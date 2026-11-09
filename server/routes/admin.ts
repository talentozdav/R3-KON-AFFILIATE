import { Router, Request, Response } from 'express';
import { db, verifyPassword } from '../db.js';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth.js';
import { ApplicationStatus, AffiliateStatus } from '../types.js';
import {
  getClientRegistrations,
  updateClientRegistrationStatus,
  updateClientRegistrationInvitation,
  getClientNotes,
  insertClientNote,
  getClientFollowups,
  insertClientFollowup,
  getAdminOverviewMetrics,
  getAffiliateApplications,
  reviewAffiliateApplication,
  createAffiliate,
  getAffiliates,
  updateAffiliateStatus,
  getReferralLeads,
  getReferralClicks,
  createConversion,
  getConversions,
  verifyConversion,
  getCommissions,
  generateCommission,
  actionCommission,
  getCommissionRules,
  createCommissionRule,
  toggleCommissionRuleStatus,
  getPayouts,
  preparePayoutBatch,
  recordPayoutPayment,
  getAuditLogs,
  recordAuditLog,
  bootstrapAdminUser,
  supabaseAdmin,
  supabasePublic
} from '../supabase.js';
import { sendClientAccountInvitation, sendAffiliateApprovalActivation } from '../services/mailer.js';

export const adminRouter = Router();

// ==============================================================================
// PUBLIC / UNPROTECTED ADMIN AUTH & BOOTSTRAP ENDPOINTS
// ==============================================================================

/**
 * POST /api/admin/bootstrap
 * Secure endpoint to bootstrap or reset initial administrator account in Supabase
 */
adminRouter.post('/bootstrap', async (req: Request, res: Response) => {
  const secretKey = (req.headers['x-admin-bootstrap-key'] as string) || req.body?.bootstrapKey;
  const expectedKey = process.env.ADMIN_BOOTSTRAP_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Protect against arbitrary access
  if (!expectedKey || !secretKey || secretKey !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized Bootstrap',
      message: 'Valid administrative bootstrap key or Supabase secret key required in X-Admin-Bootstrap-Key header.'
    });
  }

  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required.' });
  }

  try {
    const result = await bootstrapAdminUser({
      email,
      password,
      fullName,
      role: role || 'super_admin'
    });

    await recordAuditLog(
      email,
      role || 'super_admin',
      'ADMIN_BOOTSTRAP_PROVISIONED',
      'profiles',
      result.userId,
      `Bootstrapped administrative user for ${email} with role ${role || 'super_admin'}`,
      req.ip
    );

    return res.status(201).json({
      message: 'Administrative user successfully provisioned in Supabase.',
      ...result
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Bootstrap failed', message: err.message });
  }
});

/**
 * POST /api/admin/login
 * Dedicated administrative login with role verification
 */
adminRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and security key/password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Supabase Auth check
  if (supabasePublic) {
    try {
      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (!error && data.user) {
        // Query profile for admin role verification
        let profile = null;
        if (supabaseAdmin) {
          const { data: p } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
          profile = p;
        }

        const role = profile?.role || data.user.user_metadata?.role;
        const validAdminRoles = ['super_admin', 'affiliate_manager', 'finance_manager'];

        if (!validAdminRoles.includes(role)) {
          return res.status(403).json({
            error: 'Unauthorized Role',
            message: 'Your account does not possess administrative clearance.'
          });
        }

        await recordAuditLog(
          normalizedEmail,
          role,
          'ADMIN_LOGIN',
          'auth',
          data.user.id,
          `Admin Supabase login verified for role: ${role}`,
          req.ip
        );

        return res.json({
          success: true,
          token: data.session?.access_token || normalizedEmail,
          user: {
            id: data.user.id,
            email: data.user.email,
            fullName: profile?.full_name || data.user.user_metadata?.full_name || 'Admin Officer',
            role,
            status: profile?.status || 'active'
          }
        });
      }
    } catch (err: any) {
      console.warn('[Admin Auth] Supabase check notice:', err.message);
    }
  }

  // 2. Memory database fallback (for local development only)
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return res.status(401).json({
      error: 'Invalid Credentials',
      message: 'No administrative account found for this address.'
    });
  }

  const validAdminRoles = ['super_admin', 'affiliate_manager', 'finance_manager'];
  if (!validAdminRoles.includes(user.role)) {
    return res.status(403).json({
      error: 'Unauthorized Role',
      message: 'Access restricted to authorized governance personnel.'
    });
  }

  if (user.passwordHash && user.passwordSalt) {
    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: 'The email or password provided is incorrect.'
      });
    }
  }

  await recordAuditLog(
    user.email,
    user.role,
    'ADMIN_LOGIN',
    'auth',
    user.id,
    `Admin memory login verified for role: ${user.role}`,
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
      status: user.status
    }
  });
});

