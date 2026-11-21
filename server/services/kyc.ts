import crypto from 'crypto';
import {
  supabaseAdmin,
  isProduction,
  assertSupabaseInProduction,
  getClientRegistrationByEmail,
  getClientRegistrationById,
  updateClientRegistrationInvitation,
  resolveAppOrigin,
  createClientActivationToken,
  recordAuditLog,
  ClientRegistrationRecord
} from '../supabase.js';
import {
  sendClientKycInvitation,
  sendClientKycSubmissionConfirmation,
  sendClientKycActionRequired,
  sendClientKycApproved,
  sendClientKycRejected
} from './mailer.js';

export const KYC_STORAGE_BUCKET = 'r3-client-kyc-documents';
export const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const KYC_SIGNED_URL_TTL_SECONDS = 120; // 2 minutes short-lived URL
export const KYC_CONSENT_VERSION = '2026-11-v1';

const DEV_EPHEMERAL_KYC_SECRET = crypto.randomBytes(32).toString('hex');

export type KycStatus =
  | 'not_started'
  | 'action_required'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export type GovernmentIdType = 'drivers_license' | 'state_id' | 'passport' | 'national_id';

export type KycDocumentType =
  | 'gov_id_front'
  | 'gov_id_back'
  | 'passport'
  | 'national_id'
  | 'selfie'
  | 'liveness_capture'
  | 'supplemental';

export const ALLOWED_KYC_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
] as const;

export type AllowedKycMimeType = (typeof ALLOWED_KYC_MIME_TYPES)[number];

interface InternalKycVerificationRecord {
  id: string;
  registrationId: string;
  userId?: string;
  verificationStatus: KycStatus;
  legalFullName?: string;
  verifiedEmail: string;
  country: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  governmentIdType?: GovernmentIdType;
  governmentIdLast4?: string;
  ssnProvided: boolean;
  ssnLast4?: string;
  ssnEncrypted?: string;
  ssnHmac?: string;
  livenessMethod?: 'camera_capture' | 'selfie_upload';
  livenessVerified: boolean;
  livenessChallengeNote?: string;
  consentAccepted: boolean;
  consentVersion?: string;
  consentTimestamp?: string;
  retentionExpiresAt?: string;
  kycInvitationSentAt?: string;
  kycInvitationExpiresAt?: string;
  actionRequiredMessage?: string;
  rejectionReason?: string;
  internalComplianceNotes?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewedByRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KycDocumentMetadata {
  id: string;
  verificationId: string;
  registrationId: string;
  userId?: string;
  documentType: KycDocumentType;
  originalFilename: string;
  mimeType: AllowedKycMimeType;
  fileSizeBytes: number;
  sha256Checksum?: string;
  uploadStatus: 'pending' | 'uploaded' | 'superseded' | 'deleted';
  uploadedAt: string;
}

interface InternalKycDocumentRecord extends KycDocumentMetadata {
  storageBucket: string;
  storagePath: string;
}

export interface KycReviewHistoryEntry {
  id: string;
  verificationId: string;
  previousStatus?: string;
  newStatus: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  clientMessage?: string;
  internalNotes?: string;
  createdAt: string;
}

// Non-production local development fallback stores (only used when supabaseAdmin is null in dev/test)
const memoryVerifications: InternalKycVerificationRecord[] = [];
const memoryDocuments: InternalKycDocumentRecord[] = [];
const memoryDocumentBlobs = new Map<string, { buffer: Buffer; mimeType: AllowedKycMimeType; filename: string }>();
const memoryHistory: KycReviewHistoryEntry[] = [];

function getKycKeyMaterial(): string {
  const secret =
    process.env.KYC_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.ADMIN_BOOTSTRAP_KEY?.trim() ||
    (!isProduction ? DEV_EPHEMERAL_KYC_SECRET : '');

  if (!secret) {
    throw new Error('Server-side KYC encryption secret is unavailable in production.');
  }
  return secret;
}

function getKycAesKey(): Buffer {
  return crypto.createHmac('sha256', 'r3-kyc-aes256-v1').update(getKycKeyMaterial()).digest();
}

function getKycPreviewHmacKey(): Buffer {
  return crypto.createHmac('sha256', 'r3-kyc-preview-v1').update(getKycKeyMaterial()).digest();
}

export function isUnitedStatesJurisdiction(country?: string | null): boolean {
  if (!country) return false;
  const c = country.trim().toLowerCase();
  return c === 'united states' || c.startsWith('united states (') || c === 'us' || c === 'usa';
}

export function validateAndEncryptSsn(rawSsn: string): {
  valid: boolean;
  error?: string;
  last4?: string;
  encrypted?: string;
  hmac?: string;
} {
  const digits = String(rawSsn || '').replace(/[\s-]/g, '');
  if (!/^\d{9}$/.test(digits)) {
    return { valid: false, error: 'Social Security Number must contain exactly 9 digits (XXX-XX-XXXX).' };
  }
  const area = digits.slice(0, 3);
  const group = digits.slice(3, 5);
  const serial = digits.slice(5, 9);
  if (area === '000' || area === '666' || area.startsWith('9') || group === '00' || serial === '0000') {
    return { valid: false, error: 'Please enter a valid US Social Security Number.' };
  }
  if (/^(\d)\1{8}$/.test(digits)) {
    return { valid: false, error: 'Invalid Social Security Number sequence.' };
  }

  const key = getKycAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encryptedBuf = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const encrypted = `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedBuf.toString('hex')}`;
  const hmac = crypto.createHmac('sha256', key).update(digits).digest('hex');

  return {
    valid: true,
    last4: digits.slice(-4),
    encrypted,
    hmac
  };
}

export function validateMimeAndMagicBytes(
  mimeType: string,
  buffer: Buffer
): { valid: boolean; error?: string; mimeType?: AllowedKycMimeType } {
  const cleanMime = mimeType.trim().toLowerCase() as AllowedKycMimeType;
  if (!ALLOWED_KYC_MIME_TYPES.includes(cleanMime)) {
    return {
      valid: false,
      error: 'Unsupported file type. Accepted formats: JPEG, PNG, WEBP, or PDF.'
    };
  }

  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Uploaded file is empty.' };
  }

  if (buffer.length > KYC_MAX_FILE_BYTES) {
    return { valid: false, error: 'File exceeds the maximum allowed limit of 10 MB.' };
  }

  if (cleanMime === 'image/jpeg') {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      return { valid: false, error: 'File content does not match JPEG image signature.' };
    }
  } else if (cleanMime === 'image/png') {
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(pngSig)) {
      return { valid: false, error: 'File content does not match PNG image signature.' };
    }
  } else if (cleanMime === 'image/webp') {
    if (
      buffer.length < 12 ||
      buffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
    ) {
      return { valid: false, error: 'File content does not match WEBP image signature.' };
    }
  } else if (cleanMime === 'application/pdf') {
    if (buffer.length < 4 || buffer.subarray(0, 4).toString('ascii') !== '%PDF') {
      return { valid: false, error: 'File content does not match PDF document signature.' };
    }
  }

  return { valid: true, mimeType: cleanMime };
}

