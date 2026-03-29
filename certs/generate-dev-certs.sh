#!/usr/bin/env bash
# Generates a self-signed TLS certificate for local development.
# Run from the repo root: bash certs/generate-dev-certs.sh
# Outputs: certs/server.key (private key), certs/server.crt (certificate)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Generating self-signed dev certificates..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${SCRIPT_DIR}/server.key" \
  -out    "${SCRIPT_DIR}/server.crt" \
  -subj   "/C=US/ST=Dev/L=Dev/O=RealityEngine/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "${SCRIPT_DIR}/server.key"
chmod 644 "${SCRIPT_DIR}/server.crt"

echo ""
echo "✓ certs/server.key  (private key)"
echo "✓ certs/server.crt  (certificate, valid 365 days)"
echo ""
echo "To silence browser warnings, trust the certificate:"
echo "  macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/server.crt"
echo "  Linux:   sudo cp certs/server.crt /usr/local/share/ca-certificates/reality-engine.crt && sudo update-ca-certificates"
echo "  Windows: certutil -addstore -f 'ROOT' certs\\server.crt"
