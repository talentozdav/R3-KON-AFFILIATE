import {
  User,
  AffiliateApplication,
  Affiliate,
  ReferralLead,
  Conversion,
  Commission,
  Payout,
  CommissionRule,
  AuditLogEntry,
  ReferralClickRecord,
  UserRole
} from './types.js';

class DatabaseStore {
  public users: User[] = [];
  public applications: AffiliateApplication[] = [];
  public affiliates: Affiliate[] = [];
  public leads: ReferralLead[] = [];
  public conversions: Conversion[] = [];
  public commissions: Commission[] = [];
  public payouts: Payout[] = [];
  public commissionRules: CommissionRule[] = [];
  public auditLogs: AuditLogEntry[] = [];
  public clicks: ReferralClickRecord[] = [];
  private visitorHashes: Set<string> = new Set();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 1. Initial Users
    this.users = [
      {
        id: 'usr_super_admin',
        email: 'superadmin@r3contingencies.com',
        fullName: 'Julian Sterling (Head of Governance)',
        role: 'super_admin',
        status: 'active',
        createdAt: '2026-01-10T09:00:00Z',
      },
      {
        id: 'usr_affiliate_mgr',
        email: 'affiliates@r3contingencies.com',
        fullName: 'Elena Rostova (Affiliate Director)',
        role: 'affiliate_manager',
        status: 'active',
        createdAt: '2026-01-15T10:00:00Z',
      },
      {
        id: 'usr_finance_mgr',
        email: 'finance@r3contingencies.com',
        fullName: 'Marcus Vance (Chief Financial Officer)',
        role: 'finance_manager',
        status: 'active',
        createdAt: '2026-01-15T11:00:00Z',
      },
      {
        id: 'usr_affiliate_1',
        email: 'alexander.v@vanderbilt-capital.com',
        fullName: 'Alexander Vanderbilt',
        role: 'affiliate',
        affiliateId: 'aff_2041',
        status: 'active',
        createdAt: '2026-02-01T14:30:00Z',
      },
      {
        id: 'usr_affiliate_2',
        email: 'clara.m@meridian-partners.co.uk',
        fullName: 'Clara Montagu',
        role: 'affiliate',
        affiliateId: 'aff_3190',
        status: 'active',
        createdAt: '2026-03-12T10:00:00Z',
      }
    ];

    // 2. Initial Affiliates
    this.affiliates = [
      {
        id: 'aff_2041',
        affiliateNumber: 'R3-AFF-2041',
        userId: 'usr_affiliate_1',
        fullName: 'Alexander Vanderbilt',
        email: 'alexander.v@vanderbilt-capital.com',
        businessName: 'Vanderbilt Capital Advisory Ltd',
        referralCode: 'ALEXANDER-R3',
        status: 'active',
        joinedAt: '2026-02-01T14:30:00Z',
        approvedRatePercent: 10.0,
        totalClicks: 142,
        uniqueVisitors: 89,
      },
      {
        id: 'aff_3190',
        affiliateNumber: 'R3-AFF-3190',
        userId: 'usr_affiliate_2',
        fullName: 'Clara Montagu',
        email: 'clara.m@meridian-partners.co.uk',
        businessName: 'Meridian Private Wealth',
        referralCode: 'MERIDIAN-R3',
        status: 'active',
        joinedAt: '2026-03-12T10:00:00Z',
        approvedRatePercent: 8.5,
        totalClicks: 94,
        uniqueVisitors: 62,
      }
    ];

