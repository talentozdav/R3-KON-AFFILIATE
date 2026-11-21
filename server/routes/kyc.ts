import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, requireAuth, requireRoles } from '../middleware/auth.js';
import {
  getClientOwnKycState,
  saveClientKycDraft,
  createClientKycUploadUrl,
  confirmClientKycUploadedDocument,
  uploadClientKycDocumentDirect,
  submitClientKycVerification,
  getComplianceKycOverviewAndList,
  getComplianceKycSubmissionDetail,
  generateSignedDocumentViewUrl,
  decideClientKycVerification,
  verifyAndReadDevDocumentPreview
} from '../services/kyc.js';

export const kycRouter = Router();

// ==============================================================================
// CLIENT-FACING KYC ENDPOINTS (Authenticated & Approved Clients Only)
// ==============================================================================

/**
 * GET /api/kyc/status
 * Returns authenticated client's registration approval gate + KYC status + redacted fields.
 */
kycRouter.get('/status', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await getClientOwnKycState(req.user!);
    if (!state) {
      return res.status(404).json({
        error: 'Client Registration Not Found',
        message: 'No active client registration was found for this account.'
      });
    }
    return res.json({ success: true, ...state });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      error: 'Failed to Load Verification Status',
      message: err.message
    });
  }
});

/**
 * PUT /api/kyc/draft
 * Saves partial KYC form progress securely after admin registration approval.
 */
kycRouter.put('/draft', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updatedState = await saveClientKycDraft(req.user!, req.body || {});
    return res.json({
      success: true,
      message: 'Identity verification progress saved securely.',
      ...updatedState
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      error: 'Failed to Save Verification Draft',
      message: err.message
    });
  }
});

/**
 * POST /api/kyc/documents/upload-url
 * Issues a server-authorized Supabase Storage signed upload URL (or directs to /api/kyc/documents in dev).
 */
kycRouter.post('/documents/upload-url', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { documentType, filename, mimeType, fileSizeBytes } = req.body || {};
  if (!documentType || !filename || !mimeType || !fileSizeBytes) {
    return res.status(400).json({
      error: 'Missing Upload Metadata',
      message: 'documentType, filename, mimeType, and fileSizeBytes are required.'
    });
  }

  try {
    const result = await createClientKycUploadUrl(req.user!, {
      documentType,
      filename,
      mimeType,
      fileSizeBytes: Number(fileSizeBytes)
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      error: 'Unable to Authorize Upload',
      message: err.message
    });
  }
});

/**
 * POST /api/kyc/documents/confirm
 * Confirms completion of a signed storage upload and records metadata in client_kyc_documents.
 */
kycRouter.post('/documents/confirm', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { documentType, storagePath, originalFilename, mimeType, fileSizeBytes } = req.body || {};
  if (!documentType || !storagePath || !originalFilename || !mimeType || !fileSizeBytes) {
    return res.status(400).json({
      error: 'Missing Upload Confirmation',
      message: 'documentType, storagePath, originalFilename, mimeType, and fileSizeBytes are required.'
    });
  }

  try {
    const document = await confirmClientKycUploadedDocument(req.user!, {
      documentType,
      storagePath,
      originalFilename,
      mimeType,
      fileSizeBytes: Number(fileSizeBytes)
    });
    return res.status(201).json({ success: true, document });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      error: 'Document Registration Failed',
      message: err.message
    });
  }
});

/**
 * POST /api/kyc/documents
 * Server-mediated validated upload with magic-byte verification -> private Supabase Storage or dev store.
 */
kycRouter.post('/documents', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { documentType, filename, mimeType, contentBase64 } = req.body || {};
  if (!documentType || !filename || !mimeType || !contentBase64) {
    return res.status(400).json({
      error: 'Missing Document Payload',
      message: 'documentType, filename, mimeType, and contentBase64 are required.'
    });
  }

  try {
    const document = await uploadClientKycDocumentDirect(req.user!, {
      documentType,
      filename,
      mimeType,
      contentBase64
    });
    return res.status(201).json({ success: true, document });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      error: 'Document Upload Failed',
      message: err.message
    });
  }
});

