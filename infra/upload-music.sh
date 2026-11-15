#!/usr/bin/env bash
# Upload the AI music library to .65, where nginx serves it at https://chuanho.hoandat.com/media/music/.
# The library is too big for the repo and the release, so it lives outside dist/ and deploys never touch it.
#
#   SSH_TARGET=<host alias> [SSH_OPTS="-F ssh_config"] [PRUNE=1] bash infra/upload-music.sh <library dir>
#
# <library dir> holds manifest.json and the tracks it lists (made by tools/chuanho-music in the workspace repo).
# Idempotent: rsync sends only what changed. Order: refuse when the server has less than three times the library
# size free; tracks first, manifest last (a client never sees a manifest naming a file not there yet); then the
# nginx file (same install as deploy.sh: nginx -t, previous file restored on failure). PRUNE=1 also deletes server
# tracks the manifest no longer lists (a player holding the old manifest just skips them).
set -euo pipefail

: "${SSH_TARGET:?set SSH_TARGET to the ssh host alias of .65}"
arg="${1:?usage: upload-music.sh <library dir>}"
[ -d "$arg" ] || { echo "$arg is not a directory" >&2; exit 2; }
# An absolute POSIX path: rsync would read a Windows "D:/…" path as a remote host "D".
src="$(cd "$arg" && pwd)"
read -r -a ssh_opts <<<"${SSH_OPTS:-}"
remote_dir=/var/www/chuanho
media=$remote_dir/media/music

cd "$(dirname "$0")/.."
[ -f "$src/manifest.json" ] || { echo "$src/manifest.json not found" >&2; exit 2; }

# Every file the manifest names must be here and be a plain file name.
mapfile -t files < <(grep -o '"file": *"[^"]*"' "$src/manifest.json" | sed 's/.*"\([^"]*\)"$/\1/' | tr -d '\r')
[ "${#files[@]}" -gt 0 ] || { echo "manifest lists no tracks" >&2; exit 2; }
for f in "${files[@]}"; do
	[[ "$f" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*\.(mp3|m4a|ogg|webm)$ ]] || { echo "unsafe file name in manifest: $f" >&2; exit 2; }
	[ -f "$src/$f" ] || { echo "manifest lists $f but it is not in $src" >&2; exit 2; }
done
size_kb=$(du -sk "$src" | cut -f1)
echo "library: ${#files[@]} tracks, $((size_kb / 1024)) MB"

remote() { ssh "${ssh_opts[@]}" "$SSH_TARGET" "$@" </dev/null; }

free_kb=$(remote "mkdir -p $media && df -Pk $media | awk 'NR==2 {print \$4}'" | tr -d '\r')
[[ "$free_kb" =~ ^[0-9]+$ ]] || { echo "could not read free space on the server" >&2; exit 1; }
echo "server free: $((free_kb / 1024)) MB"
if [ "$free_kb" -lt $((size_kb * 3)) ]; then
	echo "less than 3x the library size free on the server: not uploading" >&2
	exit 1
fi

rsync_opts=(-rt --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "ssh ${ssh_opts[*]}")
printf '%s\n' "${files[@]}" >"${TMPDIR:-/tmp}/chuanho-music-files.$$"
trap 'rm -f "${TMPDIR:-/tmp}/chuanho-music-files.$$"' EXIT
rsync "${rsync_opts[@]}" --files-from="${TMPDIR:-/tmp}/chuanho-music-files.$$" "$src/" "$SSH_TARGET:$media/"
rsync "${rsync_opts[@]}" "$src/manifest.json" "$SSH_TARGET:$media/manifest.json"
if [ "${PRUNE:-0}" = 1 ]; then
	rsync "${rsync_opts[@]}" --delete --delete-excluded --include-from="${TMPDIR:-/tmp}/chuanho-music-files.$$" --include=manifest.json --exclude='*' "$src/" "$SSH_TARGET:$media/"
fi

rsync -rlz -e "ssh ${ssh_opts[*]}" infra/nginx infra/install-nginx-conf.sh "$SSH_TARGET:$remote_dir/infra/"
remote "cd $remote_dir && chown -R root:root infra media && bash infra/install-nginx-conf.sh"
echo "uploaded; check: curl -sI https://chuanho.hoandat.com/media/music/manifest.json"
