import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

export const affiliatesRouter = Router();

// Private Affiliate Portal Dashboard
affiliatesRouter.get('/portal', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  let targetAffiliateId = user.affiliateId;

  // If administrator is previewing an affiliate, allow viewing specific affiliateId via query
  if (user.role !== 'affiliate' && req.query.affiliateId) {
    targetAffiliateId = req.query.affiliateId as string;
  }

  if (!targetAffiliateId) {
    return res.status(404).json({
      error: 'Affiliate record not found',
      message: 'This account does not have an active affiliate partnership profile attached.'
    });
  }

  const dashboardData = db.getAffiliateDashboard(targetAffiliateId);
  if (!dashboardData) {
    return res.status(404).json({
      error: 'Affiliate not found',
      message: 'The requested affiliate partner profile could not be located.'
    });
  }

  // Ensure security: Affiliates see clean, privacy-compliant views
  res.json({
    success: true,
    data: dashboardData
  });
});

// Affiliate submits a lead introduction directly through their portal
affiliatesRouter.post('/submit-lead', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const affiliateId = user.affiliateId || (user.role !== 'affiliate' ? req.body.affiliateId : null);

  if (!affiliateId) {
    return res.status(403).json({ error: 'Valid affiliate profile required to submit lead.' });
  }

  const affiliate = db.getAffiliateById(affiliateId);
  if (!affiliate || affiliate.status !== 'active') {
    return res.status(403).json({ error: 'Affiliate partnership is not in active standing.' });
  }

  const { clientIdentifier, clientType, region, serviceCategory, estimatedValue, notes } = req.body;

  if (!clientIdentifier || typeof clientIdentifier !== 'string' || clientIdentifier.trim().length < 3) {
    return res.status(400).json({ error: 'Client organization or descriptive identifier is required.' });
  }

  if (!serviceCategory) {
    return res.status(400).json({ error: 'Service category is required.' });
  }

  const newLead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    affiliateId: affiliate.id,
    referralCode: affiliate.referralCode,
    clientIdentifier: clientIdentifier.trim(),
    clientType: clientType || 'Corporate',
    region: region || 'International',
    serviceCategory,
    status: 'in_review' as const,
    estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
    notes: notes?.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.leads.unshift(newLead);

  db.recordAuditLog(
    user.email,
    user.role,
    'LEAD_SUBMITTED',
    'affiliate',
    affiliate.id,
    `New prospective client lead submitted by affiliate ${affiliate.affiliateNumber}: ${newLead.clientIdentifier}`,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'Prospective client lead registered. R3 Coordination team will review compliance and reach out.',
    lead: newLead
  });
});