/**
 * GET /api/admin/verify-session
 * Verifies current admin session
 */
adminRouter.get('/verify-session', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false, message: 'No active session.' });
  }

  const validAdminRoles = ['super_admin', 'affiliate_manager', 'finance_manager'];
  if (!validAdminRoles.includes(req.user.role)) {
    return res.status(403).json({
      authenticated: false,
      message: 'Insufficient administrative privileges.'
    });
  }

  res.json({
    authenticated: true,
    user: req.user
  });
});

// ==============================================================================
// PROTECTED ADMINISTRATIVE ACCESS
// ==============================================================================

adminRouter.use(requireRoles('super_admin', 'affiliate_manager', 'finance_manager'));

// 1. Program Overview Metrics
adminRouter.get('/overview', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const metrics = await getAdminOverviewMetrics();
    res.json({ metrics });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to calculate overview metrics', message: err.message });
  }
});

// 2. Client CRM Registrations
adminRouter.get('/client-registrations', requireRoles('super_admin', 'affiliate_manager'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const registrations = await getClientRegistrations();
    res.json({ registrations });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch client registrations', message: err.message });
  }
});

// Update client registration status
adminRouter.post('/client-registrations/:id/status', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await updateClientRegistrationStatus(id, status);
    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'CLIENT_REGISTRATION_STATUS_UPDATED',
      'client_registrations',
      id,
      `Client registration ${id} status updated to ${status}`,
      req.ip
    );
    res.json({ success: true, message: `Registration status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update registration status', message: err.message });
  }
});

// Resend client account invitation
adminRouter.post('/client-registrations/:id/resend-invite', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const registrations = await getClientRegistrations();
    const reg = registrations.find(r => r.id === id);

    if (!reg) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    const origin = req.headers.origin || process.env.APP_URL || 'https://r3-kon.vercel.app';
    const invitationUrl = `${origin}/client-portal?mode=activate&ref=${reg.referenceNumber}&email=${encodeURIComponent(reg.email)}`;

    const emailResult = await sendClientAccountInvitation({
      email: reg.email,
      fullName: reg.fullName,
      invitationUrl,
      referenceNumber: reg.referenceNumber
    });

    await updateClientRegistrationInvitation(
      reg.id,
      emailResult.success ? 'sent' : 'failed',
      emailResult.error
    );

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'CLIENT_INVITATION_RESENT',
      'client_registrations',
      id,
      `Resent portal invitation to ${reg.email} [${emailResult.success ? 'Success' : 'Failed'}]`,
      req.ip
    );

    res.json({
      success: emailResult.success,
      message: emailResult.success
        ? `Invitation re-dispatched successfully to ${reg.email}.`
        : `Failed to deliver invitation: ${emailResult.error}`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to resend invite', message: err.message });
  }
});

// Client Staff Notes
adminRouter.get('/client-notes/:registrationId', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { registrationId } = req.params;
  try {
    const notes = await getClientNotes(registrationId);
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch client notes', message: err.message });
  }
});

adminRouter.post('/client-notes', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { registrationId, noteType, content } = req.body;
  if (!registrationId || !content) {
    return res.status(400).json({ error: 'Registration ID and note content are required.' });
  }

  try {
    const note = await insertClientNote({
      registrationId,
      authorEmail: req.user!.email,
      authorName: req.user!.fullName,
      noteType: noteType || 'general',
      content: content.trim()
    });

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'CLIENT_NOTE_ADDED',
      'client_notes',
      registrationId,
      `Added confidential CRM note (${noteType || 'general'})`,
      req.ip
    );

    res.status(201).json({ success: true, note });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add note', message: err.message });
  }
});

// Client Followups
adminRouter.get('/client-followups', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const registrationId = req.query.registrationId as string | undefined;
  try {
    const followups = await getClientFollowups(registrationId);
    res.json({ followups });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch followups', message: err.message });
  }
});

adminRouter.post('/client-followups', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { registrationId, title, dueDate, priority, assignedTo, notes } = req.body;
  if (!registrationId || !title || !dueDate) {
    return res.status(400).json({ error: 'Registration ID, title, and due date are required.' });
  }

  try {
    const followup = await insertClientFollowup({
      registrationId,
      title: title.trim(),
      dueDate,
      priority: priority || 'medium',
      assignedTo: assignedTo || req.user!.fullName,
      notes: notes ? notes.trim() : undefined
    });

    res.status(201).json({ success: true, followup });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add followup', message: err.message });
  }
});

// 3. Applications Management
adminRouter.get('/applications', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const applications = await getAffiliateApplications();
    res.json({ applications });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch affiliate applications', message: err.message });
  }
});

// Review Application (Update status)
adminRouter.post('/applications/:id/review', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, statusNotes } = req.body as { status: ApplicationStatus; statusNotes?: string };

  const validStatuses: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'INFORMATION_REQUESTED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const updated = await reviewAffiliateApplication(id, status, statusNotes, req.user!.fullName);

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'APPLICATION_REVIEWED',
      'application',
      updated.id,
      `Application ${updated.referenceNumber} status changed to ${status}. Notes: ${statusNotes || 'None'}`,
      req.ip
    );

    res.json({
      success: true,
      message: `Application ${updated.referenceNumber} updated to ${status}.`,
      application: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to review application', message: err.message });
  }
});

// Activate Approved Application into an Active Affiliate
adminRouter.post('/applications/:id/activate', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { customCode, approvedRatePercent } = req.body;

  try {
    const apps = await getAffiliateApplications();
    const app = apps.find(a => a.id === id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (app.status !== 'APPROVED') {
      return res.status(400).json({ error: `Application must be in APPROVED status prior to activation. Current status: ${app.status}` });
    }

    const affiliates = await getAffiliates();
    const existingAffiliate = affiliates.find(a => a.email.toLowerCase() === app.email.toLowerCase());
    if (existingAffiliate) {
      return res.status(400).json({ error: 'An active affiliate profile already exists for this candidate.' });
    }

    const referralCode = customCode ? customCode.trim().toUpperCase() : `${app.fullName.split(' ').pop()?.toUpperCase() || 'PARTNER'}-R3`;
    let userId = `usr_${Date.now()}`;

    // If Supabase Auth is enabled, create or retrieve user in Supabase
    if (supabaseAdmin) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuth = listData?.users?.find(u => u.email?.toLowerCase() === app.email.toLowerCase());
        if (existingAuth) {
          userId = existingAuth.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { role: 'affiliate', full_name: app.fullName }
          });
        } else {
          const tempPassword = `R3Affiliate!${Math.floor(100000 + Math.random() * 900000)}`;
          const { data: newAuth } = await supabaseAdmin.auth.admin.createUser({
            email: app.email.toLowerCase(),
            password: tempPassword,
            email_confirm: true,
            user_metadata: { role: 'affiliate', full_name: app.fullName }
          });
          if (newAuth?.user) {
            userId = newAuth.user.id;
          }
        }

        // Upsert profile
        await supabaseAdmin.from('profiles').upsert({
          id: userId,
          email: app.email.toLowerCase(),
          full_name: app.fullName,
          role: 'affiliate',
          status: 'active'
        });
      } catch (authErr: any) {
        console.warn('[Admin Activation] Auth link note:', authErr.message);
      }
    }

    const newAffiliate = await createAffiliate({
      userId,
      fullName: app.fullName,
      email: app.email,
      businessName: app.businessName,
      referralCode,
      approvedRatePercent: approvedRatePercent ? Number(approvedRatePercent) : 10.0
    });

    // Mark application activated
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('affiliate_applications')
        .update({ activated_affiliate_id: newAffiliate.id, updated_at: new Date().toISOString() })
        .eq('id', app.id);
    }

    // Dispatch welcome / activation notification
    const origin = req.headers.origin || process.env.APP_URL || 'https://r3-kon.vercel.app';
    sendAffiliateApprovalActivation({
      email: app.email,
      fullName: app.fullName,
      referralCode,
      approvedRatePercent: newAffiliate.approvedRatePercent,
      loginUrl: `${origin}/affiliate/portal?mode=login`,
      referenceNumber: app.referenceNumber
    }).catch(err => console.warn('[Admin Activation] Email notification error:', err.message));

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'AFFILIATE_ACTIVATED',
      'affiliate',
      newAffiliate.id,
      `Activated affiliate ${newAffiliate.affiliateNumber} (${app.fullName}) with code ${referralCode} and rate ${newAffiliate.approvedRatePercent}%`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Affiliate partner successfully activated: ${newAffiliate.affiliateNumber}`,
      affiliate: newAffiliate
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to activate affiliate', message: err.message });
  }
});

