#!/bin/bash
# ---
# Database Inspection and Management Script for Spacewars3
# ---
#
# This script provides convenient commands for inspecting and managing
# the PostgreSQL test database. It's particularly useful during development
# and debugging to quickly check database state without writing SQL queries.
#
# Usage:
#   ./scripts/db-inspect.sh <command>
#
# Commands:
#   users    - Display all users with their basic info (id, username, iron, ship_id)
#   battles  - Display all battles with their status
#   messages - Display all messages
#   objects  - Display all space objects (asteroids, shipwrecks, escape pods)
#   count    - Count rows in all tables (quick overview of database state)
#   schema   - Show table structures (\d command for each table)
#   clear    - Clear all data from the database (TRUNCATE with CASCADE)
#   drop     - Drop all tables completely (removes table structure)
#   seed     - Reseed the database with default test data
#   connect  - Open an interactive psql session to the test database
#
# Examples:
#   ./scripts/db-inspect.sh count     # See how many rows in each table
#   ./scripts/db-inspect.sh users     # List all users
#   ./scripts/db-inspect.sh clear     # Clear database
#   ./scripts/db-inspect.sh seed      # Reseed with default data
#   ./scripts/db-inspect.sh connect   # Interactive SQL session
#
# Database Configuration:
#   By default, this script connects to the test database using these settings:
#   - Host: db (Docker Compose service name)
#   - Port: 5432
#   - Database: spacewars_test
#   - User: spacewars
#   - Password: spacewars
#
# Note: This script is intended for the test database only. To inspect the
# production database, modify the database name in the connection string.
# ---

set -e

# Database connection settings
DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_TEST_DB:-spacewars_test}"
DB_USER="${POSTGRES_USER:-spacewars}"
DB_PASSWORD="${POSTGRES_PASSWORD:-spacewars}"

# Helper function to execute a SQL query
query() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Helper function to execute a psql meta-command
meta() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Main command handling
case "$1" in
  users)
    echo "📊 Users in test database:"
    query "SELECT id, username, iron, ship_id, 
           pulse_laser, auto_turret, ship_hull, kinetic_armor, energy_shield
           FROM users ORDER BY id;"
    ;;
    
  battles)
    echo "⚔️  Battles in test database:"
    query "SELECT id, attacker_id, attackee_id, status, 
           created_at, updated_at 
           FROM battles ORDER BY id;"
    ;;
    
  messages)
    echo "📬 Messages in test database:"
    query "SELECT id, user_id, message, is_read, created_at 
           FROM messages ORDER BY created_at DESC LIMIT 20;"
    ;;
    
  objects)
    echo "🌌 Space objects in test database:"
    query "SELECT id, type, x, y, speed, angle
           FROM space_objects ORDER BY type, id;"
    ;;
    
  count)
    echo "📈 Row counts in all tables:"
    query "SELECT 'users' as table, COUNT(*) as count FROM users
           UNION ALL SELECT 'battles', COUNT(*) FROM battles
           UNION ALL SELECT 'messages', COUNT(*) FROM messages
           UNION ALL SELECT 'space_objects', COUNT(*) FROM space_objects;"
    ;;
    
  schema)
    echo "📋 Table schemas:"
    echo ""
    echo "=== Users Table ==="
    meta "\d users"
    echo ""
    echo "=== Battles Table ==="
    meta "\d battles"
    echo ""
    echo "=== Messages Table ==="
    meta "\d messages"
    echo ""
    echo "=== Space Objects Table ==="
    meta "\d space_objects"
    ;;
    
  clear)
    echo "🗑️  Clearing test database..."
    echo "⚠️  This will delete ALL data from all tables!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      query "TRUNCATE TABLE battles, messages, users, space_objects RESTART IDENTITY CASCADE;"
      echo "✅ Test database cleared!"
      echo "💡 Tip: Run './scripts/db-inspect.sh seed' to reseed with default data"
    else
      echo "❌ Cancelled"
    fi
    ;;
    
  drop)
    echo "💣 Dropping all tables from test database..."
    echo "⚠️  WARNING: This will completely remove all tables and their structure!"
    echo "⚠️  You will need to restart the application to recreate them."
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      query "DROP TABLE IF EXISTS battles, messages, users, space_objects CASCADE;"
      echo "✅ All tables dropped!"
      echo "💡 Tip: Restart the application to recreate tables automatically"
    else
      echo "❌ Cancelled"
    fi
    ;;
    
  seed)
    echo "🌱 Seeding test database with default data..."
    echo ""
    echo "Note: The simplest way to seed the test database is to run the tests,"
    echo "which will automatically seed the database if it's empty (via setup.ts)."
    echo ""
    echo "Options:"
    echo "  1. Run tests: npm test (automatic seeding via setup.ts)"
    echo "  2. Manual SQL: Run the INSERT statements from src/lib/server/seedData.ts"
    echo ""
    echo "The database will be automatically seeded when you run: npm test"
    ;;
    
  connect)
    echo "🔌 Opening interactive psql session..."
    echo "💡 Tip: Use \\q to quit, \\dt to list tables, \\d tablename to describe a table"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    ;;
    
  *)
    echo "Spacewars3 Database Inspector"
    echo "=============================="
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  users    - Display all users with their basic info"
    echo "  battles  - Display all battles with their status"
    echo "  messages - Display all messages (last 20)"
    echo "  objects  - Display all space objects (asteroids, shipwrecks, etc.)"
    echo "  count    - Count rows in all tables"
    echo "  schema   - Show table structures"
    echo "  clear    - Clear all data (with confirmation)"
    echo "  drop     - Drop all tables completely (with confirmation)"
    echo "  seed     - Reseed database with default test data"
    echo "  connect  - Open interactive psql session"
    echo ""
    echo "Examples:"
    echo "  $0 count     # Quick overview of database state"
    echo "  $0 users     # See all users"
    echo "  $0 clear     # Clear and reseed database"
    echo "  $0 seed"
    echo ""
    echo "Database: $DB_NAME@$DB_HOST:$DB_PORT"
    exit 1
    ;;
esac