function getExtensionForMime(mimeType: AllowedKycMimeType): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
  }
}

function sanitizeFilename(name: string): string {
  const base = String(name || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.');
  return base.slice(0, 120) || 'document';
}

function mapVerificationRow(r: any): InternalKycVerificationRecord {
  return {
    id: r.id,
    registrationId: r.registration_id,
    userId: r.user_id || undefined,
    verificationStatus: r.verification_status,
    legalFullName: r.legal_full_name || undefined,
    verifiedEmail: r.verified_email,
    country: r.country,
    addressLine1: r.address_line1 || undefined,
    addressLine2: r.address_line2 || undefined,
    city: r.city || undefined,
    stateProvince: r.state_province || undefined,
    postalCode: r.postal_code || undefined,
    governmentIdType: r.government_id_type || undefined,
    governmentIdLast4: r.government_id_last4 || undefined,
    ssnProvided: Boolean(r.ssn_provided),
    ssnLast4: r.ssn_last4 || undefined,
    ssnEncrypted: r.ssn_encrypted || undefined,
    ssnHmac: r.ssn_hmac || undefined,
    livenessMethod: r.liveness_method || undefined,
    livenessVerified: Boolean(r.liveness_verified),
    livenessChallengeNote: r.liveness_challenge_note || undefined,
    consentAccepted: Boolean(r.consent_accepted),
    consentVersion: r.consent_version || undefined,
    consentTimestamp: r.consent_timestamp || undefined,
    retentionExpiresAt: r.retention_expires_at || undefined,
    kycInvitationSentAt: r.kyc_invitation_sent_at || undefined,
    kycInvitationExpiresAt: r.kyc_invitation_expires_at || undefined,
    actionRequiredMessage: r.action_required_message || undefined,
    rejectionReason: r.rejection_reason || undefined,
    internalComplianceNotes: r.internal_compliance_notes || undefined,
    submittedAt: r.submitted_at || undefined,
    reviewedAt: r.reviewed_at || undefined,
    reviewedBy: r.reviewed_by || undefined,
    reviewedByEmail: r.reviewed_by_email || undefined,
    reviewedByRole: r.reviewed_by_role || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function mapDocumentRow(r: any): InternalKycDocumentRecord {
  return {
    id: r.id,
    verificationId: r.verification_id,
    registrationId: r.registration_id,
    userId: r.user_id || undefined,
    documentType: r.document_type,
    storageBucket: r.storage_bucket,
    storagePath: r.storage_path,
    originalFilename: r.original_filename,
    mimeType: r.mime_type,
    fileSizeBytes: Number(r.file_size_bytes),
    sha256Checksum: r.sha256_checksum || undefined,
    uploadStatus: r.upload_status,
    uploadedAt: r.uploaded_at
  };
}

function mapHistoryRow(r: any): KycReviewHistoryEntry {
  return {
    id: r.id,
    verificationId: r.verification_id,
    previousStatus: r.previous_status || undefined,
    newStatus: r.new_status,
    action: r.action,
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    clientMessage: r.client_message || undefined,
    internalNotes: r.internal_notes || undefined,
    createdAt: r.created_at
  };
}

export function sanitizeDocumentMetadata(doc: InternalKycDocumentRecord): KycDocumentMetadata {
  return {
    id: doc.id,
    verificationId: doc.verificationId,
    registrationId: doc.registrationId,
    documentType: doc.documentType,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    fileSizeBytes: doc.fileSizeBytes,
    sha256Checksum: doc.sha256Checksum,
    uploadStatus: doc.uploadStatus,
    uploadedAt: doc.uploadedAt
  };
}

export function sanitizeVerificationForClient(
  v: InternalKycVerificationRecord | null,
  registration: ClientRegistrationRecord | null,
  docs: InternalKycDocumentRecord[],
  history: KycReviewHistoryEntry[]
) {
  const registrationApproved = registration?.status === 'APPROVED';
  if (!v) {
    return {
      registrationId: registration?.id || null,
      registrationReference: registration?.referenceNumber || null,
      registrationStatus: registration?.status || 'PENDING',
      registrationApproved,
      verificationStatus: 'not_started' as KycStatus,
      canStartVerification: registrationApproved,
      isUnitedStates: isUnitedStatesJurisdiction(registration?.country),
      verification: null,
      documents: [],
      history: []
    };
  }

  return {
    registrationId: v.registrationId,
    registrationReference: registration?.referenceNumber || null,
    registrationStatus: registration?.status || 'PENDING',
    registrationApproved,
    verificationStatus: v.verificationStatus,
    canStartVerification:
      registrationApproved && (v.verificationStatus === 'not_started' || v.verificationStatus === 'action_required'),
    isUnitedStates: isUnitedStatesJurisdiction(v.country),
    verification: {
      id: v.id,
      registrationId: v.registrationId,
      verificationStatus: v.verificationStatus,
      legalFullName: v.legalFullName || registration?.fullName || '',
      verifiedEmail: v.verifiedEmail,
      country: v.country,
      addressLine1: v.addressLine1 || '',
      addressLine2: v.addressLine2 || '',
      city: v.city || '',
      stateProvince: v.stateProvince || '',
      postalCode: v.postalCode || '',
      governmentIdType: v.governmentIdType || '',
      governmentIdLast4: v.governmentIdLast4 || '',
      ssnProvided: v.ssnProvided,
      ssnMasked: v.ssnLast4 ? `***-**-${v.ssnLast4}` : null,
      livenessMethod: v.livenessMethod || 'selfie_upload',
      livenessVerified: v.livenessVerified,
      livenessChallengeNote: v.livenessChallengeNote || '',
      consentAccepted: v.consentAccepted,
      consentVersion: v.consentVersion || KYC_CONSENT_VERSION,
      consentTimestamp: v.consentTimestamp || null,
      retentionExpiresAt: v.retentionExpiresAt || null,
      actionRequiredMessage: v.actionRequiredMessage || null,
      rejectionReason: v.rejectionReason || null,
      submittedAt: v.submittedAt || null,
      reviewedAt: v.reviewedAt || null,
      updatedAt: v.updatedAt
    },
    documents: docs.filter(d => d.uploadStatus === 'uploaded').map(sanitizeDocumentMetadata),
    history: history.map(h => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      action: h.action,
      clientMessage: h.clientMessage,
      createdAt: h.createdAt
    }))
  };
}

export function sanitizeVerificationForCompliance(
  v: InternalKycVerificationRecord,
  registration: ClientRegistrationRecord | null,
  docs: InternalKycDocumentRecord[],
  history: KycReviewHistoryEntry[]
) {
  return {
    id: v.id,
    registrationId: v.registrationId,
    registrationReference: registration?.referenceNumber || null,
    registrationStatus: registration?.status || 'UNKNOWN',
    clientCompany: registration?.company || null,
    serviceCategory: registration?.serviceCategory || null,
    userId: v.userId || null,
    verificationStatus: v.verificationStatus,
    legalFullName: v.legalFullName || registration?.fullName || '',
    verifiedEmail: v.verifiedEmail,
    country: v.country,
    isUnitedStates: isUnitedStatesJurisdiction(v.country),
    addressLine1: v.addressLine1 || '',
    addressLine2: v.addressLine2 || '',
    city: v.city || '',
    stateProvince: v.stateProvince || '',
    postalCode: v.postalCode || '',
    governmentIdType: v.governmentIdType || null,
    governmentIdLast4: v.governmentIdLast4 || null,
    ssnProvided: v.ssnProvided,
    ssnMasked: v.ssnLast4 ? `***-**-${v.ssnLast4}` : null,
    livenessMethod: v.livenessMethod || null,
    livenessVerified: v.livenessVerified,
    livenessChallengeNote: v.livenessChallengeNote || null,
    consentAccepted: v.consentAccepted,
    consentVersion: v.consentVersion || null,
    consentTimestamp: v.consentTimestamp || null,
    retentionExpiresAt: v.retentionExpiresAt || null,
    kycInvitationSentAt: v.kycInvitationSentAt || null,
    kycInvitationExpiresAt: v.kycInvitationExpiresAt || null,
    actionRequiredMessage: v.actionRequiredMessage || null,
    rejectionReason: v.rejectionReason || null,
    internalComplianceNotes: v.internalComplianceNotes || null,
    submittedAt: v.submittedAt || null,
    reviewedAt: v.reviewedAt || null,
    reviewedByEmail: v.reviewedByEmail || null,
    reviewedByRole: v.reviewedByRole || null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    documents: docs.filter(d => d.uploadStatus === 'uploaded').map(sanitizeDocumentMetadata),
    history
  };
}

async function insertReviewHistory(params: {
  verificationId: string;
  previousStatus?: string;
  newStatus: string;
  action: string;
  actorId?: string;
  actorEmail: string;
  actorRole: string;
  clientMessage?: string;
  internalNotes?: string;
}): Promise<KycReviewHistoryEntry> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_kyc_review_history')
      .insert({
        verification_id: params.verificationId,
        previous_status: params.previousStatus || null,
        new_status: params.newStatus,
        action: params.action,
        actor_id: params.actorId || null,
        actor_email: params.actorEmail,
        actor_role: params.actorRole,
        client_message: params.clientMessage || null,
        internal_notes: params.internalNotes || null
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error logging KYC review history: ${error?.message || 'Insert returned no data'}`);
    }
    return mapHistoryRow(data);
  }
  assertSupabaseInProduction();
  const entry: KycReviewHistoryEntry = {
    id: `khist_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    verificationId: params.verificationId,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    action: params.action,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    clientMessage: params.clientMessage,
    internalNotes: params.internalNotes,
    createdAt: now
  };
  memoryHistory.unshift(entry);
  return entry;
}

export async function getKycVerificationByRegistrationId(
  registrationId: string
): Promise<InternalKycVerificationRecord | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_identity_verifications')
      .select('*')
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching KYC verification: ${error.message}`);
    }
    return data ? mapVerificationRow(data) : null;
  }
  assertSupabaseInProduction();
  return memoryVerifications.find(v => v.registrationId === registrationId) || null;
}

export async function getKycVerificationById(id: string): Promise<InternalKycVerificationRecord | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_identity_verifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching KYC submission: ${error.message}`);
    }
    return data ? mapVerificationRow(data) : null;
  }
  assertSupabaseInProduction();
  return memoryVerifications.find(v => v.id === id) || null;
}

