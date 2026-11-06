export type UserRole = 'super_admin' | 'affiliate_manager' | 'finance_manager' | 'affiliate';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  affiliateId?: string; // links to Affiliate if role === 'affiliate'
  status: 'active' | 'suspended' | 'pending_activation';
  passwordHash?: string;
  passwordSalt?: string;
  activationToken?: string;
  resetToken?: string;
  resetTokenExpires?: string;
  createdAt: string;
}

export type ApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INFORMATION_REQUESTED';
export type ApplicantType = 'Individual' | 'Business';

export interface AffiliateApplication {
  id: string;
  referenceNumber: string; // e.g. R3-APP-2026-8812
  fullName: string;
  applicantType: ApplicantType;
  businessName?: string;
  email: string;
  phone: string;
  country: string;
  partnershipCategory: string; // Wealth Advisory, Corporate Services, Executive Search, Family Office, Legal & Tax, Other
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
  affiliateNumber: string; // e.g. R3-AFF-2041
  userId: string;
  fullName: string;
  email: string;
  businessName?: string;
  referralCode: string; // e.g. ALEXANDER-R3
  status: AffiliateStatus;
  joinedAt: string;
  approvedRatePercent: number; // Configured approved commission rate e.g. 10.0
  totalClicks: number;
  uniqueVisitors: number;
}

export type LeadStatus = 'in_review' | 'engaged' | 'qualified' | 'converted' | 'disqualified';

export interface ReferralLead {
  id: string;
  affiliateId: string;
  referralCode: string;
  clientIdentifier: string; // Anonymized/redacted for confidentiality e.g. "Private Family Office (Geneva)"
  clientType: 'Individual' | 'Corporate' | 'Institutional';
  region: string;
  serviceCategory: string; // Executive Contingency, Crisis Coordination, Sovereign Advisory, etc.
  status: LeadStatus;
  estimatedValue?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversionStatus = 'verified' | 'pending_verification' | 'reversed';

export interface Conversion {
  id: string;
  transactionReference: string; // e.g. CTX-2026-9041
  affiliateId: string;
  leadId?: string;
  membershipTierOrCategory: string;
  eligibleSaleAmount: number; // in USD
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
  commissionReference: string; // e.g. COM-2026-7812
  affiliateId: string;
  conversionId: string;
  transactionReference: string;
  eligibleTransactionAmount: number;
  appliedCommissionRate: number; // e.g. 10.0 for 10%
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
  payoutReference: string; // e.g. PAY-2026-0419
  affiliateId: string;
  payoutPeriod: string; // e.g. "October 2026", "Q3 2026"
  amount: number;
  currency: string;
  status: PayoutStatus;
  paymentMethod: string; // Wire Transfer, SWIFT, SEPA
  paymentReference?: string; // e.g. WIRE-R3-884920
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
  targetType: 'application' | 'affiliate' | 'conversion' | 'commission' | 'payout' | 'commission_rule' | 'auth';
  targetId: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface ReferralClickRecord {
  id: string;
  referralCode: string;
  affiliateId: string;
  visitorHash: string;
  isUnique: boolean;
  referer?: string;
  userAgent?: string;
  timestamp: string;
}
