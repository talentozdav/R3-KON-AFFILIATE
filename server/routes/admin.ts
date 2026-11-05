import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth.js';
import { ApplicationStatus, AffiliateStatus, CommissionRule } from '../types.js';

export const adminRouter = Router();

// Protect all admin routes: only super_admin, affiliate_manager, finance_manager
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

// 2. Applications Management
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
    return res.status(400).json({
      error: 'Cannot activate unapproved application',
      message: `Application must be APPROVED before activation. Current status: ${app.status}`
    });
  }

  if (app.activatedAffiliateId) {
    return res.status(400).json({
      error: 'Already activated',
      message: `This application has already been activated into affiliate ID ${app.activatedAffiliateId}.`
    });
  }

  // Derive referral code
  let referralCode = (customCode || '').trim().toUpperCase();
  if (!referralCode) {
    const lastName = app.fullName.split(' ').pop() || 'PARTNER';
    referralCode = `${lastName.replace(/[^A-Z]/gi, '').toUpperCase()}-R3`;
  }

  // Ensure unique referral code
  let finalCode = referralCode;
  let counter = 1;
  while (db.affiliates.some(a => a.referralCode === finalCode)) {
    finalCode = `${referralCode}-${counter}`;
    counter++;
  }

  const randomAffNumber = Math.floor(1000 + Math.random() * 9000);
  const affiliateNumber = `R3-AFF-${randomAffNumber}`;
  const now = new Date().toISOString();

  // Create user record for affiliate
  const newUserId = `usr_${Date.now()}`;
  const affiliateId = `aff_${randomAffNumber}`;

  db.users.push({
    id: newUserId,
    email: app.email,
    fullName: app.fullName,
    role: 'affiliate',
    affiliateId,
    status: 'active',
    createdAt: now
  });

  const rate = typeof approvedRatePercent === 'number' && approvedRatePercent > 0 ? approvedRatePercent : 10.0;

  const newAffiliate = {
    id: affiliateId,
    affiliateNumber,
    userId: newUserId,
    fullName: app.fullName,
    email: app.email,
    businessName: app.businessName,
    referralCode: finalCode,
    status: 'active' as const,
    joinedAt: now,
    approvedRatePercent: rate,
    totalClicks: 0,
    uniqueVisitors: 0
  };

  db.affiliates.unshift(newAffiliate);
  app.activatedAffiliateId = affiliateId;
  app.updatedAt = now;

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'AFFILIATE_ACTIVATED',
    'affiliate',
    affiliateId,
    `Activated application ${app.referenceNumber}. Provisioned Affiliate ${affiliateNumber} with referral code ${finalCode} at approved rate ${rate}%.`,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: `Affiliate ${affiliateNumber} successfully provisioned and activated.`,
    affiliate: newAffiliate
  });
});

// 3. Affiliates Management
adminRouter.get('/affiliates', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ affiliates: db.affiliates });
});

// Update affiliate status (Active, Suspended, Terminated)
adminRouter.post('/affiliates/:id/status', requireRoles('super_admin', 'affiliate_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body as { status: AffiliateStatus; reason?: string };

  const affiliate = db.affiliates.find(a => a.id === id);
  if (!affiliate) {
    return res.status(404).json({ error: 'Affiliate not found' });
  }

  const prevStatus = affiliate.status;
  affiliate.status = status;

  // Also update corresponding user status
  const user = db.users.find(u => u.id === affiliate.userId);
  if (user) {
    user.status = status === 'active' ? 'active' : 'suspended';
  }

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'AFFILIATE_STATUS_CHANGE',
    'affiliate',
    affiliate.id,
    `Affiliate ${affiliate.affiliateNumber} changed from ${prevStatus} to ${status}. Reason: ${reason || 'Governance review'}`,
    req.ip
  );

  res.json({
    success: true,
    message: `Affiliate ${affiliate.affiliateNumber} status updated to ${status}.`,
    affiliate
  });
});

// 4. Referral & Leads Management
adminRouter.get('/referrals', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    leads: db.leads,
    clicks: db.clicks.slice(0, 50)
  });
});

// 5. Conversions Management
adminRouter.get('/conversions', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ conversions: db.conversions });
});

