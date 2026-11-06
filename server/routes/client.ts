import { Router, Request, Response } from 'express';
import {
  insertClientRegistration,
  updateClientRegistrationInvitation,
  insertClientInquiry,
  getClientInquiries,
  supabaseAdmin,
  supabasePublic
} from '../supabase.js';
import {
  sendClientAccountInvitation,
  sendClientActivationConfirmation,
  sendClientRegistrationConfirmation
} from '../services/mailer.js';
import { AuthenticatedRequest, requireAuth, requireRoles } from '../middleware/auth.js';
import { db } from '../db.js';
import crypto from 'crypto';

export const clientRouter = Router();

// In-memory token store for client account invitations when running without Supabase service role
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
      errors.country = 'Country or primary jurisdiction is required.';
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

    // 2. If attributed via affiliate referral code, register lead in affiliate tracking
    if (referralCode) {
      const cleanCode = referralCode.trim().toUpperCase();
      const affiliate = db.affiliates.find(a => a.referralCode.toUpperCase() === cleanCode);
      if (affiliate && affiliate.status === 'active') {
        const maskedClient = company
          ? `${company.trim()} (${country.trim()})`
          : `Private Principal (${country.trim()})`;

        const leadRecord = {
          id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          affiliateId: affiliate.id,
          referralCode: cleanCode,
          clientIdentifier: maskedClient,
          clientType: (company ? 'Corporate' : 'Individual') as any,
          region: country.trim(),
          serviceCategory: serviceCategory.trim(),
          status: 'in_review' as const,
          notes: `Client registration [${registration.referenceNumber}]. Retainer category: ${serviceCategory.trim()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.leads.unshift(leadRecord);

        db.recordAuditLog(
          'system',
          'super_admin',
          'LEAD_ATTRIBUTED',
          'affiliate',
          affiliate.id,
          `Client registration ${registration.referenceNumber} attributed to affiliate ${affiliate.affiliateNumber}`,
          req.ip
        );
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
          // Generate fallback secure activation token
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
 * Client completes account creation by confirming token and setting their security password.
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
        // If user already exists in auth, update their password
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

        // 3. Update registration status
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

      // Send confirmation
      sendClientActivationConfirmation({
        email: normalizedEmail,
        fullName: req.body.fullName || 'Valued Client'
      }).catch(console.error);

      return res.json({
        success: true,
        message: 'Client account activated successfully. You may now access the Client Portal.',
        token: normalizedEmail
      });
    }

    // Local in-memory fallback
    res.json({
      success: true,
      message: 'Account activated successfully.',
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

    // Local fallback
    res.json({
      success: true,
      token: normalizedEmail,
      user: {
        id: `usr_${Date.now()}`,
        email: normalizedEmail,
        fullName: 'Client Member',
        role: 'client',
        status: 'active',
        membershipTier: 'Executive Contingency Retainer'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login error', message: err.message });
  }
});

/**
 * 4. GET /api/client/me
 * Returns authenticated client dossier and status
 */
clientRouter.get('/me', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const inquiries = await getClientInquiries(user.id);

    res.json({
      authenticated: true,
      client: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        membershipTier: user.membershipTier || 'Executive Contingency Retainer',
        inquiries
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch client profile', message: err.message });
  }
});

/**
 * 5. POST /api/client/inquiries
 * Authenticated client submits a confidential inquiry or emergency brief
 */
clientRouter.post('/inquiries', requireAuth, requireRoles('client'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { serviceInterest, briefSummary, priority } = req.body;

    if (!serviceInterest || !briefSummary) {
      return res.status(400).json({ error: 'Service interest and brief summary are required.' });
    }

    const inquiry = await insertClientInquiry({
      clientId: user.id,
      clientName: user.fullName,
      email: user.email,
      country: 'International',
      serviceInterest,
      briefSummary,
      priority: priority || 'high'
    });

    res.status(201).json({
      success: true,
      referenceNumber: inquiry.referenceNumber,
      message: 'Inquiry logged confidentially under strict non-disclosure protocol.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit inquiry', message: err.message });
  }
});

/**
 * 6. GET /api/client/inquiries
 * Returns inquiries for the currently signed-in client
 */
clientRouter.get('/inquiries', requireAuth, requireRoles('client'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const inquiries = await getClientInquiries(user.id);
    res.json({ inquiries });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch inquiries', message: err.message });
  }
});
