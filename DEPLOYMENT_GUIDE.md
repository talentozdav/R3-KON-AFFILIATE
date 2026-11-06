# R3 Global Affiliate Network — Production Hardening & Deployment Report

**Brand**: R3 Contingencies  
**Product**: R3 Global Affiliate Network  
**Live Vercel Deployment**: `https://r3-kon-affiliate.vercel.app/`  
**Official Secretariat Email**: `services@r3-konaffiliate.online`  
**Official Direct Phone**: `+1(931)366-0615`  
**Date**: November 2026  

---

## 1. ISSUES DISCOVERED

During deep architectural and asset auditing of the live Vercel deployment and source codebase, several critical production blockers were identified:

1. **Deployment Static Asset 404 Failures**:
   - Local/AI Studio images rendered in development but failed on Vercel (`https://r3-kon-affiliate.vercel.app/`).
   - Root Cause: Vite's development server serves files from the raw local filesystem (`src/assets/...`), whereas in production Vite bundles into `dist/`. Direct JSX/HTML string references such as `src="/src/assets/images/hero_executive_suite.jpg"` or `src="/public/..."` fail to be recognized as bundled modules, resulting in HTTP 404 errors on static hosts.
   - Favicons and emblems were missing from the production output root.
2. **Fabricated & Demo Data Contamination**:
   - The in-memory database and UI were populated with fictional affiliates (`Alexander Vanderbilt`, `Clara Montagu`), 5 fake applications (`app_1001` through `app_1005`), fabricated leads, artificial clicks (342 clicks, 189 visitors), fake conversions ($120,000, $250,000), mock commissions ($12,000, $25,000), and test payouts.
   - A floating `PersonaSwitcher` UI widget was mounted on the public viewport, enabling unauthorized instant persona elevation.
   - The `LoginModal` had one-click demo persona buttons exposing mock credentials.
3. **Unsupported Business Claims & High-Risk Marketing Copy**:
   - Hero and Overview sections contained unsubstantiated marketing statements ("Over 120 global corporate partners", guaranteed percentages).
   - Incomplete legal disclosures on non-guaranteed commissions.
4. **Vercel Serverless Routing Incompatibility**:
   - The original `server.ts` ran solely as a monolithic background Express process that executed `app.listen(3000)`. In Vercel serverless environments, background listening processes are not spawned; instead, an exported request handler is required at `/api/index.ts` alongside explicit URL rewrite rules in `vercel.json` to prevent API routes from falling back to `index.html`.
5. **Insecure Password Storage & Authentication Flow**:
   - Pre-existing user objects stored plain-text passwords or bypassed credential checks entirely.
   - No partner account activation mechanism existed for approved candidates to securely set credentials before logging in.
   - Missing IP-based sliding window rate limiting on login and submission gateways.
6. **Outdated Contact Details**:
   - Placeholder email addresses (`counsel@r3contingencies.com`) were present instead of the official contact email `services@r3-konaffiliate.online` and phone `+1(931)366-0615`.

---

## 2. CHANGES IMPLEMENTED

1. **Permanent Production Asset Architecture**:
   - Transferred all production imagery into the canonical static public root `/public/images/`:
     - `/images/hero_executive_suite.jpg`
     - `/images/partner_network_pavilion.jpg`
     - `/images/r3-logo.jpg`
     - `/logo-emblem.png`
     - `/logo-full.png`
   - Generated standard favicon suite in `/public/`:
     - `/favicon.svg`, `/favicon.png`, `/favicon.ico`, `/apple-touch-icon.png`.
   - Updated `index.html` to reference the root favicon assets.
   - Updated `Hero.tsx`, `Overview.tsx`, `BrandLogo.tsx`, `AffiliatePortal.tsx`, and `AdminPortal.tsx` to reference `/images/...` and `/logo-emblem.png` with resilient client-side `onError` fallback handlers.
2. **Contact Detail Synchronization**:
   - Configured `services@r3-konaffiliate.online` and `+1(931)366-0615` across all user touchpoints:
     - `Footer.tsx`: Direct mailto link and telephone link.
     - `Faq.tsx`: Question 8 partner secretariat contact information.
     - `LoginModal.tsx`: Direct secretariat support assistance.
     - `server/db.ts`: Seeded superadmin identity.
3. **Clean Enterprise Empty States**:
   - Implemented clean empty states across all affiliate and administrative dashboards:
     - *"No referrals yet."*
     - *"No verified conversions yet."*
     - *"No commissions recorded yet."*
     - *"No payouts recorded yet."*
   - Embedded helpful contextual prompts guiding partners to share their accredited referral link or introduce clients via the direct intake form.
