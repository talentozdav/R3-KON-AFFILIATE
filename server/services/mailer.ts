import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'R3 Contingencies <services@r3-konaffiliate.online>';
const FALLBACK_FROM_EMAIL = 'R3 Contingencies <onboarding@resend.dev>';

let resendInstance: Resend | null = null;

if (RESEND_API_KEY) {
  try {
    resendInstance = new Resend(RESEND_API_KEY);
    console.log('[R3 Mailer] Resend API initialized successfully.');
  } catch (err: any) {
    console.error('[R3 Mailer] Failed to initialize Resend:', err.message);
  }
} else {
  console.warn('[R3 Mailer] RESEND_API_KEY is not set. Outbound emails will be simulated and logged.');
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Core dispatch function with graceful domain fallback and technical logging
 */
async function dispatchEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const { to, subject, html, text } = params;

  if (!resendInstance) {
    console.log(`[R3 Mailer Simulation] To: ${to} | Subject: "${subject}"`);
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured in this environment.'
    };
  }

  try {
    // Attempt with primary verified domain
    const response = await resendInstance.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ')
    });

    if (response.error) {
      // If domain verification is still in progress on Resend, attempt with onboarding fallback
      if (response.error.message?.includes('domain') || response.error.message?.includes('not verified')) {
        console.warn('[R3 Mailer] Primary domain not yet verified. Retrying via Resend onboarding address...');
        const fallbackRes = await resendInstance.emails.send({
          from: FALLBACK_FROM_EMAIL,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ' ')
        });

        if (fallbackRes.error) {
          return { success: false, error: fallbackRes.error.message };
        }
        return { success: true, messageId: fallbackRes.data?.id };
      }

      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (err: any) {
    console.error('[R3 Mailer Exception]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Event 1: Client Account Creation & Portal Invitation
 */
export async function sendClientAccountInvitation(params: {
  email: string;
  fullName: string;
  invitationUrl: string;
  referenceNumber: string;
}): Promise<SendEmailResult> {
  const { email, fullName, invitationUrl, referenceNumber } = params;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF9F6; padding: 40px 20px; color: #0A192F;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E2DDD3; padding: 36px;">
        <div style="border-bottom: 2px solid #0A192F; padding-bottom: 16px; margin-bottom: 24px;">
          <h2 style="font-family: Georgia, serif; color: #0A192F; margin: 0; font-size: 24px; letter-spacing: 0.5px;">R3 CONTINGENCIES</h2>
          <span style="font-size: 11px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Executive Client Coordination</span>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #2D3748;">
          Dear ${fullName},
        </p>

        <p style="font-size: 14px; line-height: 1.6; color: #2D3748;">
          Your formal client registration with R3 Contingencies has been recorded under reference:
          <strong style="color: #0A192F; font-family: monospace;">${referenceNumber}</strong>.
        </p>

        <p style="font-size: 14px; line-height: 1.6; color: #2D3748;">
          To complete your membership setup, access your encrypted case dossier, and configure your credentials for the private Client Portal, please activate your account below:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${invitationUrl}" style="background-color: #0A192F; color: #FAF9F6; padding: 14px 28px; text-decoration: none; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; display: inline-block; border: 1px solid #1A2E4C;">
            Activate Client Account
          </a>
        </div>

        <p style="font-size: 12px; line-height: 1.5; color: #718096;">
          If the button above does not render, paste the following link directly into your browser:<br/>
          <span style="font-family: monospace; word-break: break-all; color: #4A5568;">${invitationUrl}</span>
        </p>

        <div style="border-top: 1px solid #E2DDD3; margin-top: 36px; padding-top: 20px; font-size: 11px; color: #A0AEC0; line-height: 1.4;">
          <p style="margin: 0;">Discreet U.S. Fiduciary Architecture · U.S. Federal &amp; Delaware Compliance</p>
          <p style="margin: 4px 0 0 0;">Confidential Inquiries: services@r3-konaffiliate.online | +1(931)366-0615</p>
        </div>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: email,
    subject: `R3 Contingencies — Account Invitation [Ref: ${referenceNumber}]`,
    html
  });
}

