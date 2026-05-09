import query from '../_lib/db';
import { verifyToken } from '../_lib/auth';
import { logAudit } from '../_lib/utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const user = verifyToken(req);
    const { assignment_id, resolution, case_fields, notes } = req.body;
    if (!assignment_id || !resolution) return res.status(400).json({ error: 'Missing assignment_id or resolution' });
    if (!['awaiting customer response', 'closed'].includes(resolution)) return res.status(400).json({ error: 'Invalid resolution' });
    const assignment = await query('SELECT * FROM assignments WHERE id = $1', [assignment_id]);
    if (!assignment.rows.length) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.rows[0].agent_id !== user.id) return res.status(403).json({ error: 'Not your assignment' });
    if (assignment.rows[0].status !== 'acknowledged') return res.status(400).json({ error: 'Must acknowledge before submitting' });
    const now = new Date();
    const statusFinal = (resolution === 'closed') ? 'closed' : 'completed';
    await query(
      `UPDATE assignments SET status = $1, resolution = $2, submitted_at = $3, closed_at = $4, notes = COALESCE($5, notes)
       WHERE id = $6`,
      [statusFinal, resolution, now, resolution === 'closed' ? now : null, notes, assignment_id]
    );
    // Update case fields if provided
    if (case_fields) {
      const { actions_taken, comment, case_owner } = case_fields;
      await query(
        `UPDATE cases SET actions_taken = COALESCE($1, actions_taken), comment = COALESCE($2, comment), case_owner = COALESCE($3, case_owner), updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT case_id FROM assignments WHERE id = $4)`,
        [actions_taken, comment, case_owner, assignment_id]
      );
    }
    await logAudit(query, user.id, 'submit', { assignment_id, resolution });
    res.json({ message: 'Case submitted' });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
