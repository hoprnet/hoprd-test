#!/usr/bin/env bash
# Shape the in-process entry's (edgli's) uplink, so the entry's own link is the bottleneck the way
# a laptop's Wi-Fi or home uplink is. Used by `surb_self_congestion::shaped_uplink_should_not_stall_downstream`.
#
# The whole cluster runs on loopback, so shaping the interface would slow every node. Only packets
# whose UDP *source* port is edgli's P2P port are shaped: that is everything the entry sends (data,
# SURB keep-alives, probes) and nothing any hoprd sends.
#
#   sudo bash scripts/shape-edge-uplink.sh up <mbit> [port] [queue_kb]
#   sudo bash scripts/shape-edge-uplink.sh status
#   sudo bash scripts/shape-edge-uplink.sh down
#
#   mbit      uplink rate, Mbit/s (e.g. 8)
#   port      edgli's P2P port; default 19000 + ${HOPRD_CLUSTER_SIZE:-3}, i.e. the port the first
#             edgli of a test binary binds (`env::first_edge_p2p_port`). The scenario checks it.
#   queue_kb  bottleneck queue, KiB; default 256 — about a quarter second at 8 Mbit/s, a plausible
#             home-router buffer. A deep queue is what turns a burst into seconds of delay rather
#             than immediate loss, which is the incident's shape (tunnel ping up to 10.6 s).
#
# Linux uses tc (htb + bfifo + u32 filter on lo); macOS uses dummynet (dnctl + a pf anchor under
# com.apple/, which the stock /etc/pf.conf already references). Both need root.
#
# Writes /tmp/hopr-it-edge-uplink.env (EDGE_UPLINK_SHAPED_MBIT, EDGE_UPLINK_PORT) for the `just`
# recipe to read, and removes it on `down`.
set -euo pipefail

STATE=/tmp/hopr-it-edge-uplink.env
ANCHOR=com.apple/hopr-it-edge-uplink
PIPE=4711

die() {
  echo "shape-edge-uplink: $*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || die "needs root (sudo)"

cmd="${1:-}"
case "${cmd}" in
up)
  mbit="${2:?usage: up <mbit> [port] [queue_kb]}"
  port="${3:-$((19000 + ${HOPRD_CLUSTER_SIZE:-3}))}"
  queue_kb="${4:-256}"
  [[ "${mbit}" =~ ^[0-9]+([.][0-9]+)?$ ]] || die "mbit must be a number, got '${mbit}'"
  [[ "${port}" =~ ^[0-9]+$ ]] || die "port must be a number, got '${port}'"
  case "$(uname -s)" in
  Linux)
    command -v tc >/dev/null || die "tc not found (iproute2)"
    tc qdisc del dev lo root 2>/dev/null || true
    # HTB rather than prio: it is in every distro kernel (some minimal kernels lack sch_prio).
    # Class 1:10 is the shaped uplink with a byte-limited FIFO as the bottleneck queue; everything
    # unclassified goes to 1:20, which is effectively unlimited.
    tc qdisc add dev lo root handle 1: htb default 20
    tc class add dev lo parent 1: classid 1:10 htb rate "${mbit}mbit" ceil "${mbit}mbit" burst 32kb
    tc class add dev lo parent 1: classid 1:20 htb rate 100gbit quantum 60000
    tc qdisc add dev lo parent 1:10 handle 10: bfifo limit "${queue_kb}kb"
    tc filter add dev lo parent 1: protocol ip prio 1 u32 \
      match ip protocol 17 0xff match ip sport "${port}" 0xffff flowid 1:10
    tc filter add dev lo parent 1: protocol ipv6 prio 2 u32 \
      match ip6 protocol 17 0xff match ip6 sport "${port}" 0xffff flowid 1:10
    ;;
  Darwin)
    # dummynet queues are in packets; ~1.4 kB per HOPR packet.
    slots=$((queue_kb * 1024 / 1400))
    [ "${slots}" -ge 10 ] || slots=10
    dnctl pipe "${PIPE}" config bw "${mbit}Mbit/s" queue "${slots}"
    printf 'dummynet out quick on lo0 proto udp from any port %s to any pipe %s\n' "${port}" "${PIPE}" |
      pfctl -q -a "${ANCHOR}" -f -
    token="$(pfctl -E 2>&1 | sed -n 's/^Token : //p')"
    echo "EDGE_UPLINK_PF_TOKEN=${token}" >"${STATE}.pf"
    ;;
  *) die "unsupported OS $(uname -s)" ;;
  esac
  printf 'EDGE_UPLINK_SHAPED_MBIT=%s\nEDGE_UPLINK_PORT=%s\n' "${mbit}" "${port}" >"${STATE}"
  chmod 644 "${STATE}"
  echo "shaped udp sport ${port} to ${mbit} Mbit/s (queue ${queue_kb} KiB); state in ${STATE}"
  ;;
status)
  [ -f "${STATE}" ] && cat "${STATE}" || echo "not shaped (no ${STATE})"
  case "$(uname -s)" in
  Linux) tc -s qdisc show dev lo ;;
  Darwin)
    dnctl pipe show "${PIPE}" 2>/dev/null || true
    pfctl -a "${ANCHOR}" -s dummynet 2>/dev/null || true
    ;;
  esac
  ;;
down)
  case "$(uname -s)" in
  Linux) tc qdisc del dev lo root 2>/dev/null || true ;;
  Darwin)
    pfctl -q -a "${ANCHOR}" -F all 2>/dev/null || true
    dnctl pipe delete "${PIPE}" 2>/dev/null || true
    if [ -f "${STATE}.pf" ]; then
      # shellcheck disable=SC1090  # written by `up` above
      source "${STATE}.pf"
      if [ -n "${EDGE_UPLINK_PF_TOKEN:-}" ]; then
        pfctl -q -X "${EDGE_UPLINK_PF_TOKEN}" 2>/dev/null || true
      fi
      rm -f "${STATE}.pf"
    fi
    ;;
  esac
  rm -f "${STATE}"
  echo "uplink shaping removed"
  ;;
*)
  die "usage: $0 up <mbit> [port] [queue_kb] | status | down"
  ;;
esac
