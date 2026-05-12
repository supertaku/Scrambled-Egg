#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf}"
OUTPUT_PATH="${2:-android/app/src/main/assets/models/haki-tiny.gguf}"

mkdir -p "$(dirname "$OUTPUT_PATH")"

echo "Downloading Tiny GGUF model"
echo "Source: $URL"
echo "Target: $OUTPUT_PATH"

if command -v curl >/dev/null 2>&1; then
  curl -L --fail --retry 3 -o "$OUTPUT_PATH" "$URL"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$OUTPUT_PATH" "$URL"
else
  echo "curl or wget is required to download the Tiny GGUF model." >&2
  exit 1
fi

du -h "$OUTPUT_PATH"
