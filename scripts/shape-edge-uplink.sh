#!/usr/bin/env bash
# Shape the in-process entry's (edgli's) uplink, so the entry's own link is the bottleneck the way
# a laptop's Wi-Fi or home uplink is. The SURB packets the entry sends then compete with its data
# for that uplink, which is what the incident of 2026-09-24 looked like. Used by the two shaped
# `surb_self_congestion` scenarios (`shaped_uplink_should_not_stall_downstream`,
# `shaped_outage_should_not_loop`); they run 5 nodes, so pass port 19005.
#
# The whole cluster runs on loopback, so shaping the interface would slow every node. Only packets
# whose UDP *source* port is one of edgli's P2P ports are shaped: that is everything the entry sends
# (data, SURB keep-alives, probes) and nothing any hoprd sends. A test binary takes a new port for
# every edgli it boots (`env::edge_p2p_port`), so a range of ports is shaped, starting at the first;
# all of them share one limited link, which is fine because a test runs one entry at a time.
#
#   sudo bash scripts/shape-edge-uplink.sh up <mbit> [port] [queue_kb] [ports]
#        bash scripts/shape-edge-uplink.sh selftest     # check the shaper actually shapes
#   sudo bash scripts/shape-edge-uplink.sh status
#   sudo bash scripts/shape-edge-uplink.sh down
#
#   mbit      uplink rate, Mbit/s (e.g. 8)
#   port      edgli's first P2P port; default 19000 + ${HOPRD_CLUSTER_SIZE:-3}, i.e. the port the
#             first edgli of a test binary binds (`env::first_edge_p2p_port`). The scenario checks it.
#   ports     how many ports from `port` on to shape, default 16: one per edgli the test binary
#             boots. The scenarios check that each entry they measure is inside the range.
#   queue_kb  bottleneck queue, KiB; default 256 — about a quarter second at 8 Mbit/s, a plausible
#             home-router buffer. A deep queue is what turns a burst into seconds of delay rather
#             than immediate loss, which is the incident's shape (tunnel ping up to 10.6 s).
#
# Linux: tc (htb + bfifo + u32 filter on lo). macOS: dummynet (dnctl + a pf rule in the
# `com.apple/hopr-it-edge-uplink` anchor, which the stock /etc/pf.conf wires in through
# `dummynet-anchor "com.apple/*"`). Both need root; `selftest` does not.
#
# Runs under macOS's bash 3.2 as well as bash 5. Writes /tmp/hopr-it-edge-uplink.env
# (EDGE_UPLINK_SHAPED_MBIT, EDGE_UPLINK_PORT, EDGE_UPLINK_PORT_LAST) for the `just` recipe to read;
# `down` removes it.
set -euo pipefail

STATE=/tmp/hopr-it-edge-uplink.env
ANCHOR=com.apple/hopr-it-edge-uplink
PIPE=4711
OS="$(uname -s)"

die() {
  echo "shape-edge-uplink: $*" >&2
  exit 1
}

need_root() {
  [ "$(id -u)" -eq 0 ] || die "'$1' needs root (sudo)"
}

need() {
  command -v "$1" >/dev/null || die "$1 not found${2:+ ($2)}"
}

# Release the pf enable-token a previous `up` took, if any (macOS only).
release_pf_token() {
  [ -f "${STATE}.pf" ] || return 0
  # shellcheck disable=SC1090  # written by `up` below
  source "${STATE}.pf"
  if [ -n "${EDGE_UPLINK_PF_TOKEN:-}" ]; then
    pfctl -q -X "${EDGE_UPLINK_PF_TOKEN}" 2>/dev/null || true
  fi
  rm -f "${STATE}.pf"
}

