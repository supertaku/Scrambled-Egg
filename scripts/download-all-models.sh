#!/bin/bash
set -e

REPO_ROOT=$(dirname "$(dirname "$0")")
BASE_DIR="$REPO_ROOT/android/app/src/main/assets/models"

declare -A REPOS
REPOS["tiny"]="larryliu0820/Qwen3-0.6B-ExecuTorch-XNNPACK"
REPOS["minimum"]="larryliu0820/Qwen3-1.7B-ExecuTorch-XNNPACK"
REPOS["flagship"]="larryliu0820/llava-v1.5-7b-IN8-INT4"

FILES=("model.pte" "tokenizer.json" "vocab.json" "merges.txt" "config.json" "generation_config.json" "tokenizer_config.json")

for tier in "${!REPOS[@]}"; do
    REPO=${REPOS[$tier]}
    TIER_DIR="$BASE_DIR/$tier"
    BASE_URL="https://huggingface.co/$REPO/resolve/main"

    echo "--- Downloading Tier: $tier ($REPO) ---"
    mkdir -p "$TIER_DIR"

    for file in "${FILES[@]}"; do
        TARGET_FILE="$TIER_DIR/$file"
        URL="$BASE_URL/$file"
        
        echo "Downloading $file..."
        if curl -L -f -H "User-Agent: haki-local-model-build" -o "$TARGET_FILE" "$URL"; then
            SIZE=$(du -h "$TARGET_FILE" | cut -f1)
            echo "Saved $file ($SIZE)"
        else
            echo "Warning: Could not download $file for $tier."
        fi
    done
done

echo "All models downloaded to $BASE_DIR"
