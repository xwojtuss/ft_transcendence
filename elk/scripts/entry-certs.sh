# ^^^^^ dckr ^^^^^
# File: elk/scripts/entry-certs.sh
# Purpose: Run ONLY the certificate generation and exit. Never start Elasticsearch.

set -euo pipefail

TARGET_DIR="${1:-/certs}"

# Make sure the output dir exists and is writable by the elasticsearch user (uid 1000)
mkdir -p "$TARGET_DIR"
chown -R 1000:0 "$TARGET_DIR"
chmod 0775 "$TARGET_DIR"

# Run existing generator (repo: elk/scripts/gen-certs.sh)
# This script should create: CA + elasticsearch + kibana certs in $TARGET_DIR
/scripts/gen-certs.sh "$TARGET_DIR"

# Debug visibility: list what we generated
echo "[certs] generated files in $TARGET_DIR:"
ls -l "$TARGET_DIR" || true

echo "[certs] done."
