#!/usr/bin/env node

import { readFileSync } from 'fs';
import postgres from 'postgres';

const databaseUrl = process.argv[2];

if (!databaseUrl) {
  console.error('Usage: node migrate.js <DATABASE_URL>');
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function migrate() {
  try {
    console.log('Running database migrations...');

    const schema = readFileSync('./db/schema.sql', 'utf-8');

    // Split by statements and execute
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    console.log('✅ Database migrations completed successfully!');
    await sql.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await sql.end();
    process.exit(1);
  }
}

migrate();
