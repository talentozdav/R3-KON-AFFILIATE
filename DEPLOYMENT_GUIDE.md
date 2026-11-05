# R3 Global Affiliate Network — Production Deployment & Architecture Guide

**Brand**: R3 Contingencies  
**Product**: R3 Global Affiliate Network  
**Environment Target**: Node.js Full-Stack / Vercel + Supabase PostgreSQL  

---

## 1. Executive Architecture Overview

The **R3 Global Affiliate Network** is a minimalist, international affiliate membership platform engineered for discretion, compliance, and strict fiduciary accountability.

### Core Architecture
- **Frontend SPA**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, tabular financial typography (`font-variant-numeric: tabular-nums`).
- **Backend API**: Express server running on Node.js (`server.ts`), mounting `/api/*` routes with server-side role validation, duplicate application checks, rate limiting, and immutable audit logging.
- **Database Layer**:
  - **AI Studio / In-Memory & Persistent Engine**: `server/db.ts` providing immediate out-of-the-box operation with pre-seeded personas and financial records.
  - **Production Supabase PostgreSQL**: Schema, enums, tables, indexes, and comprehensive Row Level Security (RLS) policies located in `/supabase/migrations/20261105000000_r3_affiliate_schema.sql`.

---

## 2. Supabase Configuration & Database Setup

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com) and create a new project.
   - Note your `Project URL`, `anon public key`, and `service_role secret key`.

2. **Execute Database Migrations**:
   - In your Supabase Dashboard, navigate to the **SQL Editor**.
   - Open `/supabase/migrations/20261105000000_r3_affiliate_schema.sql` from this repository.
   - Run the script. This provisions:
     - Enums: `user_role`, `application_status`, `affiliate_status`, `conversion_status`, `commission_status`, `payout_status`.
     - Tables: `profiles`, `affiliate_applications`, `affiliates`, `referral_leads`, `conversions`, `commission_rules`, `commissions`, `payouts`, `audit_logs`, `referral_clicks`.
     - Indexes and relational constraints.
     - Row Level Security (RLS) policies preventing cross-account data leakage.

3. **Row Level Security (RLS) Guarantees**:
   - **Affiliates**: Can strictly view their own affiliate profile, attributed leads, verified conversions, commissions, and payout history. Affiliates have zero permission to approve conversions, alter commission rates, or disburse payouts.
   - **Administrators**: Role verification is strictly enforced on the server (`super_admin`, `affiliate_manager`, `finance_manager`).

---

## 3. Local Development & Testing Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   The application runs full-stack at `http://localhost:3000`.

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Production Run**:
   ```bash
   npm start
   ```

---

## 4. Vercel Deployment Instructions

1. **Push Code to Git Repository** (GitHub, GitLab, or Bitbucket).
2. **Import Project to Vercel**:
   - Framework Preset: **Vite** or **Other**.
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Configure Environment Variables in Vercel**:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Secret Key.
   - `SESSION_SECRET`: A secure random cryptographic string.
4. **Deploy**:
   - Click **Deploy**. Vercel will build the frontend bundle and serve the application globally.

---

## 5. Verification & Testing Checklist

- [x] **Production Build**: `npm run build` and `npm run lint` succeed with zero errors.
- [x] **Minimalist Design & Palette**: Deep navy (`#0A192F`), warm white (`#FAF9F6`), muted gold (`#D4AF37`), zero-pill metadata discipline, restrained typography.
- [x] **Public Candidacy Gateway**:
  - Full application form with corporate/individual types, client network background, objectives, terms, and privacy checkboxes.
  - Client-side and server-side validation.
  - Generates institutional reference (`R3-APP-2026-XXXX`).
  - Strict duplicate prevention for active or pending emails.
- [x] **Application Status Tool**:
  - Track candidacy status by reference number and corporate email.
- [x] **Referral Link Attribution**:
  - Visiting `/?ref=ALEXANDER-R3` logs the referral click, increments unique visitor counter, displays referral attribution banner, and attaches partner key to prospective inquiries.
- [x] **Private Affiliate Dashboard**:
  - Accessible only to activated affiliates.
  - Displays Affiliate Number (`R3-AFF-2041`), status, referral clicks, unique visitors, leads generated, verified conversions, approved commissions, and paid settlements.
  - Affiliates cannot self-approve conversions, alter rates, or mark payouts.
- [x] **Administration Area**:
  - Server-side role enforcement (`super_admin`, `affiliate_manager`, `finance_manager`).
  - Review queue: update statuses (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `INFORMATION_REQUESTED`).
  - Activation: provisions live affiliate ID, referral code, and authorized rate.
  - Conversion verification: verify or reverse with compliance notes.
  - Commission engine: calculate commissions strictly using verified transactions and approved active rules.
  - Payout management: compile payout batches, record wire references (`WIRE-R3-XXXX`).
  - Immutable audit logs recording actor, action, timestamp, and IP.
- [x] **Mobile & Responsive Layout**: Responsive navigation and data grids tested for tablet and mobile viewports.

---

## 6. Business Decisions Requiring R3 Formal Approval

Before launching public commercial marketing, R3 leadership and legal counsel should formally approve the following items:

1. **Active Commission Rate Schedules**:
   - The platform includes configurable rules (e.g., standard 10% on executive retainers). Unapproved commercial rules remain inactive. R3 Board of Governance must confirm active percentage tiers for sovereign and institutional engagements.
2. **KYC & Due Diligence Thresholds**:
   - Confirm third-party PEP (Politically Exposed Persons) and sanctions screening API integrations (e.g., ComplyAdvantage, LexisNexis Bridger).
3. **Banking Settlement Window**:
   - Formalize whether affiliate commission payouts are disbursed on a Net-30 or Net-60 cycle post-retainer clearance.
4. **Joining Fee Confirmation**:
   - As mandated by the prompt, no affiliate joining fee has been published. If R3 institutes an accredited partner joining fee, it must be configured in the administrative policy engine.