    // 3. Initial Applications
    this.applications = [
      {
        id: 'app_1001',
        referenceNumber: 'R3-APP-2026-2041',
        fullName: 'Alexander Vanderbilt',
        applicantType: 'Business',
        businessName: 'Vanderbilt Capital Advisory Ltd',
        email: 'alexander.v@vanderbilt-capital.com',
        phone: '+44 20 7946 0912',
        country: 'United Kingdom',
        partnershipCategory: 'Wealth Advisory',
        industryBackground: 'Former Managing Director at Tier-1 Swiss Private Bank, currently advising ultra-high-net-worth families on cross-border risk and governance.',
        audienceDescription: 'Family offices, high-profile entrepreneurs, and principals with assets in excess of $50M facing geopolitical and operational exposure.',
        partnershipObjectives: 'To provide institutional-grade crisis coordination and executive contingency solutions to our existing retained client base.',
        termsAccepted: true,
        privacyAccepted: true,
        status: 'APPROVED',
        statusNotes: 'KYC and compliance cleared. Proven institutional pedigree. Approved by Affiliate Director.',
        reviewedBy: 'Elena Rostova (Affiliate Director)',
        reviewedAt: '2026-02-01T14:00:00Z',
        submittedAt: '2026-01-28T11:20:00Z',
        updatedAt: '2026-02-01T14:30:00Z',
        activatedAffiliateId: 'aff_2041'
      },
      {
        id: 'app_1002',
        referenceNumber: 'R3-APP-2026-3190',
        fullName: 'Clara Montagu',
        applicantType: 'Business',
        businessName: 'Meridian Private Wealth',
        email: 'clara.m@meridian-partners.co.uk',
        phone: '+44 20 7183 4901',
        country: 'United Kingdom',
        partnershipCategory: 'Family Office',
        industryBackground: 'Senior Partner specializing in sovereign advisory, fiduciary structuring, and multi-jurisdictional compliance.',
        audienceDescription: 'European and Middle Eastern UHNW families, enterprise founders, and maritime executives.',
        partnershipObjectives: 'Complement fiduciary advisory with R3 contingency protocols.',
        termsAccepted: true,
        privacyAccepted: true,
        status: 'APPROVED',
        statusNotes: 'Approved following partner interview. Clean background check.',
        reviewedBy: 'Elena Rostova (Affiliate Director)',
        reviewedAt: '2026-03-12T09:30:00Z',
        submittedAt: '2026-03-08T15:10:00Z',
        updatedAt: '2026-03-12T10:00:00Z',
        activatedAffiliateId: 'aff_3190'
      },
      {
        id: 'app_1003',
        referenceNumber: 'R3-APP-2026-8812',
        fullName: 'Sarah Chen-Sinclair',
        applicantType: 'Individual',
        businessName: 'Sinclair Advisory Pte Ltd',
        email: 'sarah.chen@pacific-wealth.sg',
        phone: '+65 6712 9940',
        country: 'Singapore',
        partnershipCategory: 'Corporate Services',
        industryBackground: 'Cross-border M&A counsel and private trustee with 18 years practice in Singapore and Hong Kong.',
        audienceDescription: 'C-Suite leadership at multinational technology firms and APAC regional holding conglomerates.',
        partnershipObjectives: 'Introduce clients expanding into emerging markets to R3 international contingency frameworks.',
        termsAccepted: true,
        privacyAccepted: true,
        status: 'UNDER_REVIEW',
        statusNotes: 'Preliminary compliance check in progress. Awaiting credential verification.',
        reviewedBy: 'Elena Rostova (Affiliate Director)',
        reviewedAt: '2026-11-01T08:30:00Z',
        submittedAt: '2026-10-29T16:45:00Z',
        updatedAt: '2026-11-01T08:30:00Z'
      },
      {
        id: 'app_1004',
        referenceNumber: 'R3-APP-2026-5591',
        fullName: 'Henrik Lindqvist',
        applicantType: 'Business',
        businessName: 'Nordic Sovereign Risk AB',
        email: 'henrik@nordicrisk.se',
        phone: '+46 8 500 1200',
        country: 'Sweden',
        partnershipCategory: 'Legal & Tax',
        industryBackground: 'Maritime security and geopolitical risk assessor advising institutional shipping groups.',
        audienceDescription: 'Commercial cargo fleet operators and international commodity traders.',
        partnershipObjectives: 'Direct referral of high-risk operational coordination engagements.',
        termsAccepted: true,
        privacyAccepted: true,
        status: 'INFORMATION_REQUESTED',
        statusNotes: 'Requested additional clarification on regulatory licenses and primary operating jurisdictions.',
        reviewedBy: 'Elena Rostova (Affiliate Director)',
        reviewedAt: '2026-11-03T11:20:00Z',
        submittedAt: '2026-11-02T09:15:00Z',
        updatedAt: '2026-11-03T11:20:00Z'
      },
      {
        id: 'app_1005',
        referenceNumber: 'R3-APP-2026-4401',
        fullName: 'Marcus Thorne',
        applicantType: 'Individual',
        email: 'marcus.t@unverified-lead.net',
        phone: '+1 555 019 2831',
        country: 'United States',
        partnershipCategory: 'Other',
        industryBackground: 'Affiliate marketer and internet traffic broker.',
        audienceDescription: 'Broad social media followers and consumer email lists.',
        partnershipObjectives: 'Run automated ads and display banners.',
        termsAccepted: true,
        privacyAccepted: true,
        status: 'REJECTED',
        statusNotes: 'Incompatible audience. R3 Global Affiliate Network is strictly reserved for qualified professional partners and executive consultancies; programmatic retail marketing is prohibited.',
        reviewedBy: 'Elena Rostova (Affiliate Director)',
        reviewedAt: '2026-10-15T14:00:00Z',
        submittedAt: '2026-10-14T10:10:00Z',
        updatedAt: '2026-10-15T14:00:00Z'
      }
    ];

