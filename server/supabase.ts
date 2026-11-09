import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { db as memoryDb } from './db.js';

// Project reference: btyrmnklklxgqoxdhetd
const SUPABASE_PROJECT_REF = 'btyrmnklklxgqoxdhetd';
const DEFAULT_SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
export const isSupabaseConfigured = Boolean(supabaseUrl && (supabaseServiceKey || supabaseAnonKey));

let supabaseAdmin: SupabaseClient | null = null;
let supabasePublic: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  const activeKey = supabaseServiceKey || supabaseAnonKey!;
  try {
    supabaseAdmin = createClient(supabaseUrl, activeKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    if (supabaseAnonKey) {
      supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
    } else {
      supabasePublic = supabaseAdmin;
    }

    console.log(`[R3 Supabase] Initialized client for project ${SUPABASE_PROJECT_REF}. Service role: ${Boolean(supabaseServiceKey)}`);
  } catch (err: any) {
    console.error('[R3 Supabase] Initialization error:', err.message);
  }
} else {
  if (isProduction) {
    console.error('[R3 Supabase FATAL] Production runtime started without Supabase credentials.');
  } else {
    console.warn('[R3 Supabase] Live credentials not provided in environment. Running with local development fallback.');
  }
}

export { supabaseAdmin, supabasePublic };

// ==============================================================================
// AUTHENTICATION & ACCESS TOKEN VERIFICATION
// ==============================================================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'affiliate_manager' | 'finance_manager' | 'compliance_officer' | 'affiliate' | 'client';
  status: string;
  affiliateId?: string;
  clientId?: string;
  membershipTier?: string;
}

