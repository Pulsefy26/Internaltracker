import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import query from './_lib/db';
import { verifyToken } from './_lib/auth';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // Login
  if (req.method === 'POST' && path === '/api/auth/login') {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const result = await query('SELECT * FROM users WHERE full_name = $1', [username]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });
    const token = jwt.sign({ id: user.id, full_name: user.full_name, role: user.role, department: user.department }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: user.id, full_name: user.full_name, role: user.role, department: user.department } });
  }

  // Register (admin only)
  if (req.method === 'POST' && path === '/api/auth/register') {
    try {
      const admin = verifyToken(req);
      if (admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      const { full_name, department, max_open_cases = 50 } = req.body;
      if (!full_name) return res.status(400).json({ error: 'Full name required' });
      const existing = await query('SELECT id FROM users WHERE full_name = $1', [full_name]);
      if (existing.rows.length) return res.status(409).json({ error: 'User exists' });
      const password = Math.random().toString(36).slice(-8);
      const hash = bcrypt.hashSync(password, 10);
      const result = await query(
        'INSERT INTO users (full_name, password_hash, role, department, max_open_cases) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name',
        [full_name, hash, 'agent', department || 'Customer Service', max_open_cases]
      );
      res.status(201).json({ ...result.rows[0], password });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
    return;
  }

  res.status(404).json({ error: 'Not found' });
}
