-- ==============================================================================
-- R3 CONTINGENCIES — POST-APPROVAL CLIENT IDENTITY VERIFICATION (KYC) MODULE
-- Migration: 20261121000000_client_identity_verification.sql
-- Target Supabase Project: mxzjanjdwnhonqensnsw
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure user_role enum includes compliance_officer & client (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
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

-- 2. Least-privilege Compliance Role Helper (STRICTLY super_admin & compliance_officer)
--    Explicitly excludes affiliate, affiliate_manager, finance_manager, and client roles.
CREATE OR REPLACE FUNCTION public.is_compliance_officer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'compliance_officer')
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Client Identity Verifications Table
CREATE TABLE IF NOT EXISTS public.client_identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL UNIQUE REFERENCES public.client_registrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (verification_status IN ('not_started', 'action_required', 'submitted', 'under_review', 'approved', 'rejected')),
  legal_full_name TEXT,
  verified_email TEXT NOT NULL,
  country TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  government_id_type TEXT
    CHECK (government_id_type IS NULL OR government_id_type IN ('drivers_license', 'state_id', 'passport', 'national_id')),
  government_id_last4 TEXT,
  ssn_provided BOOLEAN NOT NULL DEFAULT FALSE,
  ssn_last4 TEXT,
  ssn_encrypted TEXT,
  ssn_hmac TEXT,
  liveness_method TEXT
    CHECK (liveness_method IS NULL OR liveness_method IN ('camera_capture', 'selfie_upload')),
  liveness_verified BOOLEAN NOT NULL DEFAULT FALSE,
  liveness_challenge_note TEXT,
  consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version TEXT,
  consent_timestamp TIMESTAMPTZ,
  retention_expires_at TIMESTAMPTZ,
  kyc_invitation_sent_at TIMESTAMPTZ,
  kyc_invitation_expires_at TIMESTAMPTZ,
  action_required_message TEXT,
  rejection_reason TEXT,
  internal_compliance_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_email TEXT,
  reviewed_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Client KYC Documents Metadata Table (files stored in private Storage bucket)
CREATE TABLE IF NOT EXISTS public.client_kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.client_identity_verifications(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.client_registrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('gov_id_front', 'gov_id_back', 'passport', 'national_id', 'selfie', 'liveness_capture', 'supplemental')),
  storage_bucket TEXT NOT NULL DEFAULT 'r3-client-kyc-documents',
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  sha256_checksum TEXT,
  upload_status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (upload_status IN ('pending', 'uploaded', 'superseded', 'deleted')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Immutable KYC Review & Decision History Table
CREATE TABLE IF NOT EXISTS public.client_kyc_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.client_identity_verifications(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('invitation_issued', 'draft_saved', 'submitted', 'under_review', 'action_required', 'approved', 'rejected', 'resubmitted')),
  actor_id UUID,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  client_message TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_registration ON public.client_identity_verifications(registration_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user ON public.client_identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON public.client_identity_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_verification ON public.client_kyc_documents(verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user ON public.client_kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_history_verification ON public.client_kyc_review_history(verification_id, created_at DESC);

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) ON ALL KYC TABLES
-- ==============================================================================

ALTER TABLE public.client_identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_kyc_review_history ENABLE ROW LEVEL SECURITY;

-- Client Identity Verifications RLS
DROP POLICY IF EXISTS "Clients view own identity verification" ON public.client_identity_verifications;
CREATE POLICY "Clients view own identity verification" ON public.client_identity_verifications
  FOR SELECT USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.is_compliance_officer()
  );

DROP POLICY IF EXISTS "Approved clients update own draft verification" ON public.client_identity_verifications;
CREATE POLICY "Approved clients update own draft verification" ON public.client_identity_verifications
  FOR UPDATE USING (
    user_id = auth.uid()
    AND verification_status IN ('not_started', 'action_required')
    AND EXISTS (
      SELECT 1 FROM public.client_registrations r
      WHERE r.id = registration_id AND r.status = 'APPROVED'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND verification_status IN ('not_started', 'action_required', 'submitted', 'under_review')
  );

DROP POLICY IF EXISTS "Compliance officers manage all verifications" ON public.client_identity_verifications;
CREATE POLICY "Compliance officers manage all verifications" ON public.client_identity_verifications
  FOR ALL USING (public.is_compliance_officer())
  WITH CHECK (public.is_compliance_officer());

-- Client KYC Documents RLS
DROP POLICY IF EXISTS "Clients view own kyc document metadata" ON public.client_kyc_documents;
CREATE POLICY "Clients view own kyc document metadata" ON public.client_kyc_documents
  FOR SELECT USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.is_compliance_officer()
  );

DROP POLICY IF EXISTS "Approved clients insert own kyc documents" ON public.client_kyc_documents;
CREATE POLICY "Approved clients insert own kyc documents" ON public.client_kyc_documents
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.client_identity_verifications v
      JOIN public.client_registrations r ON r.id = v.registration_id
      WHERE v.id = verification_id
        AND v.user_id = auth.uid()
        AND r.status = 'APPROVED'
        AND v.verification_status IN ('not_started', 'action_required')
    )
  );

DROP POLICY IF EXISTS "Compliance officers manage kyc documents" ON public.client_kyc_documents;
CREATE POLICY "Compliance officers manage kyc documents" ON public.client_kyc_documents
  FOR ALL USING (public.is_compliance_officer())
  WITH CHECK (public.is_compliance_officer());

-- Client KYC Review History RLS
-- Clients can view non-sensitive status transition history on their own verification;
-- internal_notes are redacted at API layer (and only compliance roles write decisions).
DROP POLICY IF EXISTS "Clients view own kyc history" ON public.client_kyc_review_history;
CREATE POLICY "Clients view own kyc history" ON public.client_kyc_review_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_identity_verifications v
      WHERE v.id = verification_id AND v.user_id = auth.uid()
    )
    OR public.is_compliance_officer()
  );

DROP POLICY IF EXISTS "Compliance officers record kyc history" ON public.client_kyc_review_history;
CREATE POLICY "Compliance officers record kyc history" ON public.client_kyc_review_history
  FOR INSERT WITH CHECK (public.is_compliance_officer());

-- ==============================================================================
-- 8. PRIVATE SUPABASE STORAGE BUCKET & OBJECT POLICIES
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'r3-client-kyc-documents',
  'r3-client-kyc-documents',
  FALSE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS "Approved clients upload own KYC files" ON storage.objects;
CREATE POLICY "Approved clients upload own KYC files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'r3-client-kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.client_identity_verifications v
      JOIN public.client_registrations r ON r.id = v.registration_id
      WHERE v.user_id = auth.uid()
        AND r.status = 'APPROVED'
        AND v.verification_status IN ('not_started', 'action_required')
    )
  );

DROP POLICY IF EXISTS "Clients and compliance read authorized KYC files" ON storage.objects;
CREATE POLICY "Clients and compliance read authorized KYC files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'r3-client-kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_compliance_officer()
    )
  );

DROP POLICY IF EXISTS "Compliance officers delete expired KYC files" ON storage.objects;
CREATE POLICY "Compliance officers delete expired KYC files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'r3-client-kyc-documents'
    AND public.is_compliance_officer()
  );