    // 4. Initial Referral Leads (Privacy compliant / anonymized for partner protection)
    this.leads = [
      {
        id: 'lead_701',
        affiliateId: 'aff_2041',
        referralCode: 'ALEXANDER-R3',
        clientIdentifier: 'Single Family Office (Geneva)',
        clientType: 'Institutional',
        region: 'Western Europe',
        serviceCategory: 'Executive Contingency Retainer',
        status: 'converted',
        estimatedValue: 120000,
        notes: 'Retainer executed for comprehensive family crisis protocol across 4 residences.',
        createdAt: '2026-03-02T11:00:00Z',
        updatedAt: '2026-03-20T16:30:00Z'
      },
      {
        id: 'lead_702',
        affiliateId: 'aff_2041',
        referralCode: 'ALEXANDER-R3',
        clientIdentifier: 'Principal Asset Holdings (London / DIFC)',
        clientType: 'Corporate',
        region: 'United Kingdom / GCC',
        serviceCategory: 'Institutional Crisis Advisory',
        status: 'converted',
        estimatedValue: 85000,
        notes: 'Corporate executive contingency coordination for leadership overseas deployment.',
        createdAt: '2026-05-14T09:15:00Z',
        updatedAt: '2026-06-01T10:00:00Z'
      },
      {
        id: 'lead_703',
        affiliateId: 'aff_2041',
        referralCode: 'ALEXANDER-R3',
        clientIdentifier: 'Private Maritime Logistics Principal',
        clientType: 'Individual',
        region: 'Mediterranean',
        serviceCategory: 'Private Sovereign Support',
        status: 'qualified',
        estimatedValue: 95000,
        notes: 'Under formal evaluation with R3 Senior Contingency Counsel.',
        createdAt: '2026-10-10T14:20:00Z',
        updatedAt: '2026-10-25T11:00:00Z'
      },
      {
        id: 'lead_704',
        affiliateId: 'aff_2041',
        referralCode: 'ALEXANDER-R3',
        clientIdentifier: 'Biotech Venture Chairman',
        clientType: 'Individual',
        region: 'North America',
        serviceCategory: 'Executive Contingency Retainer',
        status: 'engaged',
        estimatedValue: 60000,
        notes: 'Initial consultation scheduled with lead coordinator.',
        createdAt: '2026-10-28T16:00:00Z',
        updatedAt: '2026-11-02T09:30:00Z'
      },
      {
        id: 'lead_705',
        affiliateId: 'aff_3190',
        referralCode: 'MERIDIAN-R3',
        clientIdentifier: 'Multi-Family Office Syndicate (Zurich)',
        clientType: 'Institutional',
        region: 'Switzerland',
        serviceCategory: 'Institutional Crisis Advisory',
        status: 'converted',
        estimatedValue: 150000,
        notes: 'Signed multi-year advisory mandate.',
        createdAt: '2026-04-18T10:00:00Z',
        updatedAt: '2026-05-02T14:00:00Z'
      }
    ];

