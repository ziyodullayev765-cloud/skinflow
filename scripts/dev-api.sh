#!/usr/bin/env bash
# Starts the API in the background with .env loaded (local dev helper).
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
exec npx tsx server/index.ts
