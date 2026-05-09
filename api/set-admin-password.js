import bcrypt from 'bcryptjs';
import query from './_lib/db.js';

export default async function handler(req, res) {
  // Allow GET for easy testing in browser
  const newPassword = req.query.pwd || 'admin123';
  const hash = bcrypt.hashSync(newPassword, 10);
  
  try {
    // Check if admin exists
    const check = await query("SELECT id FROM users WHERE full_name = 'admin'");
    if (check.rows.length === 0) {
      await query("INSERT INTO users (full_name, password_hash, role, department, is_active) VALUES ('admin', $1, 'admin', 'Management', true)", [hash]);
    } else {
      await query("UPDATE users SET password_hash = $1 WHERE full_name = 'admin'", [hash]);
    }
    res.send(`✅ Admin password set to: <strong>${newPassword}</strong><br><a href="/">Go to login</a>`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
}
