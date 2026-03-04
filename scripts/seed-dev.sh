#!/usr/bin/env bash
# =============================================================================
# seed-dev.sh — Seed the local development database
# Usage: ./scripts/seed-dev.sh
# Requires: supabase CLI running locally (supabase start)
# =============================================================================

set -euo pipefail

echo "Seeding development database..."
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.sql
echo "Seed complete."
