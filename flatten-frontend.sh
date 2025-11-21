#!/bin/bash
# flatten-frontend.sh
# Safely locate the deepest static asset folders and move them to project root.

set -e  # stop if any command fails

# Make a timestamped backup before modifying anything
timestamp=$(date +%Y%m%d-%H%M%S)
mkdir -p backups_cleanup
tar -czf backups_cleanup/backup-$timestamp.tar.gz server || true

echo "🔍 Searching for deepest 'styles', 'themes', 'images', and 'js' folders..."

for dir in styles themes images js; do
    echo ""
    echo "=== Checking for $dir ==="
    target=$(find . -type d -name "$dir" | awk '{ print length, $0 }' | sort -n | tail -1 | cut -d" " -f2-)
    if [ -n "$target" ]; then
        echo "Found deepest $dir folder at: $target"
        if [ ! -d "./$dir" ]; then
            mkdir "./$dir"
        fi
        echo "📦 Moving contents of $target → ./$dir"
        rsync -av "$target/" "./$dir/" --remove-source-files
    else
        echo "⚠️  No folder named '$dir' found."
    fi
done

echo ""
echo "🧹 Cleaning empty directories..."
find server -type d -empty -delete || true

echo ""
echo "✅ Flatten complete. Verify your root now contains:"
echo "   styles/, themes/, images/, js/"