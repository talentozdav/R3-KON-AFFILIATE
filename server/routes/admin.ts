import { Router, Request, Response } from 'express';
import { db, verifyPassword } from '../db.js';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth.js';
import { ApplicationStatus, AffiliateStatus, CommissionRule } from '../types.js';
import {
  getClientRegistrations,
  updateClientRegistrationStatus,
  updateClientRegistrationInvitation,
  getClientNotes,
  insertClientNote,
  getClientFollowups,
  insertClientFollowup,
  supabaseAdmin,
  supabasePublic
} from '../supabase.js';
import { sendClientAccountInvitation } from '../services/mailer.js';

export const adminRouter = Router();

// ==============================================================================
// PUBLIC / UNPROTECTED ADMIN AUTH ENDPOINTS
// ==============================================================================

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

  // 2. Memory database fallback
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

  db.recordAuditLog(
    user.email,
    user.role,
    'ADMIN_LOGIN',
    'auth',
    user.id,
    `Admin login verified for role: ${user.role}`,
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
adminRouter.get('/overview', (req: AuthenticatedRequest, res: Response) => {
  const pendingApps = db.applications.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length;
  const activeAffiliatesCount = db.affiliates.filter(a => a.status === 'active').length;
  const totalLeads = db.leads.length;
  const verifiedConversions = db.conversions.filter(c => c.verificationStatus === 'verified').length;
  const pendingConversions = db.conversions.filter(c => c.verificationStatus === 'pending_verification').length;
  
  const pendingCommissionAmount = db.commissions
    .filter(c => c.status === 'pending')
    .reduce((s, c) => s + c.commissionAmount, 0);

  const approvedUnpaidCommissionAmount = db.commissions
    .filter(c => c.status === 'approved')
    .reduce((s, c) => s + c.commissionAmount, 0);

  const totalPaidOut = db.payouts
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + p.amount, 0);

  res.json({
    metrics: {
      pendingApplications: pendingApps,
      totalApplications: db.applications.length,
      activeAffiliates: activeAffiliatesCount,
      totalAffiliates: db.affiliates.length,
      totalLeads,
      verifiedConversions,
      pendingConversions,
      pendingCommissionApproval: pendingCommissionAmount,
      approvedUnpaidCommissions: approvedUnpaidCommissionAmount,
      totalPaidOutCommissions: totalPaidOut,
      activeCommissionRulesCount: db.commissionRules.filter(r => r.status === 'active').length
    }
  });
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
    db.recordAuditLog(
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

  db.recordAuditLog(
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

    db.recordAuditLog(
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
adminRouter.get('/applications', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    applications: db.applications
  });
});

// Review Application (Update status)
adminRouter.post('/applications/:id/review', requireRoles('super_admin', 'affiliate_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, statusNotes } = req.body as { status: ApplicationStatus; statusNotes?: string };

  const validStatuses: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'INFORMATION_REQUESTED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const app = db.applications.find(a => a.id === id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const prevStatus = app.status;
  app.status = status;
  app.statusNotes = statusNotes || app.statusNotes;
  app.reviewedBy = req.user!.fullName;
  app.reviewedAt = new Date().toISOString();
  app.updatedAt = new Date().toISOString();

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'APPLICATION_REVIEWED',
    'application',
    app.id,
    `Application ${app.referenceNumber} status changed from ${prevStatus} to ${status}. Notes: ${statusNotes || 'None'}`,
    req.ip
  );

  res.json({
    success: true,
    message: `Application ${app.referenceNumber} updated to ${status}.`,
    application: app
  });
});

// Activate Approved Application into an Active Affiliate
adminRouter.post('/applications/:id/activate', requireRoles('super_admin', 'affiliate_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { customCode, approvedRatePercent } = req.body;

  const app = db.applications.find(a => a.id === id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (app.status !== 'APPROVED') {
    return res.status(400).json({ error: `Application must be in APPROVED status prior to activation. Current status: ${app.status}` });
  }

  const existingAffiliate = db.affiliates.find(a => a.email.toLowerCase() === app.email.toLowerCase());
  if (existingAffiliate) {
    return res.status(400).json({ error: 'An active affiliate profile already exists for this candidate.' });
  }

  const affiliateNumber = `R3-AFF-${Math.floor(1000 + Math.random() * 9000)}`;
  const referralCode = customCode ? customCode.trim().toUpperCase() : `${app.fullName.split(' ').pop()?.toUpperCase() || 'PARTNER'}-R3`;

  const newAffiliate = {
    id: `aff_${Date.now()}`,
    affiliateNumber,
    userId: `usr_${Date.now()}`,
    fullName: app.fullName,
    email: app.email,
    businessName: app.businessName,
    referralCode,
    status: 'active' as const,
    joinedAt: new Date().toISOString(),
    approvedRatePercent: approvedRatePercent ? Number(approvedRatePercent) : 10.0,
    totalClicks: 0,
    uniqueVisitors: 0
  };

  db.affiliates.unshift(newAffiliate);
  app.activatedAffiliateId = newAffiliate.id;

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'AFFILIATE_ACTIVATED',
    'affiliate',
    newAffiliate.id,
    `Activated affiliate ${affiliateNumber} (${app.fullName}) with code ${referralCode} and rate ${newAffiliate.approvedRatePercent}%`,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: `Affiliate partner successfully activated: ${affiliateNumber}`,
    affiliate: newAffiliate
  });
});

