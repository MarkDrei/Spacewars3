#!/bin/bash
# Initialize test database if it doesn't exist

set -e

echo "🔍 Checking for test database..."

# Detect if we're running locally or in Docker
# Try to connect to localhost:5433 first (local db-test), then fall back to db service (Docker)
if pg_isready -h localhost -p 5433 -U spacewars -t 1 2>/dev/null; then
  # Running locally - use db-test on port 5433
  PGHOST=localhost
  PGPORT=5433
  echo "🏠 Running locally, connecting to db-test at ${PGHOST}:${PGPORT}"
else
  # Running in Docker - use db service on port 5432
  PGHOST=db
  PGPORT=5432
  echo "🐳 Running in Docker, connecting to db at ${PGHOST}:${PGPORT}"
  
  # Wait for PostgreSQL to be ready (only needed in Docker as it might be starting)
  until PGPASSWORD=spacewars psql -h ${PGHOST} -p ${PGPORT} -U spacewars -d postgres -c '\q' 2>/dev/null; do
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 1
  done
fi

# Note: For local testing, the test database is a separate container (db-test)
# For Docker testing, the test database is created within the main db service
# We don't need to check or create the database as:
# - Local: db-test container already has spacewars_test database
# - Docker: Application code creates the database automatically on first connection

echo "✅ Test database ready at ${PGHOST}:${PGPORT}"