export async function getKycDocuments(verificationId: string): Promise<InternalKycDocumentRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_kyc_documents')
      .select('*')
      .eq('verification_id', verificationId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching KYC documents: ${error.message}`);
    }
    return (data || []).map(mapDocumentRow);
  }
  assertSupabaseInProduction();
  return memoryDocuments.filter(d => d.verificationId === verificationId);
}

export async function getKycDocumentById(docId: string): Promise<InternalKycDocumentRecord | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_kyc_documents')
      .select('*')
      .eq('id', docId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching KYC document: ${error.message}`);
    }
    return data ? mapDocumentRow(data) : null;
  }
  assertSupabaseInProduction();
  return memoryDocuments.find(d => d.id === docId) || null;
}

export async function getKycHistory(verificationId: string): Promise<KycReviewHistoryEntry[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_kyc_review_history')
      .select('*')
      .eq('verification_id', verificationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching KYC history: ${error.message}`);
    }
    return (data || []).map(mapHistoryRow);
  }
  assertSupabaseInProduction();
  return memoryHistory.filter(h => h.verificationId === verificationId);
}

export async function backfillKycUserId(registrationId: string, userId: string): Promise<void> {
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('client_identity_verifications')
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq('registration_id', registrationId)
      .is('user_id', null);
    return;
  }
  assertSupabaseInProduction();
  for (const v of memoryVerifications) {
    if (v.registrationId === registrationId && !v.userId) {
      v.userId = userId;
    }
  }
}

export async function ensureKycRecordForApprovedRegistration(
  reg: ClientRegistrationRecord,
  actor?: { email: string; role: string; id?: string }
): Promise<InternalKycVerificationRecord> {
  const existing = await getKycVerificationByRegistrationId(reg.id);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('client_identity_verifications')
        .update({
          user_id: existing.userId || reg.userId || null,
          kyc_invitation_sent_at: now,
          kyc_invitation_expires_at: expiresAt,
          updated_at: now
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error || !data) {
        throw new Error(`Database error updating KYC invitation record: ${error?.message || 'No record returned'}`);
      }
      return mapVerificationRow(data);
    }
    assertSupabaseInProduction();
    existing.userId = existing.userId || reg.userId;
    existing.kycInvitationSentAt = now;
    existing.kycInvitationExpiresAt = expiresAt;
    existing.updatedAt = now;
    return existing;
  }

  let created: InternalKycVerificationRecord;
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_identity_verifications')
      .insert({
        registration_id: reg.id,
        user_id: reg.userId || null,
        verification_status: 'not_started',
        legal_full_name: reg.fullName,
        verified_email: reg.email.toLowerCase(),
        country: reg.country,
        kyc_invitation_sent_at: now,
        kyc_invitation_expires_at: expiresAt
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error initializing KYC verification record: ${error?.message || 'Insert returned no data'}`);
    }
    created = mapVerificationRow(data);
  } else {
    assertSupabaseInProduction();
    created = {
      id: `kyc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      registrationId: reg.id,
      userId: reg.userId,
      verificationStatus: 'not_started',
      legalFullName: reg.fullName,
      verifiedEmail: reg.email.toLowerCase(),
      country: reg.country,
      ssnProvided: false,
      livenessVerified: false,
      consentAccepted: false,
      kycInvitationSentAt: now,
      kycInvitationExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now
    };
    memoryVerifications.unshift(created);
  }

  if (actor) {
    await insertReviewHistory({
      verificationId: created.id,
      previousStatus: undefined,
      newStatus: 'not_started',
      action: 'invitation_issued',
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      clientMessage: 'Client registration approved; identity verification invitation issued.'
    });
  }

  return created;
}

/**
 * Post-Approval Automation Workflow:
 * Triggered immediately when an admin approves a client registration (status -> APPROVED).
 * 1. Keeps registration status (APPROVED) cleanly separated from KYC status (not_started).
 * 2. Initializes or refreshes the KYC verification record & secure invitation.
 * 3. Ensures client account activation URL is ready if the client has not activated yet.
 * 4. Sends identity verification invitation email via Resend.
 */
export async function triggerPostApprovalKycWorkflow(params: {
  registration: ClientRegistrationRecord;
  actor: { id?: string; email: string; role: string };
  reqHeaders?: Record<string, any>;
  ipAddress?: string;
}): Promise<{
  verificationId: string;
  verificationStatus: KycStatus;
  emailSent: boolean;
  emailError?: string;
  verificationPortalUrl: string;
}> {
  const { registration, actor, reqHeaders, ipAddress } = params;
  const origin = resolveAppOrigin({ headers: reqHeaders });
  const kycRecord = await ensureKycRecordForApprovedRegistration(registration, actor);

  const needsActivation = !registration.userId && !registration.accountActivatedAt && registration.invitationStatus !== 'accepted';
  let verificationPortalUrl = `${origin}/client-portal?section=verification&ref=${encodeURIComponent(
    registration.referenceNumber
  )}`;

  if (needsActivation) {
    const signedToken = createClientActivationToken({
      registrationId: registration.id,
      referenceNumber: registration.referenceNumber,
      email: registration.email
    });
    const activateAndVerifyRedirect = `${origin}/client-portal?mode=activate&next=verification&ref=${encodeURIComponent(
      registration.referenceNumber
    )}&email=${encodeURIComponent(registration.email)}&token=${encodeURIComponent(signedToken)}`;
    verificationPortalUrl = activateAndVerifyRedirect;

    if (supabaseAdmin) {
      try {
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email: registration.email.toLowerCase(),
          options: {
            redirectTo: activateAndVerifyRedirect,
            data: {
              full_name: registration.fullName,
              role: 'client',
              registration_id: registration.id
            }
          }
        });
        if (!linkErr && linkData?.properties?.action_link) {
          verificationPortalUrl = linkData.properties.action_link;
        }
      } catch (err: any) {
        console.warn('[R3 KYC Post-Approval] Auth invite link notice:', err.message);
      }
    }
  }

  let emailSent = false;
  let emailError: string | undefined;
  try {
    const mailRes = await sendClientKycInvitation({
      email: registration.email,
      fullName: registration.fullName,
      referenceNumber: registration.referenceNumber,
      verificationUrl: verificationPortalUrl,
      requiresActivation: needsActivation
    });
    emailSent = mailRes.success;
    emailError = mailRes.error;
  } catch (err: any) {
    emailError = err.message;
  }

  if (needsActivation) {
    await updateClientRegistrationInvitation(
      registration.id,
      emailSent ? 'sent' : 'failed',
      emailError
    ).catch(() => undefined);
  }

  await recordAuditLog(
    actor.email,
    actor.role,
    'CLIENT_KYC_INVITATION_ISSUED',
    'client_identity_verifications',
    kycRecord.id,
    `Registration ${registration.referenceNumber} approved; KYC verification initialized (${kycRecord.verificationStatus}) and invitation ${emailSent ? 'sent' : 'queued'}.`,
    ipAddress
  ).catch(() => undefined);

  return {
    verificationId: kycRecord.id,
    verificationStatus: kycRecord.verificationStatus,
    emailSent,
    emailError,
    verificationPortalUrl
  };
}

/**
 * Resolves the authenticated client's registration & KYC state.
 */
export async function getClientOwnKycState(user: {
  id: string;
  email: string;
  fullName: string;
}) {
  const registration = await getClientRegistrationByEmail(user.email);
  if (!registration) {
    return null;
  }

  let verification = await getKycVerificationByRegistrationId(registration.id);
  if (registration.status === 'APPROVED' && !verification) {
    verification = await ensureKycRecordForApprovedRegistration({
      ...registration,
      userId: registration.userId || user.id
    });
  } else if (verification && !verification.userId) {
    await backfillKycUserId(registration.id, user.id);
    verification.userId = user.id;
  }

  const docs = verification ? await getKycDocuments(verification.id) : [];
  const history = verification ? await getKycHistory(verification.id) : [];

  return sanitizeVerificationForClient(verification, registration, docs, history);
}

/**
 * Ensures client is strictly registration-approved and editable before draft/upload/submit.
 */
async function requireEditableApprovedClientVerification(user: { id: string; email: string; fullName: string }): Promise<{
  registration: ClientRegistrationRecord;
  verification: InternalKycVerificationRecord;
}> {
  const registration = await getClientRegistrationByEmail(user.email);
  if (!registration) {
    const err = new Error('No client registration record was located for this account.') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  if (registration.status !== 'APPROVED') {
    const err = new Error(
      `Identity verification cannot begin until your client registration application is approved by an administrator. Current status: ${registration.status}.`
    ) as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  let verification = await getKycVerificationByRegistrationId(registration.id);
  if (!verification) {
    verification = await ensureKycRecordForApprovedRegistration({
      ...registration,
      userId: registration.userId || user.id
    });
  } else if (!verification.userId) {
    await backfillKycUserId(registration.id, user.id);
    verification.userId = user.id;
  }

  if (verification.userId && verification.userId !== user.id && registration.email.toLowerCase() !== user.email.toLowerCase()) {
    const err = new Error('Ownership mismatch on verification dossier.') as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  if (verification.verificationStatus !== 'not_started' && verification.verificationStatus !== 'action_required') {
    const err = new Error(
      `Verification dossier is currently '${verification.verificationStatus}' and cannot be modified unless additional information is requested.`
    ) as Error & { status?: number };
    err.status = 409;
    throw err;
  }

  return { registration, verification };
}

export async function saveClientKycDraft(
  user: { id: string; email: string; fullName: string },
  payload: {
    legalFullName?: string;
    country?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    governmentIdType?: string;
    governmentIdNumber?: string;
    ssn?: string;
    livenessMethod?: 'camera_capture' | 'selfie_upload';
    livenessVerified?: boolean;
    livenessChallengeNote?: string;
    consentAccepted?: boolean;
  }
) {
  const { registration, verification } = await requireEditableApprovedClientVerification(user);
  const now = new Date().toISOString();
  const nextCountry =
    typeof payload.country === 'string' && payload.country.trim().length >= 2
      ? payload.country.trim()
      : verification.country || registration.country;
  const isUS = isUnitedStatesJurisdiction(nextCountry);

  const validGovIdTypes: GovernmentIdType[] = ['drivers_license', 'state_id', 'passport', 'national_id'];
  let nextGovIdType = verification.governmentIdType;
  if (payload.governmentIdType !== undefined && payload.governmentIdType !== '') {
    if (!validGovIdTypes.includes(payload.governmentIdType as GovernmentIdType)) {
      const err = new Error('Invalid government ID type selected.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    nextGovIdType = payload.governmentIdType as GovernmentIdType;
  }

  let nextGovIdLast4 = verification.governmentIdLast4;
  if (typeof payload.governmentIdNumber === 'string' && payload.governmentIdNumber.trim()) {
    const cleaned = payload.governmentIdNumber.replace(/[^a-zA-Z0-9]/g, '');
    if (cleaned.length < 4) {
      const err = new Error('Government ID number must be at least 4 characters.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    nextGovIdLast4 = cleaned.slice(-4).toUpperCase();
  }

  let nextSsnProvided = isUS ? verification.ssnProvided : false;
  let nextSsnLast4 = isUS ? verification.ssnLast4 : undefined;
  let nextSsnEncrypted = isUS ? verification.ssnEncrypted : undefined;
  let nextSsnHmac = isUS ? verification.ssnHmac : undefined;

  if (typeof payload.ssn === 'string' && payload.ssn.trim()) {
    if (!isUS) {
      const err = new Error('US Social Security Number is not collected for non-US jurisdictions.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const ssnResult = validateAndEncryptSsn(payload.ssn);
    if (!ssnResult.valid) {
      const err = new Error(ssnResult.error || 'Invalid Social Security Number.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    nextSsnProvided = true;
    nextSsnLast4 = ssnResult.last4;
    nextSsnEncrypted = ssnResult.encrypted;
    nextSsnHmac = ssnResult.hmac;
  }

  const nextConsentAccepted =
    payload.consentAccepted !== undefined ? Boolean(payload.consentAccepted) : verification.consentAccepted;
  const nextConsentTimestamp = nextConsentAccepted ? verification.consentTimestamp || now : undefined;

  const updateFields = {
    legal_full_name:
      typeof payload.legalFullName === 'string' && payload.legalFullName.trim()
        ? payload.legalFullName.trim()
        : verification.legalFullName || registration.fullName,
    country: nextCountry,
    address_line1:
      payload.addressLine1 !== undefined ? payload.addressLine1.trim() || null : verification.addressLine1 || null,
    address_line2:
      payload.addressLine2 !== undefined ? payload.addressLine2.trim() || null : verification.addressLine2 || null,
    city: payload.city !== undefined ? payload.city.trim() || null : verification.city || null,
    state_province:
      payload.stateProvince !== undefined ? payload.stateProvince.trim() || null : verification.stateProvince || null,
    postal_code:
      payload.postalCode !== undefined ? payload.postalCode.trim() || null : verification.postalCode || null,
    government_id_type: nextGovIdType || null,
    government_id_last4: nextGovIdLast4 || null,
    ssn_provided: nextSsnProvided,
    ssn_last4: nextSsnLast4 || null,
    ssn_encrypted: nextSsnEncrypted || null,
    ssn_hmac: nextSsnHmac || null,
    liveness_method:
      payload.livenessMethod === 'camera_capture' || payload.livenessMethod === 'selfie_upload'
        ? payload.livenessMethod
        : verification.livenessMethod || 'selfie_upload',
    liveness_verified:
      payload.livenessVerified !== undefined ? Boolean(payload.livenessVerified) : verification.livenessVerified,
    liveness_challenge_note:
      payload.livenessChallengeNote !== undefined
        ? payload.livenessChallengeNote.trim() || null
        : verification.livenessChallengeNote || null,
    consent_accepted: nextConsentAccepted,
    consent_version: nextConsentAccepted ? KYC_CONSENT_VERSION : null,
    consent_timestamp: nextConsentTimestamp || null,
    updated_at: now
  };

  let updated: InternalKycVerificationRecord;
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_identity_verifications')
      .update(updateFields)
      .eq('id', verification.id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error saving KYC draft: ${error?.message || 'No data returned'}`);
    }
    updated = mapVerificationRow(data);
  } else {
    assertSupabaseInProduction();
    verification.legalFullName = updateFields.legal_full_name || undefined;
    verification.country = updateFields.country;
    verification.addressLine1 = updateFields.address_line1 || undefined;
    verification.addressLine2 = updateFields.address_line2 || undefined;
    verification.city = updateFields.city || undefined;
    verification.stateProvince = updateFields.state_province || undefined;
    verification.postalCode = updateFields.postal_code || undefined;
    verification.governmentIdType = (updateFields.government_id_type as GovernmentIdType) || undefined;
    verification.governmentIdLast4 = updateFields.government_id_last4 || undefined;
    verification.ssnProvided = updateFields.ssn_provided;
    verification.ssnLast4 = updateFields.ssn_last4 || undefined;
    verification.ssnEncrypted = updateFields.ssn_encrypted || undefined;
    verification.ssnHmac = updateFields.ssn_hmac || undefined;
    verification.livenessMethod = updateFields.liveness_method as any;
    verification.livenessVerified = updateFields.liveness_verified;
    verification.livenessChallengeNote = updateFields.liveness_challenge_note || undefined;
    verification.consentAccepted = updateFields.consent_accepted;
    verification.consentVersion = updateFields.consent_version || undefined;
    verification.consentTimestamp = updateFields.consent_timestamp || undefined;
    verification.updatedAt = now;
    updated = verification;
  }

  const docs = await getKycDocuments(updated.id);
  const history = await getKycHistory(updated.id);
  return sanitizeVerificationForClient(updated, registration, docs, history);
}

