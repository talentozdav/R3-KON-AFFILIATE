-- ==============================================================================
-- R3 CONTINGENCIES — CLIENT CRM, REGISTRATIONS, INQUIRIES & SECURITY SCHEMA
-- Migration: 20261030000001_client_crm_and_security.sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENSURE ROLE ENUM SUPPORTS CLIENT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'super_admin',
      'affiliate_manager',
      'finance_manager',
      'affiliate',
      'client'
    );
  ELSE
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 3. CLIENT PROFILES (Authenticated clients mapped to auth.users)
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  country TEXT NOT NULL DEFAULT 'International',
  membership_tier TEXT NOT NULL DEFAULT 'Executive Contingency Retainer',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_activation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. CLIENT REGISTRATIONS (Public and inbound membership registrations)
CREATE TABLE IF NOT EXISTS public.client_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  country TEXT NOT NULL,
  service_category TEXT NOT NULL,
  requirements_brief TEXT,
  referral_code TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'ARCHIVED')),
  invitation_status TEXT NOT NULL DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'sent', 'failed', 'accepted', 'expired')),
  invitation_sent_at TIMESTAMPTZ,
  invitation_error TEXT,
  account_activated_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. CLIENT INQUIRIES (Direct inquiries and retainer briefs)
CREATE TABLE IF NOT EXISTS public.client_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES public.client_registrations(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  organization TEXT,
  country TEXT NOT NULL DEFAULT 'International',
  service_interest TEXT NOT NULL,
  brief_summary TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'assigned', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('urgent', 'high', 'standard')),
  assigned_coordinator TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. CLIENT STAFF NOTES (Strictly confidential staff CRM notes)
CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.client_registrations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('general', 'compliance', 'security', 'billing', 'operational')),
  content TEXT NOT NULL,
  is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. CLIENT FOLLOW-UPS (Administrative and coordinator task queue)
CREATE TABLE IF NOT EXISTS public.client_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.client_registrations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. INDEXES
CREATE INDEX IF NOT EXISTS idx_client_registrations_email ON public.client_registrations(email);
CREATE INDEX IF NOT EXISTS idx_client_registrations_status ON public.client_registrations(status);
CREATE INDEX IF NOT EXISTS idx_client_registrations_ref ON public.client_registrations(reference_number);
CREATE INDEX IF NOT EXISTS idx_client_inquiries_email ON public.client_inquiries(email);
CREATE INDEX IF NOT EXISTS idx_client_inquiries_client ON public.client_inquiries(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_registration ON public.client_notes(registration_id);
CREATE INDEX IF NOT EXISTS idx_client_followups_due ON public.client_followups(due_date);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_followups ENABLE ROW LEVEL SECURITY;

-- Helper check for staff role
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'affiliate_manager', 'finance_manager')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. Client Profiles
DROP POLICY IF EXISTS "Clients view own profile" ON public.client_profiles;
CREATE POLICY "Clients view own profile" ON public.client_profiles
  FOR SELECT USING (id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Clients update own profile" ON public.client_profiles;
CREATE POLICY "Clients update own profile" ON public.client_profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Staff insert client profile" ON public.client_profiles;
CREATE POLICY "Staff insert client profile" ON public.client_profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR public.is_staff());

-- 2. Client Registrations
DROP POLICY IF EXISTS "Public can insert registration" ON public.client_registrations;
CREATE POLICY "Public can insert registration" ON public.client_registrations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Clients can view own registration" ON public.client_registrations;
CREATE POLICY "Clients can view own registration" ON public.client_registrations
  FOR SELECT USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Staff can manage registrations" ON public.client_registrations;
CREATE POLICY "Staff can manage registrations" ON public.client_registrations
  FOR ALL USING (public.is_staff());

-- 3. Client Inquiries
DROP POLICY IF EXISTS "Public and clients can insert inquiry" ON public.client_inquiries;
CREATE POLICY "Public and clients can insert inquiry" ON public.client_inquiries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Clients can view own inquiries" ON public.client_inquiries;
CREATE POLICY "Clients can view own inquiries" ON public.client_inquiries
  FOR SELECT USING (
    (client_id IS NOT NULL AND client_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Staff manage inquiries" ON public.client_inquiries;
CREATE POLICY "Staff manage inquiries" ON public.client_inquiries
  FOR ALL USING (public.is_staff());

-- 4. Client Notes (STRICTLY STAFF ONLY - NO AFFILIATE OR CLIENT ACCESS)
DROP POLICY IF EXISTS "Staff only notes" ON public.client_notes;
CREATE POLICY "Staff only notes" ON public.client_notes
  FOR ALL USING (public.is_staff());

-- 5. Client Followups (STRICTLY STAFF ONLY)
DROP POLICY IF EXISTS "Staff only followups" ON public.client_followups;
CREATE POLICY "Staff only followups" ON public.client_followups
  FOR ALL USING (public.is_staff());
