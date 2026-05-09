import query from './_lib/db';
import { verifyToken } from './_lib/auth';

export default async function handler(req, res) {
  try {
    const user = verifyToken(req);
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    if (req.method === 'GET') {
      const { limit = 100, user_id } = req.query;
      let sql = 'SELECT * FROM audit_log';
      const params = [];
      if (user_id) {
        sql += ' WHERE user_id = $1';
        params.push(user_id);
      }
      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      const result = await query(sql, params);
      res.json(result.rows);
    }
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
