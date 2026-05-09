import { sql } from '@vercel/postgres';

export default async function query(text, params = []) {
  try {
    const result = await sql.query(text, params);
    return result;
  } catch (err) {
    console.error('Database query error:', err);
    throw new Error('Database query failed: ' + err.message);
  }
}
