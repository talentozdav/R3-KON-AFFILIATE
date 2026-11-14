import { Router, Response } from 'express';
import {
  supabaseAdmin,
  signInWithSupabasePassword,
  isProduction,
  getAffiliateById,
  getAffiliateByUserId,
  getAffiliateApplicationByRef,
  createAffiliate,
  recordAuditLog
} from '../supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/mailer.js';

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

// 1. Get current session profile
authRouter.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }

  let affiliateData = null;
  if (req.user.role === 'affiliate' && req.user.affiliateId) {
    affiliateData = await getAffiliateById(req.user.affiliateId);
  }

  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      status: req.user.status,
      affiliate: affiliateData,
      clientId: req.user.clientId,
      membershipTier: req.user.membershipTier
    }
  });
});

// 2. Authenticate via credentials
authRouter.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Maximum login attempts exceeded. Please try again after 15 minutes.'
    });
  }

  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Valid email address and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Authenticate through Supabase Auth
  if (supabaseAdmin) {
    try {
      const signInResult = await signInWithSupabasePassword(normalizedEmail, password);
      if (!signInResult) {
        return res.status(500).json({
          error: 'Authentication Unavailable',
          message: 'Supabase authentication client could not be initialized.'
        });
      }

      const { data, error } = signInResult;

      if (!error && data?.user && data?.session?.access_token) {
        let profile: any = null;
        let role: string | null = null;
        let affiliateData = null;

        const { data: p, error: pErr } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (pErr) {
          return res.status(500).json({ error: 'Database error verifying account profile', message: pErr.message });
        }

        if (p) {
          profile = p;
          role = p.role;
          if (role === 'affiliate') {
            const { data: aff } = await supabaseAdmin.from('affiliates').select('*').eq('user_id', data.user.id).maybeSingle();
            affiliateData = aff;
          }
        } else {
          const { data: cp, error: cpErr } = await supabaseAdmin
            .from('client_profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (cpErr) {
            return res.status(500).json({ error: 'Database error verifying client profile', message: cpErr.message });
          }

          if (cp) {
            profile = cp;
            role = 'client';
          }
        }

        if (!role || !profile || profile.status !== 'active') {
          return res.status(403).json({
            error: 'Account Inactive or Unprovisioned',
            message: 'No active portal profile is assigned to this account.'
          });
        }

        await recordAuditLog(
          normalizedEmail,
          role,
          'USER_LOGIN',
          'auth',
          data.user.id,
          `Authenticated via Supabase Auth. Role: ${role}`,
          ip
        ).catch(err => console.warn('[R3 Auth] Audit log notice:', err.message));

        return res.json({
          success: true,
          token: data.session.access_token,
          user: {
            id: data.user.id,
            email: data.user.email,
            fullName: profile.full_name || data.user.email,
            role,
            status: profile.status,
            affiliate: affiliateData,
            clientId: role === 'client' ? data.user.id : undefined,
            membershipTier: profile.membership_tier
          }
        });
      }

      return res.status(401).json({
        error: 'Authentication failed',
        message: error?.message || 'Invalid credentials.'
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Authentication service error', message: err.message });
    }
  }

  if (isProduction) {
    return res.status(500).json({
      error: 'Authentication Unavailable',
      message: 'Server-side Supabase authentication is not configured in production.'
    });
  }

  // Non-production test fallback when Supabase is not configured
  res.status(401).json({
    error: 'Invalid credentials',
    message: 'The email or password provided is incorrect.'
  });
});

