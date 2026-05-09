import query from '../_lib/db';
import { verifyToken } from '../_lib/auth';
import { logAudit } from '../_lib/utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const admin = verifyToken(req);
    if (admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { department, number_of_cases } = req.body;
    if (!department || !number_of_cases || number_of_cases < 1) {
      return res.status(400).json({ error: 'Department and positive number of cases required' });
    }
    // Get available unassigned cases
    const available = await query(`
      SELECT c.id FROM cases c
      LEFT JOIN assignments a ON c.id = a.case_id AND a.status != 'closed'
      WHERE a.id IS NULL
      ORDER BY c.created_at
      LIMIT $1
    `, [number_of_cases]);
    if (available.rows.length === 0) return res.json({ message: 'No unassigned cases', assigned: 0 });
    // Get agents in department, ordered by current open assignments count (ascending) for fair distribution
    const agents = await query(`
      SELECT u.id, u.full_name, u.max_open_cases, COUNT(a.id) as current_open
      FROM users u
      LEFT JOIN assignments a ON u.id = a.agent_id AND a.status != 'closed'
      WHERE u.role = 'agent' AND u.department = $1 AND u.is_active = true
      GROUP BY u.id, u.full_name, u.max_open_cases
      ORDER BY current_open ASC
    `, [department]);
    if (agents.rows.length === 0) return res.json({ message: 'No active agents in department', assigned: 0 });
    // Distribute cases round‑robin respecting max open
    const assignments = [];
    let caseIndex = 0;
    while (caseIndex < available.rows.length) {
      for (const agent of agents.rows) {
        if (caseIndex >= available.rows.length) break;
        if (agent.current_open + 1 > agent.max_open_cases) continue;
        const result = await query(
          `INSERT INTO assignments (case_id, agent_id, assigned_by, status)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [available.rows[caseIndex].id, agent.id, admin.id, 'pending']
        );
        assignments.push(result.rows[0]);
        agent.current_open++;
        caseIndex++;
      }
    }
    await logAudit(query, admin.id, 'auto_assign', { department, number_of_cases, assigned: assignments.length });
    res.json({ message: `Assigned ${assignments.length} cases`, assignments });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
