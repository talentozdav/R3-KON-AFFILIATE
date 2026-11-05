import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { AffiliateApplication } from '../types.js';

export const applicationsRouter = Router();

// Submit new affiliate application
applicationsRouter.post('/', (req: Request, res: Response) => {
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
    errors.phone = 'Valid international direct phone number is required.';
  }

  if (!country || typeof country !== 'string' || country.trim().length < 2) {
    errors.country = 'Country of primary registration or residence is required.';
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

  // Duplicate check:
  // Prevent duplicate submissions if an application with this email is currently pending or active
  const existingApp = db.applications.find(a => a.email.toLowerCase() === normalizedEmail);
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

  // Generate institutional reference: R3-APP-2026-XXXX
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const referenceNumber = `R3-APP-2026-${randomSuffix}`;
  const now = new Date().toISOString();

  const newApplication: AffiliateApplication = {
    id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    referenceNumber,
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
    privacyAccepted: true,
    status: 'SUBMITTED', // Strictly SUBMITTED - does NOT create active affiliate account
    submittedAt: now,
    updatedAt: now
  };

  db.applications.unshift(newApplication);

  // Record audit log
  db.recordAuditLog(
    normalizedEmail,
    'affiliate',
    'APPLICATION_SUBMITTED',
    'application',
    newApplication.id,
    `New partnership application submitted: ${referenceNumber} (${applicantType}${businessName ? ` - ${businessName}` : ''})`,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'Your partnership application has been formally received and logged in the R3 Global Affiliate registry.',
    referenceNumber: newApplication.referenceNumber,
    status: newApplication.status,
    submittedAt: newApplication.submittedAt,
    applicantName: newApplication.fullName
  });
});

// Check application status by reference number and email
applicationsRouter.get('/status', (req: Request, res: Response) => {
  const reference = (req.query.ref as string || '').trim().toUpperCase();
  const email = (req.query.email as string || '').trim().toLowerCase();

  if (!reference) {
    return res.status(400).json({ error: 'Application reference number is required.' });
  }

  const app = db.applications.find(a => 
    a.referenceNumber.toUpperCase() === reference && 
    (!email || a.email.toLowerCase() === email)
  );

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
});
