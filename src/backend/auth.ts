import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { query } from './db';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Create users table if it doesn't exist
export async function initializeAuthDB() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        profile_notes TEXT,
        stored_resume TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS application_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        job_description TEXT,
        questions TEXT,
        generated_answers JSONB,
        tailored_resume TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await ensureDefaultUser();
    console.log('✅ Auth tables initialized');
  } catch (error) {
    console.error('Auth DB init error:', error);
  }
}

// Ensure default user exists
async function ensureDefaultUser() {
  try {
    const defaultEmail = process.env.DEFAULT_USER_EMAIL || 'user@example.com';
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'password123';

    const userExists = await query('SELECT id FROM users WHERE email = $1', [defaultEmail]);

    if (!userExists.rows.length) {
      const passwordHash = await bcryptjs.hash(defaultPassword, 10);
      await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
        [defaultEmail, passwordHash]
      );
      console.log(`✅ Default user created: ${defaultEmail}`);
    }
  } catch (error) {
    console.error('Error creating default user:', error);
  }
}


// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const result = await query('SELECT id, email, profile_notes, stored_resume FROM users WHERE id = $1', [userId]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Save profile
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { profileNotes, storedResume } = req.body;
    
    await query(
      'UPDATE users SET profile_notes = $1, stored_resume = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [profileNotes, storedResume, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Middleware to verify JWT
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    next();
  });
}

export default router;
