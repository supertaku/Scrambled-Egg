#!/bin/bash
set -e

REPO_ROOT=$(dirname "$(dirname "$0")")
TARGET_DIR="$REPO_ROOT/android/app/libs"
TARGET_FILE="$TARGET_DIR/executorch.aar"
URL="https://ossci-android.s3.amazonaws.com/executorch/release/1.0.0-xnnpack/executorch.aar"

echo "Downloading ExecuTorch Android AAR"
mkdir -p "$TARGET_DIR"

curl -L -f -o "$TARGET_FILE" "$URL"
echo "Downloaded executorch.aar"