up_linux() {
  local mbit="$1" port="$2" queue_kb="$3" last="$4" p
  need tc "iproute2"
  tc qdisc del dev lo root 2>/dev/null || true
  # HTB rather than prio: it is in every distro kernel (some minimal kernels lack sch_prio).
  # Class 1:10 is the shaped uplink with a byte-limited FIFO as the bottleneck queue; everything
  # unclassified goes to 1:20, which is effectively unlimited.
  tc qdisc add dev lo root handle 1: htb default 20 ||
    die "could not add an htb qdisc on lo (is sch_htb available?)"
  tc class add dev lo parent 1: classid 1:10 htb rate "${mbit}mbit" ceil "${mbit}mbit" burst 32kb
  tc class add dev lo parent 1: classid 1:20 htb rate 100gbit quantum 60000
  tc qdisc add dev lo parent 1:10 handle 10: bfifo limit "${queue_kb}kb"
  # u32 matches one port per filter, so add one per port in the range.
  for ((p = port; p <= last; p++)); do
    tc filter add dev lo parent 1: protocol ip prio 1 u32 \
      match ip protocol 17 0xff match ip sport "${p}" 0xffff flowid 1:10
    tc filter add dev lo parent 1: protocol ipv6 prio 2 u32 \
      match ip6 protocol 17 0xff match ip6 sport "${p}" 0xffff flowid 1:10
  done
}

up_darwin() {
  local mbit="$1" port="$2" queue_kb="$3" last="$4" slots token
  need dnctl
  need pfctl
  # The rule lives in a com.apple/ sub-anchor, which only takes effect if the main ruleset
  # references it. The stock /etc/pf.conf does; a customised one may not.
  grep -q 'dummynet-anchor "com.apple/\*"' /etc/pf.conf ||
    die '/etc/pf.conf has no dummynet-anchor "com.apple/*" line, so the shaping rule would never be evaluated'
  release_pf_token
  # Prefer a queue sized in bytes, like the Linux bfifo. Some dnctl builds accept only packet slots,
  # and only 2..100 of them, so fall back to that (~1.4 kB per HOPR packet), clamped.
  if ! dnctl pipe "${PIPE}" config bw "${mbit}Mbit/s" queue "${queue_kb}Kbytes" 2>/dev/null; then
    slots=$((queue_kb * 1024 / 1400))
    if [ "${slots}" -gt 100 ]; then
      echo "dnctl caps the queue at 100 packets (~140 KiB); using that instead of ${queue_kb} KiB" >&2
      slots=100
    fi
    [ "${slots}" -ge 2 ] || slots=2
    dnctl pipe "${PIPE}" config bw "${mbit}Mbit/s" queue "${slots}" ||
      die "dnctl rejected the pipe configuration"
  fi
  # Load the stock main ruleset so the com.apple/* anchors are wired in even if pf was never
  # configured on this Mac. It is the file the system loads anyway, so nothing else changes.
  pfctl -q -f /etc/pf.conf 2>/dev/null || die "pfctl could not load /etc/pf.conf"
  # pf's `a:b` port range includes both ends.
  printf 'dummynet out quick on lo0 proto udp from any port %s:%s to any pipe %s\n' \
    "${port}" "${last}" "${PIPE}" |
    pfctl -q -a "${ANCHOR}" -f - || die "pfctl rejected the dummynet rule"
  token="$(pfctl -E 2>&1 | sed -n 's/^Token : //p')"
  echo "EDGE_UPLINK_PF_TOKEN=${token}" >"${STATE}.pf"
  pfctl -a "${ANCHOR}" -s dummynet 2>/dev/null | grep -q "pipe ${PIPE}" ||
    die "the dummynet rule is not loaded in ${ANCHOR}"
}

down_darwin() {
  pfctl -q -a "${ANCHOR}" -F all 2>/dev/null || true
  # dnctl's delete syntax differs between macOS releases; try both spellings.
  dnctl pipe "${PIPE}" delete 2>/dev/null || dnctl delete pipe "${PIPE}" 2>/dev/null || true
  release_pf_token
}

# Send UDP from the shaped port and from an unshaped one for a few seconds each and report what
# arrived. Needs python3 (preinstalled on Linux distros; on macOS with the Xcode command line tools).
selftest() {
  [ -f "${STATE}" ] || die "not shaped — run 'up' first"
  # shellcheck disable=SC1090
  source "${STATE}"
  need python3
  python3 - "${EDGE_UPLINK_SHAPED_MBIT}" "${EDGE_UPLINK_PORT}" "${EDGE_UPLINK_PORT_LAST:-${EDGE_UPLINK_PORT}}" <<'PY'
import socket, sys, threading, time

mbit, port, last = float(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])

