import { Router, Response } from 'express';
import crypto from 'crypto';
import { db, hashPassword, verifyPassword } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

// In-memory sliding window rate limiter for login
const loginAttempts: Map<string, { count: number; firstAttempt: number }> = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  record.count += 1;
  return record.count <= MAX_ATTEMPTS;
}

// Get current session profile
authRouter.get('/me', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }

  let affiliateData = null;
  if (req.user.role === 'affiliate' && req.user.affiliateId) {
    affiliateData = db.getAffiliateById(req.user.affiliateId);
  }

  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      status: req.user.status,
      affiliate: affiliateData
    }
  });
});

// Authenticate via credentials
authRouter.post('/login', (req: AuthenticatedRequest, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Maximum login attempts exceeded. Please try again after 15 minutes.'
    });
  }

  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'No registered member or administrator account exists with this email address.'
    });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({
      error: 'Account Suspended',
      message: 'This account has been suspended by R3 Contingencies compliance. Please contact partner support.'
    });
  }

  if (user.status === 'pending_activation') {
    return res.status(403).json({
      error: 'Account Not Activated',
      message: 'Your application has been approved, but your account has not yet been activated. Please complete account activation.'
    });
  }

  // Verify password if user has passwordHash configured
  if (user.passwordHash && user.passwordSalt) {
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }
    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'The email or password provided is incorrect.'
      });
    }
  }

  let affiliateData = null;
  if (user.role === 'affiliate' && user.affiliateId) {
    affiliateData = db.getAffiliateById(user.affiliateId);
    if (affiliateData && affiliateData.status !== 'active') {
      return res.status(403).json({
        error: 'Affiliate Status Inactive',
        message: `Your affiliate partnership status is '${affiliateData.status}'. Please contact R3 administration.`
      });
    }
  }

  db.recordAuditLog(
    user.email,
    user.role,
    'USER_LOGIN',
    'auth',
    user.id,
    `Member signed in successfully. Role: ${user.role}`,
    req.ip
  );

  res.json({
    success: true,
    token: user.email,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      affiliate: affiliateData
    }
  });
});

// Partner Account Activation (Approved Applicants activate account & set password)
authRouter.post('/activate', (req: AuthenticatedRequest, res: Response) => {
  const { email, referenceNumber, password } = req.body;

  if (!email || !referenceNumber || !password) {
    return res.status(400).json({ error: 'Email, application reference number, and new password are required.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanRef = referenceNumber.trim().toUpperCase();

  const application = db.applications.find(
    a => a.email.toLowerCase() === normalizedEmail && a.referenceNumber.toUpperCase() === cleanRef
  );

  if (!application) {
    return res.status(404).json({
      error: 'Application not found',
      message: 'No application matching this email and reference number was located.'
    });
  }

  if (application.status !== 'APPROVED') {
    return res.status(400).json({
      error: 'Application not approved',
      message: `Your application is currently in '${application.status}' status. Only approved applications can be activated.`
    });
  }

  // Find or create the user record
  let user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
  const { hash, salt } = hashPassword(password);

  if (user) {
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.status = 'active';
  } else {
    // If admin approved but user record wasn't created yet, create it now
    const newUserId = `usr_${Date.now()}`;
    const affNum = `R3-AFF-${Math.floor(1000 + Math.random() * 9000)}`;
    const affiliateId = `aff_${Date.now()}`;
    const code = `${application.fullName.split(' ').pop()?.toUpperCase() || 'PARTNER'}-R3`;

    user = {
      id: newUserId,
      email: normalizedEmail,
      fullName: application.fullName,
      role: 'affiliate',
      affiliateId,
      status: 'active',
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);

    const newAffiliate = {
      id: affiliateId,
      affiliateNumber: affNum,
      userId: newUserId,
      fullName: application.fullName,
      email: normalizedEmail,
      businessName: application.businessName,
      referralCode: code,
      status: 'active' as const,
      joinedAt: new Date().toISOString(),
      approvedRatePercent: 10.0,
      totalClicks: 0,
      uniqueVisitors: 0
    };
    db.affiliates.unshift(newAffiliate);
    application.activatedAffiliateId = affiliateId;
  }

  db.recordAuditLog(
    normalizedEmail,
    'affiliate',
    'ACCOUNT_ACTIVATED',
    'auth',
    user.id,
    `Affiliate account activated and password set for application ${cleanRef}.`,
    req.ip
  );

  const affiliateData = user.affiliateId ? db.getAffiliateById(user.affiliateId) : null;

  res.json({
    success: true,
    message: 'Account successfully activated. Welcome to the R3 Global Affiliate Network.',
    token: user.email,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      affiliate: affiliateData
    }
  });
});

// Request Password Reset
authRouter.post('/forgot-password', (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required.' });

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  // Return generic confirmation regardless of email existence for security
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hour
    db.recordAuditLog(
      normalizedEmail,
      user.role,
      'PASSWORD_RESET_REQUESTED',
      'auth',
      user.id,
      'Password reset link generated.',
      req.ip
    );
  }

  res.json({
    success: true,
    message: 'If an active account exists for this address, password reset instructions have been issued.'
  });
});

// Confirm Password Reset
authRouter.post('/reset-password', (req: AuthenticatedRequest, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
  }

  const user = db.users.find(u => u.resetToken === token && u.resetTokenExpires && new Date(u.resetTokenExpires) > new Date());
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired password reset token.' });
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;

  db.recordAuditLog(
    user.email,
    user.role,
    'PASSWORD_RESET_COMPLETED',
    'auth',
    user.id,
    'Password successfully updated.',
    req.ip
  );

  res.json({
    success: true,
    message: 'Password successfully reset. You may now sign in with your new credentials.'
  });
});

// Logout
authRouter.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    db.recordAuditLog(
      req.user.email,
      req.user.role,
      'USER_LOGOUT',
      'auth',
      req.user.id,
      'Member signed out.',
      req.ip
    );
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});