// 3. Partner Account Activation (Approved Applicants activate account & set password)
authRouter.post('/activate', async (req: AuthenticatedRequest, res: Response) => {
  const { email, referenceNumber, password } = req.body;

  if (!email || typeof email !== 'string' || !referenceNumber || typeof referenceNumber !== 'string' || !password) {
    return res.status(400).json({ error: 'Email, application reference number, and new password are required.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanRef = referenceNumber.trim().toUpperCase();

  try {
    const application = await getAffiliateApplicationByRef(cleanRef, normalizedEmail);

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'No application matching this email and reference number was located in the registry.'
      });
    }

    if (application.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Application not approved',
        message: `Your application is currently in '${application.status}' status. Only approved applications can be activated.`
      });
    }

    if (application.activatedAffiliateId) {
      return res.status(409).json({
        error: 'Application already activated',
        message: 'This approved application has already been activated. Please sign in or use password recovery.'
      });
    }

    let token = '';

    if (supabaseAdmin) {
      // 1. Create or retrieve user in Supabase Auth (preventing staff takeover)
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'affiliate',
          full_name: application.fullName
        }
      });

      let userId = authUser?.user?.id;

      if (authErr) {
        const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) {
          return res.status(500).json({ error: `Failed to inspect existing auth records: ${listErr.message}` });
        }
        const existing = listData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (existing) {
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', existing.id)
            .maybeSingle();

          const protectedRoles = ['super_admin', 'affiliate_manager', 'finance_manager', 'compliance_officer'];
          if (existingProfile && protectedRoles.includes(existingProfile.role)) {
            return res.status(403).json({
              error: 'Account Conflict',
              message: 'Cannot activate an affiliate account over a privileged governance email address.'
            });
          }

          userId = existing.id;
          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: { role: 'affiliate', full_name: application.fullName }
          });
          if (updErr) {
            return res.status(500).json({ error: `Failed to update auth credentials: ${updErr.message}` });
          }
        } else {
          return res.status(400).json({ error: `Failed to create auth credentials: ${authErr.message}` });
        }
      }

      if (!userId) {
        return res.status(500).json({ error: 'Unable to establish authenticated user ID.' });
      }

      // 2. Upsert profile in public.profiles table
      const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: normalizedEmail,
        full_name: application.fullName,
        role: 'affiliate',
        status: 'active',
        updated_at: new Date().toISOString()
      });

      if (profileErr) {
        throw new Error(`Database error saving partner profile: ${profileErr.message}`);
      }

      // 3. Create or find affiliate partner record
      let affiliate = await getAffiliateByUserId(userId);
      if (!affiliate) {
        const refCode = `${application.fullName.split(' ').pop()?.toUpperCase() || 'PARTNER'}-R3`;
        affiliate = await createAffiliate({
          userId,
          fullName: application.fullName,
          email: normalizedEmail,
          businessName: application.businessName,
          referralCode: refCode,
          approvedRatePercent: 10.0
        });
      }

      // 4. Update application with activated affiliate id
      const { error: appUpdErr } = await supabaseAdmin
        .from('affiliate_applications')
        .update({
          activated_affiliate_id: affiliate.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id);

      if (appUpdErr) {
        throw new Error(`Database error linking activated affiliate: ${appUpdErr.message}`);
      }

      // 5. Generate real Supabase Auth session token
      const signInResult = await signInWithSupabasePassword(normalizedEmail, password);
      token = signInResult?.data?.session?.access_token || '';
      if (!token) {
        return res.status(500).json({
          error: 'Session Issuance Failed',
          message: 'Account was activated in the database, but a login session could not be issued. Please sign in manually.'
        });
      }

      await recordAuditLog(
        normalizedEmail,
        'affiliate',
        'AFFILIATE_ACTIVATED',
        'affiliates',
        affiliate.id,
        `Partner account activated for ${application.referenceNumber} (${affiliate.referralCode})`,
        req.ip
      ).catch(err => console.warn('[R3 Affiliate Activation] Audit log notice:', err.message));

      return res.json({
        success: true,
        message: 'Affiliate partnership account successfully activated. You may now access the Affiliate Dashboard.',
        token,
        affiliateNumber: affiliate.affiliateNumber,
        referralCode: affiliate.referralCode,
        user: {
          id: userId,
          email: normalizedEmail,
          fullName: application.fullName,
          role: 'affiliate',
          status: 'active',
          affiliate
        }
      });
    }

    if (isProduction) {
      throw new Error('Supabase admin client unavailable in production.');
    }

    res.json({
      success: true,
      message: 'Account activated successfully (development test mode).'
    });
  } catch (err: any) {
    console.error('[R3 Affiliate Activation Error]:', err);
    res.status(500).json({ error: 'Activation failed', message: err.message });
  }
});

// 4. Password Recovery: Request Reset Link
authRouter.post('/forgot-password', async (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const origin = req.headers.origin || process.env.APP_URL || 'https://r3-kon-affiliate.vercel.app';

  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: {
          redirectTo: `${origin}/reset-password`
        }
      });

      if (!error && data?.properties?.action_link) {
        await sendPasswordResetEmail({
          email: normalizedEmail,
          resetUrl: data.properties.action_link
        });
      }
    }

    res.json({
      success: true,
      message: 'If an active account exists for this address, password reset instructions have been dispatched.'
    });
  } catch (err: any) {
    console.error('[R3 Forgot Password Error]:', err);
    res.json({
      success: true,
      message: 'If an active account exists for this address, password reset instructions have been dispatched.'
    });
  }
});