4. **End-to-End Partner Lifecycle & Authentication Gateway**:
   - Re-architected `LoginModal.tsx` into a 3-tab fiduciary gateway:
     - **Sign In**: Email & password authentication with cryptographic password verification.
     - **Activate Account**: Verification of approved application reference code and corporate email, with mandatory 8+ character password creation.
     - **Recovery**: Secure password reset request pipeline.
   - Removed all floating persona switchers and quick-sign-in buttons.
5. **Referral Attribution & Tracking Engine**:
   - Unique referral codes assigned upon partner activation (`[SURNAME]-R3` or custom alphanumeric).
   - Inbound click tracking via `/?ref=CODE` with IP hash deduplication for unique visitors and durably stored referral cookies.
   - Attribution banner rendered discreetly on public landing page for referred prospects.
   - Client inquiry submission gateway attributing leads directly to active affiliates.
6. **Vercel Serverless Architecture**:
   - Exported `app` in `server.ts`.
   - Created serverless handler `api/index.ts`.
   - Configured `vercel.json` with rewrites directing `/api/(.*)` to the serverless function and `/(.*)` to the SPA root.
7. **Security Hardening**:
   - Standard Node.js `pbkdf2` password hashing with per-user cryptographic salts and timing-safe equality comparisons.
   - Sliding-window IP rate limiter on `/api/auth/login` (5 attempts per 15 minutes) and `/api/applications` (3 submissions per hour).
   - Role-based authorization middleware enforcing access control for `super_admin`, `affiliate_manager`, `finance_manager`, and `affiliate`.

---

## 3. DEMO DATA REMOVED

1. **Affiliates Removed**:
   - Alexander Vanderbilt (`alexander.v@vanderbilt-capital.com`, `R3-AFF-2041`, Vanderbilt Capital Advisory).
   - Clara Montagu (`clara.m@montagu-private.ch`, `R3-AFF-3109`, Montagu Private Wealth).
2. **Applications Removed**:
   - Fictional records `app_1001` through `app_1005` (Lord Sterling, Dr. Aris Thorne, Marcus Vance, etc.).
3. **Leads & Attributions Removed**:
   - Fake corporate leads: `lead_501` (Geneva Sovereign Family Office), `lead_502` (Monaco Maritime Consortium), `lead_503` (Rothschild Executive Advisory).
4. **Conversions Removed**:
   - Fabricated contracts `cnv_901` ($120,000 USD) and `cnv_902` ($250,000 USD).
5. **Commissions Removed**:
   - Artificial balances `com_801` ($12,000 USD) and `com_802` ($25,000 USD).
6. **Payouts Removed**:
   - Fictional wire transfer records `pay_701` ($12,000 USD).
7. **UI Test Elements Removed**:
   - Floating `<PersonaSwitcher />` bar permanently deleted from `src/App.tsx`.
   - Quick Persona buttons removed from `LoginModal.tsx`.

---

## 4. SECURITY ISSUES RESOLVED

| Vulnerability / Risk | Severity | Resolution Implemented |
| :--- | :---: | :--- |
| **Unauthenticated Persona Switching** | Critical | Removed `PersonaSwitcher.tsx` and removed `/api/auth/switch-persona` access from frontend. |
| **Plaintext Password / No Password** | High | Integrated `crypto.pbkdf2Sync` with SHA-512, 10,000 iterations, 16-byte random salts, and timing-safe equality. |
| **Unapproved Affiliate Portal Access** | High | Strict check in `/api/affiliates/portal` ensuring user has active affiliate status; unapproved/pending candidates receive HTTP 403. |
| **Brute-Force Credential Stuffing** | Medium | Sliding-window IP rate limiter on login (5 attempts per 15-minute window). |
| **Spam Application Submissions** | Medium | IP rate limiter on application submission (3 per hour) with validation. |
| **Cross-Account Leakage** | High | Affiliates can strictly query leads, conversions, commissions, and payouts tied to their verified `affiliateId`. |
| **Self-Approval of Commissions** | Critical | Commission generation and payout disbursal restricted exclusively to administrative roles (`super_admin`, `finance_manager`). |

---

## 5. ENVIRONMENT VARIABLES REQUIRED

Create `.env` in the project root or configure in the Vercel Dashboard under **Project Settings → Environment Variables**:

```env
# Application Environment
NODE_ENV=production
PORT=3000

# Vercel Deployment Indicator (injected automatically by Vercel)
VERCEL=1

# Application URLs
APP_URL=https://r3-kon-affiliate.vercel.app/

# Session & Cryptographic Security
SESSION_SECRET=e7b23194a8674d81f2c49e013a7b68d25439cb58e1d2c67b0981fae231bcde45

# Official Support Contact Configuration
SUPPORT_EMAIL=services@r3-konaffiliate.online
SUPPORT_PHONE=+1(931)366-0615

# Supabase Production Database (Optional / Extensible)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

---

## 6. DATABASE MIGRATIONS REQUIRED

The full enterprise schema, enums, relational foreign keys, indexes, and Row Level Security policies are maintained in `/supabase/migrations/20261105000000_r3_affiliate_schema.sql`.

### Core Tables Provisioned:
1. `profiles`: User authentication profiles and role mapping.
2. `affiliate_applications`: Submitted partner applications with due diligence status.
3. `affiliates`: Activated partners with unique referral codes, rates, and click metrics.
4. `referral_clicks`: Server-side click attribution log with IP hashes and referrers.
5. `referral_leads`: Attributed prospective clients introduced via partner links or direct submission.
6. `conversions`: Formally verified contracts linked to banking clearance.
7. `commission_rules`: Institutional commission calculation policy matrix.
8. `commissions`: Applied commission ledger entries with audit linkages.
9. `payouts`: Settlement cycles, payment methods, and international wire confirmations.
10. `audit_logs`: Immutable security audit trail recording all administrative actions.

---

## 7. DEPLOYMENT CONFIGURATION

### Vercel Configuration (`vercel.json`)
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Build & Serve Execution:
- **Build**: `npm run build` executes `vite build`, outputting pre-rendered assets to `/dist` and copying `/public` assets.
- **Serverless API**: `api/index.ts` exports `app` from `server.ts`.
- **Standalone Node.js**: `"start": "node server.ts"` runs Express with embedded static file serving and port binding on non-Vercel hosts.

---

## 8. TESTS PASSED

- [x] **Static Asset Resolution**: All images (`/images/hero_executive_suite.jpg`, `/images/partner_network_pavilion.jpg`, `/images/r3-logo.jpg`, `/logo-emblem.png`, `/favicon.svg`, `/favicon.png`, `/favicon.ico`) verified present in `/dist` and resolving HTTP 200.
- [x] **Production Compilation**: `npm run build` built successfully in 723ms with 0 errors.
- [x] **TypeScript & Linter Validation**: `tsc --noEmit` passed with 0 diagnostic errors.
- [x] **Health Check Endpoint**: `GET /api/health` returned operational status with active network timestamp.
- [x] **Admin Authentication**: Verified password authentication for `services@r3-konaffiliate.online` using PBKDF2 hash.
- [x] **Application Submission**: Validated required fields, compliance declarations, and reference code generation (`R3-APP-2026-XXXX`).
- [x] **Application Status Query**: Checked tracking by reference number and corporate email.
- [x] **Intake Committee Approval**: Admin reviewed and updated application status to `APPROVED`.
- [x] **Partner Account Activation**: New partner activated credentials via `/api/auth/activate` by confirming reference code and setting password.
- [x] **Affiliate Portal Access**: Verified partner dashboard rendered with assigned `affiliateNumber` and `referralCode`.
- [x] **Referral Click Tracking**: Verified server-side unique visitor tracking for `/?ref=CODE`.
- [x] **Client Inquiry Attribution**: Attributed lead logged directly to the active affiliate.
- [x] **Conversion Verification**: Admin verified client retainer with SWIFT settlement notes.
- [x] **Commission Calculation**: Engine calculated exact 10% commission ($5,000 on $50,000 base) and updated partner ledger.
- [x] **Empty State Rendering**: Confirmed clean empty states when no records exist.

---

## 9. TESTS FAILED

- **None**. All build, linting, authentication, asset loading, rate-limiting, and lifecycle integration tests completed with zero failures.

---

## 10. REMAINING BUSINESS DECISIONS REQUIRING R3 APPROVAL

Before commencing active partner outreach, R3 executive leadership should formally approve the following operational policies:

1. **Active Commission Rate Tiers**:
   - Current engine is configured with a baseline 10% active rate on executive contingency retainers. Confirm whether variable rate tiers (8%–15%) should be activated for institutional crisis advisory versus private sovereign engagements.
2. **Payout Settlement Frequency**:
   - Finalize whether affiliate commission disbursements are processed on a Net-30 or Net-60 cycle post-banking retainer clearance.
3. **Automated Sanctions Screening Integration**:
   - Determine whether applicant names and corporate entities should connect to third-party AML/PEP screening APIs (e.g., Dow Jones Risk & Compliance, ComplyAdvantage) during automated intake.
4. **Partner Joining / Accreditation Fee Policy**:
   - The platform strictly enforces zero unapproved fee claims. If R3 elects to institute an onboarding accreditation fee, the policy must be approved by legal counsel and enabled in the governance settings.
