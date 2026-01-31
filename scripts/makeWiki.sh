#!/bin/bash

# Variables
REPO_NAME="RealityEngine_AI"
REPO_OWNER="jateeter"
WIKI_URL="git@github.com:jateeter/RealityEngine_AI.wiki.git"
REPO_PATH="/Users/johnt/workspace/GitHub/RealityEngine_AI/" # Replace with the path to the repository with .md files
WIKI_PATH="/Users/johnt/workspace/GitHub/RealityEngine_AI/wiki" # Replace with the local path where the wiki will be cloned

# Step 1: Clone the wiki if not already cloned
if [ ! -d "$WIKI_PATH" ]; then
  echo "Cloning the wiki repository..."
  git clone "$WIKI_URL" "$WIKI_PATH"
else
  echo "Wiki repository already cloned. Pulling latest changes..."
  cd "$WIKI_PATH" && git pull origin main
fi

# Step 2: Synchronize .md files while maintaining directory structure
echo "Synchronizing .md files..."
rsync -av --include="*/" --include="*.md" --exclude="*" "$REPO_PATH/" "$WIKI_PATH/"

# Step 3: (Optional) Update Markdown links in the wiki
# Adjust relative links in the Markdown files (if necessary)
echo "Updating links in Markdown files (if applicable)..."
find "$WIKI_PATH" -type f -name "*.md" -exec sed -i 's|](docs/|](./docs/|g' {} \;

# Step 4: Commit and push to the wiki repository
cd "$WIKI_PATH"
if [ -n "$(git status --porcelain)" ]; then
  echo "Committing changes to the wiki..."
  git add .
  git commit -m "Automated injection of .md files from the main repository"
  git push origin main
else
  echo "No changes to commit."
fi

echo "All done."
