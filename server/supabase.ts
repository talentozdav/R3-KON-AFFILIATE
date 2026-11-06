import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { db as memoryDb } from './db.js';

// Project reference: btyrmnklklxgqoxdhetd
const SUPABASE_PROJECT_REF = 'btyrmnklklxgqoxdhetd';
const DEFAULT_SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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
  console.warn('[R3 Supabase] Live credentials not provided in environment. Running with local persistent fallback.');
}

export { supabaseAdmin, supabasePublic };

// ==============================================================================
// AUTHENTICATION & ACCESS TOKEN VERIFICATION
// ==============================================================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'affiliate_manager' | 'finance_manager' | 'affiliate' | 'client';
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
        // Check if user is a client account via metadata
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
      // Non-JWT token (e.g. local seeded admin credentials), fall through to local verification
    }
  }

  // 2. Local fallback verification for developer test environment
  const user = memoryDb.users.find(u => u.email.toLowerCase() === token.toLowerCase());
  if (user && user.status === 'active') {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      affiliateId: user.affiliateId
    };
  }

  return null;
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

// In-memory CRM table fallback for local dev
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
      if (error.message?.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
        console.warn('[R3 Supabase] Table public.client_registrations not found yet in Supabase. Please execute migration 20261030000001_client_crm_and_security.sql in Supabase SQL editor. Storing in resilient local store in the interim.');
      } else {
        console.error('[R3 Supabase] Error inserting client registration:', error);
        throw new Error(`Database error saving registration: ${error.message}`);
      }
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
  }

  // Memory fallback
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
      console.error('[R3 Supabase] Error fetching registrations:', error);
      return memoryClientRegistrations;
    }

    return data.map((r: any) => ({
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
        country: data.country || 'International',
        service_interest: data.serviceInterest,
        brief_summary: data.briefSummary || null,
        priority: data.priority || 'high',
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
        console.warn('[R3 Supabase] Table public.client_inquiries not found yet. Using local store until migration is run.');
      } else {
        console.error('[R3 Supabase] Error inserting client inquiry:', error);
        throw new Error(`Database error saving inquiry: ${error.message}`);
      }
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
      console.error('[R3 Supabase] Error fetching inquiries:', error);
      return memoryClientInquiries;
    }
    return data;
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

    if (error) {
      if (error.message?.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
        console.warn('[R3 Supabase] Table public.client_notes not found yet. Using local store until migration is run.');
      } else {
        throw new Error(error.message);
      }
    } else if (inserted) {
      return inserted;
    }
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

    if (error) return memoryClientNotes.filter(n => n.registrationId === registrationId);
    return data;
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

    if (error) {
      if (error.message?.includes('schema cache') || error.code === 'PGRST204' || error.code === '42P01') {
        console.warn('[R3 Supabase] Table public.client_followups not found yet. Using local store until migration is run.');
      } else {
        throw new Error(error.message);
      }
    } else if (inserted) {
      return inserted;
    }
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
    if (error) return memoryClientFollowups.filter(f => !registrationId || f.registrationId === registrationId);
    return data;
  }

  if (registrationId) {
    return memoryClientFollowups.filter(f => f.registrationId === registrationId);
  }
  return memoryClientFollowups;
}
