#!/usr/bin/env bash
# Idempotent environment preflight for the integration test. Verifies the host
# can run the stack and makes the chain image available. Safe to run repeatedly;
# usable both as a CI step and as a local "doctor".
#
# Usage:  preflight.sh <bloklid-anvil-image-ref>
#
# Env:
#   HOPRD_CONTAINER_RUNTIME  container CLI to check (default: docker)
#   GCP_AR_HOST              registry host for the auth fallback
#                            (default: europe-west3-docker.pkg.dev)
set -euo pipefail

IMAGE="${1:?usage: preflight.sh <bloklid-anvil-image-ref>}"
RUNTIME="${HOPRD_CONTAINER_RUNTIME:-docker}"
GCP_AR_HOST="${GCP_AR_HOST:-europe-west3-docker.pkg.dev}"

fail() { echo "preflight: $*" >&2; exit 1; }

echo "preflight: container runtime = ${RUNTIME}"
command -v "${RUNTIME}" >/dev/null || fail "'${RUNTIME}' not found on PATH. Install it, or set HOPRD_CONTAINER_RUNTIME."

# Daemon reachable? (Apple `container`/podman have no `info` parity — `version` suffices.)
if [ "${RUNTIME}" = "docker" ]; then
  docker info >/dev/null 2>&1 || fail "docker daemon not reachable. Start Docker / OrbStack (local) or check the runner's docker service."
else
  "${RUNTIME}" --version >/dev/null 2>&1 || fail "'${RUNTIME}' is installed but not responding."
fi

command -v nix >/dev/null || fail "nix not found. Needed to build hoprd + hoprd-localcluster."

# The chain image is amd64-only and localcluster runs it with --platform
# linux/amd64; pull the same so arm64 hosts (e.g. Apple silicon) emulate it
# instead of failing on a missing arm manifest.
PLATFORM_ARGS=()
case "${RUNTIME}" in
  docker | podman) PLATFORM_ARGS=(--platform linux/amd64) ;;
esac

# Pull the chain image. Capture output so an auth failure can be distinguished
# from other errors (manifest/network) — only the former warrants a gcloud retry.
echo "preflight: ensuring chain image ${IMAGE} ..."
pull_out=""
if ! pull_out="$("${RUNTIME}" pull "${PLATFORM_ARGS[@]}" "${IMAGE}" 2>&1)"; then
  echo "${pull_out}" >&2
  if grep -qiE "unauthor|denied|forbidden|authentication" <<<"${pull_out}" && command -v gcloud >/dev/null; then
    echo "preflight: auth failure — configuring gcloud docker credentials for ${GCP_AR_HOST} ..."
    gcloud auth configure-docker --quiet "${GCP_AR_HOST}"
    "${RUNTIME}" pull "${PLATFORM_ARGS[@]}" "${IMAGE}" || fail "still cannot pull ${IMAGE} after gcloud auth."
  else
    fail "cannot pull ${IMAGE}. If this is an auth error, authenticate to ${GCP_AR_HOST} (CI: docker/login-action; local: \`gcloud auth configure-docker ${GCP_AR_HOST}\`)."
  fi
fi

# A leftover chain container from a crashed/prior run still holds port 8080 and
# collides with the one localcluster starts — blokli's /readyz then never comes
# up. Refuse to proceed rather than fail obscurely mid-bring-up.
running="$("${RUNTIME}" ps -q --filter "ancestor=${IMAGE}" 2>/dev/null || true)"
if [ -n "${running}" ]; then
  fail "a container from ${IMAGE} is already running (holds port 8080). Stop it — \`${RUNTIME} rm -f ${running}\` or \`just clean\` — then retry."
fi

echo "preflight: OK — runtime up, nix present, chain image ready, no stale container."