// 4. Affiliates List
adminRouter.get('/affiliates', requireRoles('super_admin', 'affiliate_manager', 'finance_manager'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({ affiliates: db.affiliates });
});

// Update Affiliate Status
adminRouter.post('/affiliates/:id/status', requireRoles('super_admin', 'affiliate_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body as { status: AffiliateStatus; reason?: string };

  const validStatuses: AffiliateStatus[] = ['active', 'suspended', 'terminated', 'pending'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid affiliate status. Valid options: ${validStatuses.join(', ')}` });
  }

  const affiliate = db.affiliates.find(a => a.id === id);
  if (!affiliate) {
    return res.status(404).json({ error: 'Affiliate not found' });
  }

  const prevStatus = affiliate.status;
  affiliate.status = status;

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'AFFILIATE_STATUS_CHANGED',
    'affiliate',
    affiliate.id,
    `Affiliate ${affiliate.affiliateNumber} status updated from ${prevStatus} to ${status}. Reason: ${reason || 'Governance review'}`,
    req.ip
  );

  res.json({
    success: true,
    message: `Affiliate ${affiliate.affiliateNumber} updated to ${status}.`,
    affiliate
  });
});

// 5. Referrals & Attributed Inquiries
adminRouter.get('/referrals', requireRoles('super_admin', 'affiliate_manager'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    leads: db.leads,
    clicks: db.clicks
  });
});

// 6. Conversions Management
adminRouter.get('/conversions', requireRoles('super_admin', 'affiliate_manager', 'finance_manager'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({ conversions: db.conversions });
});

// Manual Conversion Verification
adminRouter.post('/conversions/create', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const {
    affiliateId,
    leadId,
    membershipTierOrCategory,
    eligibleSaleAmount,
    verificationStatus,
    verificationNotes
  } = req.body;

  if (!affiliateId || !membershipTierOrCategory || !eligibleSaleAmount) {
    return res.status(400).json({ error: 'Affiliate ID, category, and eligible amount are required.' });
  }

  const affiliate = db.affiliates.find(a => a.id === affiliateId);
  if (!affiliate) {
    return res.status(404).json({ error: 'Affiliate not found' });
  }

  const txRef = `CTX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const conversion = {
    id: `cnv_${Date.now()}`,
    transactionReference: txRef,
    affiliateId,
    leadId: leadId || undefined,
    membershipTierOrCategory,
    eligibleSaleAmount: Number(eligibleSaleAmount),
    currency: 'USD',
    verificationStatus: (verificationStatus || 'verified') as any,
    verificationNotes: verificationNotes?.trim() || 'Verified against executed contingency contract and bank settlement.',
    verifiedBy: req.user!.fullName,
    verifiedAt: now,
    transactionDate: now,
    createdAt: now
  };

  db.conversions.unshift(conversion);

  if (leadId) {
    const lead = db.leads.find(l => l.id === leadId);
    if (lead) {
      lead.status = 'converted';
      lead.updatedAt = now;
    }
  }

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'CONVERSION_VERIFIED',
    'conversion',
    conversion.id,
    `Logged verified conversion ${txRef} for $${eligibleSaleAmount} USD attributed to ${affiliate.affiliateNumber}`,
    req.ip
  );

  res.status(201).json({
    success: true,
    conversion
  });
});