    // 5. Initial Conversions
    this.conversions = [
      {
        id: 'cnv_8001',
        transactionReference: 'CTX-2026-9041',
        affiliateId: 'aff_2041',
        leadId: 'lead_701',
        membershipTierOrCategory: 'Executive Contingency Retainer',
        eligibleSaleAmount: 120000,
        currency: 'USD',
        verificationStatus: 'verified',
        verificationNotes: 'Client contract executed, banking clearance confirmed. Verified by Compliance & Finance.',
        verifiedBy: 'Julian Sterling (Head of Governance)',
        verifiedAt: '2026-03-22T10:00:00Z',
        transactionDate: '2026-03-20T16:30:00Z',
        createdAt: '2026-03-21T09:00:00Z'
      },
      {
        id: 'cnv_8002',
        transactionReference: 'CTX-2026-9188',
        affiliateId: 'aff_2041',
        leadId: 'lead_702',
        membershipTierOrCategory: 'Institutional Crisis Advisory',
        eligibleSaleAmount: 85000,
        currency: 'USD',
        verificationStatus: 'verified',
        verificationNotes: 'Engagement fee received via escrow. Cleared compliance audit.',
        verifiedBy: 'Marcus Vance (CFO)',
        verifiedAt: '2026-06-03T11:00:00Z',
        transactionDate: '2026-06-01T10:00:00Z',
        createdAt: '2026-06-02T08:30:00Z'
      },
      {
        id: 'cnv_8003',
        transactionReference: 'CTX-2026-9420',
        affiliateId: 'aff_3190',
        leadId: 'lead_705',
        membershipTierOrCategory: 'Institutional Crisis Advisory',
        eligibleSaleAmount: 150000,
        currency: 'USD',
        verificationStatus: 'verified',
        verificationNotes: 'First phase retainer confirmed and banked.',
        verifiedBy: 'Marcus Vance (CFO)',
        verifiedAt: '2026-05-05T15:00:00Z',
        transactionDate: '2026-05-02T14:00:00Z',
        createdAt: '2026-05-03T09:00:00Z'
      }
    ];

    // 6. Configured Commission Rules (Must be approved by administrator to be active)
    this.commissionRules = [
      {
        id: 'rule_1',
        name: 'Executive Contingency Retainers — Standard Partner Tier',
        serviceCategory: 'Executive Contingency Retainer',
        ratePercent: 10.0,
        status: 'active',
        effectiveDate: '2026-01-01',
        approvedBy: 'Julian Sterling (Head of Governance)',
        approvedAt: '2026-01-05T10:00:00Z',
        description: 'Standard 10% referral fee on verified first-year retained contingency contracts.'
      },
      {
        id: 'rule_2',
        name: 'Institutional Crisis Advisory & Rapid Deployment',
        serviceCategory: 'Institutional Crisis Advisory',
        ratePercent: 10.0,
        status: 'active',
        effectiveDate: '2026-01-01',
        approvedBy: 'Julian Sterling (Head of Governance)',
        approvedAt: '2026-01-05T10:00:00Z',
        description: '10% on verified institutional and corporate advisory billings.'
      },
      {
        id: 'rule_3',
        name: 'Private Sovereign & High-Risk Maritime Support (Special Category)',
        serviceCategory: 'Private Sovereign Support',
        ratePercent: 8.0,
        status: 'active',
        effectiveDate: '2026-02-01',
        approvedBy: 'Julian Sterling (Head of Governance)',
        approvedAt: '2026-02-01T12:00:00Z',
        description: 'Configured special category rate for cross-border sovereign risk.'
      },
      {
        id: 'rule_4',
        name: 'Enterprise Multi-Jurisdictional Umbrella (Proposed)',
        serviceCategory: 'Enterprise Multi-Jurisdictional Umbrella',
        ratePercent: 12.5,
        status: 'inactive', // Unapproved rule remains inactive as required by prompt
        effectiveDate: '2027-01-01',
        description: 'Draft commercial term awaiting Board and Governance review. Kept inactive until authorized.'
      }
    ];

