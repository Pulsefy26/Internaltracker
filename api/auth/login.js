import bcrypt from 'bcryptjs';
import query from '../_lib/db';
import { generateToken } from '../_lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const result = await query('SELECT * FROM users WHERE full_name = $1', [username]);
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, full_name: user.full_name, role: user.role, department: user.department } });
}
