#!/usr/bin/env bash
set -euo pipefail

test_dir=$(mktemp -d /private/tmp/replay-upsert.XXXXXX)
test_port=$((55000 + RANDOM % 5000))

cleanup() {
  if [[ -f "$test_dir/data/postmaster.pid" ]]; then
    pg_ctl -D "$test_dir/data" stop -m immediate >/dev/null
  fi
}
trap cleanup EXIT

initdb -D "$test_dir/data" -A trust --no-instructions >/dev/null
pg_ctl -D "$test_dir/data" -o "-k $test_dir -p $test_port" \
  -l "$test_dir/server.log" start >/dev/null
psql -h "$test_dir" -p "$test_port" -d postgres \
  -v ON_ERROR_STOP=1 -f tests/integration/upsert.sql
