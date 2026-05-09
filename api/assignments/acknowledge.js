import query from '../_lib/db';
import { verifyToken } from '../_lib/auth';
import { logAudit } from '../_lib/utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const user = verifyToken(req);
    const { assignment_id } = req.body;
    if (!assignment_id) return res.status(400).json({ error: 'Assignment ID required' });
    const assignment = await query('SELECT * FROM assignments WHERE id = $1', [assignment_id]);
    if (!assignment.rows.length) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.rows[0].agent_id !== user.id) return res.status(403).json({ error: 'Not your assignment' });
    if (assignment.rows[0].status !== 'pending') return res.status(400).json({ error: 'Already acknowledged or completed' });
    await query(
      'UPDATE assignments SET status = $1, acknowledged_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['acknowledged', assignment_id]
    );
    await logAudit(query, user.id, 'acknowledge', { assignment_id });
    res.json({ message: 'Assignment acknowledged' });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
