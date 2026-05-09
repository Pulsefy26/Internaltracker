import query from './_lib/db';
import { verifyToken } from './_lib/auth';

export default async function handler(req, res) {
  try {
    const user = verifyToken(req);
    if (req.method === 'GET') {
      const { department } = req.query;
      if (!department) return res.status(400).json({ error: 'Department required' });
      // Get active target
      const targetResult = await query(
        'SELECT * FROM department_targets WHERE department = $1 AND target_date = CURRENT_DATE AND is_active = true',
        [department]
      );
      const target = targetResult.rows[0] || { target_cases: 0 };
      // Count completed (closed) cases today for this department
      const completedResult = await query(`
        SELECT COUNT(*) as completed 
        FROM assignments a
        JOIN users u ON a.agent_id = u.id
        WHERE u.department = $1 AND a.status = 'closed' AND DATE(a.closed_at) = CURRENT_DATE
      `, [department]);
      const completed = parseInt(completedResult.rows[0]?.completed || 0);
      // Leaderboard: agents with most closed cases today
      const leaderboard = await query(`
        SELECT u.full_name, COUNT(a.id) as closed_count
        FROM assignments a
        JOIN users u ON a.agent_id = u.id
        WHERE u.department = $1 AND a.status = 'closed' AND DATE(a.closed_at) = CURRENT_DATE
        GROUP BY u.id, u.full_name
        ORDER BY closed_count DESC
        LIMIT 5
      `, [department]);
      res.json({ target: target.target_cases, completed, remaining: Math.max(0, target.target_cases - completed), leaderboard: leaderboard.rows });
    }
    if (req.method === 'POST') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { department, target_cases } = req.body;
      if (!department || target_cases === undefined) return res.status(400).json({ error: 'Department and target_cases required' });
      // Deactivate previous active target for today
      await query(
        'UPDATE department_targets SET is_active = false WHERE department = $1 AND target_date = CURRENT_DATE',
        [department]
      );
      // Insert new target
      const result = await query(
        'INSERT INTO department_targets (department, target_date, target_cases, created_by, is_active) VALUES ($1, CURRENT_DATE, $2, $3, true) RETURNING *',
        [department, target_cases, user.id]
      );
      res.status(201).json(result.rows[0]);
    }
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