def run(sport, dport, secs=3.0, offer_mbit=None):
    rx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    rx.bind(("127.0.0.1", dport))
    rx.settimeout(0.3)
    got, stop = [0], [False]

    def reader():
        while not stop[0]:
            try:
                got[0] += len(rx.recv(2048))
            except socket.timeout:
                pass

    t = threading.Thread(target=reader)
    t.start()
    tx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    tx.bind(("127.0.0.1", sport))
    buf, sent, t0 = b"x" * 1400, 0, time.time()
    while time.time() - t0 < secs:
        try:
            tx.sendto(buf, ("127.0.0.1", dport))
            sent += len(buf)
        except OSError:  # macOS: ENOBUFS when the pipe's queue is full
            time.sleep(0.001)
        if offer_mbit and sent * 8 / 1e6 > offer_mbit * (time.time() - t0):
            time.sleep(0.001)
    time.sleep(1.0)
    stop[0] = True
    t.join()
    for s in (rx, tx):
        s.close()
    return sent * 8 / secs / 1e6, got[0] * 8 / secs / 1e6

offer = 4 * mbit
s_off, s_got = run(port, port + 10000, offer_mbit=offer)
l_off, l_got = run(last, last + 10000, offer_mbit=offer)
u_off, u_got = run(last + 1, last + 10001, offer_mbit=offer)
print(f"shaped   sport {port}: offered {s_off:6.1f} Mbit/s, delivered {s_got:6.1f} Mbit/s (limit {mbit:g})")
print(f"shaped   sport {last}: offered {l_off:6.1f} Mbit/s, delivered {l_got:6.1f} Mbit/s (limit {mbit:g})")
print(f"unshaped sport {last + 1}: offered {u_off:6.1f} Mbit/s, delivered {u_got:6.1f} Mbit/s")
ok = s_got <= 1.3 * mbit and l_got <= 1.3 * mbit and u_got >= 2 * mbit
print("selftest: " + ("PASS" if ok else "FAIL — the shaper is not limiting only the entry's port"))
sys.exit(0 if ok else 1)
PY
}

cmd="${1:-}"
case "${cmd}" in
up)
  need_root up
  mbit="${2:?usage: up <mbit> [port] [queue_kb] [ports]}"
  port="${3:-$((19000 + ${HOPRD_CLUSTER_SIZE:-3}))}"
  queue_kb="${4:-256}"
  ports="${5:-16}"
  [[ "${mbit}" =~ ^[0-9]+([.][0-9]+)?$ ]] || die "mbit must be a number, got '${mbit}'"
  [[ "${port}" =~ ^[0-9]+$ ]] || die "port must be a number, got '${port}'"
  [[ "${queue_kb}" =~ ^[0-9]+$ ]] || die "queue_kb must be a number, got '${queue_kb}'"
  [[ "${ports}" =~ ^[0-9]+$ ]] && [ "${ports}" -ge 1 ] && [ "${ports}" -le 64 ] ||
    die "ports must be a number from 1 to 64, got '${ports}'"
  last=$((port + ports - 1))
  case "${OS}" in
  Linux) up_linux "${mbit}" "${port}" "${queue_kb}" "${last}" ;;
  Darwin) up_darwin "${mbit}" "${port}" "${queue_kb}" "${last}" ;;
  *) die "unsupported OS ${OS}" ;;
  esac
  printf 'EDGE_UPLINK_SHAPED_MBIT=%s\nEDGE_UPLINK_PORT=%s\nEDGE_UPLINK_PORT_LAST=%s\n' \
    "${mbit}" "${port}" "${last}" >"${STATE}"
  chmod 644 "${STATE}"
  echo "shaped udp sport ${port}-${last} to ${mbit} Mbit/s (queue ${queue_kb} KiB); state in ${STATE}"
  echo "check it with: bash $0 selftest"
  ;;
selftest)
  selftest
  ;;
status)
  need_root status
  if [ -f "${STATE}" ]; then cat "${STATE}"; else echo "not shaped (no ${STATE})"; fi
  case "${OS}" in
  Linux) tc -s qdisc show dev lo ;;
  Darwin)
    dnctl show 2>/dev/null || true
    pfctl -a "${ANCHOR}" -s dummynet 2>/dev/null || true
    ;;
  esac
  ;;
down)
  need_root down
  case "${OS}" in
  Linux) tc qdisc del dev lo root 2>/dev/null || true ;;
  Darwin) down_darwin ;;
  esac
  rm -f "${STATE}"
  echo "uplink shaping removed"
  ;;
*)
  die "usage: $0 up <mbit> [port] [queue_kb] [ports] | selftest | status | down"
  ;;
esac
