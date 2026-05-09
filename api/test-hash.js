import bcrypt from 'bcryptjs';
import query from './_lib/db.js';

export default async function handler(req, res) {
  // Only allow GET for simplicity
  if (req.method !== 'GET') return res.status(405).end();
  
  try {
    const result = await query("SELECT password_hash FROM users WHERE full_name = 'admin'");
    const hash = result.rows[0]?.password_hash;
    if (!hash) return res.status(404).json({ error: 'Admin not found' });
    
    const testPassword = 'Admin123!';
    const isValid = bcrypt.compareSync(testPassword, hash);
    
    res.json({ 
      hash_preview: hash.substring(0, 20) + '...', 
      hash_length: hash.length,
      password_tested: testPassword,
      matches: isValid 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
