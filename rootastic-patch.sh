#!/bin/bash
set -e  # exit immediately if a command exits with a non-zero status

# Step 1: Fetch and merge upstream changes from the master/main branch
git fetch upstream
git checkout main
git merge upstream/main

# Step 2: Apply the custom patch
if git apply --check myCustom.patch; then
    git apply myCustom.patch
    echo "Custom patch applied successfully."
else
    echo "Error: Patch did not apply cleanly. Please resolve conflicts manually."
    exit 1
fi