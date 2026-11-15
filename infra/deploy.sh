#!/usr/bin/env bash
# Build chuanho-next and publish it to .65 as the static site of chuanho.hoandat.com, by hand
# (every push to main also deploys through .github/workflows/deploy.yml).
#
#   SSH_TARGET=<host alias> [SSH_OPTS="-F ssh_config"] bash infra/deploy.sh
#
# Steps: gates + build locally; rsync infra/ (nginx file and the root scripts)
# to /var/www/chuanho/infra and the build to ci-incoming/<release-id>;
# install the nginx file when it changed (infra/install-nginx-conf.sh: nginx -t before reload, the previous
# file kept as .prev); refresh the root-owned activate command the CI user
# runs; then switch with infra/activate-incoming.sh, the same switch CI uses
# (origin check, previous build restored on failure). The previous dist/ is
# kept as dist.prev for rollback:
#   ssh <target> 'cd /var/www/chuanho && rm -rf dist && mv dist.prev dist'
set -euo pipefail

: "${SSH_TARGET:?set SSH_TARGET to the ssh host alias of .65}"
read -r -a ssh_opts <<<"${SSH_OPTS:-}"
remote_dir=/var/www/chuanho

cd "$(dirname "$0")/.."

# The release must be exactly a commit that is already on origin/main.
if [ -n "$(git status --porcelain)" ]; then
	echo "working tree is not clean: commit or stash first (git status)" >&2
	exit 1
fi
git fetch --quiet origin main
if ! git merge-base --is-ancestor HEAD origin/main; then
	echo "HEAD $(git rev-parse --short HEAD) is not on origin/main: push it first" >&2
	exit 1
fi

pnpm lint
pnpm typecheck
pnpm test
pnpm build

release_id="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
ssh "${ssh_opts[@]}" "$SSH_TARGET" "mkdir -p $remote_dir/ci-incoming/$release_id $remote_dir/infra" </dev/null
rsync -rlz --delete -e "ssh ${ssh_opts[*]}" apps/web/dist/ "$SSH_TARGET:$remote_dir/ci-incoming/$release_id/"
rsync -rlz -e "ssh ${ssh_opts[*]}" infra/nginx infra/activate-incoming.sh infra/activate-server.sh infra/chuanho-server.service infra/setup-deploy-user.sh infra/install-nginx-conf.sh "$SSH_TARGET:$remote_dir/infra/"
# The API build: dist/server/index.mjs next to drizzle/, the layout chuanho-server.service runs.
ssh "${ssh_opts[@]}" "$SSH_TARGET" "mkdir -p $remote_dir/ci-incoming/server-$release_id/dist" </dev/null
rsync -rlz --delete -e "ssh ${ssh_opts[*]}" apps/server/dist/server/ "$SSH_TARGET:$remote_dir/ci-incoming/server-$release_id/dist/server/"
rsync -rlz --delete -e "ssh ${ssh_opts[*]}" apps/server/drizzle/ "$SSH_TARGET:$remote_dir/ci-incoming/server-$release_id/drizzle/"

ssh "${ssh_opts[@]}" "$SSH_TARGET" bash -s <<EOF
set -euo pipefail
cd $remote_dir
chown -R root:root infra
install -m 755 -o root -g root infra/activate-incoming.sh /usr/local/sbin/chuanho-activate-incoming
install -m 755 -o root -g root infra/activate-server.sh /usr/local/sbin/chuanho-activate-server
bash infra/install-nginx-conf.sh
bash infra/activate-server.sh $release_id
bash infra/activate-incoming.sh $release_id
EOF
