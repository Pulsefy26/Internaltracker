import query from './_lib/db.js';
import { verifyToken } from './_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const user = verifyToken(req);
    if (req.method === 'GET') {
      const { department } = req.query;
      const dept = department || 'Customer Service';
      const targetResult = await query(
        'SELECT target_cases FROM department_targets WHERE department = $1 AND target_date = CURRENT_DATE AND is_active = true',
        [dept]
      );
      const target = targetResult.rows[0]?.target_cases || 0;
      const completedResult = await query(`
        SELECT COUNT(*) as completed
        FROM assignments a
        JOIN users u ON a.agent_id = u.id
        WHERE u.department = $1 AND a.status = 'closed' AND DATE(a.closed_at) = CURRENT_DATE
      `, [dept]);
      const completed = parseInt(completedResult.rows[0]?.completed || 0);
      const leaderboard = await query(`
        SELECT u.full_name, COUNT(a.id) as closed_count
        FROM assignments a
        JOIN users u ON a.agent_id = u.id
        WHERE u.department = $1 AND a.status = 'closed' AND DATE(a.closed_at) = CURRENT_DATE
        GROUP BY u.id, u.full_name
        ORDER BY closed_count DESC
        LIMIT 5
      `, [dept]);
      return res.json({ target, completed, remaining: Math.max(0, target - completed), leaderboard: leaderboard.rows });
    }
    if (req.method === 'POST') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { department, target_cases } = req.body;
      if (!department || target_cases === undefined) return res.status(400).json({ error: 'Department and target_cases required' });
      await query('UPDATE department_targets SET is_active = false WHERE department = $1 AND target_date = CURRENT_DATE', [department]);
      await query('INSERT INTO department_targets (department, target_date, target_cases, created_by, is_active) VALUES ($1, CURRENT_DATE, $2, $3, true)', [department, target_cases, user.id]);
      return res.json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Targets error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}
