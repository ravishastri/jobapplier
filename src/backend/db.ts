import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL)
  : postgres({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'jobapplier',
      password: process.env.DB_PASSWORD || 'jobapplier',
      database: process.env.DB_NAME || 'job_applier',
      onnotice: () => {},
    });

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await sql.unsafe(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.length });
    return { rows: result, rowCount: result.length };
  } catch (error) {
    console.error('Query error', { text, error });
    throw error;
  }
}

export async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');
    const schema = readFileSync(`${__dirname}/../../db/schema.sql`, 'utf-8');
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export async function closePool() {
  await sql.end();
}

export default sql;
