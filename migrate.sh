#!/bin/bash

# Usage: ./migrate.sh <DATABASE_URL>
# Example: ./migrate.sh "postgresql://user:password@host:port/database"

if [ -z "$1" ]; then
  echo "Usage: $0 <DATABASE_URL>"
  echo ""
  echo "Example:"
  echo "  $0 postgresql://postgres:password@localhost:5432/railway"
  exit 1
fi

DATABASE_URL="$1"

echo "Running database migrations..."
psql "$DATABASE_URL" < db/schema.sql

if [ $? -eq 0 ]; then
  echo "✅ Database migrations completed successfully!"
else
  echo "❌ Migration failed"
  exit 1
fi
