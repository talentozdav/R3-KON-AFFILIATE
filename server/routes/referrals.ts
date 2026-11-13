import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getAffiliateByCode,
  recordReferralClick,
  createReferralLead,
  insertClientInquiry,
  insertClientRegistration,
  recordAuditLog
} from '../supabase.js';

export const referralsRouter = Router();

// Track referral link click and unique visitor
referralsRouter.post(['/track', '/track-click'], async (req: Request, res: Response) => {
  const code = req.body.code || req.body.referralCode;
  const referer = req.body.referer;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Referral code is required' });
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    const affiliate = await getAffiliateByCode(cleanCode);

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
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'unknown';
    const visitorHash = crypto.createHash('sha256').update(`${ip}-${ua}-${cleanCode}`).digest('hex').substring(0, 16);

    const trackingResult = await recordReferralClick({
      referralCode: cleanCode,
      visitorHash,
      referer,
      userAgent: ua
    });

    res.json({
      success: true,
      affiliateNumber: affiliate.affiliateNumber,
      referralCode: affiliate.referralCode,
      isUnique: trackingResult?.isUnique ?? false,
      partnerEntity: affiliate.businessName || affiliate.fullName
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Tracking failed', message: err.message });
  }
});

// Validate referral code
referralsRouter.get('/validate/:code', async (req: Request, res: Response) => {
  const code = (req.params.code || '').trim().toUpperCase();

  try {
    const affiliate = await getAffiliateByCode(code);

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
  } catch (err: any) {
    res.status(500).json({ valid: false, message: err.message });
  }
});

// Prospective client inquiry through referral attribution
referralsRouter.post(['/inquire', '/inquiry', '/lead'], async (req: Request, res: Response) => {
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

  try {
    if (referralCode) {
      const affiliate = await getAffiliateByCode(referralCode.trim().toUpperCase());
      if (affiliate && affiliate.status === 'active') {
        affiliateId = affiliate.id;
        cleanCode = affiliate.referralCode;
      }
    }

    // 1. If valid affiliate attribution exists, create lead record for affiliate
    if (affiliateId) {
      const maskedClient = organization
        ? `${organization} (${country || 'United States'})`
        : `Private Principal (${country || 'United States'})`;

      const leadRecord = await createReferralLead({
        affiliateId,
        referralCode: cleanCode,
        clientIdentifier: maskedClient,
        clientType: organization ? 'Corporate' : 'Individual',
        region: country || 'United States',
        serviceCategory: serviceInterest,
        notes: `Inquiry submitted via partner link [${cleanCode}]. Brief: ${briefSummary || 'Confidential introduction.'}`
      });

      await recordAuditLog(
        'system',
        'super_admin',
        'LEAD_ATTRIBUTED',
        'referral_leads',
        leadRecord.id,
        `Client inquiry attributed to partner ${cleanCode}: ${maskedClient}`,
        req.ip
      );
    }

    // 2. Persist directly into Supabase CRM tables
    const inquiryRecord = await insertClientInquiry({
      clientName: clientName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      organization: organization ? organization.trim() : undefined,
      country: country ? country.trim() : 'United States',
      serviceInterest,
      briefSummary: briefSummary ? briefSummary.trim() : undefined
    });

    await insertClientRegistration({
      fullName: clientName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      company: organization ? organization.trim() : undefined,
      country: country ? country.trim() : 'United States',
      serviceCategory: serviceInterest,
      requirementsBrief: briefSummary ? briefSummary.trim() : undefined,
      referralCode: cleanCode || undefined
    });

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been received by R3 Contingencies executive intake. A senior coordinator will contact you confidentially.',
      referenceNumber: inquiryRecord.referenceNumber,
      attributed: Boolean(affiliateId),
      leadAttributed: Boolean(affiliateId),
      referralCode: cleanCode || null
    });
  } catch (err: any) {
    console.error('[R3 Referrals Inquire Error]:', err);
    res.status(500).json({
      error: 'Inquiry processing failed',
      message: err.message || 'An error occurred while submitting inquiry.'
    });
  }
});
