export type UserRole =
  | 'super_admin'
  | 'compliance_officer'
  | 'affiliate_manager'
  | 'finance_manager'
  | 'affiliate'
  | 'client';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending_activation';
  affiliate?: Affiliate | null;
  clientId?: string;
  membershipTier?: string;
}

export type ApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INFORMATION_REQUESTED';
export type ApplicantType = 'Individual' | 'Business';

export interface AffiliateApplication {
  id: string;
  referenceNumber: string;
  fullName: string;
  applicantType: ApplicantType;
  businessName?: string;
  email: string;
  phone: string;
  country: string;
  partnershipCategory: string;
  industryBackground: string;
  audienceDescription: string;
  partnershipObjectives: string;
  additionalInfo?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  status: ApplicationStatus;
  statusNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt: string;
  activatedAffiliateId?: string;
}

export type AffiliateStatus = 'active' | 'suspended' | 'terminated' | 'pending';

export interface Affiliate {
  id: string;
  affiliateNumber: string;
  userId?: string;
  fullName: string;
  email: string;
  businessName?: string;
  referralCode: string;
  status: AffiliateStatus;
  joinedAt: string;
  approvedRatePercent: number;
  totalClicks: number;
  uniqueVisitors: number;
}

export type LeadStatus = 'in_review' | 'engaged' | 'qualified' | 'converted' | 'disqualified';

