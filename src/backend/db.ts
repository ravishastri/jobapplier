import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'jobapplier',
  password: process.env.DB_PASSWORD || 'jobapplier',
  database: process.env.DB_NAME || 'job_applier',
  onnotice: () => {}, // Suppress notices
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

export async function closePool() {
  await sql.end();
}

export default sql;
