-- ==============================================================================
-- R3 CONTINGENCIES — PRODUCTION SCHEMA RECONCILIATION & INTEGRITY CONSTRAINTS
-- Migration: 20261109000000_production_reconciliation.sql
-- Target Supabase Project: btyrmnklklxgqoxdhetd (https://btyrmnklklxgqoxdhetd.supabase.co)
-- ==============================================================================

-- 1. Ensure all user roles are safely present in enum user_role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('super_admin', 'affiliate_manager', 'finance_manager', 'compliance_officer', 'affiliate', 'client');
  ELSE
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'compliance_officer';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Staff verification function (Idempotent and resilient)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'affiliate_manager', 'finance_manager', 'compliance_officer')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Current user role helper
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. Check and add missing columns if any table was provisioned earlier
DO $$ BEGIN
  -- Ensure affiliate_applications has activated_affiliate_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliate_applications') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_applications' AND column_name = 'activated_affiliate_id') THEN
      ALTER TABLE public.affiliate_applications ADD COLUMN activated_affiliate_id UUID;
    END IF;
  END IF;

  -- Ensure affiliates has user_id, referral_code
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliates') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'approved_rate_percent') THEN
      ALTER TABLE public.affiliates ADD COLUMN approved_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00;
    END IF;
  END IF;

  -- Ensure commissions has audit_reason
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commissions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commissions' AND column_name = 'audit_reason') THEN
      ALTER TABLE public.commissions ADD COLUMN audit_reason TEXT;
    END IF;
  END IF;
END $$;

-- 5. Additional Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates(status);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_lookup ON public.referral_clicks(referral_code, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_conversions_status ON public.conversions(verification_status);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);

-- 6. Health check function accessible by authenticated and service roles
CREATE OR REPLACE FUNCTION public.check_system_health()
RETURNS JSONB AS $$
DECLARE
  v_users_count INT;
  v_affiliates_count INT;
  v_clients_count INT;
BEGIN
  SELECT count(*) INTO v_users_count FROM public.profiles;
  SELECT count(*) INTO v_affiliates_count FROM public.affiliates;
  SELECT count(*) INTO v_clients_count FROM public.client_profiles;

  RETURN jsonb_build_object(
    'status', 'healthy',
    'database', 'connected',
    'timestamp', timezone('utc'::text, now()),
    'profiles_count', v_users_count,
    'affiliates_count', v_affiliates_count,
    'clients_count', v_clients_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
