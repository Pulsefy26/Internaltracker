import query from '../_lib/db';
import { verifyToken } from '../_lib/auth';

export default async function handler(req, res) {
  try {
    const user = verifyToken(req);
    if (req.method === 'GET') {
      const { status, resolution, agent_id, department, date_from, date_to, search } = req.query;
      let sql = `
        SELECT a.*, c.case_number, c.account_number, c.task_type, c.case_owner, c.actions_taken, c.comment,
               u.full_name as agent_name
        FROM assignments a
        JOIN cases c ON a.case_id = c.id
        JOIN users u ON a.agent_id = u.id
        WHERE 1=1
      `;
      const params = [];
      if (user.role !== 'admin') {
        sql += ` AND a.agent_id = $${params.length + 1}`;
        params.push(user.id);
      }
      if (agent_id && agent_id !== 'all') {
        sql += ` AND a.agent_id = $${params.length + 1}`;
        params.push(agent_id);
      }
      if (department && department !== 'all') {
        sql += ` AND u.department = $${params.length + 1}`;
        params.push(department);
      }
      if (status && status !== 'all') {
        sql += ` AND a.status = $${params.length + 1}`;
        params.push(status);
      }
      if (resolution && resolution !== 'all') {
        sql += ` AND a.resolution = $${params.length + 1}`;
        params.push(resolution);
      }
      if (date_from) {
        sql += ` AND a.assigned_at >= $${params.length + 1}`;
        params.push(date_from);
      }
      if (date_to) {
        sql += ` AND a.assigned_at <= $${params.length + 1}`;
        params.push(date_to);
      }
      if (search && search.trim()) {
        sql += ` AND (c.case_number ILIKE $${params.length + 1} OR c.account_number ILIKE $${params.length + 2})`;
        params.push(`%${search}%`, `%${search}%`);
      }
      sql += ` ORDER BY a.assigned_at DESC`;
      const result = await query(sql, params);
      return res.json(result.rows);
    }
    if (req.method === 'POST') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { case_ids, agent_id } = req.body;
      if (!case_ids || !Array.isArray(case_ids) || !agent_id) {
        return res.status(400).json({ error: 'case_ids array and agent_id required' });
      }
      const openCount = await query('SELECT COUNT(*) as count FROM assignments WHERE agent_id = $1 AND status != $2', [agent_id, 'closed']);
      const agent = await query('SELECT max_open_cases FROM users WHERE id = $1', [agent_id]);
      const maxOpen = agent.rows[0]?.max_open_cases || 50;
      if (openCount.rows[0].count + case_ids.length > maxOpen) {
        return res.status(400).json({ error: `Agent would exceed max open cases (${maxOpen})` });
      }
      const inserted = [];
      for (const caseId of case_ids) {
        const existing = await query('SELECT id FROM assignments WHERE case_id = $1 AND status != $2', [caseId, 'closed']);
        if (existing.rows.length) continue;
        const result = await query(
          `INSERT INTO assignments (case_id, agent_id, assigned_by, status)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [caseId, agent_id, user.id, 'pending']
        );
        inserted.push(result.rows[0]);
      }
      return res.status(201).json(inserted);
    }
    res.status(405).end();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
