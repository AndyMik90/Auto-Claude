#!/usr/bin/env bash
# Extract changelog section for a specific version from CHANGELOG.md
# Usage: extract-changelog.sh VERSION [CHANGELOG_FILE]
# Outputs the changelog content to stdout and returns 0 on success, 1 if not found

set -euo pipefail

VERSION="${1:-}"
CHANGELOG_FILE="${2:-CHANGELOG.md}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 VERSION [CHANGELOG_FILE]" >&2
  exit 1
fi

if [ ! -f "$CHANGELOG_FILE" ]; then
  echo "::warning::$CHANGELOG_FILE not found" >&2
  echo "NOT_FOUND"
  exit 1
fi

# Extract changelog section for this version
# Looks for "## X.Y.Z" header and captures until next "## " or "---" or end
# Uses escaped version to match dots literally in regex
CHANGELOG_CONTENT=$(awk -v ver="$VERSION" '
  BEGIN { 
    found=0
    content=""
    # Escape dots in version for regex matching
    ver_escaped = ver
    gsub(/\./, "\\.", ver_escaped)
  }
  /^## / {
    if (found) exit
    # Match version at start of header (e.g., "## 2.7.3 -" or "## 2.7.3")
    # Use exact match OR regex with escaped version
    if ($2 == ver || $2 ~ "^"ver_escaped"[[:space:]]*-") {
      found=1
      # Skip the header line itself, we will add our own
      next
    }
  }
  /^---$/ { if (found) exit }
  found { content = content $0 "\n" }
  END {
    if (!found) {
      print "NOT_FOUND"
      exit 1
    }
    # Trim leading/trailing whitespace
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", content)
    print content
  }
' "$CHANGELOG_FILE")

# Check if extraction succeeded
if [ "$CHANGELOG_CONTENT" = "NOT_FOUND" ] || [ -z "$CHANGELOG_CONTENT" ]; then
  echo "NOT_FOUND"
  exit 1
fi

echo "$CHANGELOG_CONTENT"
exit 0
