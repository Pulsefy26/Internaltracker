import query from './_lib/db';
import { verifyToken } from './_lib/auth';

export default async function handler(req, res) {
  try {
    const user = verifyToken(req);
    if (req.method === 'GET') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { department } = req.query;
      let sql = 'SELECT id, full_name, role, department, max_open_cases, is_active, created_at FROM users WHERE role = $1';
      const params = ['agent'];
      if (department && department !== 'all') {
        sql += ' AND department = $2';
        params.push(department);
      }
      sql += ' ORDER BY full_name';
      const result = await query(sql, params);
      return res.json(result.rows);
    }
    if (req.method === 'PATCH') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { id } = req.query;
      const { department, max_open_cases, is_active } = req.body;
      await query('UPDATE users SET department = COALESCE($1, department), max_open_cases = COALESCE($2, max_open_cases), is_active = COALESCE($3, is_active) WHERE id = $4', [department, max_open_cases, is_active, id]);
      res.json({ message: 'User updated' });
    }
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
