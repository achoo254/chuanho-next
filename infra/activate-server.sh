#!/bin/bash
# Switches the Chùa Nhỏ API to an uploaded server build. Root-owned; installed as
# /usr/local/sbin/chuanho-activate-server by setup-deploy-user.sh (and refreshed by every manual
# deploy.sh); the second (and last) command the CI user `chuanho-deploy` may run through sudo.
#   chuanho-activate-server <release-id>
# The build waits in /var/www/chuanho/ci-incoming/server-<id> (writable by the deploy user) and
# holds dist/server/index.mjs plus drizzle/ (the migrations the bundle runs at start). It is moved
# out of the deploy user's reach before any check, must hold only plain files and directories,
# then replaces /var/www/chuanho/server (the previous one kept as server.prev). The service is
# restarted and /healthz on loopback must answer; on failure the previous build comes back.
# Until the service is installed on the host (docs/deployment-guide.md, "Lần đầu bật server") the
# script only reports that and exits 0, so CI can ship the web build before the API exists.
set -euo pipefail
ROOT=/var/www/chuanho
UNIT=chuanho-server
ID="${1:?usage: chuanho-activate-server <release-id>}"
[[ "$ID" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{12}$ ]] || { echo "bad release id" >&2; exit 2; }

SRC="$ROOT/ci-incoming/server-$ID"
[ -d "$SRC" ] && [ ! -L "$SRC" ] || { echo "incoming server release $ID missing" >&2; exit 2; }

if [ ! -f "/etc/systemd/system/$UNIT.service" ]; then
	rm -rf "${SRC:?}"
	echo "chuanho-server is not installed on this host: server build $ID skipped"
	exit 0
fi

# One activation at a time (shared with the web switch so a restart never overlaps a site switch).
exec 9>/run/chuanho-activate.lock
flock -w 600 9 || { echo "another activation still holds /run/chuanho-activate.lock" >&2; exit 1; }

STAGE="$ROOT/staging"
install -d -m 700 -o root -g root "$STAGE"
rm -rf "${STAGE:?}/server-$ID"
mv "$SRC" "$STAGE/server-$ID"
chown -R root:root "$STAGE/server-$ID"
if [ -n "$(find "$STAGE/server-$ID" ! -type f ! -type d -print -quit)" ] || [ ! -f "$STAGE/server-$ID/dist/server/index.mjs" ] || [ ! -d "$STAGE/server-$ID/drizzle" ]; then
	rm -rf "${STAGE:?}/server-$ID"
	echo "incoming server release $ID has links, special files or misses dist/server/index.mjs or drizzle/" >&2
	exit 2
fi
find "$STAGE/server-$ID" -type d -exec chmod 755 {} +
find "$STAGE/server-$ID" -type f -exec chmod 644 {} +
printf '%s\n' "$ID" >"$STAGE/server-$ID/RELEASE"

cd "$ROOT"
rm -rf server.prev
if [ -d server ]; then mv server server.prev; fi
mv "$STAGE/server-$ID" server

healthy() {
	local body=""
	for _ in 1 2 3 4 5 6 7 8 9 10; do
		body="$(curl -s --max-time 3 http://127.0.0.1:5330/healthz || true)"
		[ "$body" = ok ] && return 0
		sleep 1
	done
	echo "http://127.0.0.1:5330/healthz -> '${body}'" >&2
	return 1
}

systemctl restart "$UNIT"
if ! healthy; then
	if [ -d server.prev ]; then
		rm -rf server
		mv server.prev server
		systemctl restart "$UNIT" || true
		echo "server build $ID failed its health check: previous build restored" >&2
	fi
	exit 1
fi
echo "chuanho-server now runs $ID"
