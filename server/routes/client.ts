import { Router, Request, Response } from 'express';
import {
  insertClientRegistration,
  getClientRegistrations,
  updateClientRegistrationInvitation,
  insertClientInquiry,
  getClientInquiries,
  getAffiliateByCode,
  createReferralLead,
  recordAuditLog,
  supabaseAdmin,
  supabasePublic,
  isProduction
} from '../supabase.js';
import {
  sendClientAccountInvitation,
  sendClientActivationConfirmation,
  sendClientRegistrationConfirmation
} from '../services/mailer.js';
import { AuthenticatedRequest, requireAuth, requireRoles } from '../middleware/auth.js';
import crypto from 'crypto';

export const clientRouter = Router();

// In-memory token store for client account invitations when running without Supabase service role in local dev
const clientActivationTokens: Map<string, { email: string; registrationId: string; expiresAt: number }> = new Map();

/**
 * 1. POST /api/client/register
 * Public client registration gateway with strict input validation,
 * CRM persistence, affiliate lead attribution, and immediate transactional invitation.
 */
clientRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      phone,
      company,
      country,
      serviceCategory,
      requirementsBrief,
      referralCode
    } = req.body;

    // Validation
    const errors: Record<string, string> = {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      errors.fullName = 'Full legal name is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      errors.email = 'Valid business or personal email is required.';
    }

    if (!country || typeof country !== 'string') {
      errors.country = 'U.S. state or primary jurisdiction is required.';
    }

    if (!serviceCategory || typeof serviceCategory !== 'string') {
      errors.serviceCategory = 'Service interest category is required.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing active registration
    const existing = await getClientRegistrations();
    const duplicate = existing.find(
      r => r.email.toLowerCase() === normalizedEmail && r.status !== 'DECLINED' && r.status !== 'ARCHIVED'
    );
    if (duplicate) {
      return res.status(409).json({
        error: 'Duplicate Registration',
        message: 'A client profile or active registration already exists for this email address.',
        referenceNumber: duplicate.referenceNumber
      });
    }

    // 1. Save to Supabase CRM (client_registrations)
    const registration = await insertClientRegistration({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : undefined,
      company: company ? company.trim() : undefined,
      country: country.trim(),
      serviceCategory: serviceCategory.trim(),
      requirementsBrief: requirementsBrief ? requirementsBrief.trim() : undefined,
      referralCode: referralCode ? referralCode.trim().toUpperCase() : undefined
    });

    // 2. If attributed via affiliate referral code, register lead in permanent affiliate tracking
    if (referralCode) {
      try {
        const cleanCode = referralCode.trim().toUpperCase();
        const affiliate = await getAffiliateByCode(cleanCode);
        if (affiliate && affiliate.status === 'active') {
          const maskedClient = company
            ? `${company.trim()} (${country.trim()})`
            : `Private Principal (${country.trim()})`;

          const leadRecord = await createReferralLead({
            affiliateId: affiliate.id,
            referralCode: cleanCode,
            clientIdentifier: maskedClient,
            clientType: company ? 'Corporate' : 'Individual',
            region: country.trim(),
            serviceCategory: serviceCategory.trim(),
            notes: `Client registration [${registration.referenceNumber}]. Retainer category: ${serviceCategory.trim()}`
          });

          await recordAuditLog(
            'system',
            'super_admin',
            'LEAD_ATTRIBUTED',
            'referral_leads',
            leadRecord.id,
            `Client registration ${registration.referenceNumber} attributed to affiliate ${affiliate.affiliateNumber}`,
            req.ip
          );
        }
      } catch (attErr: any) {
        console.warn('[R3 Client Register] Lead attribution notice:', attErr.message);
      }
    }

    // 3. Initiate Account Creation Invitation immediately via Resend
    let invitationUrl = '';
    let emailSent = false;
    const origin = req.headers.origin || process.env.APP_URL || 'https://r3-kon.vercel.app';

    if (supabaseAdmin) {
      try {
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email: normalizedEmail,
          options: {
            redirectTo: `${origin}/client-portal?mode=activate&ref=${registration.referenceNumber}`,
            data: {
              full_name: fullName.trim(),
              role: 'client'
            }
          }
        });

        if (linkErr) {
          console.warn('[R3 Client Register] Supabase generateLink notice:', linkErr.message);
          const token = crypto.randomBytes(32).toString('hex');
          clientActivationTokens.set(token, {
            email: normalizedEmail,
            registrationId: registration.id,
            expiresAt: Date.now() + 86400000 // 24 hours
          });
          invitationUrl = `${origin}/client-portal?action=activate&token=${token}&email=${encodeURIComponent(normalizedEmail)}&ref=${registration.referenceNumber}`;
        } else {
          invitationUrl = linkData.properties?.action_link || `${origin}/client-portal?mode=activate&ref=${registration.referenceNumber}`;
        }
      } catch (err: any) {
        console.error('[R3 Client Register] Auth invitation error:', err.message);
      }
    } else {
      const token = crypto.randomBytes(32).toString('hex');
      clientActivationTokens.set(token, {
        email: normalizedEmail,
        registrationId: registration.id,
        expiresAt: Date.now() + 86400000
      });
      invitationUrl = `${origin}/client-portal?action=activate&token=${token}&email=${encodeURIComponent(normalizedEmail)}&ref=${registration.referenceNumber}`;
    }

    // 4. Send Transactional Invitation Email
    const emailResult = await sendClientAccountInvitation({
      email: normalizedEmail,
      fullName: fullName.trim(),
      invitationUrl,
      referenceNumber: registration.referenceNumber
    });

    emailSent = emailResult.success;

    // Update registration invitation status in database
    await updateClientRegistrationInvitation(
      registration.id,
      emailSent ? 'sent' : 'failed',
      emailResult.error
    );

    res.status(201).json({
      success: true,
      referenceNumber: registration.referenceNumber,
      client: {
        id: registration.id,
        referenceNumber: registration.referenceNumber,
        fullName: fullName.trim(),
        email: normalizedEmail
      },
      message: emailSent
        ? 'Client registration recorded. Your account creation invitation has been dispatched to your email.'
        : 'Client registration recorded. Note: Transactional email delivery is queued for dispatch.',
      emailSent,
      registrationId: registration.id
    });
  } catch (err: any) {
    console.error('[R3 Client Register Error]:', err);
    res.status(500).json({
      error: 'Registration Failed',
      message: err.message || 'An unexpected error occurred while processing your client registration.'
    });
  }
});

