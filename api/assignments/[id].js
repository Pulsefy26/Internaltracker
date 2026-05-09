import query from '../_lib/db';
import { verifyToken } from '../_lib/auth';

export default async function handler(req, res) {
  try {
    const user = verifyToken(req);
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (req.method === 'DELETE') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      await query('DELETE FROM assignments WHERE id = $1', [id]);
      return res.json({ message: 'Assignment deleted' });
    }
    res.status(405).end();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}
