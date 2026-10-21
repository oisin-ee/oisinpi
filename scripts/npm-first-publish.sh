#!/bin/sh
# First npm release of a new workspace package, run once by the npm owner.
#
# The Publish workflow uses npm trusted publishing (OIDC). npm accepts a trusted
# publisher only for a package that already exists, so a new package fails there
# with 404 until it is published once by hand and trusted. This script does both
# steps, then re-runs the Publish workflow so the packages that depend on it ship.
#
# Usage: scripts/npm-first-publish.sh <package>   e.g. pi-tiers
# It publishes origin/main's copy of packages/<package>, whatever is checked out.
# Needs: npm >= 11.15, gh logged in, an npm account with 2FA. npm prompts for
# login and one-time passwords itself; this script never reads or stores them.
set -eu

die() {
	printf 'npm-first-publish: %s\n' "$1" >&2
	exit 1
}

[ $# -eq 1 ] || die "usage: $0 <package>   (a directory name under packages/)"
cd "$(dirname "$0")/.."
git fetch -q origin main
path=packages/${1#packages/}
git cat-file -e "origin/main:$path/package.json" 2>/dev/null || die "$path/package.json is not on origin/main"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git archive origin/main "$path" | tar -x -C "$work"
dir=$work/$path
if grep -q '"workspace:' "$dir/package.json"; then
	die "$path depends on workspace: packages; npm cannot publish it directly"
fi

name=$(node -p "require('$dir/package.json').name")
version=$(node -p "require('$dir/package.json').version")
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
workflow=publish.yml

npm whoami >/dev/null 2>&1 || npm login

if npm view "$name" version >/dev/null 2>&1; then
	printf '%s already exists on npm; skipping the first publish.\n' "$name"
else
	printf 'Publishing %s@%s from origin/main for the first time.\n' "$name" "$version"
	(cd "$dir" && npm publish --access public)
fi

if npm trust list "$name" 2>/dev/null | grep -q "$workflow"; then
	printf '%s already trusts %s.\n' "$name" "$workflow"
else
	npm trust github "$name" --file "$workflow" --repository "$repo" --allow-publish --yes
fi

printf 'Re-running %s on main to publish the remaining packages.\n' "$workflow"
before=$(gh run list --workflow "$workflow" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh workflow run "$workflow" --ref main
run=$before
while [ "$run" = "$before" ]; do
	sleep 3
	run=$(gh run list --workflow "$workflow" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
done
gh run watch "$run" --exit-status

missing=
for pkg in $(git ls-tree -d --name-only origin/main packages/); do
	git cat-file -e "origin/main:$pkg/package.json" 2>/dev/null || continue
	manifest=$(git show "origin/main:$pkg/package.json")
	[ "$(printf '%s' "$manifest" | node -p 'JSON.parse(require("fs").readFileSync(0)).private === true')" = true ] && continue
	n=$(printf '%s' "$manifest" | node -p 'JSON.parse(require("fs").readFileSync(0)).name')
	v=$(printf '%s' "$manifest" | node -p 'JSON.parse(require("fs").readFileSync(0)).version')
	if [ "$(npm view "$n@$v" version 2>/dev/null)" = "$v" ]; then
		printf 'ok      %s@%s\n' "$n" "$v"
	else
		printf 'MISSING %s@%s\n' "$n" "$v"
		missing=1
	fi
done
[ -z "$missing" ] || die "some packages are not on npm"
printf 'Done.\n'
