#!/bin/bash
# Installs the uploaded nginx file of chuanho.hoandat.com when it differs from the live one (run as root on the
# server, from /var/www/chuanho): the live file is kept as .prev, `nginx -t` checks the result, and on failure the
# previous file comes back and nothing is reloaded. Used by deploy.sh and upload-music.sh. Touches no other site.
set -euo pipefail
SRC=/var/www/chuanho/infra/nginx/chuanho.hoandat.com.conf
CONF=/etc/nginx/conf.d/chuanho.hoandat.com.conf
[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 2; }

if cmp -s "$SRC" "$CONF"; then
	echo "nginx config unchanged"
	exit 0
fi
if [ -f "$CONF" ]; then cp "$CONF" "$CONF.prev"; fi
install -m 644 -o root -g root "$SRC" "$CONF"
if ! nginx -t; then
	if [ -f "$CONF.prev" ]; then mv "$CONF.prev" "$CONF"; else rm -f "$CONF"; fi
	echo "nginx -t failed: config restored, nothing reloaded" >&2
	exit 1
fi
systemctl reload nginx
echo "nginx config installed and reloaded"