    // 7. Initial Commission Ledger
    this.commissions = [
      {
        id: 'com_9001',
        commissionReference: 'COM-2026-7812',
        affiliateId: 'aff_2041',
        conversionId: 'cnv_8001',
        transactionReference: 'CTX-2026-9041',
        eligibleTransactionAmount: 120000,
        appliedCommissionRate: 10.0,
        commissionAmount: 12000,
        currency: 'USD',
        status: 'paid',
        payoutId: 'pay_3001',
        approvedBy: 'Marcus Vance (CFO)',
        approvedAt: '2026-03-25T11:00:00Z',
        dateRecorded: '2026-03-22T12:00:00Z'
      },
      {
        id: 'com_9002',
        commissionReference: 'COM-2026-8140',
        affiliateId: 'aff_2041',
        conversionId: 'cnv_8002',
        transactionReference: 'CTX-2026-9188',
        eligibleTransactionAmount: 85000,
        appliedCommissionRate: 10.0,
        commissionAmount: 8500,
        currency: 'USD',
        status: 'approved', // Approved, pending next scheduled payout batch
        approvedBy: 'Marcus Vance (CFO)',
        approvedAt: '2026-06-05T14:30:00Z',
        dateRecorded: '2026-06-04T09:00:00Z'
      },
      {
        id: 'com_9003',
        commissionReference: 'COM-2026-8022',
        affiliateId: 'aff_3190',
        conversionId: 'cnv_8003',
        transactionReference: 'CTX-2026-9420',
        eligibleTransactionAmount: 150000,
        appliedCommissionRate: 8.5,
        commissionAmount: 12750,
        currency: 'USD',
        status: 'paid',
        payoutId: 'pay_3002',
        approvedBy: 'Marcus Vance (CFO)',
        approvedAt: '2026-05-10T09:00:00Z',
        dateRecorded: '2026-05-06T10:00:00Z'
      }
    ];

    // 8. Initial Payout History
    this.payouts = [
      {
        id: 'pay_3001',
        payoutReference: 'PAY-2026-0419',
        affiliateId: 'aff_2041',
        payoutPeriod: 'Q1 2026 Settlement',
        amount: 12000,
        currency: 'USD',
        status: 'paid',
        paymentMethod: 'Fedwire / International SWIFT',
        paymentReference: 'WIRE-R3-884920-CHASE',
        notes: 'Disbursed to Vanderbilt Capital Advisory fiduciary account. Remittance confirmation archived.',
        commissionIds: ['com_9001'],
        preparedBy: 'Marcus Vance (CFO)',
        processedBy: 'Marcus Vance (CFO)',
        processedAt: '2026-04-10T14:00:00Z',
        createdAt: '2026-04-05T10:00:00Z'
      },
      {
        id: 'pay_3002',
        payoutReference: 'PAY-2026-0520',
        affiliateId: 'aff_3190',
        payoutPeriod: 'May 2026 Cycle',
        amount: 12750,
        currency: 'USD',
        status: 'paid',
        paymentMethod: 'CHAPS / Barclays London',
        paymentReference: 'BARC-R3-091244',
        notes: 'Executed in full to Meridian Nominees account.',
        commissionIds: ['com_9003'],
        preparedBy: 'Marcus Vance (CFO)',
        processedBy: 'Marcus Vance (CFO)',
        processedAt: '2026-05-20T11:00:00Z',
        createdAt: '2026-05-15T09:30:00Z'
      }
    ];

