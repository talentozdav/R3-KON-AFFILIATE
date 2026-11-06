export type UserRole = 'super_admin' | 'affiliate_manager' | 'finance_manager' | 'affiliate' | 'client';

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
