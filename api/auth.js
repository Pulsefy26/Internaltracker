import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import query from './_lib/db.js';
import { verifyToken } from './_lib/auth.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, username, password, full_name, department, max_open_cases } = req.body;

    // LOGIN
    if (action === 'login') {
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      // Test database connection
      let test;
      try {
        test = await query('SELECT 1 as connected');
      } catch (dbErr) {
        console.error('DB connection error:', dbErr);
        return res.status(500).json({ error: 'Database connection failed: ' + dbErr.message });
      }

      const result = await query('SELECT * FROM users WHERE full_name = $1', [username]);
      const user = result.rows[0];
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

      const token = jwt.sign(
        { id: user.id, full_name: user.full_name, role: user.role, department: user.department },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({ token, user: { id: user.id, full_name: user.full_name, role: user.role, department: user.department } });
    }

    // REGISTER (admin only)
    if (action === 'register') {
      const admin = verifyToken(req);
      if (admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      if (!full_name) return res.status(400).json({ error: 'Full name required' });

      const existing = await query('SELECT id FROM users WHERE full_name = $1', [full_name]);
      if (existing.rows.length) return res.status(409).json({ error: 'User exists' });

      const generatedPassword = Math.random().toString(36).slice(-8);
      const hash = bcrypt.hashSync(generatedPassword, 10);
      const result = await query(
        'INSERT INTO users (full_name, password_hash, role, department, max_open_cases) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name',
        [full_name, hash, 'agent', department || 'Customer Service', max_open_cases || 50]
      );
      return res.status(201).json({ ...result.rows[0], password: generatedPassword });
    }

    return res.status(400).json({ error: 'Invalid action. Use "login" or "register".' });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}
