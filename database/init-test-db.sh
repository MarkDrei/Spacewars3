#!/bin/bash
# Creates the spacewars_test database alongside the main spacewars database.
# This script runs automatically when the postgres container starts for the first time
# (any file in /docker-entrypoint-initdb.d/ is executed during initialization).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE spacewars_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'spacewars_test')\gexec
    GRANT ALL PRIVILEGES ON DATABASE spacewars_test TO $POSTGRES_USER;
EOSQL

echo "✅ spacewars_test database ready"
