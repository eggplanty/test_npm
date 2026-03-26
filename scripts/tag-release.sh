#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read version from npm/package.json
VERSION=$(node -p "require('${REPO_ROOT}/npm/package.json').version")

if [ -z "$VERSION" ]; then
  echo "Error: could not read version from npm/package.json" >&2
  exit 1
fi

TAG="v${VERSION}"

echo "Version: ${VERSION}"
echo "Tag: ${TAG}"

# Check if tag already exists locally
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists locally, skipping."
  exit 0
fi

# Check if tag already exists on remote
if git ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
  echo "Tag ${TAG} already exists on remote, skipping."
  exit 0
fi

# Create and push tag
git tag "$TAG"
git push origin "$TAG"

echo "Successfully created and pushed tag ${TAG}"