    // 9. Initial Audit Log
    this.auditLogs = [
      {
        id: 'aud_1',
        action: 'APPLICATION_APPROVED',
        actorEmail: 'affiliates@r3contingencies.com',
        actorRole: 'affiliate_manager',
        targetType: 'application',
        targetId: 'app_1001',
        details: 'Approved Vanderbilt Capital Advisory application following compliance clearance.',
        timestamp: '2026-02-01T14:00:00Z',
        ipAddress: '194.207.89.12'
      },
      {
        id: 'aud_2',
        action: 'AFFILIATE_ACTIVATED',
        actorEmail: 'affiliates@r3contingencies.com',
        actorRole: 'affiliate_manager',
        targetType: 'affiliate',
        targetId: 'aff_2041',
        details: 'Generated referral code ALEXANDER-R3 and provisioned private portal credentials.',
        timestamp: '2026-02-01T14:30:00Z',
        ipAddress: '194.207.89.12'
      },
      {
        id: 'aud_3',
        action: 'CONVERSION_VERIFIED',
        actorEmail: 'superadmin@r3contingencies.com',
        actorRole: 'super_admin',
        targetType: 'conversion',
        targetId: 'cnv_8001',
        details: 'Verified transaction CTX-2026-9041 ($120,000 USD) for Single Family Office (Geneva).',
        timestamp: '2026-03-22T10:00:00Z',
        ipAddress: '82.165.197.4'
      },
      {
        id: 'aud_4',
        action: 'COMMISSION_APPROVED',
        actorEmail: 'finance@r3contingencies.com',
        actorRole: 'finance_manager',
        targetType: 'commission',
        targetId: 'com_9001',
        details: 'Approved $12,000 USD (10.0%) commission for affiliate R3-AFF-2041 on transaction CTX-2026-9041.',
        timestamp: '2026-03-25T11:00:00Z',
        ipAddress: '82.165.197.4'
      },
      {
        id: 'aud_5',
        action: 'PAYOUT_DISBURSED',
        actorEmail: 'finance@r3contingencies.com',
        actorRole: 'finance_manager',
        targetType: 'payout',
        targetId: 'pay_3001',
        details: 'Processed international wire WIRE-R3-884920-CHASE for $12,000 USD.',
        timestamp: '2026-04-10T14:00:00Z',
        ipAddress: '82.165.197.4'
      }
    ];
  }

  // Helper Methods

  public recordAuditLog(
    actorEmail: string,
    actorRole: UserRole,
    action: string,
    targetType: AuditLogEntry['targetType'],
    targetId: string,
    details: string,
    ipAddress?: string
  ) {
    const entry: AuditLogEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      actorEmail,
      actorRole,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: ipAddress || '127.0.0.1'
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  public trackReferralClick(code: string, visitorHash: string, referer?: string, userAgent?: string) {
    const affiliate = this.affiliates.find(a => a.referralCode.toUpperCase() === code.toUpperCase() && a.status === 'active');
    if (!affiliate) {
      return null;
    }

    const isUnique = !this.visitorHashes.has(`${affiliate.id}_${visitorHash}`);
    if (isUnique) {
      this.visitorHashes.add(`${affiliate.id}_${visitorHash}`);
      affiliate.uniqueVisitors += 1;
    }
    affiliate.totalClicks += 1;

    const clickRecord: ReferralClickRecord = {
      id: `clk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      referralCode: affiliate.referralCode,
      affiliateId: affiliate.id,
      visitorHash,
      isUnique,
      referer,
      userAgent,
      timestamp: new Date().toISOString()
    };
    this.clicks.unshift(clickRecord);

    return {
      affiliateId: affiliate.id,
      affiliateNumber: affiliate.affiliateNumber,
      referralCode: affiliate.referralCode,
      isUnique
    };
  }

  public getAffiliateByUserId(userId: string) {
    return this.affiliates.find(a => a.userId === userId);
  }

  public getAffiliateById(affiliateId: string) {
    return this.affiliates.find(a => a.id === affiliateId);
  }

  public getAffiliateByCode(code: string) {
    return this.affiliates.find(a => a.referralCode.toUpperCase() === code.toUpperCase());
  }

  public getAffiliateDashboard(affiliateId: string) {
    const affiliate = this.getAffiliateById(affiliateId);
    if (!affiliate) return null;

    const leads = this.leads.filter(l => l.affiliateId === affiliateId);
    const conversions = this.conversions.filter(c => c.affiliateId === affiliateId);
    const commissions = this.commissions.filter(c => c.affiliateId === affiliateId);
    const payouts = this.payouts.filter(p => p.affiliateId === affiliateId);

    const verifiedConversionsCount = conversions.filter(c => c.verificationStatus === 'verified').length;
    
    // Approved commissions total (status: approved or paid)
    const approvedCommissionsTotal = commissions
      .filter(c => c.status === 'approved' || c.status === 'paid')
      .reduce((sum, c) => sum + c.commissionAmount, 0);

    // Paid commissions total
    const paidCommissionsTotal = payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      affiliate: {
        id: affiliate.id,
        affiliateNumber: affiliate.affiliateNumber,
        fullName: affiliate.fullName,
        businessName: affiliate.businessName,
        email: affiliate.email,
        status: affiliate.status,
        referralCode: affiliate.referralCode,
        joinedAt: affiliate.joinedAt,
        approvedRatePercent: affiliate.approvedRatePercent,
      },
      stats: {
        totalClicks: affiliate.totalClicks,
        uniqueVisitors: affiliate.uniqueVisitors,
        leadsGenerated: leads.length,
        verifiedConversions: verifiedConversionsCount,
        approvedCommissions: approvedCommissionsTotal,
        paidCommissions: paidCommissionsTotal,
        pendingVerificationConversions: conversions.filter(c => c.verificationStatus === 'pending_verification').length,
        pendingPayoutCommissions: commissions.filter(c => c.status === 'approved').reduce((s, c) => s + c.commissionAmount, 0)
      },
      leads,
      conversions,
      commissions,
      payouts
    };
  }
}

export const db = new DatabaseStore();