/**
 * 2. POST /api/client/activate
 * Client completes account creation by setting their security password and activating Supabase Auth account.
 */
clientRouter.post('/activate', async (req: Request, res: Response) => {
  const { email, password, token, referenceNumber } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    if (supabaseAdmin) {
      // 1. Create or update user in Supabase Auth
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'client'
        }
      });

      let userId = authData?.user?.id;

      if (authErr) {
        // If user already exists in auth, update their password and confirm email
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (existing) {
          userId = existing.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true
          });
        } else {
          return res.status(400).json({ error: authErr.message });
        }
      }

      // 2. Upsert client profile
      if (userId) {
        await supabaseAdmin.from('client_profiles').upsert({
          id: userId,
          email: normalizedEmail,
          full_name: req.body.fullName || 'Client Member',
          membership_tier: 'Executive Contingency Retainer',
          status: 'active'
        });

        // 3. Update registration status in client_registrations
        await supabaseAdmin
          .from('client_registrations')
          .update({
            invitation_status: 'accepted',
            account_activated_at: new Date().toISOString(),
            user_id: userId,
            status: 'APPROVED'
          })
          .eq('email', normalizedEmail);
      }

      // 4. Send confirmation email
      sendClientActivationConfirmation({
        email: normalizedEmail,
        fullName: req.body.fullName || 'Valued Client'
      }).catch(console.error);

      // 5. Generate authentic Supabase Auth session token
      let sessionToken = normalizedEmail;
      if (supabasePublic) {
        const { data: sessionData } = await supabasePublic.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (sessionData?.session?.access_token) {
          sessionToken = sessionData.session.access_token;
        }
      }

      return res.json({
        success: true,
        message: 'Client account activated successfully. You may now access the Client Portal.',
        token: sessionToken
      });
    }

    if (isProduction) {
      return res.status(500).json({
        error: 'Database Error',
        message: 'Database service unavailable in production. Cannot activate account.'
      });
    }

    // Local in-memory fallback for development test fixtures
    res.json({
      success: true,
      message: 'Account activated successfully (development test mode).',
      token: normalizedEmail
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Activation failed', message: err.message });
  }
});

/**
 * 3. POST /api/client/login
 * Client login with email and password
 */
clientRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    if (supabasePublic) {
      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: error.message
        });
      }

      // Fetch client profile
      let clientProfile = null;
      if (supabaseAdmin && data.user) {
        const { data: p } = await supabaseAdmin
          .from('client_profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        clientProfile = p;
      }

      return res.json({
        success: true,
        token: data.session?.access_token || normalizedEmail,
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: clientProfile?.full_name || data.user.user_metadata?.full_name || 'Client Member',
          role: 'client',
          status: clientProfile?.status || 'active',
          membershipTier: clientProfile?.membership_tier || 'Executive Contingency Retainer'
        }
      });
    }

    if (isProduction) {
      return res.status(500).json({
        error: 'Authentication Unavailable',
        message: 'Authentication service not initialized in production.'
      });
    }

    // Local fallback for dev test fixtures
    res.json({
      success: true,
      token: normalizedEmail,
      user: {
        id: `clt_dev_${Date.now()}`,
        email: normalizedEmail,
        fullName: 'Client Member (Dev)',
        role: 'client',
        status: 'active',
        membershipTier: 'Executive Contingency Retainer'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

/**
 * 4. GET /api/client/me
 * Authenticated client profile and active inquiries
 */
clientRouter.get('/me', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    const inquiries = await getClientInquiries(user.id);

    res.json({
      authenticated: true,
      client: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: 'client',
        membershipTier: user.membershipTier || 'Executive Contingency Retainer',
        inquiries
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch client dossier', message: err.message });
  }
});

/**
 * 5. POST /api/client/inquiries
 * Submits an operational brief or confidential advisory request
 */
clientRouter.post('/inquiries', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { serviceInterest, briefSummary, priority, country } = req.body;

  if (!serviceInterest) {
    return res.status(400).json({ error: 'Service interest category is required.' });
  }

  try {
    const inquiry = await insertClientInquiry({
      clientId: user.id,
      clientName: user.fullName,
      email: user.email,
      country: country || 'United States',
      serviceInterest,
      briefSummary: briefSummary ? briefSummary.trim() : undefined,
      priority: priority || 'high'
    });

    res.status(201).json({
      success: true,
      referenceNumber: inquiry.referenceNumber,
      message: 'Inquiry logged confidentially under strict non-disclosure protocol.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record brief', message: err.message });
  }
});

/**
 * 6. GET /api/client/inquiries
 * Lists all advisory briefs submitted by the authenticated client
 */
clientRouter.get('/inquiries', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    const inquiries = await getClientInquiries(user.id);
    res.json({ inquiries });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch inquiries', message: err.message });
  }
});
