import query from './_lib/db.js';

export default async function handler(req, res) {
  try {
    const result = await query('SELECT 1 as connected');
    res.status(200).json({ status: 'ok', message: 'Database connected', test: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