// Record new conversion
adminRouter.post('/conversions/create', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { affiliateId, leadId, membershipTierOrCategory, eligibleSaleAmount, verificationStatus, verificationNotes } = req.body;

  const affiliate = db.getAffiliateById(affiliateId);
  if (!affiliate) {
    return res.status(400).json({ error: 'Valid affiliate is required' });
  }

  if (!eligibleSaleAmount || Number(eligibleSaleAmount) <= 0) {
    return res.status(400).json({ error: 'Eligible transaction sale amount must be positive' });
  }

  const txRef = `CTX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const newConversion = {
    id: `cnv_${Date.now()}`,
    transactionReference: txRef,
    affiliateId: affiliate.id,
    leadId: leadId || undefined,
    membershipTierOrCategory: membershipTierOrCategory || 'Executive Contingency Retainer',
    eligibleSaleAmount: Number(eligibleSaleAmount),
    currency: 'USD',
    verificationStatus: (verificationStatus || 'verified') as any,
    verificationNotes: verificationNotes?.trim(),
    verifiedBy: req.user!.fullName,
    verifiedAt: now,
    transactionDate: now,
    createdAt: now
  };

  db.conversions.unshift(newConversion);

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'CONVERSION_RECORDED',
    'conversion',
    newConversion.id,
    `Recorded transaction ${txRef} ($${newConversion.eligibleSaleAmount} USD) for affiliate ${affiliate.affiliateNumber}. Status: ${newConversion.verificationStatus}`,
    req.ip
  );

  res.status(201).json({
    success: true,
    conversion: newConversion
  });
});

// Verify conversion
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

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'CONVERSION_VERIFIED',
    'conversion',
    conversion.id,
    `Conversion ${conversion.transactionReference} verification status set to ${verificationStatus}. Notes: ${verificationNotes || 'Verified banking audit.'}`,
    req.ip
  );

  res.json({
    success: true,
    conversion
  });
});

// 6. Commission Management
adminRouter.get('/commissions', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ commissions: db.commissions });
});

// Generate commission strictly using verified transaction and approved active rules!
adminRouter.post('/commissions/generate', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { conversionId, ruleId, customRate } = req.body;

  const conversion = db.conversions.find(c => c.id === conversionId);
  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  if (conversion.verificationStatus !== 'verified') {
    return res.status(400).json({
      error: 'Cannot calculate commission on unverified conversion',
      message: `Transaction ${conversion.transactionReference} is in status '${conversion.verificationStatus}'. Only verified eligible transactions can generate commission records.`
    });
  }

  const affiliate = db.getAffiliateById(conversion.affiliateId);
  if (!affiliate) {
    return res.status(404).json({ error: 'Attributed affiliate not found' });
  }

  // Look up approved active rule
  let appliedRate = affiliate.approvedRatePercent || 10.0;
  if (ruleId) {
    const rule = db.commissionRules.find(r => r.id === ruleId);
    if (!rule) {
      return res.status(400).json({ error: 'Commission rule not found' });
    }
    if (rule.status !== 'active') {
      return res.status(400).json({
        error: 'Unapproved commission rule cannot be applied',
        message: `Rule '${rule.name}' is currently '${rule.status}'. Commercial terms must be active and approved by R3 administrators before calculation.`
      });
    }
    appliedRate = rule.ratePercent;
  } else if (typeof customRate === 'number' && customRate > 0) {
    appliedRate = customRate;
  }

  const commissionAmount = Math.round((conversion.eligibleSaleAmount * (appliedRate / 100)) * 100) / 100;
  const commissionRef = `COM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const newCommission = {
    id: `com_${Date.now()}`,
    commissionReference: commissionRef,
    affiliateId: affiliate.id,
    conversionId: conversion.id,
    transactionReference: conversion.transactionReference,
    eligibleTransactionAmount: conversion.eligibleSaleAmount,
    appliedCommissionRate: appliedRate,
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
    'COMMISSION_CALCULATED',
    'commission',
    newCommission.id,
    `Calculated approved commission ${commissionRef} for ${affiliate.affiliateNumber}: $${commissionAmount} USD (${appliedRate}% on $${conversion.eligibleSaleAmount} USD).`,
    req.ip
  );

  res.status(201).json({
    success: true,
    commission: newCommission
  });
});