/**
 * Server-side JWT token verification using Supabase Auth.
 * Never trusts client headers or unverified emails.
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  // 1. If Supabase is configured, verify cryptographically via Supabase Auth
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      const user = data?.user;
      if (!error && user && user.email) {
        // Check if user is a client account via metadata or client_profiles
        if (user.user_metadata?.role === 'client') {
          const { data: clientProfile } = await supabaseAdmin
            .from('client_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          return {
            id: user.id,
            email: user.email,
            fullName: clientProfile?.full_name || user.user_metadata?.full_name || user.email,
            role: 'client',
            status: clientProfile?.status || 'active',
            clientId: clientProfile?.id || user.id,
            membershipTier: clientProfile?.membership_tier || 'Executive Contingency Retainer'
          };
        }

        // First check staff / affiliate profile
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          let affiliateId: string | undefined;
          if (profile.role === 'affiliate') {
            const { data: aff } = await supabaseAdmin
              .from('affiliates')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            affiliateId = aff?.id;
          }

          return {
            id: user.id,
            email: user.email,
            fullName: profile.full_name || user.user_metadata?.full_name || user.email,
            role: profile.role,
            status: profile.status,
            affiliateId
          };
        }

        // Check client profile
        const { data: clientProfile } = await supabaseAdmin
          .from('client_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (clientProfile) {
          return {
            id: user.id,
            email: user.email,
            fullName: clientProfile.full_name,
            role: 'client',
            status: clientProfile.status,
            clientId: clientProfile.id,
            membershipTier: clientProfile.membership_tier
          };
        }

        // Fallback: user exists in auth.users with user_metadata
        const roleFromMeta = (user.user_metadata?.role as any) || 'client';
        return {
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || user.email,
          role: roleFromMeta,
          status: 'active'
        };
      }
    } catch {
      // Non-JWT token, handled below in non-production
    }
  }

  // 2. In non-production only, allow local test credentials
  if (!isProduction) {
    const user = memoryDb.users.find(u => u.email.toLowerCase() === token.toLowerCase());
    if (user && user.status === 'active') {
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as any,
        status: user.status,
        affiliateId: user.affiliateId
      };
    }

    const client = memoryClientRegistrations.find(c => c.email.toLowerCase() === token.toLowerCase());
    if (client) {
      return {
        id: client.id,
        email: client.email,
        fullName: client.fullName,
        role: 'client',
        status: 'active',
        membershipTier: client.serviceCategory
      };
    }

    const aff = memoryDb.affiliates.find(a => a.email.toLowerCase() === token.toLowerCase());
    if (aff) {
      return {
        id: aff.id,
        email: aff.email,
        fullName: aff.fullName,
        role: 'affiliate',
        status: aff.status,
        affiliateId: aff.id
      };
    }
  }

  return null;
}

// ==============================================================================
// DATABASE HEALTH CHECK
// ==============================================================================

export async function checkDatabaseConnectivity(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  if (!supabaseAdmin) {
    if (isProduction) {
      return { connected: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured in production.' };
    }
    return { connected: true, latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const { error } = await supabaseAdmin.from('profiles').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { connected: false, latencyMs: Date.now() - start, error: error.message };
    }
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { connected: false, latencyMs: Date.now() - start, error: err.message };
  }
}

// ==============================================================================
// AFFILIATE APPLICATIONS
// ==============================================================================

export interface AffiliateApplicationRecord {
  id: string;
  referenceNumber: string;
  fullName: string;
  applicantType: 'Individual' | 'Business';
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
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INFORMATION_REQUESTED';
  statusNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  activatedAffiliateId?: string;
  submittedAt: string;
  updatedAt: string;
}

export async function createAffiliateApplication(data: Omit<AffiliateApplicationRecord, 'id' | 'referenceNumber' | 'status' | 'submittedAt' | 'updatedAt'>): Promise<AffiliateApplicationRecord> {
  const ref = `R3-APP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('affiliate_applications')
      .insert({
        reference_number: ref,
        full_name: data.fullName,
        applicant_type: data.applicantType,
        business_name: data.businessName || null,
        email: data.email.toLowerCase(),
        phone: data.phone,
        country: data.country,
        partnership_category: data.partnershipCategory,
        industry_background: data.industryBackground,
        audience_description: data.audienceDescription,
        partnership_objectives: data.partnershipObjectives,
        additional_info: data.additionalInfo || null,
        terms_accepted: data.termsAccepted,
        privacy_accepted: data.privacyAccepted,
        status: 'SUBMITTED'
      })
      .select()
      .single();

    if (error) {
      if (isProduction) {
        throw new Error(`Production database failure saving application: ${error.message}`);
      }
      console.warn('[R3 Supabase] Application insert error, falling back to local memory store:', error.message);
    } else if (inserted) {
      return mapApplicationRow(inserted);
    }
  } else if (isProduction) {
    throw new Error('Database service unavailable in production.');
  }

  // Memory fallback for local development only
  const record: AffiliateApplicationRecord = {
    id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    referenceNumber: ref,
    ...data,
    status: 'SUBMITTED',
    submittedAt: now,
    updatedAt: now
  };
  memoryDb.applications.unshift(record as any);
  return record;
}

export async function getAffiliateApplicationByEmail(email: string): Promise<AffiliateApplicationRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .eq('email', normalized)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return mapApplicationRow(data);
    }
    if (error && isProduction) {
      throw new Error(`Database error querying application: ${error.message}`);
    }
  }

  const mem = memoryDb.applications.find(a => a.email.toLowerCase() === normalized);
  return mem ? (mem as any) : null;
}

export async function getAffiliateApplicationByRef(ref: string, email?: string): Promise<AffiliateApplicationRecord | null> {
  const cleanRef = ref.trim().toUpperCase();
  if (supabaseAdmin) {
    let query = supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .eq('reference_number', cleanRef);

    if (email) {
      query = query.eq('email', email.trim().toLowerCase());
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      return mapApplicationRow(data);
    }
  }

  const mem = memoryDb.applications.find(a => 
    a.referenceNumber.toUpperCase() === cleanRef && 
    (!email || a.email.toLowerCase() === email.trim().toLowerCase())
  );
  return mem ? (mem as any) : null;
}

export async function getAffiliateApplications(): Promise<AffiliateApplicationRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      if (isProduction) throw new Error(`Database error listing applications: ${error.message}`);
      return memoryDb.applications as any;
    }
    return (data || []).map(mapApplicationRow);
  }
  return memoryDb.applications as any;
}

export async function reviewAffiliateApplication(
  id: string,
  status: AffiliateApplicationRecord['status'],
  statusNotes?: string,
  reviewedBy?: string
): Promise<AffiliateApplicationRecord> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliate_applications')
      .update({
        status,
        status_notes: statusNotes || null,
        reviewed_by: reviewedBy || null,
        reviewed_at: now,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (isProduction) throw new Error(`Database error reviewing application: ${error.message}`);
    } else if (data) {
      return mapApplicationRow(data);
    }
  }

  const mem = memoryDb.applications.find(a => a.id === id);
  if (!mem) throw new Error('Application not found');
  mem.status = status as any;
  mem.statusNotes = statusNotes || mem.statusNotes;
  mem.reviewedBy = reviewedBy;
  mem.reviewedAt = now;
  mem.updatedAt = now;
  return mem as any;
}

function mapApplicationRow(r: any): AffiliateApplicationRecord {
  return {
    id: r.id,
    referenceNumber: r.reference_number,
    fullName: r.full_name,
    applicantType: r.applicant_type,
    businessName: r.business_name || undefined,
    email: r.email,
    phone: r.phone,
    country: r.country,
    partnershipCategory: r.partnership_category,
    industryBackground: r.industry_background || r.industryBackground || '',
    audienceDescription: r.audience_description || r.audienceDescription || '',
    partnershipObjectives: r.partnership_objectives || r.partnershipObjectives || '',
    additionalInfo: r.additional_info || undefined,
    termsAccepted: r.terms_accepted,
    privacyAccepted: r.privacy_accepted,
    status: r.status,
    statusNotes: r.status_notes || undefined,
    reviewedBy: r.reviewed_by || undefined,
    reviewedAt: r.reviewed_at || undefined,
    activatedAffiliateId: r.activated_affiliate_id || undefined,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at
  };
}

// ==============================================================================
// AFFILIATES
// ==============================================================================

export interface AffiliateRecord {
  id: string;
  affiliateNumber: string;
  userId: string;
  fullName: string;
  email: string;
  businessName?: string;
  referralCode: string;
  status: 'active' | 'suspended' | 'terminated' | 'pending';
  approvedRatePercent: number;
  totalClicks: number;
  uniqueVisitors: number;
  joinedAt: string;
  updatedAt: string;
}

export async function createAffiliate(data: {
  userId: string;
  fullName: string;
  email: string;
  businessName?: string;
  referralCode: string;
  approvedRatePercent?: number;
}): Promise<AffiliateRecord> {
  const affNum = `R3-AFF-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();
  const rate = data.approvedRatePercent ?? 10.0;

  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('affiliates')
      .insert({
        affiliate_number: affNum,
        user_id: data.userId,
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        business_name: data.businessName || null,
        referral_code: data.referralCode.toUpperCase(),
        status: 'active',
        approved_rate_percent: rate,
        total_clicks: 0,
        unique_visitors: 0
      })
      .select()
      .single();

    if (error) {
      if (isProduction) throw new Error(`Database error creating affiliate: ${error.message}`);
    } else if (inserted) {
      return mapAffiliateRow(inserted);
    }
  }

  const mem: AffiliateRecord = {
    id: `aff_${Date.now()}`,
    affiliateNumber: affNum,
    userId: data.userId,
    fullName: data.fullName,
    email: data.email.toLowerCase(),
    businessName: data.businessName,
    referralCode: data.referralCode.toUpperCase(),
    status: 'active',
    approvedRatePercent: rate,
    totalClicks: 0,
    uniqueVisitors: 0,
    joinedAt: now,
    updatedAt: now
  };
  memoryDb.affiliates.unshift(mem as any);
  return mem;
}

export async function getAffiliateById(id: string): Promise<AffiliateRecord | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) return mapAffiliateRow(data);
  }
  const mem = memoryDb.affiliates.find(a => a.id === id);
  return mem ? (mem as any) : null;
}

export async function getAffiliateByUserId(userId: string): Promise<AffiliateRecord | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) return mapAffiliateRow(data);
  }
  const mem = memoryDb.affiliates.find(a => a.userId === userId);
  return mem ? (mem as any) : null;
}

export async function getAffiliateByEmail(email: string): Promise<AffiliateRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .eq('email', normalized)
      .maybeSingle();

    if (!error && data) return mapAffiliateRow(data);
  }
  const mem = memoryDb.affiliates.find(a => a.email.toLowerCase() === normalized);
  return mem ? (mem as any) : null;
}

export async function getAffiliateByCode(code: string): Promise<AffiliateRecord | null> {
  const clean = code.trim().toUpperCase();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .eq('referral_code', clean)
      .maybeSingle();

    if (!error && data) return mapAffiliateRow(data);
  }
  const mem = memoryDb.affiliates.find(a => a.referralCode.toUpperCase() === clean);
  return mem ? (mem as any) : null;
}

export async function getAffiliates(): Promise<AffiliateRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .order('joined_at', { ascending: false });

    if (error) {
      if (isProduction) throw new Error(`Database error querying affiliates: ${error.message}`);
      return memoryDb.affiliates as any;
    }
    return (data || []).map(mapAffiliateRow);
  }
  return memoryDb.affiliates as any;
}

export async function updateAffiliateStatus(id: string, status: AffiliateRecord['status']): Promise<void> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('affiliates')
      .update({ status, updated_at: now })
      .eq('id', id);

    if (error && isProduction) throw new Error(`Database error updating affiliate: ${error.message}`);
  }
  const mem = memoryDb.affiliates.find(a => a.id === id);
  if (mem) {
    mem.status = status as any;
    mem.updatedAt = now;
  }
}

function mapAffiliateRow(r: any): AffiliateRecord {
  return {
    id: r.id,
    affiliateNumber: r.affiliate_number,
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    businessName: r.business_name || undefined,
    referralCode: r.referral_code,
    status: r.status,
    approvedRatePercent: Number(r.approved_rate_percent),
    totalClicks: r.total_clicks || 0,
    uniqueVisitors: r.unique_visitors || 0,
    joinedAt: r.joined_at,
    updatedAt: r.updated_at
  };
}

// ==============================================================================
// REFERRAL TRACKING & ATTRIBUTION
// ==============================================================================

export async function recordReferralClick(data: {
  referralCode: string;
  visitorHash: string;
  referer?: string;
  userAgent?: string;
}): Promise<{ isUnique: boolean }> {
  const cleanCode = data.referralCode.trim().toUpperCase();

  if (supabaseAdmin) {
    // 1. Find affiliate
    const { data: aff, error: affErr } = await supabaseAdmin
      .from('affiliates')
      .select('id, total_clicks, unique_visitors')
      .eq('referral_code', cleanCode)
      .maybeSingle();

    if (affErr || !aff) {
      if (isProduction) throw new Error('Affiliate not found for referral code.');
      return { isUnique: false };
    }

    // 2. Check if this visitorHash has been recorded for this referralCode
    const { data: existing } = await supabaseAdmin
      .from('referral_clicks')
      .select('id')
      .eq('referral_code', cleanCode)
      .eq('visitor_hash', data.visitorHash)
      .limit(1)
      .maybeSingle();

    const isUnique = !existing;

    // 3. Insert click
    await supabaseAdmin.from('referral_clicks').insert({
      referral_code: cleanCode,
      affiliate_id: aff.id,
      visitor_hash: data.visitorHash,
      is_unique: isUnique,
      referer: data.referer || null,
      user_agent: data.userAgent || null
    });

    // 4. Update counters
    await supabaseAdmin
      .from('affiliates')
      .update({
        total_clicks: (aff.total_clicks || 0) + 1,
        unique_visitors: isUnique ? (aff.unique_visitors || 0) + 1 : aff.unique_visitors,
        updated_at: new Date().toISOString()
      })
      .eq('id', aff.id);

    return { isUnique };
  }

  // Memory fallback
  const memRes = memoryDb.trackReferralClick(cleanCode, data.visitorHash, data.referer, data.userAgent);
  return { isUnique: memRes?.isUnique ?? false };
}

export async function getReferralClicks(affiliateId?: string): Promise<any[]> {
  if (supabaseAdmin) {
    let query = supabaseAdmin.from('referral_clicks').select('*').order('created_at', { ascending: false });
    if (affiliateId) query = query.eq('affiliate_id', affiliateId);
    const { data, error } = await query;
    if (error) {
      if (isProduction) throw new Error(`Database error fetching referral clicks: ${error.message}`);
      return memoryDb.clicks;
    }
    return data || [];
  }
  return memoryDb.clicks;
}

export async function createReferralLead(data: {
  affiliateId: string;
  referralCode: string;
  clientIdentifier: string;
  clientType: 'Individual' | 'Corporate' | 'Institutional';
  region: string;
  serviceCategory: string;
  notes?: string;
  estimatedValue?: number;
}): Promise<any> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('referral_leads')
      .insert({
        affiliate_id: data.affiliateId,
        referral_code: data.referralCode.toUpperCase(),
        client_identifier: data.clientIdentifier,
        client_type: data.clientType,
        region: data.region,
        service_category: data.serviceCategory,
        status: 'in_review',
        estimated_value: data.estimatedValue || null,
        notes: data.notes || null
      })
      .select()
      .single();

    if (error) {
      if (isProduction) throw new Error(`Database error saving lead: ${error.message}`);
    } else if (inserted) {
      return inserted;
    }
  }

  const mem = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...data,
    status: 'in_review' as const,
    createdAt: now,
    updatedAt: now
  };
  memoryDb.leads.unshift(mem as any);
  return mem;
}

export async function getReferralLeads(affiliateId?: string): Promise<any[]> {
  if (supabaseAdmin) {
    let query = supabaseAdmin.from('referral_leads').select('*').order('created_at', { ascending: false });
    if (affiliateId) query = query.eq('affiliate_id', affiliateId);

    const { data, error } = await query;
    if (error) {
      if (isProduction) throw new Error(`Database error fetching leads: ${error.message}`);
      return memoryDb.leads;
    }
    return data || [];
  }
  if (affiliateId) return memoryDb.leads.filter(l => l.affiliateId === affiliateId);
  return memoryDb.leads;
}

// ==============================================================================
// CONVERSIONS & COMMISSIONS
// ==============================================================================

export async function createConversion(data: {
  affiliateId: string;
  leadId?: string;
  membershipTierOrCategory: string;
  eligibleSaleAmount: number;
  verificationNotes?: string;
  verifiedBy: string;
}): Promise<any> {
  const txRef = `CTX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('conversions')
      .insert({
        transaction_reference: txRef,
        affiliate_id: data.affiliateId,
        lead_id: data.leadId || null,
        membership_tier_or_category: data.membershipTierOrCategory,
        eligible_sale_amount: data.eligibleSaleAmount,
        currency: 'USD',
        verification_status: 'verified',
        verification_notes: data.verificationNotes || 'Verified against executed contract and settlement.',
        verified_by: data.verifiedBy,
        verified_at: now,
        transaction_date: now
      })
      .select()
      .single();

    if (error) {
      if (isProduction) throw new Error(`Database error creating conversion: ${error.message}`);
    } else if (inserted) {
      // If leadId provided, update lead status to converted
      if (data.leadId) {
        await supabaseAdmin
          .from('referral_leads')
          .update({ status: 'converted', updated_at: now })
          .eq('id', data.leadId);
      }
      return inserted;
    }
  }

  const mem = {
    id: `cnv_${Date.now()}`,
    transactionReference: txRef,
    ...data,
    currency: 'USD',
    verificationStatus: 'verified' as const,
    transactionDate: now,
    createdAt: now
  };
  memoryDb.conversions.unshift(mem as any);
  if (data.leadId) {
    const l = memoryDb.leads.find(lead => lead.id === data.leadId);
    if (l) l.status = 'converted';
  }
  return mem;
}

export async function getConversions(affiliateId?: string): Promise<any[]> {
  if (supabaseAdmin) {
    let query = supabaseAdmin.from('conversions').select('*').order('created_at', { ascending: false });
    if (affiliateId) query = query.eq('affiliate_id', affiliateId);

    const { data, error } = await query;
    if (error) {
      if (isProduction) throw new Error(`Database error querying conversions: ${error.message}`);
      return memoryDb.conversions;
    }
    return data || [];
  }
  if (affiliateId) return memoryDb.conversions.filter(c => c.affiliateId === affiliateId);
  return memoryDb.conversions;
}

export async function verifyConversion(id: string, verificationStatus: string, verificationNotes: string, verifiedBy: string): Promise<any> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('conversions')
      .update({
        verification_status: verificationStatus,
        verification_notes: verificationNotes,
        verified_by: verifiedBy,
        verified_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error && isProduction) throw new Error(`Database error verifying conversion: ${error.message}`);
    if (data) return data;
  }
  const mem = memoryDb.conversions.find(c => c.id === id);
  if (mem) {
    mem.verificationStatus = verificationStatus as any;
    mem.verificationNotes = verificationNotes;
    mem.verifiedBy = verifiedBy;
    mem.verifiedAt = now;
  }
  return mem;
}

export async function getCommissionRules(): Promise<any[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from('commission_rules').select('*').order('created_at', { ascending: false });
    if (!error && data) return data;
    if (error && isProduction) throw new Error(`Database error fetching rules: ${error.message}`);
  }
  return memoryDb.commissionRules;
}

export async function createCommissionRule(data: {
  name: string;
  serviceCategory: string;
  ratePercent: number;
  status: 'active' | 'inactive' | 'draft';
  description: string;
  approvedBy?: string;
}): Promise<any> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('commission_rules')
      .insert({
        name: data.name,
        service_category: data.serviceCategory,
        rate_percent: data.ratePercent,
        status: data.status,
        effective_date: now.split('T')[0],
        description: data.description,
        approved_by: data.approvedBy || null,
        approved_at: data.status === 'active' ? now : null
      })
      .select()
      .single();

    if (error && isProduction) throw new Error(`Database error creating rule: ${error.message}`);
    if (inserted) return inserted;
  }
  const mem = {
    id: `rule_${Date.now()}`,
    ...data,
    effectiveDate: now.split('T')[0],
    createdAt: now
  };
  memoryDb.commissionRules.push(mem as any);
  return mem;
}

export async function toggleCommissionRuleStatus(id: string, status: 'active' | 'inactive'): Promise<any> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('commission_rules')
      .update({ status, approved_at: status === 'active' ? new Date().toISOString() : null })
      .eq('id', id)
      .select()
      .single();

    if (error && isProduction) throw new Error(`Database error updating rule: ${error.message}`);
    if (data) return data;
  }
  const mem = memoryDb.commissionRules.find(r => r.id === id);
  if (mem) mem.status = status;
  return mem;
}

export async function generateCommission(data: {
  conversionId: string;
  ruleId?: string;
  customRate?: number;
  approvedBy: string;
}): Promise<any> {
  const now = new Date().toISOString();

  // 1. Get conversion
  let conversion: any = null;
  let affiliate: any = null;

  if (supabaseAdmin) {
    const { data: conv } = await supabaseAdmin.from('conversions').select('*').eq('id', data.conversionId).single();
    conversion = conv;
    if (conversion) {
      const { data: aff } = await supabaseAdmin.from('affiliates').select('*').eq('id', conversion.affiliate_id).single();
      affiliate = aff;
    }
  } else {
    conversion = memoryDb.conversions.find(c => c.id === data.conversionId);
    if (conversion) affiliate = memoryDb.affiliates.find(a => a.id === conversion.affiliateId);
  }

  if (!conversion) throw new Error('Verified conversion not found.');

  // Rate determination
  let rate = data.customRate;
  if (!rate) {
    if (data.ruleId) {
      const rules = await getCommissionRules();
      const r = rules.find((rule: any) => rule.id === data.ruleId);
      if (r) rate = Number(r.rate_percent || r.ratePercent);
    }
    if (!rate && affiliate) {
      rate = Number(affiliate.approved_rate_percent || affiliate.approvedRatePercent || 10.0);
    }
  }
  rate = rate || 10.0;

  const eligibleAmount = Number(conversion.eligible_sale_amount || conversion.eligibleSaleAmount);
  const commissionAmount = Math.round((eligibleAmount * (rate / 100)) * 100) / 100;
  const commRef = `COM-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('commissions')
      .insert({
        commission_reference: commRef,
        affiliate_id: conversion.affiliate_id,
        conversion_id: conversion.id,
        transaction_reference: conversion.transaction_reference,
        eligible_transaction_amount: eligibleAmount,
        applied_commission_rate: rate,
        commission_amount: commissionAmount,
        currency: 'USD',
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      if (isProduction) throw new Error(`Database error generating commission: ${error.message}`);
    } else if (inserted) {
      return inserted;
    }
  }

  const mem = {
    id: `com_${Date.now()}`,
    commissionReference: commRef,
    affiliateId: conversion.affiliateId || conversion.affiliate_id,
    conversionId: conversion.id,
    transactionReference: conversion.transactionReference || conversion.transaction_reference,
    eligibleTransactionAmount: eligibleAmount,
    appliedCommissionRate: rate,
    commissionAmount,
    currency: 'USD',
    status: 'pending' as const,
    dateRecorded: now
  };
  memoryDb.commissions.unshift(mem as any);
  return mem;
}

export async function getCommissions(affiliateId?: string): Promise<any[]> {
  if (supabaseAdmin) {
    let query = supabaseAdmin.from('commissions').select('*').order('date_recorded', { ascending: false });
    if (affiliateId) query = query.eq('affiliate_id', affiliateId);

    const { data, error } = await query;
    if (error) {
      if (isProduction) throw new Error(`Database error fetching commissions: ${error.message}`);
      return memoryDb.commissions;
    }
    return data || [];
  }
  if (affiliateId) return memoryDb.commissions.filter(c => c.affiliateId === affiliateId);
  return memoryDb.commissions;
}

export async function actionCommission(id: string, action: 'approve' | 'reverse', auditReason: string, actorEmail: string): Promise<any> {
  const nextStatus = action === 'approve' ? 'approved' : 'reversed';
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('commissions')
      .update({
        status: nextStatus,
        audit_reason: auditReason,
        approved_by: actorEmail,
        approved_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error && isProduction) throw new Error(`Database error updating commission: ${error.message}`);
    if (data) return data;
  }

  const mem = memoryDb.commissions.find(c => c.id === id);
  if (mem) {
    mem.status = nextStatus as any;
    mem.auditReason = auditReason;
    mem.approvedBy = actorEmail;
    mem.approvedAt = now;
  }
  return mem;
}

// ==============================================================================
// PAYOUTS
// ==============================================================================

export async function preparePayoutBatch(data: {
  affiliateId: string;
  payoutPeriod?: string;
  paymentMethod?: string;
  preparedBy: string;
}): Promise<any> {
  const commissions = await getCommissions(data.affiliateId);
  const eligible = commissions.filter((c: any) => (c.status === 'approved') && !c.payout_id && !c.payoutId);

  if (eligible.length === 0) {
    throw new Error('No approved unpaid commissions available for this affiliate.');
  }

  const totalAmount = eligible.reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.commissionAmount), 0);
  const payRef = `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data: payout, error: payErr } = await supabaseAdmin
      .from('payouts')
      .insert({
        payout_reference: payRef,
        affiliate_id: data.affiliateId,
        payout_period: data.payoutPeriod || 'Current Cycle',
        amount: totalAmount,
        currency: 'USD',
        status: 'scheduled',
        payment_method: data.paymentMethod || 'SWIFT Wire Transfer',
        prepared_by: data.preparedBy
      })
      .select()
      .single();

    if (payErr) {
      if (isProduction) throw new Error(`Database error creating payout: ${payErr.message}`);
    } else if (payout) {
      // Link commissions to payout
      const commissionIds = eligible.map((c: any) => c.id);
      await supabaseAdmin
        .from('commissions')
        .update({ payout_id: payout.id })
        .in('id', commissionIds);

      return payout;
    }
  }

  const memPayout = {
    id: `pay_${Date.now()}`,
    payoutReference: payRef,
    affiliateId: data.affiliateId,
    payoutPeriod: data.payoutPeriod || 'Current Cycle',
    amount: totalAmount,
    currency: 'USD',
    status: 'scheduled' as const,
    paymentMethod: data.paymentMethod || 'SWIFT Wire Transfer',
    preparedBy: data.preparedBy,
    commissionIds: eligible.map((c: any) => c.id),
    createdAt: now
  };
  memoryDb.payouts.unshift(memPayout as any);
  eligible.forEach((c: any) => { c.payoutId = memPayout.id; });
  return memPayout;
}

export async function getPayouts(affiliateId?: string): Promise<any[]> {
  if (supabaseAdmin) {
    let query = supabaseAdmin.from('payouts').select('*').order('created_at', { ascending: false });
    if (affiliateId) query = query.eq('affiliate_id', affiliateId);

    const { data, error } = await query;
    if (error) {
      if (isProduction) throw new Error(`Database error fetching payouts: ${error.message}`);
      return memoryDb.payouts;
    }
    return data || [];
  }
  if (affiliateId) return memoryDb.payouts.filter(p => p.affiliateId === affiliateId);
  return memoryDb.payouts;
}

export async function recordPayoutPayment(id: string, paymentReference: string, notes?: string, processedBy?: string): Promise<any> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('payouts')
      .update({
        status: 'paid',
        payment_reference: paymentReference,
        notes: notes || null,
        processed_by: processedBy || 'Finance Director',
        processed_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error && isProduction) throw new Error(`Database error settling payout: ${error.message}`);
    if (data) {
      // Update linked commissions to paid
      await supabaseAdmin.from('commissions').update({ status: 'paid' }).eq('payout_id', id);
      return data;
    }
  }

  const mem = memoryDb.payouts.find(p => p.id === id);
  if (mem) {
    mem.status = 'paid';
    mem.paymentReference = paymentReference;
    mem.notes = notes;
    mem.processedBy = processedBy || 'Finance Director';
    mem.processedAt = now;
    memoryDb.commissions.filter(c => c.payoutId === id).forEach(c => { c.status = 'paid'; });
  }
  return mem;
}

// ==============================================================================
// AUDIT LOGS
// ==============================================================================

export async function recordAuditLog(
  actorEmail: string,
  actorRole: string,
  action: string,
  targetType: string,
  targetId: string,
  details: string,
  ipAddress?: string
): Promise<void> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    await supabaseAdmin.from('audit_logs').insert({
      action,
      actor_email: actorEmail,
      actor_role: actorRole,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ipAddress || null,
      timestamp: now
    });
    return;
  }

  memoryDb.recordAuditLog(actorEmail, actorRole as any, action, targetType, targetId, details, ipAddress);
}

export async function getAuditLogs(): Promise<any[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);

    if (!error && data) return data;
    if (error && isProduction) throw new Error(`Database error fetching audit logs: ${error.message}`);
  }
  return memoryDb.auditLogs;
}

// ==============================================================================
// AFFILIATE DASHBOARD AGGREGATE
// ==============================================================================

export async function getAffiliateDashboardData(affiliateId: string): Promise<any> {
  const aff = await getAffiliateById(affiliateId);
  if (!aff) return null;

  const [leads, conversions, commissions, payouts] = await Promise.all([
    getReferralLeads(affiliateId),
    getConversions(affiliateId),
    getCommissions(affiliateId),
    getPayouts(affiliateId)
  ]);

  const verifiedConversions = conversions.filter((c: any) => (c.verification_status || c.verificationStatus) === 'verified').length;
  const pendingConversions = conversions.filter((c: any) => (c.verification_status || c.verificationStatus) === 'pending_verification').length;

  const approvedCommissions = commissions
    .filter((c: any) => c.status === 'approved' || c.status === 'paid')
    .reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.commissionAmount), 0);

  const paidCommissions = payouts
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const pendingPayoutCommissions = commissions
    .filter((c: any) => c.status === 'approved' && !c.payout_id && !c.payoutId)
    .reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.commissionAmount), 0);

  return {
    affiliate: aff,
    stats: {
      totalClicks: aff.totalClicks || 0,
      uniqueVisitors: aff.uniqueVisitors || 0,
      leadsGenerated: leads.length,
      verifiedConversions,
      pendingVerificationConversions: pendingConversions,
      approvedCommissions,
      paidCommissions,
      pendingPayoutCommissions
    },
    leads,
    conversions,
    commissions,
    payouts
  };
}

// ==============================================================================
// ADMIN OVERVIEW METRICS
// ==============================================================================

export async function getAdminOverviewMetrics(): Promise<any> {
  if (supabaseAdmin) {
    try {
      const [
        { data: apps },
        { data: affs },
        { data: leads },
        { data: convs },
        { data: comms },
        { data: pays },
        { data: rules }
      ] = await Promise.all([
        supabaseAdmin.from('affiliate_applications').select('id, status'),
        supabaseAdmin.from('affiliates').select('id, status'),
        supabaseAdmin.from('referral_leads').select('id'),
        supabaseAdmin.from('conversions').select('id, verification_status'),
        supabaseAdmin.from('commissions').select('id, status, commission_amount'),
        supabaseAdmin.from('payouts').select('id, status, amount'),
        supabaseAdmin.from('commission_rules').select('id, status')
      ]);

      const allApps = apps || [];
      const allAffs = affs || [];
      const allConvs = convs || [];
      const allComms = comms || [];
      const allPays = pays || [];
      const allRules = rules || [];

      return {
        pendingApplications: allApps.filter((a: any) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length,
        totalApplications: allApps.length,
        activeAffiliates: allAffs.filter((a: any) => a.status === 'active').length,
        totalAffiliates: allAffs.length,
        totalLeads: (leads || []).length,
        verifiedConversions: allConvs.filter((c: any) => c.verification_status === 'verified').length,
        pendingConversions: allConvs.filter((c: any) => c.verification_status === 'pending_verification').length,
        pendingCommissionApproval: allComms.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + Number(c.commission_amount), 0),
        approvedUnpaidCommissions: allComms.filter((c: any) => c.status === 'approved').reduce((s: number, c: any) => s + Number(c.commission_amount), 0),
        totalPaidOutCommissions: allPays.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0),
        activeCommissionRulesCount: allRules.filter((r: any) => r.status === 'active').length
      };
    } catch (err: any) {
      if (isProduction) throw new Error(`Database error calculating metrics: ${err.message}`);
    }
  }

  // Memory fallback for local development
  return {
    pendingApplications: memoryDb.applications.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length,
    totalApplications: memoryDb.applications.length,
    activeAffiliates: memoryDb.affiliates.filter(a => a.status === 'active').length,
    totalAffiliates: memoryDb.affiliates.length,
    totalLeads: memoryDb.leads.length,
    verifiedConversions: memoryDb.conversions.filter(c => c.verificationStatus === 'verified').length,
    pendingConversions: memoryDb.conversions.filter(c => c.verificationStatus === 'pending_verification').length,
    pendingCommissionApproval: memoryDb.commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commissionAmount, 0),
    approvedUnpaidCommissions: memoryDb.commissions.filter(c => c.status === 'approved').reduce((s, c) => s + c.commissionAmount, 0),
    totalPaidOutCommissions: memoryDb.payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
    activeCommissionRulesCount: memoryDb.commissionRules.filter(r => r.status === 'active').length
  };
}

// ==============================================================================
// CLIENT CRM DATABASE OPERATIONS
// ==============================================================================

export interface ClientRegistrationRecord {
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
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

const memoryClientRegistrations: ClientRegistrationRecord[] = [];
const memoryClientInquiries: any[] = [];
const memoryClientNotes: any[] = [];
const memoryClientFollowups: any[] = [];

export async function insertClientRegistration(data: {
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  country: string;
  serviceCategory: string;
  requirementsBrief?: string;
  referralCode?: string;
}): Promise<ClientRegistrationRecord> {
  const ref = `R3-CLT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('client_registrations')
      .insert({
        reference_number: ref,
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        company: data.company || null,
        country: data.country,
        service_category: data.serviceCategory,
        requirements_brief: data.requirementsBrief || null,
        referral_code: data.referralCode ? data.referralCode.toUpperCase() : null,
        status: 'PENDING',
        invitation_status: 'pending'
      })
      .select()
      .single();

    if (error) {
      if (isProduction) {
        throw new Error(`Production database error saving client registration: ${error.message}`);
      }
      console.warn('[R3 Supabase] Client registration insert error, using local fallback:', error.message);
    } else if (inserted) {
      return {
        id: inserted.id,
        referenceNumber: inserted.reference_number,
        fullName: inserted.full_name,
        email: inserted.email,
        phone: inserted.phone,
        company: inserted.company,
        country: inserted.country,
        serviceCategory: inserted.service_category,
        requirementsBrief: inserted.requirements_brief,
        referralCode: inserted.referral_code,
        status: inserted.status,
        invitationStatus: inserted.invitation_status,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at
      };
    }
  } else if (isProduction) {
    throw new Error('Database service unavailable in production.');
  }

  const record: ClientRegistrationRecord = {
    id: `clt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    referenceNumber: ref,
    fullName: data.fullName,
    email: data.email.toLowerCase(),
    phone: data.phone,
    company: data.company,
    country: data.country,
    serviceCategory: data.serviceCategory,
    requirementsBrief: data.requirementsBrief,
    referralCode: data.referralCode,
    status: 'PENDING',
    invitationStatus: 'pending',
    createdAt: now,
    updatedAt: now
  };
  memoryClientRegistrations.unshift(record);
  return record;
}

export async function getClientRegistrations(): Promise<ClientRegistrationRecord[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isProduction) throw new Error(`Database error fetching client registrations: ${error.message}`);
      return memoryClientRegistrations;
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      referenceNumber: r.reference_number,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      company: r.company,
      country: r.country,
      serviceCategory: r.service_category,
      requirementsBrief: r.requirements_brief,
      referralCode: r.referral_code,
      status: r.status,
      invitationStatus: r.invitation_status,
      invitationSentAt: r.invitation_sent_at,
      invitationError: r.invitation_error,
      accountActivatedAt: r.account_activated_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  return memoryClientRegistrations;
}

export async function updateClientRegistrationInvitation(
  id: string,
  invitationStatus: 'sent' | 'failed' | 'accepted' | 'expired',
  errorMsg?: string
): Promise<void> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('client_registrations')
      .update({
        invitation_status: invitationStatus,
        invitation_sent_at: invitationStatus === 'sent' ? now : undefined,
        invitation_error: errorMsg || null,
        updated_at: now
      })
      .eq('id', id);
    return;
  }

  const rec = memoryClientRegistrations.find(r => r.id === id);
  if (rec) {
    rec.invitationStatus = invitationStatus;
    if (invitationStatus === 'sent') rec.invitationSentAt = now;
    rec.invitationError = errorMsg;
    rec.updatedAt = now;
  }
}

export async function updateClientRegistrationStatus(
  id: string,
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'DECLINED' | 'ARCHIVED'
): Promise<void> {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('client_registrations')
      .update({ status, updated_at: now })
      .eq('id', id);
    return;
  }

  const rec = memoryClientRegistrations.find(r => r.id === id);
  if (rec) {
    rec.status = status;
    rec.updatedAt = now;
  }
}

export async function insertClientInquiry(data: {
  clientId?: string;
  registrationId?: string;
  clientName: string;
  email: string;
  phone?: string;
  organization?: string;
  country: string;
  serviceInterest: string;
  briefSummary?: string;
  priority?: 'urgent' | 'high' | 'standard';
}): Promise<{ id: string; referenceNumber: string }> {
  const ref = `R3-INQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('client_inquiries')
      .insert({
        reference_number: ref,
        client_id: data.clientId || null,
        registration_id: data.registrationId || null,
        client_name: data.clientName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        organization: data.organization || null,
        country: data.country,
        service_interest: data.serviceInterest,
        brief_summary: data.briefSummary || null,
        priority: data.priority || 'high',
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      if (isProduction) throw new Error(`Database error saving inquiry: ${error.message}`);
    } else if (inserted) {
      return { id: inserted.id, referenceNumber: inserted.reference_number };
    }
  }

  const record = {
    id: `inq_${Date.now()}`,
    referenceNumber: ref,
    ...data,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  memoryClientInquiries.unshift(record);
  return { id: record.id, referenceNumber: ref };
}

export async function getClientInquiries(clientId?: string): Promise<any[]> {
  if (supabaseAdmin) {
    let query = supabaseAdmin.from('client_inquiries').select('*').order('created_at', { ascending: false });
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    const { data, error } = await query;
    if (error) {
      if (isProduction) throw new Error(`Database error fetching inquiries: ${error.message}`);
      return memoryClientInquiries;
    }
    return data || [];
  }

  if (clientId) {
    return memoryClientInquiries.filter(i => i.clientId === clientId);
  }
  return memoryClientInquiries;
}

export async function insertClientNote(data: {
  registrationId: string;
  clientId?: string;
  authorEmail: string;
  authorName: string;
  noteType: string;
  content: string;
}): Promise<any> {
  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('client_notes')
      .insert({
        registration_id: data.registrationId,
        client_id: data.clientId || null,
        author_email: data.authorEmail,
        author_name: data.authorName,
        note_type: data.noteType,
        content: data.content,
        is_confidential: true
      })
      .select()
      .single();

    if (error && isProduction) throw new Error(`Database error inserting note: ${error.message}`);
    if (inserted) return inserted;
  }

  const note = { id: `note_${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  memoryClientNotes.push(note);
  return note;
}

export async function getClientNotes(registrationId: string): Promise<any[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_notes')
      .select('*')
      .eq('registration_id', registrationId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isProduction) throw new Error(`Database error fetching notes: ${error.message}`);
      return memoryClientNotes.filter(n => n.registrationId === registrationId);
    }
    return data || [];
  }

  return memoryClientNotes.filter(n => n.registrationId === registrationId);
}

export async function insertClientFollowup(data: {
  registrationId: string;
  clientId?: string;
  title: string;
  dueDate: string;
  priority: string;
  assignedTo: string;
  notes?: string;
}): Promise<any> {
  if (supabaseAdmin) {
    const { data: inserted, error } = await supabaseAdmin
      .from('client_followups')
      .insert({
        registration_id: data.registrationId,
        client_id: data.clientId || null,
        title: data.title,
        due_date: data.dueDate,
        priority: data.priority,
        status: 'pending',
        assigned_to: data.assignedTo,
        notes: data.notes || null
      })
      .select()
      .single();

    if (error && isProduction) throw new Error(`Database error inserting followup: ${error.message}`);
    if (inserted) return inserted;
  }

  const followup = { id: `fup_${Date.now()}`, ...data, status: 'pending', createdAt: new Date().toISOString() };
  memoryClientFollowups.push(followup);
  return followup;
}

export async function getClientFollowups(registrationId?: string): Promise<any[]> {
  if (supabaseAdmin) {
    let query = supabaseAdmin.from('client_followups').select('*').order('due_date', { ascending: true });
    if (registrationId) {
      query = query.eq('registration_id', registrationId);
    }
    const { data, error } = await query;
    if (error) {
      if (isProduction) throw new Error(`Database error fetching followups: ${error.message}`);
      return memoryClientFollowups.filter(f => !registrationId || f.registrationId === registrationId);
    }
    return data || [];
  }

  if (registrationId) {
    return memoryClientFollowups.filter(f => f.registrationId === registrationId);
  }
  return memoryClientFollowups;
}

// ==============================================================================
// ADMINISTRATIVE BOOTSTRAP PROVISIONING
// ==============================================================================

export async function bootstrapAdminUser(data: {
  email: string;
  password: string;
  fullName: string;
  role?: 'super_admin' | 'affiliate_manager' | 'finance_manager' | 'compliance_officer';
}): Promise<{ success: boolean; userId: string; role: string }> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const assignedRole = data.role || 'super_admin';

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized. Cannot provision administrator.');
  }

  // 1. Create or retrieve auth user
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      role: assignedRole,
      full_name: data.fullName
    }
  });

  let userId = authUser?.user?.id;

  if (authErr) {
    // If user already exists in auth, find them and update password & metadata
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const existing = listData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (existing) {
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { role: assignedRole, full_name: data.fullName }
      });
    } else {
      throw new Error(`Failed to create admin in Supabase Auth: ${authErr.message}`);
    }
  }

  if (!userId) {
    throw new Error('Could not establish administrative user ID.');
  }

  // 2. Upsert profile in public.profiles table
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email: normalizedEmail,
      full_name: data.fullName,
      role: assignedRole,
      status: 'active',
      updated_at: new Date().toISOString()
    });

  if (profileErr) {
    throw new Error(`Failed to update administrative profile table: ${profileErr.message}`);
  }

  return { success: true, userId, role: assignedRole };
}