/**
 * Generates a signed upload target for direct Storage upload when live Supabase Storage is available.
 */
export async function createClientKycUploadUrl(
  user: { id: string; email: string; fullName: string },
  params: { documentType: KycDocumentType; filename: string; mimeType: string; fileSizeBytes: number }
) {
  const { verification } = await requireEditableApprovedClientVerification(user);
  const validDocTypes: KycDocumentType[] = [
    'gov_id_front',
    'gov_id_back',
    'passport',
    'national_id',
    'selfie',
    'liveness_capture',
    'supplemental'
  ];
  if (!validDocTypes.includes(params.documentType)) {
    const err = new Error('Invalid KYC document type.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const cleanMime = String(params.mimeType || '').trim().toLowerCase() as AllowedKycMimeType;
  if (!ALLOWED_KYC_MIME_TYPES.includes(cleanMime)) {
    const err = new Error('Unsupported MIME type. Use JPEG, PNG, WEBP, or PDF.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const size = Number(params.fileSizeBytes);
  if (!Number.isFinite(size) || size <= 0 || size > KYC_MAX_FILE_BYTES) {
    const err = new Error('File size must be between 1 byte and 10 MB.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  if (!supabaseAdmin || !supabaseAdmin.storage) {
    return {
      mode: 'direct_api' as const,
      verificationId: verification.id
    };
  }

  const ext = getExtensionForMime(cleanMime);
  const storagePath = `${user.id}/${verification.id}/${params.documentType}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(KYC_STORAGE_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(`Unable to issue storage upload URL: ${error?.message || 'Storage error'}`);
  }

  return {
    mode: 'signed_url' as const,
    verificationId: verification.id,
    storagePath,
    token: data.token,
    signedUrl: data.signedUrl,
    originalFilename: sanitizeFilename(params.filename)
  };
}

/**
 * Confirms a file uploaded via Supabase signed upload URL and records metadata in client_kyc_documents.
 */
export async function confirmClientKycUploadedDocument(
  user: { id: string; email: string; fullName: string },
  params: {
    documentType: KycDocumentType;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
  }
) {
  const { registration, verification } = await requireEditableApprovedClientVerification(user);
  const expectedPrefix = `${user.id}/${verification.id}/${params.documentType}/`;
  if (!params.storagePath.startsWith(expectedPrefix) || params.storagePath.includes('..')) {
    const err = new Error('Invalid storage path ownership or format.') as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  const cleanMime = String(params.mimeType || '').trim().toLowerCase() as AllowedKycMimeType;
  if (!ALLOWED_KYC_MIME_TYPES.includes(cleanMime)) {
    const err = new Error('Invalid document MIME type.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  if (!supabaseAdmin) {
    throw new Error('Supabase Storage confirmation requires live Supabase configuration.');
  }

  // Supersede previous document of same type (except supplemental)
  if (params.documentType !== 'supplemental') {
    await supabaseAdmin
      .from('client_kyc_documents')
      .update({ upload_status: 'superseded' })
      .eq('verification_id', verification.id)
      .eq('document_type', params.documentType)
      .eq('upload_status', 'uploaded');
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('client_kyc_documents')
    .insert({
      verification_id: verification.id,
      registration_id: registration.id,
      user_id: user.id,
      document_type: params.documentType,
      storage_bucket: KYC_STORAGE_BUCKET,
      storage_path: params.storagePath,
      original_filename: sanitizeFilename(params.originalFilename),
      mime_type: cleanMime,
      file_size_bytes: Math.floor(Number(params.fileSizeBytes)),
      upload_status: 'uploaded'
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(`Database error recording uploaded document: ${error?.message || 'Insert returned no data'}`);
  }

  return sanitizeDocumentMetadata(mapDocumentRow(inserted));
}

/**
 * Direct server-mediated upload (validates magic bytes + uploads to private Supabase Storage or isolated dev store).
 */
export async function uploadClientKycDocumentDirect(
  user: { id: string; email: string; fullName: string },
  params: {
    documentType: KycDocumentType;
    filename: string;
    mimeType: string;
    contentBase64: string;
  }
) {
  const { registration, verification } = await requireEditableApprovedClientVerification(user);
  const validDocTypes: KycDocumentType[] = [
    'gov_id_front',
    'gov_id_back',
    'passport',
    'national_id',
    'selfie',
    'liveness_capture',
    'supplemental'
  ];
  if (!validDocTypes.includes(params.documentType)) {
    const err = new Error('Invalid KYC document type.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const rawBase64 = String(params.contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(rawBase64, 'base64');
  const fileCheck = validateMimeAndMagicBytes(params.mimeType, buffer);
  if (!fileCheck.valid || !fileCheck.mimeType) {
    const err = new Error(fileCheck.error || 'Invalid uploaded document file.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = getExtensionForMime(fileCheck.mimeType);
  const cleanFilename = sanitizeFilename(params.filename);
  const storagePath = `${user.id}/${verification.id}/${params.documentType}/${crypto.randomUUID()}.${ext}`;
  const now = new Date().toISOString();

  if (supabaseAdmin && supabaseAdmin.storage) {
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(KYC_STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: fileCheck.mimeType,
        upsert: false
      });

    if (uploadErr) {
      throw new Error(`Private storage upload failed: ${uploadErr.message}`);
    }

    if (params.documentType !== 'supplemental') {
      await supabaseAdmin
        .from('client_kyc_documents')
        .update({ upload_status: 'superseded' })
        .eq('verification_id', verification.id)
        .eq('document_type', params.documentType)
        .eq('upload_status', 'uploaded');
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('client_kyc_documents')
      .insert({
        verification_id: verification.id,
        registration_id: registration.id,
        user_id: user.id,
        document_type: params.documentType,
        storage_bucket: KYC_STORAGE_BUCKET,
        storage_path: storagePath,
        original_filename: cleanFilename,
        mime_type: fileCheck.mimeType,
        file_size_bytes: buffer.length,
        sha256_checksum: checksum,
        upload_status: 'uploaded'
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Database error saving document metadata: ${insertErr?.message || 'Insert failed'}`);
    }
    return sanitizeDocumentMetadata(mapDocumentRow(inserted));
  }

  assertSupabaseInProduction();

  if (params.documentType !== 'supplemental') {
    for (const d of memoryDocuments) {
      if (d.verificationId === verification.id && d.documentType === params.documentType && d.uploadStatus === 'uploaded') {
        d.uploadStatus = 'superseded';
      }
    }
  }

  const docId = `kdoc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const docRecord: InternalKycDocumentRecord = {
    id: docId,
    verificationId: verification.id,
    registrationId: registration.id,
    userId: user.id,
    documentType: params.documentType,
    storageBucket: KYC_STORAGE_BUCKET,
    storagePath,
    originalFilename: cleanFilename,
    mimeType: fileCheck.mimeType,
    fileSizeBytes: buffer.length,
    sha256Checksum: checksum,
    uploadStatus: 'uploaded',
    uploadedAt: now
  };
  memoryDocuments.unshift(docRecord);
  memoryDocumentBlobs.set(docId, {
    buffer,
    mimeType: fileCheck.mimeType,
    filename: cleanFilename
  });

  return sanitizeDocumentMetadata(docRecord);
}

/**
 * Validates all required fields, country-specific documents, selfie, and consent,
 * transitions verification status to 'under_review', logs history, and emails confirmation.
 */
export async function submitClientKycVerification(
  user: { id: string; email: string; fullName: string },
  payload: any,
  ipAddress?: string
) {
  // First persist incoming payload fields safely
  await saveClientKycDraft(user, payload || {});
  const { registration, verification } = await requireEditableApprovedClientVerification(user);
  const docs = (await getKycDocuments(verification.id)).filter(d => d.uploadStatus === 'uploaded');
  const isUS = isUnitedStatesJurisdiction(verification.country);

  const missingErrors: Record<string, string> = {};
  if (!verification.legalFullName || verification.legalFullName.trim().length < 2) {
    missingErrors.legalFullName = 'Full legal name is required.';
  }
  if (!verification.country || verification.country.trim().length < 2) {
    missingErrors.country = 'Country or jurisdiction is required.';
  }
  if (!verification.addressLine1 || verification.addressLine1.trim().length < 3) {
    missingErrors.addressLine1 = 'Street / residential address is required.';
  }
  if (!verification.city || verification.city.trim().length < 2) {
    missingErrors.city = 'City is required.';
  }
  if (!verification.postalCode || verification.postalCode.trim().length < 2) {
    missingErrors.postalCode = 'Postal / ZIP code is required.';
  }
  if (!verification.governmentIdType) {
    missingErrors.governmentIdType = 'Government-issued identification type is required.';
  }

  const hasDoc = (types: KycDocumentType[]) => docs.some(d => types.includes(d.documentType));

  if (isUS) {
    if (!verification.ssnProvided || !verification.ssnLast4) {
      missingErrors.ssn = 'US Social Security Number (tokenized/encrypted for US regulatory compliance) is required.';
    }
    if (verification.governmentIdType === 'passport') {
      if (!hasDoc(['passport', 'gov_id_front'])) {
        missingErrors.govIdFront = 'Government ID / Passport biodata page image is required.';
      }
    } else {
      if (!hasDoc(['gov_id_front', 'drivers_license' as any].filter(Boolean) as KycDocumentType[])) {
        missingErrors.govIdFront = 'Front image of your government-issued ID is required.';
      }
      if (!hasDoc(['gov_id_back'])) {
        missingErrors.govIdBack = 'Back image of your government-issued ID is required.';
      }
    }
  } else {
    if (verification.governmentIdType === 'passport') {
      if (!hasDoc(['passport', 'gov_id_front'])) {
        missingErrors.govIdFront = 'Passport biodata page image is required.';
      }
    } else if (verification.governmentIdType) {
      if (!hasDoc(['gov_id_front', 'national_id'])) {
        missingErrors.govIdFront = 'Front image of your national ID or driver\'s licence is required.';
      }
      if (!hasDoc(['gov_id_back'])) {
        missingErrors.govIdBack = 'Back image of your national ID or driver\'s licence is required.';
      }
    }
  }

  if (!hasDoc(['selfie', 'liveness_capture'])) {
    missingErrors.selfie = 'A recent identity photograph (selfie) or live camera capture is required.';
  }

  if (!verification.consentAccepted) {
    missingErrors.consentAccepted = 'You must review and accept the KYC Data Governance & Privacy Consent notice.';
  }

  if (Object.keys(missingErrors).length > 0) {
    const err = new Error('Please complete all mandatory identity verification fields and document uploads.') as Error & {
      status?: number;
      details?: Record<string, string>;
    };
    err.status = 400;
    err.details = missingErrors;
    throw err;
  }

  const previousStatus = verification.verificationStatus;
  const now = new Date().toISOString();
  const retentionExpiresAt = new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const actionType = previousStatus === 'action_required' ? 'resubmitted' : 'submitted';

  let updated: InternalKycVerificationRecord;
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_identity_verifications')
      .update({
        verification_status: 'under_review',
        action_required_message: null,
        submitted_at: now,
        retention_expires_at: retentionExpiresAt,
        updated_at: now
      })
      .eq('id', verification.id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error submitting KYC verification: ${error?.message || 'Update failed'}`);
    }
    updated = mapVerificationRow(data);
  } else {
    assertSupabaseInProduction();
    verification.verificationStatus = 'under_review';
    verification.actionRequiredMessage = undefined;
    verification.submittedAt = now;
    verification.retentionExpiresAt = retentionExpiresAt;
    verification.updatedAt = now;
    updated = verification;
  }

  await insertReviewHistory({
    verificationId: updated.id,
    previousStatus,
    newStatus: 'under_review',
    action: actionType,
    actorId: user.id,
    actorEmail: user.email,
    actorRole: 'client',
    clientMessage:
      actionType === 'resubmitted'
        ? 'Updated KYC verification information submitted for compliance review.'
        : 'Identity verification submitted and queued for compliance review.'
  });

  await recordAuditLog(
    user.email,
    'client',
    actionType === 'resubmitted' ? 'CLIENT_KYC_RESUBMITTED' : 'CLIENT_KYC_SUBMITTED',
    'client_identity_verifications',
    updated.id,
    `Client ${registration.referenceNumber} submitted KYC verification (${updated.country}, docs=${docs.length}). Status: under_review.`,
    ipAddress
  ).catch(() => undefined);

  // Non-blocking Resend confirmation
  sendClientKycSubmissionConfirmation({
    email: registration.email,
    fullName: updated.legalFullName || registration.fullName,
    referenceNumber: registration.referenceNumber,
    submittedAt: now
  }).catch(() => undefined);

  const history = await getKycHistory(updated.id);
  return sanitizeVerificationForClient(updated, registration, docs, history);
}

