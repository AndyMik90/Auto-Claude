#!/bin/bash
# Pre-build script for macOS to work around EPERM copyfile issues
# Uses ditto to copy site-packages before electron-builder runs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"

# Determine architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
  RUNTIME_ARCH="mac-x64"
elif [ "$ARCH" = "arm64" ]; then
  RUNTIME_ARCH="mac-arm64"
else
  echo "Unknown architecture: $ARCH"
  exit 1
fi

SRC_DIR="$FRONTEND_DIR/python-runtime/$RUNTIME_ARCH/site-packages"
DEST_DIR="$FRONTEND_DIR/dist/$RUNTIME_ARCH/Auto-Claude.app/Contents/Resources/python-site-packages"

if [ -d "$SRC_DIR" ]; then
  echo "[prebuild-mac] Pre-copying site-packages with ditto..."
  rm -rf "$FRONTEND_DIR/dist"
  mkdir -p "$(dirname "$DEST_DIR")"
  ditto "$SRC_DIR" "$DEST_DIR"
  echo "[prebuild-mac] Done"
else
  echo "[prebuild-mac] No site-packages at $SRC_DIR, skipping pre-copy"
fi
