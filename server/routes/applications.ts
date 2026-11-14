import { Router, Request, Response } from 'express';
import {
  createAffiliateApplication,
  getAffiliateApplicationByEmail,
  getAffiliateApplicationByRef,
  recordAuditLog
} from '../supabase.js';
import { sendAffiliateRegistrationConfirmation } from '../services/mailer.js';

export const applicationsRouter = Router();

const appSubmissionAttempts: Map<string, { count: number; firstAttempt: number }> = new Map();
const APP_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_APP_SUBMISSIONS = 5;

// Submit new affiliate application
applicationsRouter.post('/', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const nowMs = Date.now();
  const rec = appSubmissionAttempts.get(ip);
  if (!rec || nowMs - rec.firstAttempt > APP_WINDOW) {
    appSubmissionAttempts.set(ip, { count: 1, firstAttempt: nowMs });
  } else {
    rec.count += 1;
    if (rec.count > MAX_APP_SUBMISSIONS) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Submission limit reached. Please wait before submitting another candidacy dossier.'
      });
    }
  }

  const {
    fullName,
    applicantType,
    businessName,
    email,
    phone,
    country,
    partnershipCategory,
    industryBackground,
    audienceDescription,
    partnershipObjectives,
    additionalInfo,
    termsAccepted,
    privacyAccepted
  } = req.body;

  // Server-side validations
  const errors: Record<string, string> = {};

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.fullName = 'Full legal name is required (minimum 2 characters).';
  }

  if (applicantType !== 'Individual' && applicantType !== 'Business') {
    errors.applicantType = 'Please specify whether you are applying as an Individual or Business.';
  }

  if (applicantType === 'Business' && (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2)) {
    errors.businessName = 'Registered business entity name is required for corporate applications.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.email = 'A valid corporate or professional email address is required.';
  }

  if (!phone || typeof phone !== 'string' || phone.trim().length < 6) {
    errors.phone = 'Valid U.S. direct phone number is required.';
  }

  if (!country || typeof country !== 'string' || country.trim().length < 2) {
    errors.country = 'U.S. state or jurisdiction of entity registration is required.';
  }

  if (!partnershipCategory || typeof partnershipCategory !== 'string') {
    errors.partnershipCategory = 'Please select a primary partnership category.';
  }

  if (!industryBackground || typeof industryBackground !== 'string' || industryBackground.trim().length < 20) {
    errors.industryBackground = 'Please provide an overview of your industry background (minimum 20 characters).';
  }

  if (!audienceDescription || typeof audienceDescription !== 'string' || audienceDescription.trim().length < 20) {
    errors.audienceDescription = 'Please describe your client network or audience (minimum 20 characters).';
  }

  if (!partnershipObjectives || typeof partnershipObjectives !== 'string' || partnershipObjectives.trim().length < 20) {
    errors.partnershipObjectives = 'Please articulate your partnership objectives (minimum 20 characters).';
  }

  if (termsAccepted !== true) {
    errors.termsAccepted = 'Acceptance of the R3 Global Affiliate Terms is mandatory.';
  }

  if (privacyAccepted !== true) {
    errors.privacyAccepted = 'Acceptance of the R3 Privacy Notice and Data Governance is mandatory.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Duplicate check in database
    const existingApp = await getAffiliateApplicationByEmail(normalizedEmail);
    if (existingApp) {
      if (existingApp.status === 'SUBMITTED' || existingApp.status === 'UNDER_REVIEW') {
        return res.status(409).json({
          error: 'Duplicate application detected',
          message: `An application associated with ${normalizedEmail} is already actively being processed under reference ${existingApp.referenceNumber}. Our compliance team evaluates applications sequentially.`,
          referenceNumber: existingApp.referenceNumber,
          status: existingApp.status
        });
      }

      if (existingApp.status === 'APPROVED') {
        return res.status(409).json({
          error: 'Application already approved',
          message: `An application for ${normalizedEmail} has already been approved under reference ${existingApp.referenceNumber}. Please proceed to account activation or member login.`,
          referenceNumber: existingApp.referenceNumber,
          status: existingApp.status
        });
      }
    }

    // 2. Insert into permanent database
    const application = await createAffiliateApplication({
      fullName: fullName.trim(),
      applicantType,
      businessName: businessName?.trim() || undefined,
      email: normalizedEmail,
      phone: phone.trim(),
      country: country.trim(),
      partnershipCategory,
      industryBackground: industryBackground.trim(),
      audienceDescription: audienceDescription.trim(),
      partnershipObjectives: partnershipObjectives.trim(),
      additionalInfo: additionalInfo?.trim() || undefined,
      termsAccepted: true,
      privacyAccepted: true
    });

    // 3. Record audit log (non-blocking if audit table write experiences transient warning)
    await recordAuditLog(
      normalizedEmail,
      'affiliate',
      'APPLICATION_SUBMITTED',
      'affiliate_applications',
      application.id,
      `New partnership application submitted: ${application.referenceNumber} (${applicantType}${businessName ? ` - ${businessName}` : ''})`,
      ip
    ).catch(err => {
      console.warn('[R3 Applications] Audit log warning after application commit:', err.message);
    });

    // 4. Send Confirmation Email via Resend (never mask a successful DB save as a registration failure)
    let emailSent = false;
    try {
      const emailResult = await sendAffiliateRegistrationConfirmation({
        email: normalizedEmail,
        fullName: application.fullName,
        referenceNumber: application.referenceNumber
      });
      emailSent = emailResult.success;
    } catch (mailErr: any) {
      console.warn('[R3 Applications] Confirmation email notice:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Your partnership application has been formally received and logged in the R3 Global Affiliate registry.',
      referenceNumber: application.referenceNumber,
      status: application.status,
      submittedAt: application.submittedAt,
      applicantName: application.fullName,
      emailSent,
      application
    });
  } catch (err: any) {
    console.error('[R3 Application Error]:', err);
    res.status(500).json({
      error: 'Submission Failed',
      message: err.message || 'An unexpected error occurred while processing your partnership application.'
    });
  }
});

// Check application status by reference number and optional email
applicationsRouter.get('/status', async (req: Request, res: Response) => {
  const reference = (req.query.ref as string || '').trim().toUpperCase();
  const email = (req.query.email as string || '').trim().toLowerCase();

  if (!reference) {
    return res.status(400).json({ error: 'Application reference number is required.' });
  }

  try {
    const app = await getAffiliateApplicationByRef(reference, email || undefined);

    if (!app) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No application matching the provided reference number was found in the R3 registry.'
      });
    }

    res.json({
      referenceNumber: app.referenceNumber,
      applicantType: app.applicantType,
      fullName: app.fullName,
      businessName: app.businessName,
      status: app.status,
      statusNotes: app.statusNotes,
      submittedAt: app.submittedAt,
      updatedAt: app.updatedAt,
      activatedAffiliateId: app.activatedAffiliateId
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', message: err.message });
  }
});
