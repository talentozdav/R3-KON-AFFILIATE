import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getAffiliateByCode,
  recordReferralClick,
  createReferralLead,
  insertClientInquiry,
  insertClientRegistration,
  getClientRegistrationByEmail,
  recordAuditLog
} from '../supabase.js';
import { validateInternationalPhone, isValidEmail } from '../utils/validation.js';

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

  const validationErrors: Record<string, string> = {};
  if (!clientName || typeof clientName !== 'string' || clientName.trim().length < 2) {
    validationErrors.clientName = 'Client or principal name is required (minimum 2 characters).';
  }
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    validationErrors.email = 'Valid business or personal email is required.';
  }
  if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
    const phoneCheck = validateInternationalPhone(String(phone));
    if (!phoneCheck.valid) {
      validationErrors.phone = phoneCheck.error || 'Valid international telephone number is required.';
    }
  }
  if (!serviceInterest || typeof serviceInterest !== 'string' || serviceInterest.trim().length < 2) {
    validationErrors.serviceInterest = 'Service interest category is required.';
  }

  if (Object.keys(validationErrors).length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationErrors,
      message: 'Name, valid email, and service interest are required.'
    });
  }

  const normalizedCountry =
    typeof country === 'string' && country.trim() ? country.trim() : 'International';
  const normalizedOrganization =
    typeof organization === 'string' && organization.trim() ? organization.trim() : undefined;

  let affiliateId = '';
  let cleanCode = '';

  try {
    if (referralCode && typeof referralCode === 'string' && referralCode.trim()) {
      const affiliate = await getAffiliateByCode(referralCode.trim().toUpperCase());
      if (affiliate && affiliate.status === 'active') {
        affiliateId = affiliate.id;
        cleanCode = affiliate.referralCode;
      }
    }

    // 1. If valid affiliate attribution exists, create lead record for affiliate
    if (affiliateId) {
      const maskedClient = normalizedOrganization
        ? `${normalizedOrganization} (${normalizedCountry})`
        : `Private Principal (${normalizedCountry})`;

      const leadRecord = await createReferralLead({
        affiliateId,
        referralCode: cleanCode,
        clientIdentifier: maskedClient,
        clientType: normalizedOrganization ? 'Corporate' : 'Individual',
        region: normalizedCountry,
        serviceCategory: serviceInterest.trim(),
        notes: `Inquiry submitted via partner link [${cleanCode}]. Brief: ${briefSummary ? String(briefSummary).trim() : 'Confidential introduction.'}`
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

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Persist into Supabase CRM tables: ensure client_registrations record exists first, then link client_inquiries.registration_id
    let registration = await getClientRegistrationByEmail(normalizedEmail);
    if (!registration) {
      registration = await insertClientRegistration({
        fullName: clientName.trim(),
        email: normalizedEmail,
        phone: phone ? String(phone).trim() : undefined,
        company: normalizedOrganization,
        country: normalizedCountry,
        serviceCategory: serviceInterest.trim(),
        requirementsBrief: briefSummary ? String(briefSummary).trim() : undefined,
        referralCode: cleanCode || undefined
      });
    }

    const inquiryRecord = await insertClientInquiry({
      registrationId: registration.id,
      clientId: registration.userId,
      clientName: clientName.trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : undefined,
      organization: normalizedOrganization,
      country: normalizedCountry,
      serviceInterest: serviceInterest.trim(),
      briefSummary: briefSummary ? String(briefSummary).trim() : undefined
    });

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been received by R3 Contingencies executive intake. A senior coordinator will contact you confidentially.',
      referenceNumber: inquiryRecord.referenceNumber,
      registrationId: registration.id,
      registrationReferenceNumber: registration.referenceNumber,
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
