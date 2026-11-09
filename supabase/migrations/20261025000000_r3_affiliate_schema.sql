-- ==============================================================================
-- R3 GLOBAL AFFILIATE NETWORK — PRODUCTION POSTGRESQL / SUPABASE SCHEMA & RLS
-- Migration: 20261105000000_r3_affiliate_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES (Idempotent creation)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('super_admin', 'affiliate_manager', 'finance_manager', 'affiliate', 'client');
  ELSE
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
    CREATE TYPE application_status AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'INFORMATION_REQUESTED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'affiliate_status') THEN
    CREATE TYPE affiliate_status AS ENUM ('active', 'suspended', 'terminated', 'pending');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversion_status') THEN
    CREATE TYPE conversion_status AS ENUM ('verified', 'pending_verification', 'reversed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status') THEN
    CREATE TYPE commission_status AS ENUM ('approved', 'pending', 'reversed', 'paid');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE payout_status AS ENUM ('scheduled', 'processing', 'paid', 'cancelled');
  END IF;
END $$;

-- 3. PROFILES / USERS TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'affiliate',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_activation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. AFFILIATE APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('Individual', 'Business')),
  business_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  partnership_category TEXT NOT NULL,
  industry_background TEXT NOT NULL,
  audience_description TEXT NOT NULL,
  partnership_objectives TEXT NOT NULL,
  additional_info TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  status application_status NOT NULL DEFAULT 'SUBMITTED',
  status_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  activated_affiliate_id UUID,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. AFFILIATES TABLE
CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  status affiliate_status NOT NULL DEFAULT 'active',
  approved_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (approved_rate_percent >= 0 AND approved_rate_percent <= 100),
  total_clicks INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. REFERRAL LEADS TABLE
CREATE TABLE IF NOT EXISTS public.referral_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  client_identifier TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('Individual', 'Corporate', 'Institutional')),
  region TEXT NOT NULL,
  service_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_review' CHECK (status IN ('in_review', 'engaged', 'qualified', 'converted', 'disqualified')),
  estimated_value NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. CONVERSIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference TEXT NOT NULL UNIQUE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  lead_id UUID REFERENCES public.referral_leads(id) ON DELETE SET NULL,
  membership_tier_or_category TEXT NOT NULL,
  eligible_sale_amount NUMERIC(12,2) NOT NULL CHECK (eligible_sale_amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  verification_status conversion_status NOT NULL DEFAULT 'pending_verification',
  verification_notes TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. COMMISSION RULES TABLE
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  rate_percent NUMERIC(5,2) NOT NULL CHECK (rate_percent > 0 AND rate_percent <= 100),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'draft')),
  effective_date DATE NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. COMMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_reference TEXT NOT NULL UNIQUE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  conversion_id UUID NOT NULL REFERENCES public.conversions(id) ON DELETE RESTRICT,
  transaction_reference TEXT NOT NULL,
  eligible_transaction_amount NUMERIC(12,2) NOT NULL CHECK (eligible_transaction_amount > 0),
  applied_commission_rate NUMERIC(5,2) NOT NULL CHECK (applied_commission_rate >= 0),
  commission_amount NUMERIC(12,2) NOT NULL CHECK (commission_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status commission_status NOT NULL DEFAULT 'pending',
  payout_id UUID,
  audit_reason TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  date_recorded TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. PAYOUTS TABLE
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_reference TEXT NOT NULL UNIQUE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  payout_period TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status payout_status NOT NULL DEFAULT 'scheduled',
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  notes TEXT,
  prepared_by TEXT NOT NULL,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role user_role NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. REFERRAL CLICKS TABLE
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  referer TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES
CREATE INDEX idx_applications_email ON public.affiliate_applications(email);
CREATE INDEX idx_applications_status ON public.affiliate_applications(status);
CREATE INDEX idx_affiliates_code ON public.affiliates(referral_code);
CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_leads_affiliate ON public.referral_leads(affiliate_id);
CREATE INDEX idx_conversions_affiliate ON public.conversions(affiliate_id);
CREATE INDEX idx_commissions_affiliate ON public.commissions(affiliate_id);
CREATE INDEX idx_payouts_affiliate ON public.payouts(affiliate_id);
CREATE INDEX idx_audit_timestamp ON public.audit_logs(timestamp DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Helper function: Get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. Profiles: Users can view their own profile; admins can view all
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.current_user_role() IN ('super_admin', 'affiliate_manager', 'finance_manager'));

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.current_user_role() IN ('super_admin'));

-- 2. Applications: Anyone can insert (public submit); only admins can view/update
DROP POLICY IF EXISTS "Public can submit applications" ON public.affiliate_applications;
CREATE POLICY "Public can submit applications" ON public.affiliate_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view and manage applications" ON public.affiliate_applications;
CREATE POLICY "Admins can view and manage applications" ON public.affiliate_applications
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'affiliate_manager'));

-- 3. Affiliates: Affiliates see only their own record; admins see all
DROP POLICY IF EXISTS "Affiliates can view own record" ON public.affiliates;
CREATE POLICY "Affiliates can view own record" ON public.affiliates
  FOR SELECT USING (user_id = auth.uid() OR public.current_user_role() IN ('super_admin', 'affiliate_manager', 'finance_manager'));

DROP POLICY IF EXISTS "Admins manage affiliates" ON public.affiliates;
CREATE POLICY "Admins manage affiliates" ON public.affiliates
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'affiliate_manager'));

-- 4. Referral Leads: Affiliates view only their attributed leads
DROP POLICY IF EXISTS "Affiliates view own leads" ON public.referral_leads;
CREATE POLICY "Affiliates view own leads" ON public.referral_leads
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('super_admin', 'affiliate_manager')
  );

DROP POLICY IF EXISTS "Affiliates can submit leads" ON public.referral_leads;
CREATE POLICY "Affiliates can submit leads" ON public.referral_leads
  FOR INSERT WITH CHECK (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('super_admin', 'affiliate_manager')
  );

-- 5. Conversions: Affiliates can only read; ONLY ADMINS can insert or verify
DROP POLICY IF EXISTS "Affiliates view own conversions" ON public.conversions;
CREATE POLICY "Affiliates view own conversions" ON public.conversions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('super_admin', 'affiliate_manager', 'finance_manager')
  );

DROP POLICY IF EXISTS "Admins manage conversions" ON public.conversions;
CREATE POLICY "Admins manage conversions" ON public.conversions
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'finance_manager'));

-- 6. Commissions: Affiliates can only read; NO affiliate edit or approval!
DROP POLICY IF EXISTS "Affiliates view own commissions" ON public.commissions;
CREATE POLICY "Affiliates view own commissions" ON public.commissions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('super_admin', 'finance_manager')
  );

DROP POLICY IF EXISTS "Admins manage commissions" ON public.commissions;
CREATE POLICY "Admins manage commissions" ON public.commissions
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'finance_manager'));

-- 7. Payouts: Affiliates read only their own payouts; only Finance/Super admin manages
DROP POLICY IF EXISTS "Affiliates view own payouts" ON public.payouts;
CREATE POLICY "Affiliates view own payouts" ON public.payouts
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('super_admin', 'finance_manager')
  );

DROP POLICY IF EXISTS "Finance managers manage payouts" ON public.payouts;
CREATE POLICY "Finance managers manage payouts" ON public.payouts
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'finance_manager'));

-- 8. Audit Logs: Strictly Super Admin and Managers can view; insertions only by trusted backend
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.current_user_role() IN ('super_admin', 'affiliate_manager', 'finance_manager'));
