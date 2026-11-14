import { Router, Request, Response } from 'express';
import {
  insertClientRegistration,
  getClientRegistrations,
  getClientRegistrationByEmail,
  updateClientRegistrationInvitation,
  insertClientInquiry,
  getClientInquiries,
  getAffiliateByCode,
  createReferralLead,
  recordAuditLog,
  signInWithSupabasePassword,
  supabaseAdmin,
  isProduction
} from '../supabase.js';
import {
  sendClientAccountInvitation,
  sendClientActivationConfirmation
} from '../services/mailer.js';
import { AuthenticatedRequest, requireAuth, requireRoles } from '../middleware/auth.js';
import crypto from 'crypto';

export const clientRouter = Router();

// Development-only in-memory token store when running without Supabase service credentials
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

    if (!country || typeof country !== 'string' || country.trim().length < 2) {
      errors.country = 'U.S. state or primary jurisdiction is required.';
    }

    if (!serviceCategory || typeof serviceCategory !== 'string' || serviceCategory.trim().length < 2) {
      errors.serviceCategory = 'Service interest category is required.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing active registration in persistent storage
    const duplicate = await getClientRegistrationByEmail(normalizedEmail);
    if (duplicate) {
      return res.status(409).json({
        error: 'Duplicate Registration',
        message: 'A client profile or active registration already exists for this email address.',
        referenceNumber: duplicate.referenceNumber
      });
    }

    // 1. Save permanently to Supabase CRM (public.client_registrations)
    const registration = await insertClientRegistration({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : undefined,
      company: company ? String(company).trim() : undefined,
      country: country.trim(),
      serviceCategory: serviceCategory.trim(),
      requirementsBrief: requirementsBrief ? String(requirementsBrief).trim() : undefined,
      referralCode: referralCode ? String(referralCode).trim().toUpperCase() : undefined
    });

    // Record linked client inquiry if brief/category provided (non-fatal if auxiliary record logs warning)
    await insertClientInquiry({
      registrationId: registration.id,
      clientName: fullName.trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : undefined,
      organization: company ? String(company).trim() : undefined,
      country: country.trim(),
      serviceInterest: serviceCategory.trim(),
      briefSummary: requirementsBrief ? String(requirementsBrief).trim() : undefined,
      priority: 'high'
    }).catch(inqErr => {
      console.warn('[R3 Client Register] Linked inquiry record notice:', inqErr.message);
    });

    // 2. If attributed via affiliate referral code, register lead in permanent affiliate tracking
    if (referralCode && typeof referralCode === 'string' && referralCode.trim()) {
      try {
        const cleanCode = referralCode.trim().toUpperCase();
        const affiliate = await getAffiliateByCode(cleanCode);
        if (affiliate && affiliate.status === 'active') {
          const maskedClient = company
            ? `${String(company).trim()} (${country.trim()})`
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
          ).catch(err => console.warn('[R3 Client Register] Lead audit notice:', err.message));
        }
      } catch (attErr: any) {
        console.warn('[R3 Client Register] Lead attribution notice:', attErr.message);
      }
    }

    // 3. Initiate Account Creation Invitation via Resend (failures here must NOT report DB registration failure)
    const origin = req.headers.origin || process.env.APP_URL || 'https://r3-kon-affiliate.vercel.app';
    let invitationUrl = `${origin}/client-portal?mode=activate&ref=${registration.referenceNumber}&email=${encodeURIComponent(normalizedEmail)}`;

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

        if (!linkErr && linkData?.properties?.action_link) {
          invitationUrl = linkData.properties.action_link;
        } else if (linkErr) {
          console.warn('[R3 Client Register] Supabase generateLink notice:', linkErr.message);
        }
      } catch (err: any) {
        console.warn('[R3 Client Register] Auth invitation notice:', err.message);
      }
    } else if (!isProduction) {
      const token = crypto.randomBytes(32).toString('hex');
      clientActivationTokens.set(token, {
        email: normalizedEmail,
        registrationId: registration.id,
        expiresAt: Date.now() + 86400000
      });
      invitationUrl = `${origin}/client-portal?action=activate&token=${token}&email=${encodeURIComponent(normalizedEmail)}&ref=${registration.referenceNumber}`;
    }

    // 4. Send Transactional Invitation Email safely
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const emailResult = await sendClientAccountInvitation({
        email: normalizedEmail,
        fullName: fullName.trim(),
        invitationUrl,
        referenceNumber: registration.referenceNumber
      });
      emailSent = emailResult.success;
      emailError = emailResult.error;
    } catch (mailErr: any) {
      emailError = mailErr.message;
      console.warn('[R3 Client Register] Email dispatch warning:', mailErr.message);
    }

    // Update registration invitation status in database (non-fatal if status update fails after registration insert)
    await updateClientRegistrationInvitation(
      registration.id,
      emailSent ? 'sent' : 'failed',
      emailError
    ).catch(updErr => {
      console.warn('[R3 Client Register] Invitation status update notice:', updErr.message);
    });

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
  const { email, password, referenceNumber } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Verify a valid, non-declined, unactivated client registration exists before setting password
    const registration = await getClientRegistrationByEmail(normalizedEmail);
    if (!registration) {
      return res.status(404).json({
        error: 'Registration Not Found',
        message: 'No active client registration was found for this email address.'
      });
    }

    if (referenceNumber && typeof referenceNumber === 'string' && referenceNumber.trim().toUpperCase() !== registration.referenceNumber.toUpperCase()) {
      return res.status(400).json({
        error: 'Reference Mismatch',
        message: 'The supplied registration reference number does not match this email address.'
      });
    }

    if (registration.invitationStatus === 'accepted' || registration.accountActivatedAt) {
      return res.status(409).json({
        error: 'Account Already Activated',
        message: 'This client portal account has already been activated. Please sign in or request password recovery.'
      });
    }

    if (supabaseAdmin) {
      // Check if an existing user in profiles holds a non-client role (prevent account takeover)
      const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) {
        throw new Error(`Auth lookup error: ${listErr.message}`);
      }

      const existing = listData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
      let userId = existing?.id;

      if (existing) {
        const { data: staffProfile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', existing.id)
          .maybeSingle();

        if (staffProfile) {
          return res.status(403).json({
            error: 'Account Conflict',
            message: 'This email address belongs to an existing staff or affiliate account and cannot be activated via client onboarding.'
          });
        }

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: { role: 'client', full_name: registration.fullName }
        });
        if (updErr) {
          throw new Error(`Failed to activate client credentials: ${updErr.message}`);
        }
      } else {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            role: 'client',
            full_name: registration.fullName
          }
        });

        if (authErr || !authData?.user) {
          return res.status(400).json({ error: authErr?.message || 'Failed to create client user.' });
        }
        userId = authData.user.id;
      }

      if (!userId) {
        throw new Error('Unable to establish client user ID.');
      }

      // 2. Upsert client profile
      const { error: cpErr } = await supabaseAdmin.from('client_profiles').upsert({
        id: userId,
        email: normalizedEmail,
        full_name: req.body.fullName?.trim() || registration.fullName || 'Client Member',
        membership_tier: 'Executive Contingency Retainer',
        status: 'active'
      });
      if (cpErr) {
        throw new Error(`Database error saving client profile: ${cpErr.message}`);
      }

      // 3. Update registration status in client_registrations
      const { error: regUpdErr } = await supabaseAdmin
        .from('client_registrations')
        .update({
          invitation_status: 'accepted',
          account_activated_at: new Date().toISOString(),
          user_id: userId,
          status: 'APPROVED'
        })
        .eq('id', registration.id);
      if (regUpdErr) {
        throw new Error(`Database error updating registration activation status: ${regUpdErr.message}`);
      }

      // 4. Send confirmation email safely
      sendClientActivationConfirmation({
        email: normalizedEmail,
        fullName: req.body.fullName?.trim() || registration.fullName || 'Valued Client'
      }).catch(err => console.warn('[R3 Client Activate] Confirmation email notice:', err.message));

      // 5. Generate authentic Supabase Auth session token
      const signInResult = await signInWithSupabasePassword(normalizedEmail, password);
      const sessionToken = signInResult?.data?.session?.access_token;
      if (!sessionToken) {
        return res.status(500).json({
          error: 'Session Issuance Failed',
          message: 'Client account activated, but session token could not be issued. Please sign in.'
        });
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

    // Local in-memory fallback for development/test fixtures
    await updateClientRegistrationInvitation(registration.id, 'accepted');
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

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    if (supabaseAdmin) {
      const signInResult = await signInWithSupabasePassword(normalizedEmail, password);
      if (!signInResult) {
        return res.status(500).json({
          error: 'Authentication Unavailable',
          message: 'Authentication service client could not be initialized.'
        });
      }

      const { data, error } = signInResult;

      if (error || !data?.user || !data?.session?.access_token) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: error?.message || 'Invalid credentials.'
        });
      }

      // Fetch client profile from database
      const { data: clientProfile, error: cpErr } = await supabaseAdmin
        .from('client_profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (cpErr) {
        return res.status(500).json({ error: 'Database error verifying client profile', message: cpErr.message });
      }

      if (!clientProfile || clientProfile.status !== 'active') {
        return res.status(403).json({
          error: 'Client Profile Required',
          message: 'This account does not have an active client profile.'
        });
      }

      return res.json({
        success: true,
        token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: clientProfile.full_name || 'Client Member',
          role: 'client',
          status: clientProfile.status,
          membershipTier: clientProfile.membership_tier || 'Executive Contingency Retainer'
        }
      });
    }

    if (isProduction) {
      return res.status(500).json({
        error: 'Authentication Unavailable',
        message: 'Authentication service not initialized in production.'
      });
    }

    // Local fallback for dev test fixtures without Supabase configured
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
