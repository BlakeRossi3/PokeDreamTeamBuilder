#!/bin/sh
# Check the migration on a throwaway local Postgres (needs postgres installed; nothing touches the real project):
#   sh supabase/tests/run.sh
# Starts a temporary server in /tmp/dtd-pg, applies the migration twice (it must be re-runnable), then runs
# scenario.sql: usernames, versioned saves, the 1 MB cap, friends, privacy, Likes, friend battles (invites, expiry,
# results both players confirm, the daily paid-win cap), blocks and account deletion.
set -e
cd "$(dirname "$0")/../.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1); D=/tmp/dtd-pg
[ -d "$D/data" ] || { mkdir -p $D; chown postgres $D 2>/dev/null || true; su postgres -c "$BIN/initdb -D $D/data -A trust -U postgres" >/dev/null; }
su postgres -c "$BIN/pg_ctl -D $D/data -o '-p 5434 -k $D' -l $D/log start" >/dev/null 2>&1 || true
sleep 1
P="psql -h $D -p 5434 -U postgres -q"
$P -c "drop database if exists dtd" && $P -c "create database dtd"
$P -d dtd -f supabase/tests/shim.sql
for i in 1 2; do for f in supabase/migrations/*.sql; do $P -d dtd -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || { echo "FAILED: $f"; $P -d dtd -v ON_ERROR_STOP=1 -f $f; exit 1; }; done; done
echo "migrations apply (twice)"
$P -d dtd -f supabase/tests/scenario.sql