adminRouter.post('/conversions/:id/verify', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { verificationStatus, verificationNotes } = req.body;

  const conversion = db.conversions.find(c => c.id === id);
  if (!conversion) {
    return res.status(404).json({ error: 'Conversion record not found' });
  }

  conversion.verificationStatus = verificationStatus;
  conversion.verificationNotes = verificationNotes || conversion.verificationNotes;
  conversion.verifiedBy = req.user!.fullName;
  conversion.verifiedAt = new Date().toISOString();

  res.json({ success: true, conversion });
});

// 7. Commissions Management
adminRouter.get('/commissions', requireRoles('super_admin', 'finance_manager'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({ commissions: db.commissions });
});

// Generate Commission from Verified Conversion
adminRouter.post('/commissions/generate', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { conversionId, ruleId, customRate } = req.body;

  const conversion = db.conversions.find(c => c.id === conversionId);
  if (!conversion) {
    return res.status(404).json({ error: 'Verified conversion record not found.' });
  }

  if (conversion.verificationStatus !== 'verified') {
    return res.status(400).json({ error: 'Commission can only be generated on VERIFIED conversions.' });
  }

  const existingCommission = db.commissions.find(c => c.conversionId === conversionId);
  if (existingCommission) {
    return res.status(400).json({ error: 'A commission record has already been generated for this transaction reference.' });
  }

  const affiliate = db.affiliates.find(a => a.id === conversion.affiliateId);
  if (!affiliate) {
    return res.status(404).json({ error: 'Associated affiliate record not found.' });
  }

  let rate = affiliate.approvedRatePercent;
  if (customRate !== undefined && customRate !== null) {
    rate = Number(customRate);
  } else if (ruleId) {
    const rule = db.commissionRules.find(r => r.id === ruleId && r.status === 'active');
    if (rule) rate = rule.ratePercent;
  }

  const commissionAmount = Number(((conversion.eligibleSaleAmount * rate) / 100).toFixed(2));
  const commissionRef = `COM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const newCommission = {
    id: `com_${Date.now()}`,
    commissionReference: commissionRef,
    affiliateId: affiliate.id,
    conversionId: conversion.id,
    transactionReference: conversion.transactionReference,
    eligibleTransactionAmount: conversion.eligibleSaleAmount,
    appliedCommissionRate: rate,
    commissionAmount,
    currency: 'USD',
    status: 'approved' as const,
    approvedBy: req.user!.fullName,
    approvedAt: now,
    dateRecorded: now
  };

  db.commissions.unshift(newCommission);

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'COMMISSION_GENERATED',
    'commission',
    newCommission.id,
    `Calculated approved commission ${commissionRef} for $${commissionAmount} USD (${rate}% on $${conversion.eligibleSaleAmount} base) for ${affiliate.affiliateNumber}`,
    req.ip
  );

  res.status(201).json({
    success: true,
    commission: newCommission
  });
});

// Approve or Reverse Commission
adminRouter.post('/commissions/:id/action', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { action, auditReason } = req.body;

  const commission = db.commissions.find(c => c.id === id);
  if (!commission) {
    return res.status(404).json({ error: 'Commission not found' });
  }

  if (action === 'approve') {
    commission.status = 'approved';
    commission.approvedBy = req.user!.fullName;
    commission.approvedAt = new Date().toISOString();
  } else if (action === 'reverse') {
    commission.status = 'reversed';
    commission.auditReason = auditReason || 'Reversed by finance audit';
  }

  res.json({ success: true, commission });
});

// Commission Rules Management
adminRouter.get('/commission-rules', requireRoles('super_admin', 'finance_manager'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({ rules: db.commissionRules });
});

adminRouter.post('/commission-rules', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { name, serviceCategory, ratePercent, effectiveDate, description, status } = req.body;

  if (!name || !serviceCategory || !ratePercent) {
    return res.status(400).json({ error: 'Rule name, service category, and rate percent are required.' });
  }

  const newRule: CommissionRule = {
    id: `rule_${Date.now()}`,
    name: name.trim(),
    serviceCategory: serviceCategory.trim(),
    ratePercent: Number(ratePercent),
    status: status || 'inactive',
    effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
    approvedBy: req.user!.fullName,
    approvedAt: new Date().toISOString(),
    description: description?.trim()
  };

  db.commissionRules.unshift(newRule);
  res.status(201).json({ success: true, rule: newRule });
});

adminRouter.post('/commission-rules/:id/status', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const rule = db.commissionRules.find(r => r.id === id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  rule.status = status;
  res.json({ success: true, rule });
});

// 8. Payout Management
adminRouter.get('/payouts', requireRoles('super_admin', 'finance_manager'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({ payouts: db.payouts });
});

// Prepare Payout Batch
adminRouter.post('/payouts/prepare', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { affiliateId, payoutPeriod, paymentMethod } = req.body;

  const affiliate = db.affiliates.find(a => a.id === affiliateId);
  if (!affiliate) {
    return res.status(404).json({ error: 'Affiliate not found' });
  }

  const approvedCommissions = db.commissions.filter(
    c => c.affiliateId === affiliateId && c.status === 'approved' && !c.payoutId
  );

  if (approvedCommissions.length === 0) {
    return res.status(400).json({ error: 'No approved unpaid commissions eligible for payout.' });
  }

  const totalAmount = approvedCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const payoutRef = `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const newPayout = {
    id: `pay_${Date.now()}`,
    payoutReference: payoutRef,
    affiliateId,
    payoutPeriod: payoutPeriod || `Batch ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
    amount: totalAmount,
    currency: 'USD',
    status: 'scheduled' as const,
    paymentMethod: paymentMethod || 'SWIFT Wire Transfer',
    commissionIds: approvedCommissions.map(c => c.id),
    preparedBy: req.user!.fullName,
    createdAt: now
  };

  db.payouts.unshift(newPayout);

  approvedCommissions.forEach(c => {
    c.payoutId = newPayout.id;
  });

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'PAYOUT_BATCH_PREPARED',
    'payout',
    newPayout.id,
    `Prepared scheduled payout batch ${payoutRef} for $${totalAmount} USD across ${approvedCommissions.length} commissions for ${affiliate.affiliateNumber}`,
    req.ip
  );

  res.status(201).json({
    success: true,
    payout: newPayout
  });
});

// Record completed payout
adminRouter.post('/payouts/:id/record-payment', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { paymentReference, notes } = req.body;

  if (!paymentReference || typeof paymentReference !== 'string' || paymentReference.trim().length < 4) {
    return res.status(400).json({ error: 'Valid banking/wire payment reference is required.' });
  }

  const payout = db.payouts.find(p => p.id === id);
  if (!payout) {
    return res.status(404).json({ error: 'Payout batch not found' });
  }

  payout.status = 'paid';
  payout.paymentReference = paymentReference.trim();
  payout.notes = notes?.trim() || payout.notes;
  payout.processedBy = req.user!.fullName;
  payout.processedAt = new Date().toISOString();

  db.commissions.forEach(c => {
    if (payout.commissionIds.includes(c.id)) {
      c.status = 'paid';
    }
  });

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'PAYOUT_DISBURSED',
    'payout',
    payout.id,
    `Completed payout ${payout.payoutReference} ($${payout.amount} USD). Payment Ref: ${paymentReference}`,
    req.ip
  );

  res.json({
    success: true,
    message: `Payout ${payout.payoutReference} recorded as paid.`,
    payout
  });
});

// 9. Audit Logs
adminRouter.get('/audit-logs', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ auditLogs: db.auditLogs });
});