/**
 * Event 2: Account Activation Confirmation
 */
export async function sendClientActivationConfirmation(params: {
  email: string;
  fullName: string;
}): Promise<SendEmailResult> {
  const { email, fullName } = params;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F6; padding: 40px 20px; color: #0A192F;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E2DDD3; padding: 36px;">
        <h2 style="font-family: Georgia, serif; color: #0A192F; margin: 0 0 12px 0;">Account Activated</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #2D3748;">
          Dear ${fullName},
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #2D3748;">
          Your private Client Portal account is now active. You may securely sign in at any time to review coordination status, submit advisory briefs, and coordinate with our crisis intake secretariat.
        </p>
        <p style="font-size: 11px; color: #718096; margin-top: 30px;">
          R3 Contingencies Secretariat · services@r3-konaffiliate.online
        </p>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: email,
    subject: 'R3 Contingencies — Client Portal Account Active',
    html
  });
}

/**
 * Event 3: Password Reset Instructions
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  const { email, resetUrl } = params;

  const html = `
    <div style="font-family: sans-serif; background-color: #FAF9F6; padding: 40px 20px; color: #0A192F;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E2DDD3; padding: 36px;">
        <h3 style="font-family: Georgia, serif; color: #0A192F; margin: 0 0 16px 0;">Password Reset Request</h3>
        <p style="font-size: 13px; color: #4A5568; line-height: 1.6;">
          A request to reset the credentials for your authorized R3 account has been initiated. If you made this request, please proceed below:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background: #0A192F; color: #fff; padding: 12px 24px; text-decoration: none; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">
            Reset Credentials
          </a>
        </div>
        <p style="font-size: 11px; color: #A0AEC0;">
          This link will expire in 60 minutes. If you did not initiate this request, no action is required.
        </p>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: email,
    subject: 'R3 Contingencies — Password Reset Request',
    html
  });
}

/**
 * Event 4: Client Registration Confirmation
 */
export async function sendClientRegistrationConfirmation(params: {
  email: string;
  fullName: string;
  referenceNumber: string;
}): Promise<SendEmailResult> {
  const { email, fullName, referenceNumber } = params;

  const html = `
    <div style="font-family: sans-serif; background-color: #FAF9F6; padding: 40px 20px; color: #0A192F;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E2DDD3; padding: 36px;">
        <h3 style="font-family: Georgia, serif; color: #0A192F; margin: 0 0 12px 0;">Registration Confirmed</h3>
        <p style="font-size: 14px; color: #2D3748; line-height: 1.6;">
          Dear ${fullName}, your registration has been logged under reference <strong>${referenceNumber}</strong>. An account activation link will arrive shortly.
        </p>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: email,
    subject: `R3 Contingencies — Registration Confirmed [${referenceNumber}]`,
    html
  });
}

/**
 * Event 5: Affiliate Application Confirmation
 */
export async function sendAffiliateRegistrationConfirmation(params: {
  email: string;
  fullName: string;
  referenceNumber: string;
}): Promise<SendEmailResult> {
  const { email, fullName, referenceNumber } = params;

  const html = `
    <div style="font-family: sans-serif; background-color: #FAF9F6; padding: 40px 20px; color: #0A192F;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E2DDD3; padding: 36px;">
        <h3 style="font-family: Georgia, serif; color: #0A192F; margin: 0 0 12px 0;">Partnership Application Received</h3>
        <p style="font-size: 14px; color: #2D3748; line-height: 1.6;">
          Dear ${fullName}, your application for the R3 Global Affiliate Network has been logged under reference <strong>${referenceNumber}</strong>. Our Intake Committee will complete due diligence review within 2 business days.
        </p>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: email,
    subject: `R3 Global Affiliate Network — Application Logged [${referenceNumber}]`,
    html
  });
}