/**
 * POST /api/kyc/submit
 * Final submission / resubmission of KYC verification -> sets status to 'under_review'.
 */
kycRouter.post('/submit', requireAuth, requireRoles('client', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const submittedState = await submitClientKycVerification(req.user!, req.body || {}, req.ip);
    return res.json({
      success: true,
      message: 'Identity verification submitted and placed Under Review by R3 Compliance.',
      ...submittedState
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      error: 'Verification Submission Failed',
      message: err.message,
      details: err.details
    });
  }
});

// ==============================================================================
// COMPLIANCE ADMIN ENDPOINTS (Strictly compliance_officer & super_admin ONLY)
// Affiliates, affiliate_manager, finance_manager, and client roles are denied.
// ==============================================================================

kycRouter.get(
  '/admin/overview',
  requireAuth,
  requireRoles('compliance_officer', 'super_admin'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { overview } = await getComplianceKycOverviewAndList();
      return res.json({ success: true, overview });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to load KYC metrics', message: err.message });
    }
  }
);

kycRouter.get(
  '/admin/submissions',
  requireAuth,
  requireRoles('compliance_officer', 'super_admin'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await getComplianceKycOverviewAndList();
      return res.json({ success: true, ...data });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to list KYC submissions', message: err.message });
    }
  }
);

kycRouter.get(
  '/admin/submissions/:id',
  requireAuth,
  requireRoles('compliance_officer', 'super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const submission = await getComplianceKycSubmissionDetail(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: 'KYC submission not found.' });
      }
      return res.json({ success: true, submission });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch KYC dossier', message: err.message });
    }
  }
);

kycRouter.post(
  '/admin/documents/:docId/signed-url',
  requireAuth,
  requireRoles('compliance_officer', 'super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await generateSignedDocumentViewUrl({
        docId: req.params.docId,
        actor: req.user!,
        ipAddress: req.ip
      });
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(err.status || 500).json({
        error: 'Unable to Issue Signed URL',
        message: err.message
      });
    }
  }
);

kycRouter.post(
  '/admin/submissions/:id/decision',
  requireAuth,
  requireRoles('compliance_officer', 'super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { decision, clientMessage, internalNotes } = req.body || {};
    if (decision !== 'approve' && decision !== 'reject' && decision !== 'request_info') {
      return res.status(400).json({
        error: 'Invalid Compliance Decision',
        message: "Decision must be 'approve', 'reject', or 'request_info'."
      });
    }

    try {
      const result = await decideClientKycVerification({
        verificationId: req.params.id,
        decision,
        clientMessage,
        internalNotes,
        actor: req.user!,
        reqHeaders: req.headers,
        ipAddress: req.ip
      });
      return res.json({
        success: true,
        message: `KYC decision '${result.submission.verificationStatus}' recorded.`,
        ...result
      });
    } catch (err: any) {
      return res.status(err.status || 500).json({
        error: 'Compliance Decision Failed',
        message: err.message
      });
    }
  }
);

/**
 * Signed temporary preview stream used ONLY in non-production local dev/test mode
 * when live Supabase Storage is not configured. Protected by HMAC signature & expiry.
 */
kycRouter.get('/secure-preview/:docId', (req: Request, res: Response) => {
  const { docId } = req.params;
  const exp = String(req.query.exp || '');
  const sig = String(req.query.sig || '');
  const blob = verifyAndReadDevDocumentPreview(docId, exp, sig);
  if (!blob) {
    return res.status(403).json({
      error: 'Invalid or Expired Signed URL',
      message: 'This temporary document link has expired or failed cryptographic signature verification.'
    });
  }
  res.setHeader('Content-Type', blob.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${blob.filename}"`);
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  return res.send(blob.buffer);
});
