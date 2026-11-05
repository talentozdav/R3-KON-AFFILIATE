import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

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

// Authenticate via email credentials
authRouter.post('/login', (req: AuthenticatedRequest, res: Response) => {
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

// Demo Persona Switcher (Convenient and transparent testing for all roles)
authRouter.get('/personas', (_req, res) => {
  const personas = [
    {
      id: 'usr_affiliate_1',
      email: 'alexander.v@vanderbilt-capital.com',
      fullName: 'Alexander Vanderbilt',
      role: 'affiliate',
      roleLabel: 'Active Affiliate Partner',
      description: 'Managing Director, Vanderbilt Capital Advisory (Affiliate R3-AFF-2041)',
      affiliateCode: 'ALEXANDER-R3'
    },
    {
      id: 'usr_super_admin',
      email: 'superadmin@r3contingencies.com',
      fullName: 'Julian Sterling',
      role: 'super_admin',
      roleLabel: 'Super Administrator',
      description: 'Head of Governance & Compliance'
    },
    {
      id: 'usr_affiliate_mgr',
      email: 'affiliates@r3contingencies.com',
      fullName: 'Elena Rostova',
      role: 'affiliate_manager',
      roleLabel: 'Affiliate Manager',
      description: 'Affiliate Director & Partner Onboarding'
    },
    {
      id: 'usr_finance_mgr',
      email: 'finance@r3contingencies.com',
      fullName: 'Marcus Vance',
      role: 'finance_manager',
      roleLabel: 'Finance Manager',
      description: 'Chief Financial Officer (Commissions & Payouts)'
    }
  ];

  res.json({ personas });
});

// Switch persona
authRouter.post('/switch-persona', (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'Persona not found' });
  }

  let affiliateData = null;
  if (user.role === 'affiliate' && user.affiliateId) {
    affiliateData = db.getAffiliateById(user.affiliateId);
  }

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
