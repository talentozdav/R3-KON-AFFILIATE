import crypto from 'crypto';
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

// Password hashing utility using standard Node.js crypto
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(hash));
}

class DatabaseStore {
  // Clean production state: ZERO demo data, zero fake affiliates, zero fake payouts
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
    this.seedProductionAdmin();
  }

  private seedProductionAdmin() {
    // Only configure legitimate administrative governance accounts
    // Default admin uses the updated production email: services@r3-konaffiliate.online
    const adminPass = hashPassword('R3Network@2026!');

    this.users = [
      {
        id: 'usr_governance_admin',
        email: 'services@r3-konaffiliate.online',
        fullName: 'R3 Governance & Compliance Officer',
        role: 'super_admin',
        status: 'active',
        passwordHash: adminPass.hash,
        passwordSalt: adminPass.salt,
        createdAt: new Date().toISOString()
      }
    ];

    // Standard unapproved commercial rule templates (kept inactive until authorized by R3 leadership)
    this.commissionRules = [
      {
        id: 'rule_exec_retainer',
        name: 'Executive Contingency Retainer (Proposed)',
        serviceCategory: 'Executive Contingency Retainer',
        ratePercent: 10.0,
        status: 'inactive', // Unapproved rules remain strictly inactive as required by prompt
        effectiveDate: new Date().toISOString().split('T')[0],
        description: 'Standard 10% referral fee on verified first-year retained contingency contracts. Awaiting formal R3 leadership authorization.'
      },
      {
        id: 'rule_crisis_advisory',
        name: 'Institutional Crisis Advisory (Proposed)',
        serviceCategory: 'Institutional Crisis Advisory',
        ratePercent: 10.0,
        status: 'inactive', // Unapproved rules remain strictly inactive
        effectiveDate: new Date().toISOString().split('T')[0],
        description: '10% on verified institutional and corporate advisory billings. Awaiting formal R3 leadership authorization.'
      },
      {
        id: 'rule_sovereign_support',
        name: 'Private Sovereign Support (Proposed)',
        serviceCategory: 'Private Sovereign Support',
        ratePercent: 8.0,
        status: 'inactive', // Unapproved rules remain strictly inactive
        effectiveDate: new Date().toISOString().split('T')[0],
        description: '8% referral fee for cross-border sovereign risk coordination. Awaiting formal R3 leadership authorization.'
      }
    ];

    // Initial audit log entry
    this.auditLogs = [
      {
        id: 'aud_init_001',
        action: 'SYSTEM_INITIALIZED',
        actorEmail: 'services@r3-konaffiliate.online',
        actorRole: 'super_admin',
        targetType: 'auth',
        targetId: 'usr_governance_admin',
        details: 'Production database initialized with clean empty registries. Zero demo data.',
        timestamp: new Date().toISOString(),
        ipAddress: '127.0.0.1'
      }
    ];
  }

  // Audit Logging
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

  // Referral click tracking with unique visitor detection
  public trackReferralClick(code: string, visitorHash: string, referer?: string, userAgent?: string) {
    const affiliate = this.affiliates.find(
      a => a.referralCode.toUpperCase() === code.toUpperCase() && a.status === 'active'
    );
    if (!affiliate) {
      return null;
    }

    const uniqueKey = `${affiliate.id}_${visitorHash}`;
    const isUnique = !this.visitorHashes.has(uniqueKey);
    if (isUnique) {
      this.visitorHashes.add(uniqueKey);
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
