import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb, hashPassword, verifyPassword } from './db.ts';
import type { AuthUser, UserRole } from './types.ts';

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
  authToken?: string;
}

interface DbUserRow {
  id: string;
  user_code: string;
  name: string;
  email: string;
  role: UserRole;
  password_hash: string;
  preferred_language?: string | null;
  created_at: string;
}

const VALID_ROLES: UserRole[] = ['Investor', 'Broker / Quant', 'Practice Trader'];

function normalizeLang(val?: string | null): 'en' | 'hi' | 'te' {
  return val === 'hi' || val === 'te' ? val : 'en';
}

function toSafeUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    userCode: row.user_code,
    name: row.name,
    email: row.email,
    role: row.role,
    preferredLanguage: normalizeLang(row.preferred_language),
    createdAt: row.created_at,
  };
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('bullseye_token='));
    if (match) {
      return decodeURIComponent(match.split('=').slice(1).join('='));
    }
  }
  return null;
}

function getAuthSecret(): string {
  const configured = process.env.BULLSEYE_AUTH_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('BULLSEYE_AUTH_SECRET must be configured with at least 32 characters.');
  }
  return 'bullseye-local-development-secret-do-not-use-in-production';
}

function issueToken(user: AuthUser): { token: string; expiresAt: string } {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    exp: Math.floor(expiresAt.getTime() / 1000),
    nonce: crypto.randomBytes(16).toString('hex'),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, expiresAt: expiresAt.toISOString() };
}

export function authenticateCredentials(params: {
  identifier: string;
  password: string;
  expectedRole?: UserRole;
}):
  | { ok: true; token: string; expiresAt: string; user: AuthUser }
  | { ok: false; status: number; error: string } {
  const identifier = params.identifier.trim();
  const password = params.password;

  if (!identifier || !password) {
    return { ok: false, status: 400, error: 'User ID (or email) and password are required.' };
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_code, name, email, role, password_hash, preferred_language, created_at
       FROM users
       WHERE UPPER(user_code) = UPPER(?) OR LOWER(email) = LOWER(?)
       LIMIT 1`,
    )
    .get(identifier, identifier) as DbUserRow | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, status: 401, error: 'Invalid credentials. Please verify your User ID and password.' };
  }

  if (params.expectedRole && row.role !== params.expectedRole) {
    return {
      ok: false,
      status: 403,
      error: `Access denied: account "${row.user_code}" belongs to the "${row.role}" portal, not "${params.expectedRole}".`,
    };
  }

  const user = toSafeUser(row);
  const session = issueToken(user);
  return { ok: true, ...session, user };
}

export function registerAccount(params: {
  userCode: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  preferredLanguage?: 'en' | 'hi' | 'te';
}):
  | { ok: true; token: string; expiresAt: string; user: AuthUser }
  | { ok: false; status: number; error: string } {
  const userCode = params.userCode.trim().toUpperCase();
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const password = params.password;
  const role = params.role;
  const preferredLanguage = normalizeLang(params.preferredLanguage);

  if (!userCode || userCode.length < 4) {
    return { ok: false, status: 400, error: 'User ID must be at least 4 characters.' };
  }
  if (!name) {
    return { ok: false, status: 400, error: 'Full name is required.' };
  }
  if (!email.includes('@')) {
    return { ok: false, status: 400, error: 'A valid email address is required.' };
  }
  if (!password || password.length < 6) {
    return { ok: false, status: 400, error: 'Password must be at least 6 characters.' };
  }
  if (!VALID_ROLES.includes(role)) {
    return { ok: false, status: 400, error: 'Invalid portal role.' };
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM users WHERE UPPER(user_code) = UPPER(?) OR LOWER(email) = LOWER(?)')
    .get(userCode, email) as { id: string } | undefined;

  if (existing) {
    return { ok: false, status: 409, error: 'An account with this User ID or email already exists.' };
  }

  const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, user_code, name, email, role, password_hash, preferred_language, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userCode, name, email, role, passwordHash, preferredLanguage, now);

  if (role === 'Practice Trader') {
    db.prepare(
      `INSERT INTO practice_accounts (user_id, starting_capital, cash_balance, realized_pnl, updated_at)
       VALUES (?, 1000000, 1000000, 0, ?)`,
    ).run(id, now);
    db.prepare(
      `INSERT INTO practice_equity_history (user_id, timestamp, portfolio_value, cash_balance)
       VALUES (?, ?, 1000000, 1000000)`,
    ).run(id, now);
  }

  const user: AuthUser = {
    id, userCode, name, email, role, preferredLanguage, createdAt: now,
  };
  const session = issueToken(user);
  return { ok: true, ...session, user };
}

export function resolveSession(token: string | null): AuthUser | null {
  if (!token) return null;
  try {
    const [payload, suppliedSignature, extra] = token.split('.');
    if (!payload || !suppliedSignature || extra) return null;
    const expectedSignature = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest();
    const actualSignature = Buffer.from(suppliedSignature, 'base64url');
    if (actualSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string; role?: UserRole; exp?: number;
    };
    if (!claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;

    const row = getDb()
      .prepare(
        `SELECT id, user_code, name, email, role, password_hash, preferred_language, created_at
         FROM users WHERE id = ? LIMIT 1`,
      )
      .get(claims.sub) as DbUserRow | undefined;
    if (!row || row.role !== claims.role) return null;
    return toSafeUser(row);
  } catch {
    return null;
  }
}

export function revokeSession(_token: string | null): boolean {
  // Signed tokens are stateless. The client clears its token and the HTTP-only cookie is expired.
  // Server-side revocation requires a durable shared session store.
  return false;
}

export function updateUserLanguagePreference(
  userId: string,
  language: string,
): 'en' | 'hi' | 'te' {
  const normalized = normalizeLang(language);
  const db = getDb();
  db.prepare('UPDATE users SET preferred_language = ? WHERE id = ?').run(normalized, userId);
  return normalized;
}

export function revokeSession(token: string | null): boolean {
  if (!token) return false;
  const db = getDb();
  const result = db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return Number(result.changes) > 0;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const user = resolveSession(token);
  if (!user || !token) {
    res.status(401).json({
      error: 'Authentication required. Please log in to access this protected endpoint.',
    });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = extractToken(req);
    const user = resolveSession(token);
    if (!user || !token) {
      res.status(401).json({
        error: 'Authentication required. Please sign in with an authorized portal account.',
      });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: `Forbidden: "${user.role}" role is not authorized for this resource (requires ${allowedRoles.join(' or ')}).`,
      });
      return;
    }
    req.authUser = user;
    req.authToken = token;
    next();
  };
}
