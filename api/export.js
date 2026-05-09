import query from './_lib/db';
import { verifyToken } from './_lib/auth';
import XLSX from 'xlsx';

export default async function handler(req, res) {
  try {
    const user = verifyToken(req);
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const result = await query(`
      SELECT 
        c.case_number, c.account_number, c.task_type, c.case_owner, c.actions_taken, c.comment,
        u.full_name as agent_name, u.department,
        a.status, a.resolution, a.assigned_at, a.acknowledged_at, a.submitted_at, a.closed_at, a.notes
      FROM assignments a
      JOIN cases c ON a.case_id = c.id
      JOIN users u ON a.agent_id = u.id
      ORDER BY a.assigned_at DESC
    `);
    const ws = XLSX.utils.json_to_sheet(result.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="custom_connect_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
