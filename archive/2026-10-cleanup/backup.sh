#!/bin/bash
set -ex

mkdir -p backups
timestamp=$(date +%Y%m%d-%H%M%S)
tar -czf backups/repo-backup-$timestamp.tar.gz --exclude=backups .
echo "✅ Backup archive created: backups/repo-backup-$timestamp.tar.gz"