// ==============================================================================
// COMPLIANCE OFFICER / SUPER ADMIN OPERATIONS
// ==============================================================================

export async function getComplianceKycOverviewAndList() {
  let rows: InternalKycVerificationRecord[] = [];
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_identity_verifications')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Database error listing KYC submissions: ${error.message}`);
    }
    rows = (data || []).map(mapVerificationRow);
  } else {
    assertSupabaseInProduction();
    rows = [...memoryVerifications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const enriched = await Promise.all(
    rows.map(async v => {
      const [reg, docs, history] = await Promise.all([
        getClientRegistrationById(v.registrationId),
        getKycDocuments(v.id),
        getKycHistory(v.id)
      ]);
      return sanitizeVerificationForCompliance(v, reg, docs, history);
    })
  );

  const overview = {
    total: enriched.length,
    notStarted: enriched.filter(s => s.verificationStatus === 'not_started').length,
    pendingReview: enriched.filter(
      s => s.verificationStatus === 'submitted' || s.verificationStatus === 'under_review'
    ).length,
    approved: enriched.filter(s => s.verificationStatus === 'approved').length,
    rejected: enriched.filter(s => s.verificationStatus === 'rejected').length,
    actionRequired: enriched.filter(s => s.verificationStatus === 'action_required').length
  };

  return { overview, submissions: enriched };
}

export async function getComplianceKycSubmissionDetail(verificationId: string) {
  const v = await getKycVerificationById(verificationId);
  if (!v) return null;
  const [reg, docs, history] = await Promise.all([
    getClientRegistrationById(v.registrationId),
    getKycDocuments(v.id),
    getKycHistory(v.id)
  ]);
  return sanitizeVerificationForCompliance(v, reg, docs, history);
}

export async function generateSignedDocumentViewUrl(params: {
  docId: string;
  actor: { id: string; email: string; role: string };
  ipAddress?: string;
}): Promise<{
  signedUrl: string;
  expiresInSeconds: number;
  mimeType: string;
  originalFilename: string;
}> {
  const doc = await getKycDocumentById(params.docId);
  if (!doc || doc.uploadStatus !== 'uploaded') {
    const err = new Error('Requested KYC document was not found or is no longer active.') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  let signedUrl = '';
  if (supabaseAdmin && supabaseAdmin.storage) {
    const { data, error } = await supabaseAdmin.storage
      .from(doc.storageBucket || KYC_STORAGE_BUCKET)
      .createSignedUrl(doc.storagePath, KYC_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create short-lived signed document URL: ${error?.message || 'Storage error'}`);
    }
    signedUrl = data.signedUrl;
  } else {
    assertSupabaseInProduction();
    const exp = Math.floor(Date.now() / 1000) + KYC_SIGNED_URL_TTL_SECONDS;
    const sig = crypto
      .createHmac('sha256', getKycPreviewHmacKey())
      .update(`${doc.id}:${exp}`)
      .digest('base64url');
    signedUrl = `/api/kyc/secure-preview/${encodeURIComponent(doc.id)}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
  }

  await recordAuditLog(
    params.actor.email,
    params.actor.role,
    'KYC_DOCUMENT_SIGNED_URL_ISSUED',
    'client_kyc_documents',
    doc.id,
    `Issued ${KYC_SIGNED_URL_TTL_SECONDS}s signed document view URL for verification ${doc.verificationId} (${doc.documentType}).`,
    params.ipAddress
  ).catch(() => undefined);

  return {
    signedUrl,
    expiresInSeconds: KYC_SIGNED_URL_TTL_SECONDS,
    mimeType: doc.mimeType,
    originalFilename: doc.originalFilename
  };
}

export function verifyAndReadDevDocumentPreview(docId: string, expParam: string, sigParam: string) {
  if (isProduction) {
    return null;
  }
  const exp = Number(expParam);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp < nowSec || !sigParam) {
    return null;
  }
  const expectedSig = crypto
    .createHmac('sha256', getKycPreviewHmacKey())
    .update(`${docId}:${exp}`)
    .digest('base64url');
  const providedBuf = Buffer.from(sigParam, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }
  return memoryDocumentBlobs.get(docId) || null;
}

export async function decideClientKycVerification(params: {
  verificationId: string;
  decision: 'approve' | 'reject' | 'request_info';
  clientMessage?: string;
  internalNotes?: string;
  actor: { id: string; email: string; role: string };
  reqHeaders?: Record<string, any>;
  ipAddress?: string;
}) {
  const v = await getKycVerificationById(params.verificationId);
  if (!v) {
    const err = new Error('KYC verification dossier not found.') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  if (v.verificationStatus !== 'submitted' && v.verificationStatus !== 'under_review') {
    const err = new Error(
      `Only submitted or under-review KYC dossiers can receive a compliance decision. Current status: ${v.verificationStatus}.`
    ) as Error & { status?: number };
    err.status = 409;
    throw err;
  }

  const cleanMessage = params.clientMessage?.trim() || '';
  if ((params.decision === 'reject' || params.decision === 'request_info') && cleanMessage.length < 5) {
    const err = new Error(
      params.decision === 'reject'
        ? 'A clear rejection reason (minimum 5 characters) is required.'
        : 'Clear instructions specifying what additional information is required (minimum 5 characters) must be provided.'
    ) as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const registration = await getClientRegistrationById(v.registrationId);
  if (!registration) {
    const err = new Error('Associated client registration not found.') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const previousStatus = v.verificationStatus;
  const nextStatus: KycStatus =
    params.decision === 'approve'
      ? 'approved'
      : params.decision === 'reject'
      ? 'rejected'
      : 'action_required';

  const historyAction =
    params.decision === 'approve'
      ? 'approved'
      : params.decision === 'reject'
      ? 'rejected'
      : 'action_required';

  const now = new Date().toISOString();
  const origin = resolveAppOrigin({ headers: params.reqHeaders });
  const portalVerificationUrl = `${origin}/client-portal?section=verification&ref=${encodeURIComponent(
    registration.referenceNumber
  )}`;

  let updated: InternalKycVerificationRecord;
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_identity_verifications')
      .update({
        verification_status: nextStatus,
        action_required_message: params.decision === 'request_info' ? cleanMessage : null,
        rejection_reason: params.decision === 'reject' ? cleanMessage : null,
        internal_compliance_notes: params.internalNotes?.trim() || v.internalComplianceNotes || null,
        reviewed_at: now,
        reviewed_by: params.actor.id,
        reviewed_by_email: params.actor.email,
        reviewed_by_role: params.actor.role,
        updated_at: now
      })
      .eq('id', v.id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error recording KYC decision: ${error?.message || 'Update failed'}`);
    }
    updated = mapVerificationRow(data);
  } else {
    assertSupabaseInProduction();
    v.verificationStatus = nextStatus;
    v.actionRequiredMessage = params.decision === 'request_info' ? cleanMessage : undefined;
    v.rejectionReason = params.decision === 'reject' ? cleanMessage : undefined;
    v.internalComplianceNotes = params.internalNotes?.trim() || v.internalComplianceNotes;
    v.reviewedAt = now;
    v.reviewedBy = params.actor.id;
    v.reviewedByEmail = params.actor.email;
    v.reviewedByRole = params.actor.role;
    v.updatedAt = now;
    updated = v;
  }

  await insertReviewHistory({
    verificationId: updated.id,
    previousStatus,
    newStatus: nextStatus,
    action: historyAction,
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    clientMessage: cleanMessage || (params.decision === 'approve' ? 'Identity verification approved by Compliance Desk.' : undefined),
    internalNotes: params.internalNotes?.trim() || undefined
  });

  await recordAuditLog(
    params.actor.email,
    params.actor.role,
    `CLIENT_KYC_${historyAction.toUpperCase()}`,
    'client_identity_verifications',
    updated.id,
    `Compliance decision '${nextStatus}' recorded for ${registration.referenceNumber} (previous: ${previousStatus}).`,
    params.ipAddress
  ).catch(() => undefined);

  // Trigger decision email safely without exposing PII/SSNs
  let emailSent = false;
  try {
    if (params.decision === 'approve') {
      const r = await sendClientKycApproved({
        email: registration.email,
        fullName: updated.legalFullName || registration.fullName,
        referenceNumber: registration.referenceNumber,
        portalUrl: `${origin}/client-portal`
      });
      emailSent = r.success;
    } else if (params.decision === 'reject') {
      const r = await sendClientKycRejected({
        email: registration.email,
        fullName: updated.legalFullName || registration.fullName,
        referenceNumber: registration.referenceNumber,
        reason: cleanMessage
      });
      emailSent = r.success;
    } else {
      const r = await sendClientKycActionRequired({
        email: registration.email,
        fullName: updated.legalFullName || registration.fullName,
        referenceNumber: registration.referenceNumber,
        instructions: cleanMessage,
        verificationUrl: portalVerificationUrl
      });
      emailSent = r.success;
    }
  } catch {
    emailSent = false;
  }

  const [docs, history] = await Promise.all([getKycDocuments(updated.id), getKycHistory(updated.id)]);
  return {
    submission: sanitizeVerificationForCompliance(updated, registration, docs, history),
    emailSent
  };
}
