import query from './_lib/db';
import { verifyToken } from './_lib/auth';

export default async function handler(req, res) {
  try {
    const user = verifyToken(req);
    if (req.method === 'POST') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { case_number, account_number, task_type, case_owner, actions_taken, comment } = req.body;
      if (!case_number || !task_type) return res.status(400).json({ error: 'Case number and task type required' });
      const result = await query(
        `INSERT INTO cases (case_number, account_number, task_type, case_owner, actions_taken, comment, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [case_number, account_number, task_type, case_owner, actions_taken, comment, user.id]
      );
      return res.status(201).json(result.rows[0]);
    }
    if (req.method === 'GET') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const result = await query(
        `SELECT c.* FROM cases c 
         LEFT JOIN assignments a ON c.id = a.case_id AND a.status != 'closed'
         WHERE a.id IS NULL ORDER BY c.created_at DESC`
      );
      return res.json(result.rows);
    }
    res.status(405).end();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
