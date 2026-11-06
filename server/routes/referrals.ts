import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import crypto from 'crypto';

export const referralsRouter = Router();

// Track referral link click and unique visitor
referralsRouter.post('/track', (req: Request, res: Response) => {
  const { code, referer } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Referral code is required' });
  }

  const cleanCode = code.trim().toUpperCase();
  const affiliate = db.getAffiliateByCode(cleanCode);

  if (!affiliate) {
    return res.status(404).json({
      error: 'Invalid referral code',
      message: 'The referral code does not correspond to an active partner.'
    });
  }

  if (affiliate.status !== 'active') {
    return res.status(403).json({
      error: 'Affiliate not active',
      message: 'This referral partner code is temporarily unavailable.'
    });
  }

  // Derive visitor hash from IP and user-agent for privacy-respecting unique visitor tracking
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const visitorHash = crypto.createHash('sha256').update(`${ip}-${ua}-${cleanCode}`).digest('hex').substring(0, 16);

  const trackingResult = db.trackReferralClick(cleanCode, visitorHash, referer, ua);

  res.json({
    success: true,
    affiliateNumber: affiliate.affiliateNumber,
    referralCode: affiliate.referralCode,
    isUnique: trackingResult?.isUnique ?? false,
    partnerEntity: affiliate.businessName || affiliate.fullName
  });
});

// Validate referral code
referralsRouter.get('/validate/:code', (req: Request, res: Response) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const affiliate = db.getAffiliateByCode(code);

  if (!affiliate || affiliate.status !== 'active') {
    return res.status(404).json({
      valid: false,
      message: 'Referral code is invalid or inactive.'
    });
  }

  res.json({
    valid: true,
    affiliateNumber: affiliate.affiliateNumber,
    referralCode: affiliate.referralCode,
    partnerName: affiliate.businessName || affiliate.fullName
  });
});

// Prospective client inquiry through referral attribution
referralsRouter.post('/inquire', (req: Request, res: Response) => {
  const {
    referralCode,
    clientName,
    organization,
    email,
    phone,
    country,
    serviceInterest,
    briefSummary
  } = req.body;

  if (!clientName || !email || !serviceInterest) {
    return res.status(400).json({ error: 'Name, email, and service interest are required.' });
  }

  let affiliateId = '';
  let cleanCode = '';

  if (referralCode) {
    const affiliate = db.getAffiliateByCode(referralCode.trim().toUpperCase());
    if (affiliate && affiliate.status === 'active') {
      affiliateId = affiliate.id;
      cleanCode = affiliate.referralCode;
    }
  }

  // If valid affiliate attribution exists, create lead record for affiliate
  let leadRecord = null;
  if (affiliateId) {
    leadRecord = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      affiliateId,
      referralCode: cleanCode,
      clientIdentifier: organization ? `${organization} (${country || 'International'})` : `Private Principal (${country || 'International'})`,
      clientType: (organization ? 'Corporate' : 'Individual') as any,
      region: country || 'International',
      serviceCategory: serviceInterest,
      status: 'in_review' as const,
      notes: `Inquiry submitted via affiliate link [${cleanCode}]. Brief: ${briefSummary || 'Confidential introduction.'}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.leads.unshift(leadRecord);

    db.recordAuditLog(
      'system',
      'affiliate',
      'LEAD_ATTRIBUTED',
      'affiliate',
      affiliateId,
      `Client inquiry attributed to partner ${cleanCode}: ${leadRecord.clientIdentifier}`,
      req.ip
    );
  }

  // Also persist directly into Supabase CRM
  import('../supabase.js').then(async ({ insertClientInquiry, insertClientRegistration }) => {
    try {
      await insertClientInquiry({
        clientName: clientName.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : undefined,
        organization: organization ? organization.trim() : undefined,
        country: country ? country.trim() : 'International',
        serviceInterest,
        briefSummary: briefSummary ? briefSummary.trim() : undefined
      });

      await insertClientRegistration({
        fullName: clientName.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : undefined,
        company: organization ? organization.trim() : undefined,
        country: country ? country.trim() : 'International',
        serviceCategory: serviceInterest,
        requirementsBrief: briefSummary ? briefSummary.trim() : undefined,
        referralCode: cleanCode || undefined
      });
    } catch (crmErr: any) {
      console.warn('[R3 Referrals Inquire] CRM persistence notice:', crmErr.message);
    }
  }).catch(console.error);

  res.status(201).json({
    success: true,
    message: 'Your inquiry has been received by R3 Contingencies executive intake. A senior coordinator will contact you confidentially.',
    attributed: Boolean(affiliateId),
    referralCode: cleanCode || null
  });
});