// 4. Affiliates List
adminRouter.get('/affiliates', requireRoles('super_admin', 'affiliate_manager', 'finance_manager'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const affiliates = await getAffiliates();
    res.json({ affiliates });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch affiliates', message: err.message });
  }
});

// Update Affiliate Status
adminRouter.post('/affiliates/:id/status', requireRoles('super_admin', 'affiliate_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body as { status: AffiliateStatus; reason?: string };

  const validStatuses: AffiliateStatus[] = ['active', 'suspended', 'terminated', 'pending'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid affiliate status. Valid options: ${validStatuses.join(', ')}` });
  }

  try {
    await updateAffiliateStatus(id, status);

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'AFFILIATE_STATUS_CHANGED',
      'affiliate',
      id,
      `Affiliate ${id} status updated to ${status}. Reason: ${reason || 'Governance review'}`,
      req.ip
    );

    res.json({
      success: true,
      message: `Affiliate ${id} updated to ${status}.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update affiliate status', message: err.message });
  }
});

// 5. Referrals & Attributed Inquiries
adminRouter.get('/referrals', requireRoles('super_admin', 'affiliate_manager'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [leads, clicks] = await Promise.all([
      getReferralLeads(),
      getReferralClicks()
    ]);
    res.json({ leads, clicks });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch referral activity', message: err.message });
  }
});

