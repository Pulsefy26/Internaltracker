import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is missing');
}

export function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid token');
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, full_name: user.full_name, role: user.role, department: user.department },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}
