#!/bin/bash
# Initialize test database if it doesn't exist

set -e

echo "🔍 Checking for test database..."

# Wait for PostgreSQL to be ready
until PGPASSWORD=spacewars psql -h db -U spacewars -d spacewars -c '\q' 2>/dev/null; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 1
done

# Check if test database exists
if PGPASSWORD=spacewars psql -h db -U spacewars -d spacewars -lqt | cut -d \| -f 1 | grep -qw spacewars_test; then
  echo "✅ Test database 'spacewars_test' already exists"
else
  echo "📦 Creating test database 'spacewars_test'..."
  PGPASSWORD=spacewars psql -h db -U spacewars -d spacewars -c "CREATE DATABASE spacewars_test;"
  echo "✅ Test database 'spacewars_test' created successfully"
fi