// 6. Conversions Management
adminRouter.get('/conversions', requireRoles('super_admin', 'affiliate_manager', 'finance_manager'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const conversions = await getConversions();
    res.json({ conversions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch conversions', message: err.message });
  }
});

// Manual Conversion Verification
adminRouter.post('/conversions/create', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const {
    affiliateId,
    leadId,
    membershipTierOrCategory,
    eligibleSaleAmount,
    verificationNotes
  } = req.body;

  if (!affiliateId || !membershipTierOrCategory || !eligibleSaleAmount) {
    return res.status(400).json({ error: 'Affiliate ID, category, and eligible amount are required.' });
  }

  try {
    const conversion = await createConversion({
      affiliateId,
      leadId: leadId || undefined,
      membershipTierOrCategory,
      eligibleSaleAmount: Number(eligibleSaleAmount),
      verificationNotes: verificationNotes?.trim() || 'Verified against executed contingency contract and bank settlement.',
      verifiedBy: req.user!.fullName
    });

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'CONVERSION_VERIFIED',
      'conversion',
      conversion.id,
      `Logged verified conversion for $${eligibleSaleAmount} USD attributed to affiliate ${affiliateId}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      conversion
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create verified conversion', message: err.message });
  }
});

adminRouter.post('/conversions/:id/verify', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { verificationStatus, verificationNotes } = req.body;

  try {
    const conversion = await verifyConversion(
      id,
      verificationStatus,
      verificationNotes,
      req.user!.fullName
    );

    res.json({ success: true, conversion });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify conversion', message: err.message });
  }
});

// 7. Commissions Management
adminRouter.get('/commissions', requireRoles('super_admin', 'finance_manager'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const commissions = await getCommissions();
    res.json({ commissions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch commissions', message: err.message });
  }
});

// Generate Commission from Verified Conversion
adminRouter.post('/commissions/generate', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { conversionId, ruleId, customRate } = req.body;

  if (!conversionId) {
    return res.status(400).json({ error: 'Conversion ID is required.' });
  }

  try {
    const newCommission = await generateCommission({
      conversionId,
      ruleId,
      customRate: customRate !== undefined && customRate !== null ? Number(customRate) : undefined,
      approvedBy: req.user!.fullName
    });

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'COMMISSION_GENERATED',
      'commission',
      newCommission.id,
      `Calculated commission for conversion ${conversionId}: $${newCommission.commission_amount || newCommission.commissionAmount} USD`,
      req.ip
    );

    res.status(201).json({
      success: true,
      commission: newCommission
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate commission', message: err.message });
  }
});

// Approve or Reverse Commission
adminRouter.post('/commissions/:id/action', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { action, auditReason } = req.body;

  if (action !== 'approve' && action !== 'reverse') {
    return res.status(400).json({ error: 'Action must be approve or reverse.' });
  }

  try {
    const commission = await actionCommission(id, action, auditReason || 'Finance audit verification', req.user!.email);

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      action === 'approve' ? 'COMMISSION_APPROVED' : 'COMMISSION_REVERSED',
      'commission',
      id,
      `Commission ${id} ${action}d. Reason: ${auditReason || 'Routine review'}`,
      req.ip
    );

    res.json({ success: true, commission });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update commission', message: err.message });
  }
});

// Commission Rules Management
adminRouter.get('/commission-rules', requireRoles('super_admin', 'finance_manager'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await getCommissionRules();
    res.json({ rules });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch commission rules', message: err.message });
  }
});

adminRouter.post('/commission-rules', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { name, serviceCategory, ratePercent, description, status } = req.body;

  if (!name || !serviceCategory || !ratePercent) {
    return res.status(400).json({ error: 'Rule name, service category, and rate percent are required.' });
  }

  try {
    const rule = await createCommissionRule({
      name: name.trim(),
      serviceCategory: serviceCategory.trim(),
      ratePercent: Number(ratePercent),
      status: status || 'inactive',
      description: description?.trim() || '',
      approvedBy: req.user!.fullName
    });

    res.status(201).json({ success: true, rule });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create commission rule', message: err.message });
  }
});

adminRouter.post('/commission-rules/:id/status', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ error: 'Status must be active or inactive.' });
  }

  try {
    const rule = await toggleCommissionRuleStatus(id, status);
    res.json({ success: true, rule });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update rule status', message: err.message });
  }
});

// 8. Payout Management
adminRouter.get('/payouts', requireRoles('super_admin', 'finance_manager'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const payouts = await getPayouts();
    res.json({ payouts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch payouts', message: err.message });
  }
});

// Prepare Payout Batch
adminRouter.post('/payouts/prepare', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { affiliateId, payoutPeriod, paymentMethod } = req.body;

  if (!affiliateId) {
    return res.status(400).json({ error: 'Affiliate ID is required.' });
  }

  try {
    const payout = await preparePayoutBatch({
      affiliateId,
      payoutPeriod,
      paymentMethod,
      preparedBy: req.user!.fullName
    });

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'PAYOUT_BATCH_PREPARED',
      'payout',
      payout.id,
      `Prepared scheduled payout batch for affiliate ${affiliateId}: $${payout.amount} USD`,
      req.ip
    );

    res.status(201).json({
      success: true,
      payout
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to prepare payout batch', message: err.message });
  }
});

// Record completed payout
adminRouter.post('/payouts/:id/record-payment', requireRoles('super_admin', 'finance_manager'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { paymentReference, notes } = req.body;

  if (!paymentReference || typeof paymentReference !== 'string' || paymentReference.trim().length < 4) {
    return res.status(400).json({ error: 'Valid banking/wire payment reference is required.' });
  }

  try {
    const payout = await recordPayoutPayment(
      id,
      paymentReference.trim(),
      notes?.trim(),
      req.user!.fullName
    );

    await recordAuditLog(
      req.user!.email,
      req.user!.role,
      'PAYOUT_DISBURSED',
      'payout',
      id,
      `Settled payout ${id} ($${payout.amount} USD). Bank Reference: ${paymentReference}`,
      req.ip
    );

    res.json({
      success: true,
      message: 'Payout recorded as paid.',
      payout
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record payout payment', message: err.message });
  }
});

// 9. Audit Logs
adminRouter.get('/audit-logs', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const auditLogs = await getAuditLogs();
    res.json({ auditLogs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs', message: err.message });
  }
});
