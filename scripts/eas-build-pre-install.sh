#!/usr/bin/env bash
set -euo pipefail

echo "Android chat models are user-managed; no GGUF model is bundled during this build."
if find android/app/src/main/assets/models -type f -name '*.gguf' -print -quit 2>/dev/null | grep -q .; then
  echo "A GGUF file exists under Android assets. Remove it before producing a production APK." >&2
  exit 1
fi
