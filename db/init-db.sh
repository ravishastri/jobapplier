#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER jobapplier WITH PASSWORD 'jobapplier';
  CREATE DATABASE job_applier OWNER jobapplier;
  ALTER ROLE jobapplier CREATEDB;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "job_applier" <<-EOSQL
  GRANT ALL PRIVILEGES ON DATABASE job_applier TO jobapplier;
EOSQL

echo "Database initialization completed"
