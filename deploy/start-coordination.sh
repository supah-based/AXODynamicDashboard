#!/usr/bin/env bash
set -euo pipefail
umask 077
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy NODE_EXTRA_CA_CERTS OPENAI_API_KEY AXO_SPEECH_API_KEY AXO_BITQUERY_ACCESS_TOKEN AXO_OPENCLAW_CONFIG
export NODE_ENV=production
cd /srv/axo-streams
exec /usr/sbin/runuser -u axostreams -- /opt/node-v24.20.0-linux-x64/bin/node work/axo-coordination-server.mjs
