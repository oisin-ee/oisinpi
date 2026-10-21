#!/bin/sh
# First npm release of a new workspace package, run once by the npm owner.
#
# The Publish workflow uses npm trusted publishing (OIDC). npm accepts a trusted
# publisher only for a package that already exists, so a new package fails there
# with 404 until it is published once by hand and trusted. This script does both
# steps, then re-runs the Publish workflow so the packages that depend on it ship.
#
# Usage: scripts/npm-first-publish.sh <package-dir>   e.g. packages/pi-tiers
# Needs: npm >= 11.15, gh logged in, an npm account with 2FA. npm prompts for
# login and one-time passwords itself; this script never reads or stores them.
set -eu

die() {
	printf 'npm-first-publish: %s\n' "$1" >&2
	exit 1
}

[ $# -eq 1 ] || die "usage: $0 <package-dir>"
root=$(git rev-parse --show-toplevel)
dir=$root/$1
[ -f "$dir/package.json" ] || die "$1 has no package.json"
cd "$root"

name=$(node -p "require('$dir/package.json').name")
version=$(node -p "require('$dir/package.json').version")
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
workflow=publish.yml

[ "$(git branch --show-current)" = main ] || die "run from main"
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "local main is not origin/main; pull first"
[ -z "$(git status --porcelain)" ] || die "working tree is not clean"

if npm view "$name" version >/dev/null 2>&1; then
	printf '%s already exists on npm; skipping the first publish.\n' "$name"
else
	npm whoami >/dev/null 2>&1 || npm login
	printf 'Publishing %s@%s for the first time.\n' "$name" "$version"
	(cd "$dir" && npm publish --access public)
fi

if npm trust list "$name" 2>/dev/null | grep -q "$workflow"; then
	printf '%s already trusts %s.\n' "$name" "$workflow"
else
	npm whoami >/dev/null 2>&1 || npm login
	npm trust github "$name" --file "$workflow" --repository "$repo" --allow-publish --yes
fi

printf 'Re-running %s on main to publish the remaining packages.\n' "$workflow"
gh workflow run "$workflow" --ref main
sleep 5
run=$(gh run list --workflow "$workflow" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$run" --exit-status

for pkg in packages/*/package.json; do
	n=$(node -p "require('./$pkg').name")
	p=$(node -p "require('./$pkg').private === true")
	[ "$p" = true ] && continue
	v=$(node -p "require('./$pkg').version")
	if [ "$(npm view "$n@$v" version 2>/dev/null)" = "$v" ]; then
		printf 'ok      %s@%s\n' "$n" "$v"
	else
		printf 'MISSING %s@%s\n' "$n" "$v"
		missing=1
	fi
done
[ -z "${missing:-}" ] || die "some packages are not on npm"
printf 'Done.\n'
