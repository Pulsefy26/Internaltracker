export async function logAudit(db, userId, action, details, ip = null) {
  try {
    await db.query(
      'INSERT INTO audit_log (user_id, action, details, ip) VALUES ($1, $2, $3, $4)',
      [userId, action, JSON.stringify(details), ip]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
