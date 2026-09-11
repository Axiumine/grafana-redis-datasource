#!/usr/bin/env bash
# Copyright 2026 Axiumine
#
# Added in the Axiumine fork of RedisGrafana/grafana-redis-datasource.
# Licensed under the Apache License, Version 2.0. See LICENSE.

# Builds, signs and packages a release artifact for one of this fork's own tags,
# reproducing what .github/workflows/main.yml does, from the tag's own tree.
#
#   tools/package-tag.sh                 every fork-authored tag
#   tools/package-tag.sh v2.3.0 v3.0.0   the named tags
#
# A tag is fork-authored when it has no counterpart under refs/upstream-tags/,
# which is where `git fetch upstream` mirrors RedisGrafana's tags. The inherited
# tags v1.0.0 to v2.2.1 point at upstream's own commits and are never packaged
# here: publishing them would ship upstream's build under our name.
#
# Signing needs GRAFANA_ACCESS_POLICY_TOKEN. The script reads it from the
# untracked .env and never prints it. Without it the build still runs and the
# artifact is produced unsigned, which Grafana 12 refuses to load unless
# allow_loading_unsigned_plugins names the plugin.
#
# Nothing is pushed and no release is created. The artifacts land in artifacts/,
# which is gitignored, for local testing.

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"

OUT_DIR="$REPO_ROOT/artifacts"
WORK_ROOT="${TMPDIR:-/tmp}/package-tag.$$"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

say() { printf '\n==> %s\n' "$1"; }
die() { printf '\nERROR: %s\n\n' "$1" >&2; exit 1; }

# Pick a Node version through nvm. Tags before the @grafana/create-plugin
# migration build with @grafana/toolkit 8.3.4, whose dependency tree refuses to
# install on anything past Node 17, so they need Node 16 even though current
# main needs 22 or newer.
use_node() {
  local want=$1
  # shellcheck disable=SC1091
  [ -s "$HOME/.nvm/nvm.sh" ] || die "nvm not found; it is needed to build tags that predate the create-plugin migration."
  . "$HOME/.nvm/nvm.sh"
  nvm use "$want" >/dev/null || die "nvm has no Node $want installed. Run: nvm install $want"
  command -v yarn >/dev/null 2>&1 || npm install -g yarn@1.22.22 >/dev/null 2>&1
}

# zip(1) is not installed everywhere. The fallback preserves the executable bit
# on the Go binaries, which a naive zipfile write would drop and which Grafana
# needs in order to start the backend.
make_zip() {
  local zip_path=$1 dir_name=$2
  if command -v zip >/dev/null 2>&1; then
    zip -qr "$zip_path" "$dir_name"
  else
    python3 - "$zip_path" "$dir_name" <<'PY'
import os, stat, sys, zipfile
zip_path, root = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(root):
        for name in sorted(files):
            path = os.path.join(base, name)
            info = zipfile.ZipInfo.from_file(path, path)
            info.external_attr = (stat.S_IMODE(os.stat(path).st_mode) & 0xFFFF) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(path, "rb") as fh:
                z.writestr(info, fh.read())
PY
  fi
}

fork_tags() {
  local tag
  git for-each-ref --format='%(refname:short)' refs/tags | while read -r tag; do
    git rev-parse -q --verify "refs/upstream-tags/$tag" >/dev/null || echo "$tag"
  done
}

package_tag() {
  local tag=$1
  local work="$WORK_ROOT/$tag"

  git rev-parse -q --verify "refs/tags/$tag" >/dev/null || die "No such tag: $tag"
  [ "$(git cat-file -t "refs/tags/$tag")" = "tag" ] || die "$tag is not an annotated tag."
  if git rev-parse -q --verify "refs/upstream-tags/$tag" >/dev/null; then
    die "$tag is an inherited upstream tag. Fork releases are cut only from our own tags."
  fi

  say "Packaging $tag"
  rm -rf "$work"
  git worktree add --detach "$work" "$tag" >/dev/null

  # The worktree is removed whatever happens next, including a failed build: a
  # stray registered worktree outlives the run and confuses every later
  # `git worktree list`.
  cleanup_worktree() { git worktree remove --force "$work" >/dev/null 2>&1 || true; }

  local version
  version=$(node -p "require('$work/package.json').version")
  if [ "v$version" != "$tag" ]; then
    cleanup_worktree
    die "$tag builds package.json version $version; they must match."
  fi

  local node_version
  if [ -d "$work/.config" ]; then
    node_version=$(cat "$work/.nvmrc" 2>/dev/null || echo 24)
  else
    say "$tag predates the create-plugin migration; building the frontend on Node 16."
    node_version=16
  fi

  (
    cd "$work"
    use_node "$node_version"
    say "Frontend"
    yarn install --frozen-lockfile
    yarn build

    say "Backend"
    mage -v buildAll

    say "Signing"
    if [ -n "${GRAFANA_ACCESS_POLICY_TOKEN:-}" ]; then
      # Signing runs on current Node regardless of the tag's own era: the
      # signer only reads dist/, so it is not bound to the build toolchain.
      use_node 24
      npx --yes @grafana/sign-plugin@latest
      [ -f dist/MANIFEST.txt ] || die "Signing reported success but wrote no dist/MANIFEST.txt."
      say "Signed: dist/MANIFEST.txt present"
    else
      echo "GRAFANA_ACCESS_POLICY_TOKEN is not set — producing an UNSIGNED artifact."
      echo "Grafana 12 will refuse to load it unless grafana.ini sets:"
      echo "  allow_loading_unsigned_plugins = redis-datasource"
    fi

    say "Packaging"
    mv dist redis-datasource
    make_zip "redis-datasource-$version.zip" redis-datasource
    md5sum "redis-datasource-$version.zip" > "redis-datasource-$version.zip.md5"

    mkdir -p "$OUT_DIR"
    mv "redis-datasource-$version.zip" "redis-datasource-$version.zip.md5" "$OUT_DIR/"
  ) || { cleanup_worktree; die "Build failed for $tag."; }

  cleanup_worktree
  ls -l "$OUT_DIR/redis-datasource-$version.zip" "$OUT_DIR/redis-datasource-$version.zip.md5"
}

TAGS=("$@")
if [ ${#TAGS[@]} -eq 0 ]; then
  mapfile -t TAGS < <(fork_tags)
  [ ${#TAGS[@]} -gt 0 ] || die "No fork-authored tags found."
  say "Fork-authored tags: ${TAGS[*]}"
fi

for tag in "${TAGS[@]}"; do
  package_tag "$tag"
done

rm -rf "$WORK_ROOT"

say "Done. Artifacts are in artifacts/ and nothing was pushed."