// Approve or reverse commission with audit reason
adminRouter.post('/commissions/:id/action', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { action, auditReason } = req.body as { action: 'approve' | 'reverse'; auditReason: string };

  if (!auditReason || typeof auditReason !== 'string' || auditReason.trim().length < 5) {
    return res.status(400).json({ error: 'A formal compliance/audit reason is required for commission actions (min 5 chars).' });
  }

  const commission = db.commissions.find(c => c.id === id);
  if (!commission) {
    return res.status(404).json({ error: 'Commission not found' });
  }

  const prevStatus = commission.status;
  if (action === 'approve') {
    commission.status = 'approved';
    commission.approvedBy = req.user!.fullName;
    commission.approvedAt = new Date().toISOString();
  } else if (action === 'reverse') {
    commission.status = 'reversed';
  }
  commission.auditReason = auditReason.trim();

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    action === 'approve' ? 'COMMISSION_APPROVED' : 'COMMISSION_REVERSED',
    'commission',
    commission.id,
    `Commission ${commission.commissionReference} transitioned from ${prevStatus} to ${commission.status}. Reason: ${auditReason}`,
    req.ip
  );

  res.json({
    success: true,
    commission
  });
});

// 7. Commission Rules
adminRouter.get('/commission-rules', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ rules: db.commissionRules });
});

// Create/Update commission rule
adminRouter.post('/commission-rules', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { name, serviceCategory, ratePercent, status, description, effectiveDate } = req.body;

  if (!name || !serviceCategory || typeof ratePercent !== 'number' || ratePercent <= 0) {
    return res.status(400).json({ error: 'Name, service category, and positive rate percentage are required.' });
  }

  const newRule: CommissionRule = {
    id: `rule_${Date.now()}`,
    name: name.trim(),
    serviceCategory: serviceCategory.trim(),
    ratePercent: Number(ratePercent),
    status: status === 'active' ? 'active' : 'inactive',
    effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
    description: description?.trim() || '',
    approvedBy: status === 'active' ? req.user!.fullName : undefined,
    approvedAt: status === 'active' ? new Date().toISOString() : undefined
  };

  db.commissionRules.push(newRule);

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'COMMISSION_RULE_CREATED',
    'commission_rule',
    newRule.id,
    `Created rule '${newRule.name}' (${newRule.ratePercent}%) with status ${newRule.status}`,
    req.ip
  );

  res.status(201).json({
    success: true,
    rule: newRule
  });
});

// Toggle rule status
adminRouter.post('/commission-rules/:id/status', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const rule = db.commissionRules.find(r => r.id === id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  rule.status = status === 'active' ? 'active' : 'inactive';
  if (rule.status === 'active') {
    rule.approvedBy = req.user!.fullName;
    rule.approvedAt = new Date().toISOString();
  }

  db.recordAuditLog(
    req.user!.email,
    req.user!.role,
    'COMMISSION_RULE_STATUS',
    'commission_rule',
    rule.id,
    `Rule '${rule.name}' updated to status '${rule.status}' by ${req.user!.fullName}`,
    req.ip
  );

  res.json({ success: true, rule });
});

// 8. Payout Management
adminRouter.get('/payouts', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ payouts: db.payouts });
});

// Prepare payout batch for an affiliate's approved unpaid commissions
adminRouter.post('/payouts/prepare', requireRoles('super_admin', 'finance_manager'), (req: AuthenticatedRequest, res: Response) => {
  const { affiliateId, payoutPeriod, paymentMethod } = req.body;

  const affiliate = db.getAffiliateById(affiliateId);
  if (!affiliate) {
    return res.status(404).json({ error: 'Affiliate not found' });
  }

  // Get all approved commissions not yet assigned to a payout
  const approvedCommissions = db.commissions.filter(c => c.affiliateId === affiliate.id && c.status === 'approved' && !c.payoutId);

  if (approvedCommissions.length === 0) {
    return res.status(400).json({
      error: 'No approved commissions',
      message: `Affiliate ${affiliate.affiliateNumber} has no outstanding approved commissions to batch.`
    });
  }

  const totalAmount = approvedCommissions.reduce((s, c) => s + c.commissionAmount, 0);
  const payoutRef = `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const newPayout = {
    id: `pay_${Date.now()}`,
    payoutReference: payoutRef,
    affiliateId: affiliate.id,
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

  // Link commissions to this payout
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

  // Mark all linked commissions as paid
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
