#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
python internal/tooling/scripts/validate_pack.py
