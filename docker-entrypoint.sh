#!/bin/sh
set -eu

# Cloud Run injects PORT automatically. Fallback keeps local container runs easy.
export PORT="${PORT:-8080}"

required_vars="DATABASE_URL JUDGE_ZERO_GCP JWT_SECRET"

for var_name in $required_vars; do
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    echo "Error: Missing required environment variable: $var_name" >&2
    exit 1
  fi
done

echo "Starting AlgoArena backend on port ${PORT}"
exec node dist/index.js