export const sendAffiliateApplicationConfirmation = sendAffiliateRegistrationConfirmation;

/**
 * Event 6: Affiliate Approval & Activation Instructions
 */
export async function sendAffiliateApprovalActivation(params: {
  email: string;
  fullName: string;
  referralCode: string;
  activationUrl?: string;
  loginUrl?: string;
  approvedRatePercent?: number;
  referenceNumber?: string;
}): Promise<SendEmailResult> {
  const { email, fullName, referralCode } = params;
  const activationUrl = params.activationUrl || params.loginUrl || 'https://r3-kon.vercel.app/affiliate/portal?mode=login';

  const html = `
    <div style="font-family: sans-serif; background-color: #FAF9F6; padding: 40px 20px; color: #0A192F;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E2DDD3; padding: 36px;">
        <div style="border-bottom: 2px solid #0A192F; padding-bottom: 16px; margin-bottom: 24px;">
          <h2 style="font-family: Georgia, serif; color: #0A192F; margin: 0; font-size: 24px;">R3 CONTINGENCIES</h2>
          <span style="font-size: 11px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Global Affiliate Network</span>
        </div>
        <h3 style="font-family: Georgia, serif; color: #0A192F; margin: 0 0 12px 0;">Partnership Application Approved</h3>
        <p style="font-size: 14px; color: #2D3748; line-height: 1.6;">
          Dear ${fullName}, we are pleased to inform you that your application for the R3 Global Affiliate Network has been approved.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; margin: 20px 0; font-family: monospace;">
          <div>Designated Referral Code: <strong>${referralCode}</strong></div>
        </div>
        <p style="font-size: 14px; color: #2D3748; line-height: 1.6;">
          Please complete your partnership account activation and security setup via the link below:
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${activationUrl}" style="background-color: #0A192F; color: #FAF9F6; padding: 14px 28px; text-decoration: none; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
            Activate Partner Account
          </a>
        </div>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: email,
    subject: `R3 Global Affiliate Network — Partnership Approved [${referralCode}]`,
    html
  });
}

/**
 * Event 7: Verified Conversion Notice
 */
export async function sendConversionRecordedNotice(params: {
  email: string;
  fullName: string;
  transactionRef: string;
  commissionEstimate: string;
}): Promise<SendEmailResult> {
  const { email, fullName, transactionRef, commissionEstimate } = params;

  const html = `
    <div style="font-family: sans-serif; background-color: #FAF9F6; padding: 40px 20px; color: #0A192F;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #E2DDD3; padding: 36px;">
        <h3 style="font-family: Georgia, serif; color: #0A192F; margin: 0 0 12px 0;">Verified Referral Conversion</h3>
        <p style="font-size: 14px; color: #2D3748; line-height: 1.6;">
          Dear ${fullName}, a client transaction attributed to your partner code has been verified under reference <strong>${transactionRef}</strong>.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 20px 0; font-family: monospace; color: #166534;">
          <div>Estimated Commission: <strong>${commissionEstimate}</strong></div>
        </div>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: email,
    subject: `R3 Global Affiliate Network — Verified Referral Sale [${transactionRef}]`,
    html
  });
}

/**
 * Event 8: Administrative Notice
 */
export async function sendAdministrativeNotification(params: {
  subject: string;
  details: string;
}): Promise<SendEmailResult> {
  const { subject, details } = params;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'services@r3-konaffiliate.online';

  const html = `
    <div style="font-family: monospace; padding: 24px; background: #f8fafc; color: #1e293b;">
      <h4 style="margin: 0 0 12px 0;">[R3 Admin Alert] ${subject}</h4>
      <pre style="background: #ffffff; padding: 16px; border: 1px solid #cbd5e1; white-space: pre-wrap;">${details}</pre>
    </div>
  `;

  return dispatchEmail({
    to: adminEmail,
    subject: `[R3 Admin Alert] ${subject}`,
    html
  });
}