export interface ReferralLead {
  id: string;
  affiliateId: string;
  referralCode: string;
  clientIdentifier: string;
  clientType: 'Individual' | 'Corporate' | 'Institutional';
  region: string;
  serviceCategory: string;
  status: LeadStatus;
  estimatedValue?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversionStatus = 'verified' | 'pending_verification' | 'reversed';

export interface Conversion {
  id: string;
  transactionReference: string;
  affiliateId: string;
  leadId?: string;
  membershipTierOrCategory: string;
  eligibleSaleAmount: number;
  currency: string;
  verificationStatus: ConversionStatus;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  transactionDate: string;
  createdAt: string;
}

export type CommissionStatus = 'approved' | 'pending' | 'reversed' | 'paid';

export interface Commission {
  id: string;
  commissionReference: string;
  affiliateId: string;
  conversionId: string;
  transactionReference: string;
  eligibleTransactionAmount: number;
  appliedCommissionRate: number;
  commissionAmount: number;
  currency: string;
  status: CommissionStatus;
  payoutId?: string;
  auditReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  dateRecorded: string;
}

export type PayoutStatus = 'scheduled' | 'processing' | 'paid' | 'cancelled';

export interface Payout {
  id: string;
  payoutReference: string;
  affiliateId: string;
  payoutPeriod: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  paymentMethod: string;
  paymentReference?: string;
  notes?: string;
  commissionIds: string[];
  preparedBy: string;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
}

export interface CommissionRule {
  id: string;
  name: string;
  serviceCategory: string;
  ratePercent: number;
  status: 'active' | 'inactive' | 'draft';
  effectiveDate: string;
  approvedBy?: string;
  approvedAt?: string;
  description: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: UserRole;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface AffiliateDashboardData {
  affiliate: Affiliate;
  stats: {
    totalClicks: number;
    uniqueVisitors: number;
    leadsGenerated: number;
    verifiedConversions: number;
    approvedCommissions: number;
    paidCommissions: number;
    pendingVerificationConversions: number;
    pendingPayoutCommissions: number;
  };
  leads: ReferralLead[];
  conversions: Conversion[];
  commissions: Commission[];
  payouts: Payout[];
}

export interface AdminOverviewMetrics {
  pendingApplications: number;
  totalApplications: number;
  activeAffiliates: number;
  totalAffiliates: number;
  totalLeads: number;
  verifiedConversions: number;
  pendingConversions: number;
  pendingCommissionApproval: number;
  approvedUnpaidCommissions: number;
  totalPaidOutCommissions: number;
  activeCommissionRulesCount: number;
}

export interface ClientRegistration {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  country: string;
  serviceCategory: string;
  requirementsBrief?: string;
  referralCode?: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'DECLINED' | 'ARCHIVED';
  invitationStatus: 'pending' | 'sent' | 'failed' | 'accepted' | 'expired';
  invitationSentAt?: string;
  invitationError?: string;
  accountActivatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInquiry {
  id: string;
  referenceNumber: string;
  clientId?: string;
  registrationId?: string;
  clientName: string;
  email: string;
  phone?: string;
  organization?: string;
  country: string;
  serviceInterest: string;
  briefSummary?: string;
  status: 'open' | 'under_review' | 'assigned' | 'resolved' | 'closed';
  priority: 'urgent' | 'high' | 'standard';
  assignedCoordinator?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNote {
  id: string;
  registrationId: string;
  authorEmail: string;
  authorName: string;
  noteType: string;
  content: string;
  createdAt: string;
}

export interface ClientFollowup {
  id: string;
  registrationId: string;
  title: string;
  dueDate: string;
  priority: string;
  status: string;
  assignedTo: string;
  notes?: string;
  createdAt: string;
}

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

export interface KycDocumentMetadata {
  id: string;
  verificationId: string;
  registrationId: string;
  documentType: KycDocumentType;
  originalFilename: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  fileSizeBytes: number;
  sha256Checksum?: string;
  uploadStatus: 'pending' | 'uploaded' | 'superseded' | 'deleted';
  uploadedAt: string;
}

export interface KycReviewHistoryItem {
  id: string;
  verificationId?: string;
  previousStatus?: string;
  newStatus: string;
  action: string;
  actorEmail?: string;
  actorRole?: string;
  clientMessage?: string;
  internalNotes?: string;
  createdAt: string;
}

export interface ClientKycVerificationDetails {
  id: string;
  registrationId: string;
  verificationStatus: KycStatus;
  legalFullName: string;
  verifiedEmail: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  governmentIdType: GovernmentIdType | '';
  governmentIdLast4: string;
  ssnProvided: boolean;
  ssnMasked: string | null;
  livenessMethod: 'camera_capture' | 'selfie_upload';
  livenessVerified: boolean;
  livenessChallengeNote: string;
  consentAccepted: boolean;
  consentVersion: string;
  consentTimestamp: string | null;
  retentionExpiresAt: string | null;
  actionRequiredMessage: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface ClientKycStateResponse {
  success?: boolean;
  message?: string;
  registrationId: string | null;
  registrationReference: string | null;
  registrationStatus: string;
  registrationApproved: boolean;
  verificationStatus: KycStatus;
  canStartVerification: boolean;
  isUnitedStates: boolean;
  verification: ClientKycVerificationDetails | null;
  documents: KycDocumentMetadata[];
  history: KycReviewHistoryItem[];
}

export interface ComplianceKycOverview {
  total: number;
  notStarted: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  actionRequired: number;
}

export interface ComplianceKycSubmission {
  id: string;
  registrationId: string;
  registrationReference: string | null;
  registrationStatus: string;
  clientCompany: string | null;
  serviceCategory: string | null;
  userId: string | null;
  verificationStatus: KycStatus;
  legalFullName: string;
  verifiedEmail: string;
  country: string;
  isUnitedStates: boolean;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  governmentIdType: GovernmentIdType | null;
  governmentIdLast4: string | null;
  ssnProvided: boolean;
  ssnMasked: string | null;
  livenessMethod: 'camera_capture' | 'selfie_upload' | null;
  livenessVerified: boolean;
  livenessChallengeNote: string | null;
  consentAccepted: boolean;
  consentVersion: string | null;
  consentTimestamp: string | null;
  retentionExpiresAt: string | null;
  kycInvitationSentAt: string | null;
  kycInvitationExpiresAt: string | null;
  actionRequiredMessage: string | null;
  rejectionReason: string | null;
  internalComplianceNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByEmail: string | null;
  reviewedByRole: string | null;
  createdAt: string;
  updatedAt: string;
  documents: KycDocumentMetadata[];
  history: KycReviewHistoryItem[];
}
