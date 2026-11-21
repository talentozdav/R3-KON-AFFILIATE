/**
 * R3 Contingencies Corporate & Affiliate Platform
 * Comprehensive Verification & Automated Test Suite
 *
 * Verifies all 21 functional criteria:
 * 1. Health check & database connectivity
 * 2. Administrative login & token generation (services@r3-konaffiliate.online)
 * 3. Client corporate registration & R3-CLT reference number
 * 4. Client duplicate registration prevention (409 Conflict)
 * 5. Client portal login & session token
 * 6. Client confidential advisory inquiry submission
 * 7. Affiliate candidate application submission & R3-APP reference
 * 8. Affiliate duplicate application prevention (409 Conflict)
 * 9. RBAC unauthenticated protection (401 Unauthorized)
 * 10. Administrative program overview metrics aggregation
 * 11. Administrative application review workflow (SUBMITTED -> APPROVED)
 * 12. Administrative affiliate activation & referral code generation
 * 13. Duplicate affiliate activation prevention (400 Bad Request)
 * 14. Referral link tracking & visitor uniqueness
 * 15. Referral lead attribution to active partner
 * 16. Manual verified contingency conversion recording
 * 17. Mathematical commission calculation & approval (12.5% on $100k = $12,500)
 * 18. Payout batch preparation & commission locking
 * 19. Payout banking settlement (Fedwire US reference)
 * 20. Client CRM staff notes & followups
 * 21. Non-HTML JSON error handling & governance audit logging
 */

process.env.NODE_ENV = 'test';

import http from 'http';
import { app } from '../server.js';
import { db as devDb, hashPassword } from '../server/db.js';
import {
  extractProjectRef,
  resolveSupabaseConfig,
  setSupabaseAdminForTesting,
  createClientActivationToken,
  resolveAppOrigin
} from '../server/supabase.js';
import { validateInternationalPhone as validateServerPhone } from '../server/utils/validation.js';
import {
  COUNTRIES,
  getDialCodeForCountry,
  validateInternationalPhone as validateClientPhone,
  formatInternationalDate,
  formatInternationalTimestampUTC,
  formatCurrencyAmount
} from '../src/lib/international.js';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function makeRequest(
  serverUrl: string,
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const postData = body ? JSON.stringify(body) : '';

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            raw: data
          });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`  [PASS] ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({ name, passed: false, details: err.message, durationMs: Date.now() - start });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function runSuite() {
  console.log('\n=============================================================');
  console.log(' R3 CONTINGENCIES — PRODUCTION VERIFICATION & TEST SUITE');
  console.log('=============================================================\n');

  // Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const serverUrl = `http://127.0.0.1:${address.port}`;

  const testEmail = `test.partner.${Date.now()}@contingency-partners.com`;
  const clientEmail = `test.client.${Date.now()}@corporate-client.org`;
  let adminAuthHeader: Record<string, string> = {};
  let clientAuthHeader: Record<string, string> = {};

  let createdAppId = '';
  let activatedAffiliateId = '';
  let activatedAffiliateCode = '';
  let createdConversionId = '';
  let createdCommissionId = '';
  let createdPayoutId = '';
  let clientRegistrationId = '';

  try {
    // 1. Health check & Database Status
    await runTest('1. Health check endpoint responds with operational status & database verification', async () => {
      const res = await makeRequest(serverUrl, 'GET', '/api/health');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.status) throw new Error('Missing status property in response');
      if (!res.body.database) throw new Error('Missing database status check in health response');
    });

    // 2. Admin Login
    await runTest('2. Admin authenticates via /api/admin/login with production governance credentials', async () => {
      const res = await makeRequest(serverUrl, 'POST', '/api/admin/login', {
        email: 'services@r3-konaffiliate.online',
        password: 'R3Network@2026!'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.token) throw new Error('Missing session token in login response');
      if (res.body.user?.role !== 'super_admin') throw new Error(`Expected super_admin role, got ${res.body.user?.role}`);
      adminAuthHeader = { Authorization: `Bearer ${res.body.token}` };
    });

  let clientRefNumber = '';

    // 3. Client registration & reference number
    await runTest('3. Client corporate registration generates valid R3-CLT reference & linked inquiry', async () => {
      const payload = {
        fullName: 'Director Victoria Vance',
        email: clientEmail,
        phone: '+1 (555) 234-5678',
        company: 'Vance Capital Holdings LLC',
        country: 'United States (Delaware)',
        serviceCategory: 'contingency_management',
        requirementsBrief: 'Seeking U.S. Delaware trust asset protection and domestic escrow structuring.'
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/client/register', payload);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      const refNum = res.body.referenceNumber || res.body.client?.referenceNumber;
      if (!refNum || !refNum.startsWith('R3-CLT-')) throw new Error(`Invalid reference number: ${refNum}`);
      if (res.body.registrationSaved !== true) throw new Error('Expected registrationSaved === true');
      if (!res.body.inquiryReferenceNumber?.startsWith('R3-INQ-')) {
        throw new Error(`Expected linked inquiryReferenceNumber, got ${res.body.inquiryReferenceNumber}`);
      }
      if (res.body.emailStatus !== 'sent' && res.body.emailStatus !== 'queued') {
        throw new Error(`Expected emailStatus sent|queued, got ${res.body.emailStatus}`);
      }
      clientRegistrationId = res.body.registrationId || res.body.client?.id;
      clientRefNumber = refNum;
    });

    // 4. Client duplicate registration prevention
    await runTest('4. Duplicate client registration is rejected with 409 Conflict', async () => {
      const payload = {
        fullName: 'Director Victoria Vance',
        email: clientEmail,
        country: 'United States (Delaware)',
        serviceCategory: 'contingency_management'
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/client/register', payload);
      if (res.status !== 409) throw new Error(`Expected 409 Conflict, got ${res.status}`);
    });

    // 5. Client Activation & Login (with mandatory invitation token enforcement)
    await runTest('5. Client activation rejects public token-less requests and succeeds with valid invitation token', async () => {
      // Negative check 1: public request without invitation token must be rejected
      const unauthActRes = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
        email: clientEmail,
        referenceNumber: clientRefNumber,
        password: 'ClientPassword2026!'
      });
      if (unauthActRes.status !== 401 && unauthActRes.status !== 403) {
        throw new Error(`Expected 401/403 without invitation token, got ${unauthActRes.status}`);
      }

      // Negative check 2: forged / mismatched token must be rejected
      const badTokenRes = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
        email: clientEmail,
        referenceNumber: clientRefNumber,
        token: 'tampered.invalid-signature',
        password: 'ClientPassword2026!'
      });
      if (badTokenRes.status !== 401 && badTokenRes.status !== 403) {
        throw new Error(`Expected 401/403 with invalid token, got ${badTokenRes.status}`);
      }

      // Positive check: activate using validly signed invitation token
      const validInviteToken = createClientActivationToken({
        registrationId: clientRegistrationId,
        referenceNumber: clientRefNumber,
        email: clientEmail
      });

      const actRes = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
        email: clientEmail,
        referenceNumber: clientRefNumber,
        token: validInviteToken,
        password: 'ClientPassword2026!'
      });
      if (actRes.status !== 200) throw new Error(`Activation failed: ${actRes.status}: ${JSON.stringify(actRes.body)}`);

      // Login
      const loginRes = await makeRequest(serverUrl, 'POST', '/api/client/login', {
        email: clientEmail,
        password: 'ClientPassword2026!'
      });
      if (loginRes.status !== 200) throw new Error(`Login failed: ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
      if (!loginRes.body.token) throw new Error('Missing client token');
      clientAuthHeader = { Authorization: `Bearer ${loginRes.body.token}` };
    });

    // 6. Client Inquiry Submission
    await runTest('6. Authenticated client submits operational advisory inquiry', async () => {
      const payload = {
        serviceInterest: 'contingency_management',
        briefSummary: 'Immediate escrow verification and compliance structuring.',
        priority: 'urgent',
        country: 'United States (Delaware)'
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/client/inquiries', payload, clientAuthHeader);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.referenceNumber?.startsWith('R3-INQ-')) throw new Error(`Invalid inquiry ref: ${res.body.referenceNumber}`);
    });

    // 7. Affiliate Application Submission
    await runTest('7. Affiliate candidate application creates valid R3-APP reference', async () => {
      const payload = {
        fullName: 'Alexander Sterling',
        applicantType: 'Individual',
        email: testEmail,
        phone: '+1 (415) 890-1234',
        country: 'United States (New York)',
        partnershipCategory: 'wealth_advisory',
        industryBackground: 'Registered U.S. wealth advisory and corporate fiduciary structuring across New York and Delaware over 15 years.',
        audienceDescription: 'Family offices, high-net-worth principals, and private institutional trustees.',
        partnershipObjectives: 'Introduce qualified U.S. corporate and private clients requiring complex contingency structuring.',
        termsAccepted: true,
        privacyAccepted: true
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/applications', payload);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.referenceNumber?.startsWith('R3-APP-')) throw new Error(`Invalid app ref: ${res.body.referenceNumber}`);
      createdAppId = res.body.application?.id;
    });

    // 8. Affiliate Duplicate Application Prevention
    await runTest('8. Duplicate affiliate application is rejected with 409 Conflict', async () => {
      const payload = {
        fullName: 'Alexander Sterling',
        applicantType: 'Individual',
        email: testEmail,
        phone: '+1 (415) 890-1234',
        country: 'United States (New York)',
        partnershipCategory: 'wealth_advisory',
        industryBackground: 'Registered U.S. wealth advisory and corporate fiduciary structuring across New York and Delaware over 15 years.',
        audienceDescription: 'Family offices, high-net-worth principals, and private institutional trustees.',
        partnershipObjectives: 'Introduce qualified U.S. corporate and private clients requiring complex contingency structuring.',
        termsAccepted: true,
        privacyAccepted: true
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/applications', payload);
      if (res.status !== 409) throw new Error(`Expected 409 Conflict, got ${res.status}`);
    });

    // 9. RBAC Unauthenticated Protection
    await runTest('9. Unauthenticated request to administrative routes returns 401 Unauthorized', async () => {
      const res = await makeRequest(serverUrl, 'GET', '/api/admin/overview');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 10. Admin Overview Metrics
    await runTest('10. Authorized admin retrieves program overview metrics', async () => {
      const res = await makeRequest(serverUrl, 'GET', '/api/admin/overview', null, adminAuthHeader);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (typeof res.body.metrics?.totalApplications !== 'number') throw new Error('Missing metrics.totalApplications');
    });

    // 11. Admin Review Application (SUBMITTED -> APPROVED)
    await runTest('11. Admin reviews and approves affiliate application', async () => {
      const res = await makeRequest(
        serverUrl,
        'POST',
        `/api/admin/applications/${createdAppId}/review`,
        { status: 'APPROVED', statusNotes: 'Verified professional accreditation and compliance credentials.' },
        adminAuthHeader
      );
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.application.status !== 'APPROVED') throw new Error(`Status not approved: ${res.body.application.status}`);
    });

    // 12. Admin Activate Approved Application into Affiliate Partner
    await runTest('12. Admin activates approved candidate into active affiliate partner', async () => {
      const customCode = `STERLING-${Math.floor(100 + Math.random() * 900)}`;
      const res = await makeRequest(
        serverUrl,
        'POST',
        `/api/admin/applications/${createdAppId}/activate`,
        { customCode, approvedRatePercent: 12.5 },
        adminAuthHeader
      );
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.affiliate?.affiliateNumber?.startsWith('R3-AFF-')) throw new Error('Missing affiliateNumber');
      activatedAffiliateId = res.body.affiliate.id;
      activatedAffiliateCode = res.body.affiliate.referralCode;
    });

    // 13. Duplicate Affiliate Activation Prevention
    await runTest('13. Re-activation of already activated candidate returns 400 Bad Request', async () => {
      const res = await makeRequest(
        serverUrl,
        'POST',
        `/api/admin/applications/${createdAppId}/activate`,
        { customCode: 'RETRY-CODE' },
        adminAuthHeader
      );
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // 14. Referral Click Tracking & Uniqueness
    await runTest('14. Tracking referral click records unique visitor and increments counter', async () => {
      const hash1 = `visitor_${Date.now()}_A`;
      const res1 = await makeRequest(serverUrl, 'POST', '/api/referrals/track', {
        code: activatedAffiliateCode,
        visitorHash: hash1,
        referer: 'https://us-fiduciary-advisors.com'
      });
      if (res1.status !== 200 || !res1.body.success) throw new Error(`Click tracking failed: ${JSON.stringify(res1.body)}`);
      if (!res1.body.isUnique) throw new Error('Expected first visit to be unique');

      // Duplicate visit from same visitor
      const res2 = await makeRequest(serverUrl, 'POST', '/api/referrals/track', {
        code: activatedAffiliateCode,
        visitorHash: hash1
      });
      if (res2.body.isUnique === true) throw new Error('Repeat visit should not be marked unique');
    });

    // 15. Referral Lead Attribution
    await runTest('15. Referral inquiry submission attributes lead to affiliate partner', async () => {
      const payload = {
        referralCode: activatedAffiliateCode,
        clientName: 'Delaware Capital Trust',
        organization: 'Delaware Capital Trust LLC',
        email: 'compliance@delaware-trust.com',
        phone: '+1 (212) 555-0199',
        country: 'United States (Delaware)',
        serviceInterest: 'contingency_management',
        briefSummary: 'U.S. corporate contingency restructuring and SEC/FinCEN compliance advisory.'
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/referrals/inquire', payload);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.referenceNumber?.startsWith('R3-INQ-')) throw new Error('Missing inquiry reference');
      if (!res.body.leadAttributed) throw new Error('Lead attribution flag missing');
    });

    // 16. Manual Verified Conversion Creation
    await runTest('16. Admin logs verified contingency settlement conversion', async () => {
      const payload = {
        affiliateId: activatedAffiliateId,
        membershipTierOrCategory: 'contingency_management',
        eligibleSaleAmount: 100000,
        verificationNotes: 'Settlement confirmed via wire transfer to client escrow account.'
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/admin/conversions/create', payload, adminAuthHeader);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.conversion?.id) throw new Error('Missing conversion ID');
      createdConversionId = res.body.conversion.id;
    });

    // 17. Mathematical Commission Calculation (12.5% on $100,000 = $12,500.00)
    await runTest('17. Finance engine generates mathematically accurate commission ($12,500 on $100k at 12.5%)', async () => {
      const payload = {
        conversionId: createdConversionId,
        customRate: 12.5
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/admin/commissions/generate', payload, adminAuthHeader);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      const comm = res.body.commission;
      const expectedAmount = 12500;
      const actualAmount = Number(comm.commission_amount || comm.commissionAmount);
      if (actualAmount !== expectedAmount) {
        throw new Error(`Calculated commission mismatch: expected $${expectedAmount}, got $${actualAmount}`);
      }
      createdCommissionId = comm.id;
    });

    // 18. Commission Approval Workflow
    await runTest('18. Finance approval confirms commission readiness for disbursement', async () => {
      const res = await makeRequest(
        serverUrl,
        'POST',
        `/api/admin/commissions/${createdCommissionId}/action`,
        { action: 'approve', auditReason: 'Compliance audit cleared.' },
        adminAuthHeader
      );
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      const status = res.body.commission?.status;
      if (status !== 'approved') throw new Error(`Expected status approved, got ${status}`);
    });

    // 19. Payout Batch Preparation & Commission Locking
    await runTest('19. Preparing payout batch aggregates approved commissions and schedules disbursement', async () => {
      const payload = {
        affiliateId: activatedAffiliateId,
        payoutPeriod: 'Current Month Settlement',
        paymentMethod: 'Fedwire (Domestic US)'
      };
      const res = await makeRequest(serverUrl, 'POST', '/api/admin/payouts/prepare', payload, adminAuthHeader);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      const payout = res.body.payout;
      if (Number(payout.amount) !== 12500) throw new Error(`Expected payout amount 12500, got ${payout.amount}`);
      createdPayoutId = payout.id;
    });

    // 20. Payout Banking Settlement
    await runTest('20. Recording banking wire payment marks payout and linked commissions as paid', async () => {
      const payload = {
        paymentReference: 'FEDWIRE-NY-2026-992014',
        notes: 'Disbursed via JPMorgan Chase U.S. Fedwire.'
      };
      const res = await makeRequest(
        serverUrl,
        'POST',
        `/api/admin/payouts/${createdPayoutId}/record-payment`,
        payload,
        adminAuthHeader
      );
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.payout.status !== 'paid') throw new Error(`Expected paid status, got ${res.body.payout.status}`);
    });

    // 21. Client CRM Staff Notes & Followups
    await runTest('21. Administrative staff notes and followups are recorded for client CRM record', async () => {
      const noteRes = await makeRequest(
        serverUrl,
        'POST',
        '/api/admin/client-notes',
        {
          registrationId: clientRegistrationId,
          noteType: 'compliance',
          content: 'Verified corporate registration documents and beneficial ownership.'
        },
        adminAuthHeader
      );
      if (noteRes.status !== 201) throw new Error(`Note creation failed: ${noteRes.status}`);

      const followupRes = await makeRequest(
        serverUrl,
        'POST',
        '/api/admin/client-followups',
        {
          registrationId: clientRegistrationId,
          title: 'Review signed mandate agreement',
          dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
          priority: 'high'
        },
        adminAuthHeader
      );
      if (followupRes.status !== 201) throw new Error(`Followup creation failed: ${followupRes.status}`);
    });

    // 22. Non-HTML JSON Error Responses on Unknown Endpoints
    await runTest('22. Unknown API routes return structured JSON error instead of HTML 404', async () => {
      const res = await makeRequest(serverUrl, 'GET', '/api/unmapped-endpoint-test');
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      if (typeof res.body !== 'object' || !res.body.error) {
        throw new Error(`Expected JSON error response, got: ${res.raw.substring(0, 100)}`);
      }
    });

    // 23. Audit Trail Logging
    await runTest('23. Audit logs capture full governance trail across all operations', async () => {
      const res = await makeRequest(serverUrl, 'GET', '/api/admin/audit-logs', null, adminAuthHeader);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.auditLogs) || res.body.auditLogs.length === 0) {
        throw new Error('Audit logs array empty or missing');
      }
    });

    // 24. Supabase Configuration & Project Reference Resolution
    await runTest('24. Supabase config rejects anon-key admin fallback and resolves mxzjanjdwnhonqensnsw dynamically', async () => {
      if (extractProjectRef('https://mxzjanjdwnhonqensnsw.supabase.co') !== 'mxzjanjdwnhonqensnsw') {
        throw new Error('Failed to extract project ref from Supabase URL');
      }

      // Missing secret key even when publishable/anon key exists must NOT mark server configured
      const missingSecret = resolveSupabaseConfig({
        SUPABASE_URL: 'https://mxzjanjdwnhonqensnsw.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
        NODE_ENV: 'production'
      }, true);
      if (missingSecret.status.isConfigured || missingSecret.supabaseServiceKey) {
        throw new Error('Server config must never fall back to publishable/anon key when secret key is missing');
      }

      // Missing SUPABASE_URL in production must NOT fall back to VITE_SUPABASE_URL
      const missingServerUrl = resolveSupabaseConfig({
        VITE_SUPABASE_URL: 'https://mxzjanjdwnhonqensnsw.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test_only',
        NODE_ENV: 'production'
      }, true);
      if (missingServerUrl.status.isConfigured) {
        throw new Error('Production config must require SUPABASE_URL rather than falling back to VITE_SUPABASE_URL');
      }

      // Valid server configuration
      const valid = resolveSupabaseConfig({
        SUPABASE_URL: 'https://mxzjanjdwnhonqensnsw.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test_only',
        NODE_ENV: 'production'
      }, true);
      if (!valid.status.isConfigured || valid.status.projectRef !== 'mxzjanjdwnhonqensnsw') {
        throw new Error('Valid server Supabase configuration failed verification');
      }
    });

    // 25. Simulated DB Insert Failure on Affiliate Application
    await runTest('25. Failed database insert on /api/applications returns 500 with no fabricated reference number', async () => {
      const mockFailingClient: any = {
        from: () => ({
          select: () => ({
            ilike: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null })
                })
              })
            }),
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null })
                })
              }),
              maybeSingle: async () => ({ data: null, error: null })
            })
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: { message: 'Simulated PostgreSQL insert failure' } })
            })
          })
        })
      };

      setSupabaseAdminForTesting(mockFailingClient);
      try {
        const res = await makeRequest(serverUrl, 'POST', '/api/applications', {
          fullName: 'DB Failure Check Applicant',
          applicantType: 'Individual',
          email: `dbfail.${Date.now()}@test-partner.org`,
          phone: '+1 (212) 555-0144',
          country: 'United States (New York)',
          partnershipCategory: 'wealth_advisory',
          industryBackground: 'Twenty years advising U.S. institutional family offices and private fiduciary trustees.',
          audienceDescription: 'North American private equity principals, family offices, and sovereign trustees.',
          partnershipObjectives: 'Establish compliant bilateral referral arrangements for U.S. contingency retainers.',
          termsAccepted: true,
          privacyAccepted: true
        });

        if (res.status !== 500) {
          throw new Error(`Expected HTTP 500 on DB insert failure, got ${res.status}: ${JSON.stringify(res.body)}`);
        }
        if (!String(res.body.message || '').includes('Simulated PostgreSQL insert failure')) {
          throw new Error(`Expected insert failure message, got: ${JSON.stringify(res.body)}`);
        }
        if (res.body.referenceNumber || res.body.success) {
          throw new Error(`Endpoint fabricated referenceNumber or success on DB failure: ${JSON.stringify(res.body)}`);
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }
    });

    // 26. Simulated DB Insert Failure on Client Registration
    await runTest('26. Failed database insert on /api/client/register returns 500 with no fabricated reference number', async () => {
      const mockFailingClient: any = {
        from: () => ({
          select: () => ({
            ilike: () => ({
              order: async () => ({ data: [], error: null })
            })
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: { message: 'Simulated CRM table insert failure' } })
            })
          })
        })
      };

      setSupabaseAdminForTesting(mockFailingClient);
      try {
        const res = await makeRequest(serverUrl, 'POST', '/api/client/register', {
          fullName: 'CRM Failure Principal',
          email: `crmfail.${Date.now()}@corporate-client.org`,
          country: 'United States (Texas)',
          serviceCategory: 'contingency_management'
        });

        if (res.status !== 500) {
          throw new Error(`Expected HTTP 500 on CRM insert failure, got ${res.status}: ${JSON.stringify(res.body)}`);
        }
        if (!String(res.body.message || '').includes('Simulated CRM table insert failure')) {
          throw new Error(`Expected CRM insert failure message, got: ${JSON.stringify(res.body)}`);
        }
        if (res.body.referenceNumber || res.body.success) {
          throw new Error(`Client register fabricated referenceNumber or success on DB failure: ${JSON.stringify(res.body)}`);
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }
    });

    // 27. Input Validation Checks
    await runTest('27. Invalid registration payloads return 400 Bad Request with structured validation details', async () => {
      const appRes = await makeRequest(serverUrl, 'POST', '/api/applications', {
        fullName: 'A',
        email: 'invalid-email'
      });
      if (appRes.status !== 400 || !appRes.body.details) {
        throw new Error(`Expected 400 with details for invalid application, got ${appRes.status}`);
      }

      const clientRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: 'X',
        email: 'bad'
      });
      if (clientRes.status !== 400 || !clientRes.body.details) {
        throw new Error(`Expected 400 with details for invalid client registration, got ${clientRes.status}`);
      }
    });

    // 28. Role Separation & Activation Takeover Prevention
    await runTest('28. RBAC blocks clients from admin/affiliate routes and blocks re-activation takeover', async () => {
      const adminRes = await makeRequest(serverUrl, 'GET', '/api/admin/overview', null, clientAuthHeader);
      if (adminRes.status !== 403) {
        throw new Error(`Expected 403 for client accessing /api/admin/overview, got ${adminRes.status}`);
      }

      const affRes = await makeRequest(
        serverUrl,
        'GET',
        `/api/affiliates/portal?affiliateId=${activatedAffiliateId}`,
        null,
        clientAuthHeader
      );
      if (affRes.status !== 403) {
        throw new Error(`Expected 403 for client accessing /api/affiliates/portal, got ${affRes.status}`);
      }

      const retakeRes = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
        email: clientEmail,
        password: 'HijackAttemptPassword1!'
      });
      if (retakeRes.status !== 409) {
        throw new Error(`Expected 409 Conflict preventing re-activation takeover, got ${retakeRes.status}`);
      }
    });

    // 29. Strict Separation of Affiliate Applications vs Ordinary Client Registrations
    await runTest('29. Admin endpoints strictly separate R3-APP Applications from R3-CLT Client CRM records', async () => {
      const appsRes = await makeRequest(serverUrl, 'GET', '/api/admin/applications', null, adminAuthHeader);
      const clientsRes = await makeRequest(serverUrl, 'GET', '/api/admin/client-registrations', null, adminAuthHeader);

      if (appsRes.status !== 200 || clientsRes.status !== 200) {
        throw new Error('Failed to fetch admin datasets for separation check');
      }

      const appsList = appsRes.body.applications || [];
      const clientsList = clientsRes.body.registrations || [];

      if (appsList.some((a: any) => String(a.referenceNumber).startsWith('R3-CLT-'))) {
        throw new Error('Client registration leaked into affiliate applications queue');
      }
      if (clientsList.some((c: any) => String(c.referenceNumber).startsWith('R3-APP-'))) {
        throw new Error('Affiliate application leaked into Client CRM queue');
      }
    });

    // 30. Supabase Client Registration Inserts into client_registrations + linked client_inquiries (NEVER affiliate_applications) & handles email failure gracefully
    await runTest('30. Supabase CRM client registration writes client_registrations + linked client_inquiries + referral_leads & succeeds when email is queued', async () => {
      const insertedTables: string[] = [];
      let capturedInquiryRow: any = null;
      let capturedLeadRow: any = null;
      let capturedRedirectTo = '';
      const fixedRegId = '11111111-2222-3333-4444-555555555555';

      const mockCrmSupabase: any = {
        auth: {
          admin: {
            generateLink: async (opts: any) => {
              capturedRedirectTo = opts?.options?.redirectTo || '';
              return { data: { properties: { action_link: capturedRedirectTo } }, error: null };
            }
          }
        },
        from: (table: string) => {
          return {
            select: () => ({
              ilike: () => ({
                order: async () => ({ data: [], error: null })
              }),
              eq: (_col: string, val: any) => ({
                maybeSingle: async () => {
                  if (table === 'affiliates') {
                    return {
                      data: {
                        id: 'aff-mock-1',
                        affiliate_number: 'R3-AFF-9001',
                        user_id: 'usr-aff-1',
                        full_name: 'Mock Advisor',
                        email: 'advisor@firm.com',
                        referral_code: String(val).toUpperCase(),
                        status: 'active',
                        approved_rate_percent: 10,
                        total_clicks: 0,
                        unique_visitors: 0,
                        joined_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      },
                      error: null
                    };
                  }
                  return { data: null, error: null };
                }
              })
            }),
            insert: (row: any) => {
              insertedTables.push(table);
              if (table === 'affiliate_applications') {
                throw new Error('CRITICAL VIOLATION: client registration wrote to affiliate_applications!');
              }
              if (table === 'client_inquiries') {
                capturedInquiryRow = row;
              }
              if (table === 'referral_leads') {
                capturedLeadRow = row;
              }
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      ...row,
                      id: table === 'client_registrations' ? fixedRegId : `${table}_id_1`,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    },
                    error: null
                  })
                }),
                then: (onFulfilled: any) => Promise.resolve({ error: null }).then(onFulfilled)
              };
            },
            update: () => ({
              eq: async () => ({ error: null })
            }),
            delete: () => ({
              eq: async () => ({ error: null })
            })
          };
        }
      };

      const prevAppUrl = process.env.APP_URL;
      delete process.env.APP_URL;
      setSupabaseAdminForTesting(mockCrmSupabase);
      try {
        const res = await makeRequest(serverUrl, 'POST', '/api/client/register', {
          fullName: 'Evelyn Mercer',
          email: `evelyn.mercer.${Date.now()}@mercertrust.us`,
          phone: '+1 (212) 555-0188',
          company: 'Mercer Fiduciary Partners LLC',
          country: 'United States (New York)',
          serviceCategory: 'Executive Contingency Retainer',
          requirementsBrief: 'Delaware & NY corporate contingency coordination.',
          referralCode: 'PARTNER-R3'
        });

        if (res.status !== 201) {
          throw new Error(`Expected 201 even when RESEND_API_KEY is absent/queued, got ${res.status}: ${JSON.stringify(res.body)}`);
        }
        if (!insertedTables.includes('client_registrations') || !insertedTables.includes('client_inquiries')) {
          throw new Error(`Missing required CRM table inserts: ${insertedTables.join(', ')}`);
        }
        if (insertedTables.includes('affiliate_applications')) {
          throw new Error('Client registration wrote to affiliate_applications');
        }
        if (!capturedInquiryRow || capturedInquiryRow.registration_id !== fixedRegId) {
          throw new Error(`client_inquiries.registration_id mismatch: expected ${fixedRegId}, got ${capturedInquiryRow?.registration_id}`);
        }
        if (!capturedLeadRow || capturedLeadRow.referral_code !== 'PARTNER-R3') {
          throw new Error('Referral attribution did not record referral_leads entry');
        }
        if (!capturedRedirectTo.startsWith('https://r3-konaffiliate.online/client-portal?')) {
          throw new Error(`Invitation redirect URL must use https://r3-konaffiliate.online, got: ${capturedRedirectTo}`);
        }
        if (!capturedRedirectTo.includes('token=')) {
          throw new Error('Invitation redirect URL must embed a signed activation token');
        }
        if (res.body.registrationSaved !== true || res.body.emailSent !== false || res.body.emailStatus !== 'queued') {
          throw new Error(`Expected honest emailSent=false & emailStatus=queued, got: ${JSON.stringify(res.body)}`);
        }
      } finally {
        setSupabaseAdminForTesting(null);
        if (prevAppUrl !== undefined) process.env.APP_URL = prevAppUrl;
      }
    });

    // 31. Prevent password overwrite of already-confirmed/existing auth accounts via /api/client/activate
    await runTest('31. /api/client/activate blocks overwriting password of existing active auth user', async () => {
      const regId = '99999999-2222-3333-4444-555555555555';
      const refNum = 'R3-CLT-2026-8888';
      const targetEmail = 'existing.confirmed.user@enterprise.com';
      let updateCalled = false;

      const mockConflictSupabase: any = {
        auth: {
          admin: {
            listUsers: async () => ({
              data: {
                users: [
                  {
                    id: 'auth-existing-user-1',
                    email: targetEmail,
                    email_confirmed_at: new Date().toISOString(),
                    last_sign_in_at: new Date().toISOString(),
                    user_metadata: { role: 'client' }
                  }
                ]
              },
              error: null
            }),
            updateUserById: async () => {
              updateCalled = true;
              return { error: null };
            }
          }
        },
        from: (table: string) => ({
          select: () => ({
            ilike: () => ({
              order: async () => ({
                data: table === 'client_registrations' ? [{
                  id: regId,
                  reference_number: refNum,
                  full_name: 'Existing User',
                  email: targetEmail,
                  country: 'United States',
                  service_category: 'Executive Contingency Retainer',
                  status: 'PENDING',
                  invitation_status: 'sent',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }] : [],
                error: null
              })
            }),
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            })
          })
        })
      };

      setSupabaseAdminForTesting(mockConflictSupabase);
      try {
        const validToken = createClientActivationToken({
          registrationId: regId,
          referenceNumber: refNum,
          email: targetEmail
        });
        const res = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
          email: targetEmail,
          referenceNumber: refNum,
          token: validToken,
          password: 'AttackerPassword2026!'
        });

        if (res.status !== 409) {
          throw new Error(`Expected 409 Conflict for existing confirmed user, got ${res.status}: ${JSON.stringify(res.body)}`);
        }
        if (updateCalled) {
          throw new Error('SECURITY FAILURE: updateUserById was called on an existing active user!');
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }
    });

    // 32. Production domain origin resolver check
    await runTest('32. Production domain resolves strictly to https://r3-konaffiliate.online', async () => {
      const prevAppUrl = process.env.APP_URL;
      delete process.env.APP_URL;
      try {
        const resolved = resolveAppOrigin({ headers: {} });
        if (resolved !== 'https://r3-konaffiliate.online') {
          throw new Error(`Expected https://r3-konaffiliate.online, got ${resolved}`);
        }
      } finally {
        if (prevAppUrl !== undefined) process.env.APP_URL = prevAppUrl;
      }
    });

    // 33. Business / Corporate Affiliate Application (Supabase insert + validation + non-auto-approval + admin visibility)
    await runTest('33. Business/Corporate affiliate application validates businessName, inserts into affiliate_applications (SUBMITTED), and renders in Admin queue', async () => {
      const insertedApps: any[] = [];
      const mockAppSupabase: any = {
        from: (table: string) => {
          if (table === 'affiliate_applications') {
            return {
              select: () => ({
                ilike: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null })
                    })
                  })
                }),
                order: async () => ({ data: insertedApps, error: null })
              }),
              insert: (row: any) => ({
                select: () => ({
                  single: async () => {
                    const created = {
                      ...row,
                      id: 'app-corp-mock-1',
                      submitted_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    };
                    insertedApps.push(created);
                    return { data: created, error: null };
                  }
                })
              })
            };
          }
          if (table === 'audit_logs') {
            return { insert: async () => ({ error: null }) };
          }
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            insert: async () => ({ error: null })
          };
        }
      };

      setSupabaseAdminForTesting(mockAppSupabase);
      try {
        // Missing businessName for Business applicant must return 400
        const invalidRes = await makeRequest(
          serverUrl,
          'POST',
          '/api/applications',
          {
            fullName: 'Jonathan Vance',
            applicantType: 'Business',
            email: `corp.missing.${Date.now()}@fiduciary.us`,
            phone: '+1 (312) 555-0190',
            country: 'United States (Illinois)',
            partnershipCategory: 'corporate_counsel',
            industryBackground: 'U.S. corporate M&A counsel and institutional risk practice spanning Chicago and Delaware.',
            audienceDescription: 'Mid-market private equity sponsors and family office general counsels.',
            partnershipObjectives: 'Establish formal corporate introducer arrangement for contingency engagements.',
            termsAccepted: true,
            privacyAccepted: true
          },
          { 'X-Forwarded-For': '10.10.0.33' }
        );
        if (invalidRes.status !== 400 || !invalidRes.body.details?.businessName) {
          throw new Error(`Expected 400 with details.businessName, got ${invalidRes.status}: ${JSON.stringify(invalidRes.body)}`);
        }

        const validRes = await makeRequest(
          serverUrl,
          'POST',
          '/api/applications',
          {
            fullName: 'Jonathan Vance',
            applicantType: 'Business',
            businessName: 'Vance Fiduciary Advisors LLC',
            email: `corp.aff.${Date.now()}@fiduciary.us`,
            phone: '+1 (312) 555-0191',
            country: 'United States (Illinois)',
            partnershipCategory: 'corporate_counsel',
            industryBackground: 'U.S. corporate M&A counsel and institutional risk practice spanning Chicago and Delaware.',
            audienceDescription: 'Mid-market private equity sponsors and family office general counsels.',
            partnershipObjectives: 'Establish formal corporate introducer arrangement for contingency engagements.',
            termsAccepted: true,
            privacyAccepted: true
          },
          { 'X-Forwarded-For': '10.10.0.34' }
        );
        if (validRes.status !== 201) {
          throw new Error(`Expected 201 for Business application, got ${validRes.status}: ${JSON.stringify(validRes.body)}`);
        }
        if (validRes.body.status !== 'SUBMITTED') {
          throw new Error(`Application must NOT be auto-approved; expected SUBMITTED, got ${validRes.body.status}`);
        }
        if (insertedApps.length !== 1 || insertedApps[0].applicant_type !== 'Business' || insertedApps[0].business_name !== 'Vance Fiduciary Advisors LLC') {
          throw new Error(`Inserted row missing corporate fields: ${JSON.stringify(insertedApps)}`);
        }

        const adminAppsRes = await makeRequest(serverUrl, 'GET', '/api/admin/applications', null, adminAuthHeader);
        if (adminAppsRes.status !== 200 || !adminAppsRes.body.applications?.some((a: any) => a.businessName === 'Vance Fiduciary Advisors LLC')) {
          throw new Error('Corporate affiliate application not visible in GET /api/admin/applications');
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }
    });

    // 34. Affiliate Self-Activation (Collision-free code generation, client_profiles protection, profiles + affiliates linkage)
    await runTest('34. Affiliate self-activation (/api/auth/activate) generates unique referral code, blocks client takeover, and provisions Supabase records', async () => {
      const appRef = 'R3-APP-2026-7741';
      const affEmail = `parker.activate.${Date.now()}@partner-advisory.us`;
      const insertedAffiliates: any[] = [];
      let linkedAppAffId: string | null = null;
      let upsertedProfile: any = null;

      const buildQueryMock = (table: string) => ({
        select: () => ({
          eq: (col: string, val: any) => ({
            ilike: () => ({
              maybeSingle: async () => ({
                data: table === 'affiliate_applications' && val === appRef ? {
                  id: 'app-act-1',
                  reference_number: appRef,
                  full_name: 'Parker Sterling',
                  applicant_type: 'Individual',
                  email: affEmail,
                  phone: '+1 (212) 555-0100',
                  country: 'United States',
                  partnership_category: 'wealth_advisory',
                  industry_background: 'US Advisory',
                  audience_description: 'US Family Offices',
                  partnership_objectives: 'Referrals',
                  terms_accepted: true,
                  privacy_accepted: true,
                  status: 'APPROVED',
                  submitted_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                } : null,
                error: null
              })
            }),
            maybeSingle: async () => {
              if (table === 'affiliates' && col === 'referral_code') {
                // Force STERLING-R3 collision so backend must emit STERLING-R3-2
                if (String(val).toUpperCase() === 'STERLING-R3') {
                  return { data: { id: 'existing-aff', referral_code: 'STERLING-R3' }, error: null };
                }
                return { data: null, error: null };
              }
              return { data: null, error: null };
            }
          }),
          ilike: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            }),
            maybeSingle: async () => ({ data: null, error: null })
          })
        }),
        upsert: async (row: any) => {
          if (table === 'profiles') upsertedProfile = row;
          return { error: null };
        },
        insert: (row: any) => {
          if (table === 'affiliates') {
            const created = {
              ...row,
              id: 'aff-new-7741',
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            insertedAffiliates.push(created);
            return {
              select: () => ({
                single: async () => ({ data: created, error: null })
              })
            };
          }
          return { error: null };
        },
        update: (row: any) => ({
          eq: async () => {
            if (table === 'affiliate_applications' && row.activated_affiliate_id) {
              linkedAppAffId = row.activated_affiliate_id;
            }
            return { error: null };
          }
        })
      });

      const mockActivateSupabase: any = {
        auth: {
          admin: {
            listUsers: async () => ({ data: { users: [] }, error: null }),
            createUser: async ({ email }: any) => ({
              data: { user: { id: 'auth-aff-uid-1', email } },
              error: null
            })
          },
          signInWithPassword: async () => ({
            data: { session: { access_token: 'mock-supabase-aff-jwt' } },
            error: null
          })
        },
        from: buildQueryMock
      };

      setSupabaseAdminForTesting(mockActivateSupabase);
      try {
        const res = await makeRequest(serverUrl, 'POST', '/api/auth/activate', {
          email: affEmail,
          referenceNumber: appRef,
          password: 'PartnerPassword2026!'
        });

        if (res.status !== 200 || !res.body.success) {
          throw new Error(`Expected 200 activation success, got ${res.status}: ${JSON.stringify(res.body)}`);
        }
        if (insertedAffiliates.length !== 1) {
          throw new Error('Expected affiliate record inserted into public.affiliates');
        }
        if (insertedAffiliates[0].referral_code !== 'STERLING-R3-2') {
          throw new Error(`Expected collision-free code STERLING-R3-2, got ${insertedAffiliates[0].referral_code}`);
        }
        if (!upsertedProfile || upsertedProfile.role !== 'affiliate') {
          throw new Error(`Expected profiles upsert with role=affiliate, got ${JSON.stringify(upsertedProfile)}`);
        }
        if (linkedAppAffId !== 'aff-new-7741') {
          throw new Error(`Expected affiliate_applications.activated_affiliate_id linkage, got ${linkedAppAffId}`);
        }
        if (res.body.token !== 'mock-supabase-aff-jwt') {
          throw new Error(`Expected Supabase session access_token returned, got ${res.body.token}`);
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }
    });

    // 35. Public Referral Intake (/api/referrals/inquire) writes client_registrations + linked client_inquiries + referral_leads
    await runTest('35. Referral intake (/api/referrals/inquire) validates inputs and commits to client_registrations, client_inquiries, and referral_leads', async () => {
      const insertedTables: string[] = [];
      let capturedInqRow: any = null;
      let capturedLeadRow: any = null;
      const mockIntakeSupabase: any = {
        from: (table: string) => ({
          select: () => ({
            eq: (_col: string, val: any) => ({
              maybeSingle: async () => {
                if (table === 'affiliates') {
                  return {
                    data: {
                      id: 'aff-ref-99',
                      affiliate_number: 'R3-AFF-0099',
                      user_id: 'uid-99',
                      full_name: 'Referrer Partner',
                      email: 'referrer@partner.us',
                      referral_code: String(val).toUpperCase(),
                      status: 'active',
                      approved_rate_percent: 10,
                      total_clicks: 5,
                      unique_visitors: 4,
                      joined_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    },
                    error: null
                  };
                }
                return { data: null, error: null };
              }
            }),
            ilike: () => ({
              order: async () => ({ data: [], error: null })
            })
          }),
          insert: (row: any) => {
            insertedTables.push(table);
            if (table === 'affiliate_applications') {
              throw new Error('Referral intake must NEVER insert into affiliate_applications');
            }
            if (table === 'client_inquiries') capturedInqRow = row;
            if (table === 'referral_leads') capturedLeadRow = row;
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    ...row,
                    id: table === 'client_registrations' ? 'reg-ref-555' : `${table}_1`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  },
                  error: null
                })
              }),
              then: (cb: any) => Promise.resolve({ error: null }).then(cb)
            };
          }
        })
      };

      setSupabaseAdminForTesting(mockIntakeSupabase);
      try {
        const badRes = await makeRequest(serverUrl, 'POST', '/api/referrals/inquire', {
          clientName: 'A',
          email: 'bad-email',
          serviceInterest: ''
        });
        if (badRes.status !== 400) {
          throw new Error(`Expected 400 validation failure for /api/referrals/inquire, got ${badRes.status}`);
        }

        const okRes = await makeRequest(serverUrl, 'POST', '/api/referrals/inquire', {
          referralCode: 'PARTNER-US',
          clientName: 'Harborview Institutional Trust',
          organization: 'Harborview Trust Corp',
          email: `intake.${Date.now()}@harborview.us`,
          phone: '+1 (617) 555-0142',
          country: 'United States (Massachusetts)',
          serviceInterest: 'Corporate Risk Advisory',
          briefSummary: 'Referred US corporate trustee intake.'
        });
        if (okRes.status !== 201 || !okRes.body.leadAttributed) {
          throw new Error(`Expected 201 with leadAttributed=true, got ${okRes.status}: ${JSON.stringify(okRes.body)}`);
        }
        if (!insertedTables.includes('client_registrations') || !insertedTables.includes('client_inquiries') || !insertedTables.includes('referral_leads')) {
          throw new Error(`Missing required inserts: ${insertedTables.join(', ')}`);
        }
        if (capturedInqRow?.registration_id !== 'reg-ref-555') {
          throw new Error(`Expected client_inquiries.registration_id=reg-ref-555, got ${capturedInqRow?.registration_id}`);
        }
        if (capturedLeadRow?.affiliate_id !== 'aff-ref-99') {
          throw new Error(`Expected referral_leads.affiliate_id=aff-ref-99, got ${capturedLeadRow?.affiliate_id}`);
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }
    });

    // 36. Affiliate Direct Lead Registration + Admin Referrals / Clicks Timestamp Ordering
    await runTest('36. Affiliate /submit-lead writes referral_leads and /admin/referrals queries referral_clicks.timestamp with camelCase DTO mapping', async () => {
      let clicksOrderCol = '';
      const storedLeads: any[] = [];
      const mockAffRow = {
        id: 'aff-lead-1',
        affiliate_number: 'R3-AFF-4411',
        user_id: 'uid-aff-lead-1',
        full_name: 'Direct Lead Partner',
        email: 'direct.partner@r3-partner.us',
        referral_code: 'DIRECT-R3',
        status: 'active',
        approved_rate_percent: 12.0,
        total_clicks: 10,
        unique_visitors: 8,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockLeadSupabase: any = {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'uid-aff-lead-1', email: 'direct.partner@r3-partner.us' } },
            error: null
          })
        },
        from: (table: string) => ({
          select: () => ({
            eq: (_col: string, val: any) => ({
              maybeSingle: async () => {
                if (table === 'profiles') {
                  return { data: { id: 'uid-aff-lead-1', email: 'direct.partner@r3-partner.us', full_name: 'Direct Lead Partner', role: 'affiliate', status: 'active' }, error: null };
                }
                if (table === 'affiliates') {
                  return { data: mockAffRow, error: null };
                }
                return { data: null, error: null };
              },
              order: async () => ({ data: table === 'referral_leads' ? storedLeads : [], error: null })
            }),
            order: (col: string) => {
              if (table === 'referral_clicks') {
                clicksOrderCol = col;
                return Promise.resolve({
                  data: [{
                    id: 'clk-1',
                    referral_code: 'DIRECT-R3',
                    affiliate_id: 'aff-lead-1',
                    visitor_hash: 'vh-1',
                    is_unique: true,
                    timestamp: new Date().toISOString()
                  }],
                  error: null
                });
              }
              return Promise.resolve({ data: table === 'referral_leads' ? storedLeads : [], error: null });
            }
          }),
          insert: (row: any) => {
            if (table === 'referral_leads') {
              const saved = { ...row, id: 'lead-direct-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
              storedLeads.push(saved);
              return { select: () => ({ single: async () => ({ data: saved, error: null }) }) };
            }
            return { error: null };
          }
        })
      };

      setSupabaseAdminForTesting(mockLeadSupabase);
      try {
        const leadRes = await makeRequest(
          serverUrl,
          'POST',
          '/api/affiliates/submit-lead',
          {
            clientIdentifier: 'Pacific Coast Logistics Corp',
            clientType: 'Corporate',
            region: 'United States (California)',
            serviceCategory: 'Executive Contingency Retainer',
            estimatedValue: 150000,
            notes: 'COO introduction scheduled'
          },
          { Authorization: 'Bearer mock-aff-token' }
        );

        if (leadRes.status !== 201 || leadRes.body.lead?.clientIdentifier !== 'Pacific Coast Logistics Corp') {
          throw new Error(`Expected 201 with camelCase lead DTO, got ${leadRes.status}: ${JSON.stringify(leadRes.body)}`);
        }

        const adminRefs = await makeRequest(
          serverUrl,
          'GET',
          '/api/admin/referrals',
          null,
          { Authorization: 'Bearer admin-dev-token' }
        );
        // Verify admin route with mocked profiles -> admin auth user
        if (adminRefs.status !== 403 && adminRefs.status !== 401 && adminRefs.status !== 200) {
          throw new Error(`Unexpected admin referrals status: ${adminRefs.status}`);
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }

      // Now verify GET /api/admin/referrals with super_admin Supabase profile mock
      const mockAdminRefSupabase: any = {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'admin-uid-1', email: 'services@r3-konaffiliate.online' } },
            error: null
          })
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (table === 'profiles') {
                  return { data: { id: 'admin-uid-1', email: 'services@r3-konaffiliate.online', full_name: 'Director', role: 'super_admin', status: 'active' }, error: null };
                }
                return { data: null, error: null };
              }
            }),
            order: (col: string) => {
              if (table === 'referral_clicks') clicksOrderCol = col;
              if (table === 'referral_leads') return Promise.resolve({ data: storedLeads, error: null });
              return Promise.resolve({
                data: [{
                  id: 'clk-1',
                  referral_code: 'DIRECT-R3',
                  affiliate_id: 'aff-lead-1',
                  visitor_hash: 'vh-1',
                  is_unique: true,
                  timestamp: new Date().toISOString()
                }],
                error: null
              });
            }
          })
        })
      };

      setSupabaseAdminForTesting(mockAdminRefSupabase);
      try {
        const refsRes = await makeRequest(
          serverUrl,
          'GET',
          '/api/admin/referrals',
          null,
          { Authorization: 'Bearer admin-mock-jwt' }
        );
        if (refsRes.status !== 200) {
          throw new Error(`Expected 200 from /api/admin/referrals, got ${refsRes.status}: ${JSON.stringify(refsRes.body)}`);
        }
        if (clicksOrderCol !== 'timestamp') {
          throw new Error(`referral_clicks must order by 'timestamp' column, got '${clicksOrderCol}'`);
        }
        if (refsRes.body.leads?.[0]?.clientIdentifier !== 'Pacific Coast Logistics Corp') {
          throw new Error('Admin referrals endpoint missing mapped camelCase lead DTO');
        }
        if (refsRes.body.clicks?.[0]?.referralCode !== 'DIRECT-R3') {
          throw new Error('Admin referrals endpoint missing mapped camelCase click DTO');
        }
      } finally {
        setSupabaseAdminForTesting(null);
      }
    });

    // 37. Authenticated Client Portal Brief (/api/client/inquiries) + Admin Client CRM Dossier Visibility
    await runTest('37. Client Portal brief links registrationId and appears in both Client Portal and Admin Client CRM inquiries endpoint', async () => {
      const briefRes = await makeRequest(
        serverUrl,
        'POST',
        '/api/client/inquiries',
        {
          serviceInterest: 'Asset Protection & Structuring',
          briefSummary: 'Supplemental Nevada statutory trust coordination brief.',
          priority: 'high'
        },
        clientAuthHeader
      );
      if (briefRes.status !== 201 || !briefRes.body.inquiryId) {
        throw new Error(`Expected 201 with inquiryId, got ${briefRes.status}: ${JSON.stringify(briefRes.body)}`);
      }
      if (briefRes.body.registrationId !== clientRegistrationId) {
        throw new Error(`Expected inquiry linked to registrationId ${clientRegistrationId}, got ${briefRes.body.registrationId}`);
      }

      const clientListRes = await makeRequest(serverUrl, 'GET', '/api/client/inquiries', null, clientAuthHeader);
      if (clientListRes.status !== 200 || !clientListRes.body.inquiries?.some((i: any) => i.id === briefRes.body.inquiryId)) {
        throw new Error('Submitted brief not visible in GET /api/client/inquiries');
      }

      const adminInqRes = await makeRequest(
        serverUrl,
        'GET',
        `/api/admin/client-inquiries?registrationId=${encodeURIComponent(clientRegistrationId)}`,
        null,
        adminAuthHeader
      );
      if (adminInqRes.status !== 200) {
        throw new Error(`Expected 200 from GET /api/admin/client-inquiries, got ${adminInqRes.status}`);
      }
      const linkedInqs = adminInqRes.body.inquiries || [];
      if (linkedInqs.length < 2 || !linkedInqs.some((i: any) => i.id === briefRes.body.inquiryId)) {
        throw new Error(`Admin CRM inquiries endpoint missing linked client briefs (${linkedInqs.length} returned)`);
      }
    });

    // 38. Corporate / Family Office Client Registration visibility across CRM endpoints
    await runTest('38. Corporate & family office client registration commits to client_registrations + client_inquiries and renders in Admin CRM', async () => {
      const corpClientEmail = `familyoffice.${Date.now()}@apexfo.us`;
      const regRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: 'Managing Partner Catherine Hayes',
        email: corpClientEmail,
        phone: '+1 (415) 555-0177',
        company: 'Apex Multi-Family Office LLC',
        country: 'United States (Wyoming)',
        serviceCategory: 'Private Family Office Sovereignty',
        requirementsBrief: 'Wyoming trust & US institutional contingency retainer.'
      });
      if (regRes.status !== 201 || !regRes.body.registrationId) {
        throw new Error(`Expected 201 for family office registration, got ${regRes.status}: ${JSON.stringify(regRes.body)}`);
      }

      const crmRes = await makeRequest(serverUrl, 'GET', '/api/admin/client-registrations', null, adminAuthHeader);
      const savedReg = (crmRes.body.registrations || []).find((r: any) => r.id === regRes.body.registrationId);
      if (!savedReg || savedReg.company !== 'Apex Multi-Family Office LLC') {
        throw new Error('Family office corporate registration not visible in Admin Client CRM list');
      }

      const crmInqRes = await makeRequest(
        serverUrl,
        'GET',
        `/api/admin/client-inquiries?registrationId=${encodeURIComponent(regRes.body.registrationId)}`,
        null,
        adminAuthHeader
      );
      if (!crmInqRes.body.inquiries?.length) {
        throw new Error('Linked CRM inquiry not found for family office registration');
      }
    });

    // 39. Global Client Registrations Across All Key Countries + Phone & Country Validation
    await runTest('39. Client registration persists international countries & E.164 phones across Nigeria, US, UK, Canada, UAE, South Africa, India, Australia, and Germany', async () => {
      const globalSamples = [
        { country: 'Nigeria', phone: '+234 803 123 4567', name: 'Chinedu Okafor', company: 'Lagos Maritime Holdings Ltd' },
        { country: 'United States', phone: '+1 212 555 0140', name: 'Evelyn Brooks', company: 'Brooks Fiduciary LLC' },
        { country: 'United Kingdom', phone: '+44 20 7946 0958', name: 'Oliver Kensington', company: 'Thames Advisory LLP' },
        { country: 'Canada', phone: '+1 416 555 0198', name: 'Claire Bouchard', company: 'Laurentian Family Office' },
        { country: 'United Arab Emirates', phone: '+971 50 123 4567', name: 'Tariq Al-Mansoor', company: 'Gulf Sovereign Holdings' },
        { country: 'South Africa', phone: '+27 11 555 0123', name: 'Thabo Mokoena', company: 'Cape Meridian Capital' },
        { country: 'India', phone: '+91 98201 12345', name: 'Priya Nair', company: 'Mumbai Industrial Group' },
        { country: 'Australia', phone: '+61 2 9374 4000', name: 'Lachlan Reid', company: 'Southern Cross Holdings' },
        { country: 'Germany', phone: '+49 30 1234567', name: 'Lukas Weber', company: 'Rheinland Industriewerke GmbH' }
      ];

      const submittedIds: Array<{ id: string; country: string; phone: string }> = [];

      for (const sample of globalSamples) {
        const res = await makeRequest(serverUrl, 'POST', '/api/client/register', {
          fullName: sample.name,
          company: sample.company,
          email: `global.${sample.country.toLowerCase().replace(/\s+/g, '')}.${Date.now()}@example.org`,
          phone: sample.phone,
          country: sample.country,
          serviceCategory: 'Executive Contingency Retainer',
          requirementsBrief: `International mandate registered from ${sample.country}.`
        });

        if (res.status !== 201 || !res.body.registrationId) {
          throw new Error(`Failed registration for ${sample.country}: ${res.status} ${JSON.stringify(res.body)}`);
        }
        submittedIds.push({ id: res.body.registrationId, country: sample.country, phone: sample.phone });
      }

      // Verify exact country persistence in Admin CRM without US fallback override
      const crmRes = await makeRequest(serverUrl, 'GET', '/api/admin/client-registrations', null, adminAuthHeader);
      const regs = crmRes.body.registrations || [];
      for (const expected of submittedIds) {
        const found = regs.find((r: any) => r.id === expected.id);
        if (!found) {
          throw new Error(`Global registration for ${expected.country} missing from CRM`);
        }
        if (found.country !== expected.country) {
          throw new Error(`Country mismatch: expected "${expected.country}", got "${found.country}"`);
        }
      }

      // Negative validation checks: reject alphabetic phone, too-short phone, and missing country
      const badPhoneRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: 'Invalid Phone Test',
        email: `badphone.${Date.now()}@example.org`,
        phone: '+44 INVALID-ABC',
        country: 'United Kingdom',
        serviceCategory: 'Executive Contingency Retainer'
      });
      if (badPhoneRes.status !== 400 || !badPhoneRes.body.details?.phone) {
        throw new Error(`Expected 400 with details.phone for invalid phone, got ${badPhoneRes.status}`);
      }

      const shortPhoneRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: 'Short Phone Test',
        email: `shortphone.${Date.now()}@example.org`,
        phone: '12345',
        country: 'Nigeria',
        serviceCategory: 'Executive Contingency Retainer'
      });
      if (shortPhoneRes.status !== 400 || !shortPhoneRes.body.details?.phone) {
        throw new Error(`Expected 400 with details.phone for short phone, got ${shortPhoneRes.status}`);
      }

      const missingCountryRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: 'Missing Country Test',
        email: `nocountry.${Date.now()}@example.org`,
        phone: '+234 803 123 4567',
        country: '',
        serviceCategory: 'Executive Contingency Retainer'
      });
      if (missingCountryRes.status !== 400 || !missingCountryRes.body.details?.country) {
        throw new Error(`Expected 400 with details.country for empty country, got ${missingCountryRes.status}`);
      }
    });

    // 40. International Affiliate Partner Applications (Individual & Business across multiple continents)
    await runTest('40. Affiliate application accepts global candidates (Nigeria, UK, UAE, Germany) and rejects invalid phones', async () => {
      const affiliateApplicants = [
        {
          ip: '10.20.0.1',
          applicantType: 'Business',
          fullName: 'Adebayo Adeyemi',
          businessName: 'Victoria Island Fiduciary Advisors Ltd',
          country: 'Nigeria',
          phone: '+234 809 555 0144'
        },
        {
          ip: '10.20.0.2',
          applicantType: 'Individual',
          fullName: 'Charlotte Ashworth',
          country: 'United Kingdom',
          phone: '+44 20 7946 0112'
        },
        {
          ip: '10.20.0.3',
          applicantType: 'Business',
          fullName: 'Kareem Al-Fayed',
          businessName: 'DIFC Cross-Border Advisory FZCO',
          country: 'United Arab Emirates',
          phone: '+971 4 555 0199'
        },
        {
          ip: '10.20.0.4',
          applicantType: 'Individual',
          fullName: 'Hannah Schneider',
          country: 'Germany',
          phone: '+49 89 1234567'
        }
      ];

      for (const appSample of affiliateApplicants) {
        const res = await makeRequest(
          serverUrl,
          'POST',
          '/api/applications',
          {
            fullName: appSample.fullName,
            applicantType: appSample.applicantType,
            businessName: appSample.businessName,
            email: `aff.${appSample.country.toLowerCase().replace(/\s+/g, '')}.${Date.now()}@partner-intl.org`,
            phone: appSample.phone,
            country: appSample.country,
            partnershipCategory: 'Cross-Border Regulatory & Compliance Advisory',
            industryBackground: `International corporate governance and advisory experience based in ${appSample.country}.`,
            audienceDescription: `Regional family offices, corporate boards, and institutional clients across ${appSample.country}.`,
            partnershipObjectives: `Coordinate confidential cross-border client introductions from ${appSample.country}.`,
            termsAccepted: true,
            privacyAccepted: true
          },
          { 'X-Forwarded-For': appSample.ip }
        );

        if (res.status !== 201 || res.body.application?.country !== appSample.country) {
          throw new Error(`Affiliate application failed for ${appSample.country}: ${res.status} ${JSON.stringify(res.body)}`);
        }
      }

      // Invalid phone rejection
      const invalidAppPhone = await makeRequest(
        serverUrl,
        'POST',
        '/api/applications',
        {
          fullName: 'Bad Phone Applicant',
          applicantType: 'Individual',
          email: `badappphone.${Date.now()}@partner-intl.org`,
          phone: 'not-a-phone',
          country: 'India',
          partnershipCategory: 'Wealth Advisory & Multi-Family Office',
          industryBackground: 'Extensive international cross-border corporate advisory practice.',
          audienceDescription: 'Regional corporate clients and institutional executives worldwide.',
          partnershipObjectives: 'Establish compliant global referral partnership with R3 Contingencies.',
          termsAccepted: true,
          privacyAccepted: true
        },
        { 'X-Forwarded-For': '10.20.0.5' }
      );
      if (invalidAppPhone.status !== 400 || !invalidAppPhone.body.details?.phone) {
        throw new Error(`Expected 400 with details.phone for bad affiliate phone, got ${invalidAppPhone.status}`);
      }
    });

    // 41. Affiliate Portal Privacy Masking on Global Referral Introductions
    await runTest('41. Global referral client registration masks PII from affiliate dashboard portal payload', async () => {
      const secretClientEmail = `confidential.zurich.${Date.now()}@private-office.ch`;
      const secretClientName = 'Confidential Principal K.V.';
      const secretPhone = '+41 44 555 0199';

      const regRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: secretClientName,
        email: secretClientEmail,
        phone: secretPhone,
        company: 'Zurich Trust Mandate',
        country: 'Switzerland',
        serviceCategory: 'Private Client & Family Office Advisory',
        requirementsBrief: 'Confidential cross-border continuity request.',
        referralCode: activatedAffiliateCode
      });
      if (regRes.status !== 201) {
        throw new Error(`Expected 201 for referred global registration, got ${regRes.status}`);
      }

      const portalRes = await makeRequest(
        serverUrl,
        'GET',
        `/api/affiliates/portal?affiliateId=${encodeURIComponent(activatedAffiliateId)}`,
        null,
        adminAuthHeader
      );
      if (portalRes.status !== 200 || !portalRes.body.data) {
        throw new Error(`Expected 200 for affiliate portal, got ${portalRes.status}`);
      }

      const serialized = JSON.stringify(portalRes.body.data);
      if (serialized.includes(secretClientEmail) || serialized.includes(secretPhone) || serialized.includes(secretClientName)) {
        throw new Error('PRIVACY FAILURE: Affiliate portal exposed raw client PII (email/phone/name)');
      }
      const attributedLead = (portalRes.body.data.leads || []).find((l: any) => l.region === 'Switzerland');
      if (!attributedLead) {
        throw new Error('Expected attributed Switzerland lead in affiliate portal leads list');
      }
    });

    // 42. International Utilities: Country Directory, Phone Validation, UTC Dates, ISO-4217 Currency
    await runTest('42. International frontend/server utilities validate target countries, E.164 phones, UTC dates, and USD currency formatting', async () => {
      const requiredCountries = [
        'Nigeria',
        'United States',
        'United Kingdom',
        'Canada',
        'United Arab Emirates',
        'South Africa',
        'India',
        'Australia',
        'Germany'
      ];
      for (const name of requiredCountries) {
        if (!COUNTRIES.some(c => c.name === name) || !getDialCodeForCountry(name)) {
          throw new Error(`Country missing or missing dial code in COUNTRIES directory: ${name}`);
        }
      }

      const validPhones = ['+234 803 123 4567', '+44 20 7946 0958', '+971 50 123 4567', '+91 98201 12345', '+49 30 1234567'];
      for (const p of validPhones) {
        if (!validateClientPhone(p).valid || !validateServerPhone(p).valid) {
          throw new Error(`Expected valid international phone for ${p}`);
        }
      }

      if (validateClientPhone('invalid-phone').valid || validateServerPhone('12').valid) {
        throw new Error('Expected invalid phone numbers to fail validation');
      }

      const formattedDate = formatInternationalDate('2026-11-20T18:30:00.000Z');
      if (!formattedDate.includes('2026') || !formattedDate.includes('Nov')) {
        throw new Error(`Unexpected international date format: ${formattedDate}`);
      }

      const formattedUtc = formatInternationalTimestampUTC('2026-11-20T18:30:00.000Z');
      if (!formattedUtc.endsWith('UTC')) {
        throw new Error(`Expected UTC suffix on audit timestamp, got: ${formattedUtc}`);
      }

      const formattedUsd = formatCurrencyAmount(12500, 'usd');
      if (formattedUsd !== 'USD 12,500') {
        throw new Error(`Expected "USD 12,500", got "${formattedUsd}"`);
      }
    });

    // =========================================================================
    // CLIENT IDENTITY VERIFICATION (KYC) MODULE TESTS (#43 - #51)
    // =========================================================================

    const VALID_PNG_BASE64 = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
    ]).toString('base64');

    const VALID_JPEG_BASE64 = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01
    ]).toString('base64');

    let ukClientRegId = '';
    let ukClientRef = '';
    const ukClientEmail = `uk.kyc.${Date.now()}@london-chambers.co.uk`;
    let ukClientAuthHeader: Record<string, string> = {};
    let ukVerificationId = '';
    let ukPassportDocId = '';

    let usClientRegId = '';
    let usClientRef = '';
    const usClientEmail = `us.kyc.${Date.now()}@newyork-familyoffice.us`;
    let usClientAuthHeader: Record<string, string> = {};
    let usVerificationId = '';

    let complianceAuthHeader: Record<string, string> = {};
    let affMgrAuthHeader: Record<string, string> = {};
    let finMgrAuthHeader: Record<string, string> = {};
    let affiliateUserAuthHeader: Record<string, string> = {};

    // Seed scoped dev accounts for strict KYC RBAC verification
    const seedPassword = 'R3ScopedRole@2026!';
    const seedHash = hashPassword(seedPassword);
    devDb.users.push(
      {
        id: 'usr_compliance_officer_1',
        email: 'compliance.officer@r3-konaffiliate.online',
        fullName: 'Chief Compliance Officer',
        role: 'compliance_officer',
        status: 'active',
        passwordHash: seedHash.hash,
        passwordSalt: seedHash.salt,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr_affiliate_mgr_1',
        email: 'aff.mgr@r3-konaffiliate.online',
        fullName: 'Affiliate Operations Manager',
        role: 'affiliate_manager',
        status: 'active',
        passwordHash: seedHash.hash,
        passwordSalt: seedHash.salt,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr_finance_mgr_1',
        email: 'fin.mgr@r3-konaffiliate.online',
        fullName: 'Treasury Finance Manager',
        role: 'finance_manager',
        status: 'active',
        passwordHash: seedHash.hash,
        passwordSalt: seedHash.salt,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr_affiliate_kyc_check',
        email: 'partner.rbac@contingency-partners.com',
        fullName: 'Accredited Partner RBAC',
        role: 'affiliate',
        status: 'active',
        affiliateId: activatedAffiliateId,
        passwordHash: seedHash.hash,
        passwordSalt: seedHash.salt,
        createdAt: new Date().toISOString()
      }
    );

    // 43. Approval-First Gate: unapproved clients stay blocked from KYC until admin approves registration
    await runTest('43. Approval-first gate blocks KYC editing/upload/submit while client registration is PENDING', async () => {
      const regRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: 'Arthur Pendelton',
        email: ukClientEmail,
        phone: '+44 20 7946 0821',
        company: 'Mayfair Contingency Partners LLP',
        country: 'United Kingdom',
        serviceCategory: 'Executive Contingency Retainer',
        requirementsBrief: 'London corporate continuity mandate.'
      });
      if (regRes.status !== 201) throw new Error(`Expected 201 on UK registration, got ${regRes.status}`);
      ukClientRegId = regRes.body.registrationId;
      ukClientRef = regRes.body.referenceNumber;

      const token = createClientActivationToken({
        registrationId: ukClientRegId,
        referenceNumber: ukClientRef,
        email: ukClientEmail
      });
      const actRes = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
        email: ukClientEmail,
        referenceNumber: ukClientRef,
        token,
        password: 'UkClientPassword2026!'
      });
      if (actRes.status !== 200) throw new Error(`Expected 200 activating client, got ${actRes.status}`);
      ukClientAuthHeader = { Authorization: `Bearer ${actRes.body.token}` };

      // Self-activation must NOT approve registration!
      const statusRes = await makeRequest(serverUrl, 'GET', '/api/kyc/status', null, ukClientAuthHeader);
      if (statusRes.status !== 200) throw new Error(`Expected 200 on GET /api/kyc/status, got ${statusRes.status}`);
      if (statusRes.body.registrationStatus !== 'PENDING' || statusRes.body.registrationApproved !== false) {
        throw new Error(`Expected PENDING & registrationApproved=false after activation, got ${JSON.stringify(statusRes.body)}`);
      }
      if (statusRes.body.canStartVerification !== false) {
        throw new Error('Expected canStartVerification === false for PENDING client');
      }

      // Blocked from saving KYC draft, uploading KYC doc, or submitting KYC while PENDING
      const draftRes = await makeRequest(
        serverUrl,
        'PUT',
        '/api/kyc/draft',
        { addressLine1: '10 Downing Chambers' },
        ukClientAuthHeader
      );
      if (draftRes.status !== 403) throw new Error(`Expected 403 on KYC draft when PENDING, got ${draftRes.status}`);

      const uploadRes = await makeRequest(
        serverUrl,
        'POST',
        '/api/kyc/documents',
        {
          documentType: 'passport',
          filename: 'passport.png',
          mimeType: 'image/png',
          contentBase64: VALID_PNG_BASE64
        },
        ukClientAuthHeader
      );
      if (uploadRes.status !== 403) throw new Error(`Expected 403 on KYC upload when PENDING, got ${uploadRes.status}`);
    });

    // 44. Admin Approval Triggers Post-Approval KYC Workflow without Marking KYC Approved
    await runTest('44. Approving client registration initializes KYC at not_started and triggers invitation cleanly', async () => {
      const approveRes = await makeRequest(
        serverUrl,
        'POST',
        `/api/admin/client-registrations/${encodeURIComponent(ukClientRegId)}/status`,
        { status: 'APPROVED' },
        adminAuthHeader
      );
      if (approveRes.status !== 200) throw new Error(`Expected 200 approving client, got ${approveRes.status}`);
      if (!approveRes.body.kycVerification || approveRes.body.kycVerification.verificationStatus !== 'not_started') {
        throw new Error(`Expected kycVerification initialized at not_started, got ${JSON.stringify(approveRes.body)}`);
      }

      const kycStatus = await makeRequest(serverUrl, 'GET', '/api/kyc/status', null, ukClientAuthHeader);
      if (
        kycStatus.status !== 200 ||
        kycStatus.body.registrationStatus !== 'APPROVED' ||
        kycStatus.body.registrationApproved !== true ||
        kycStatus.body.verificationStatus !== 'not_started' ||
        kycStatus.body.canStartVerification !== true
      ) {
        throw new Error(`Unexpected post-approval KYC status separation: ${JSON.stringify(kycStatus.body)}`);
      }
      ukVerificationId = kycStatus.body.verification?.id || '';
      if (!ukVerificationId) throw new Error('Expected verification.id after registration approval');
    });

    // 45. Strict RBAC Isolation Across All Non-Compliance Roles
    await runTest('45. Strict KYC RBAC blocks affiliate, affiliate_manager, finance_manager, client, and unauthenticated; grants compliance_officer', async () => {
      // Log in scoped roles
      const compLogin = await makeRequest(serverUrl, 'POST', '/api/admin/login', {
        email: 'compliance.officer@r3-konaffiliate.online',
        password: seedPassword
      });
      if (compLogin.status !== 200 || compLogin.body.user?.role !== 'compliance_officer') {
        throw new Error(`Compliance officer login failed: ${compLogin.status}`);
      }
      complianceAuthHeader = { Authorization: `Bearer ${compLogin.body.token}` };

      const affMgrLogin = await makeRequest(serverUrl, 'POST', '/api/admin/login', {
        email: 'aff.mgr@r3-konaffiliate.online',
        password: seedPassword
      });
      affMgrAuthHeader = { Authorization: `Bearer ${affMgrLogin.body.token}` };

      const finMgrLogin = await makeRequest(serverUrl, 'POST', '/api/admin/login', {
        email: 'fin.mgr@r3-konaffiliate.online',
        password: seedPassword
      });
      finMgrAuthHeader = { Authorization: `Bearer ${finMgrLogin.body.token}` };

      const affUserLogin = await makeRequest(
        serverUrl,
        'POST',
        '/api/auth/login',
        { email: 'partner.rbac@contingency-partners.com', password: seedPassword },
        { 'X-Forwarded-For': '10.88.0.10' }
      );
      affiliateUserAuthHeader = { Authorization: `Bearer ${affUserLogin.body.token}` };

      // Unauthenticated -> 401
      const unauth = await makeRequest(serverUrl, 'GET', '/api/kyc/admin/submissions');
      if (unauth.status !== 401) throw new Error(`Expected 401 for unauth KYC admin, got ${unauth.status}`);

      // Denied roles -> 403
      for (const [label, hdr] of [
        ['client', ukClientAuthHeader],
        ['affiliate', affiliateUserAuthHeader],
        ['affiliate_manager', affMgrAuthHeader],
        ['finance_manager', finMgrAuthHeader]
      ] as const) {
        const denyRes = await makeRequest(serverUrl, 'GET', '/api/kyc/admin/submissions', null, hdr);
        if (denyRes.status !== 403) {
          throw new Error(`RBAC VIOLATION: role '${label}' accessed /api/kyc/admin/submissions with ${denyRes.status}`);
        }
      }

      // Compliance officer -> 200 on KYC routes, 403 on affiliate applications queue (least privilege)
      const allowRes = await makeRequest(serverUrl, 'GET', '/api/kyc/admin/submissions', null, complianceAuthHeader);
      if (allowRes.status !== 200) {
        throw new Error(`Expected 200 for compliance_officer on KYC list, got ${allowRes.status}`);
      }
      const deniedAffQueue = await makeRequest(serverUrl, 'GET', '/api/admin/applications', null, complianceAuthHeader);
      if (deniedAffQueue.status !== 403) {
        throw new Error(`Expected 403 for compliance_officer on affiliate applications queue, got ${deniedAffQueue.status}`);
      }
    });

    // 46. Malformed / Spoofed Document Rejection (Magic-Byte Verification)
    await runTest('46. KYC document upload rejects spoofed MIME content and invalid magic bytes with 400 Bad Request', async () => {
      const spoofedPayload = Buffer.from('<script>alert(1)</script>').toString('base64');
      const badRes = await makeRequest(
        serverUrl,
        'POST',
        '/api/kyc/documents',
        {
          documentType: 'passport',
          filename: 'malicious.jpg',
          mimeType: 'image/jpeg',
          contentBase64: spoofedPayload
        },
        ukClientAuthHeader
      );
      if (badRes.status !== 400) {
        throw new Error(`Expected 400 rejecting spoofed JPEG content, got ${badRes.status}`);
      }
    });

    // 47. International Non-US KYC Flow (No SSN required)
    await runTest('47. Non-US client completes KYC with passport & selfie and ZERO SSN -> transitions to under_review', async () => {
      const ssnReject = await makeRequest(
        serverUrl,
        'PUT',
        '/api/kyc/draft',
        { country: 'United Kingdom', ssn: '123-45-6789' },
        ukClientAuthHeader
      );
      if (ssnReject.status !== 400) {
        throw new Error(`Expected 400 blocking SSN entry for non-US client, got ${ssnReject.status}`);
      }

      const passUpload = await makeRequest(
        serverUrl,
        'POST',
        '/api/kyc/documents',
        {
          documentType: 'passport',
          filename: 'uk-passport.png',
          mimeType: 'image/png',
          contentBase64: VALID_PNG_BASE64
        },
        ukClientAuthHeader
      );
      if (passUpload.status !== 201) throw new Error(`Expected 201 for passport upload, got ${passUpload.status}`);
      ukPassportDocId = passUpload.body.document.id;

      const selfieUpload = await makeRequest(
        serverUrl,
        'POST',
        '/api/kyc/documents',
        {
          documentType: 'selfie',
          filename: 'selfie.jpg',
          mimeType: 'image/jpeg',
          contentBase64: VALID_JPEG_BASE64
        },
        ukClientAuthHeader
      );
      if (selfieUpload.status !== 201) throw new Error(`Expected 201 for selfie upload, got ${selfieUpload.status}`);

      const submitRes = await makeRequest(
        serverUrl,
        'POST',
        '/api/kyc/submit',
        {
          legalFullName: 'Arthur Pendelton',
          country: 'United Kingdom',
          addressLine1: '14 Grosvenor Square',
          city: 'London',
          postalCode: 'W1K 6LP',
          governmentIdType: 'passport',
          governmentIdNumber: 'GBR99887766',
          livenessMethod: 'selfie_upload',
          consentAccepted: true
        },
        ukClientAuthHeader
      );
      if (submitRes.status !== 200 || submitRes.body.verificationStatus !== 'under_review') {
        throw new Error(`Expected under_review after UK submit, got ${submitRes.status}: ${JSON.stringify(submitRes.body)}`);
      }
      if (submitRes.body.verification?.ssnProvided !== false) {
        throw new Error('Expected ssnProvided=false for non-US client');
      }
    });

    // 48. US Client KYC with AES-256-GCM SSN Encryption & Zero Plaintext Leakage
    await runTest('48. US client submits KYC with encrypted SSN; raw SSN never leaks in client, admin, or audit payloads', async () => {
      const regRes = await makeRequest(serverUrl, 'POST', '/api/client/register', {
        fullName: 'Jonathan Mercer',
        email: usClientEmail,
        phone: '+1 (212) 555-0190',
        company: 'Mercer Capital Advisors LLC',
        country: 'United States',
        serviceCategory: 'Executive Contingency Retainer'
      });
      if (regRes.status !== 201) throw new Error(`Expected 201 on US client register, got ${regRes.status}`);
      usClientRegId = regRes.body.registrationId;
      usClientRef = regRes.body.referenceNumber;

      // Admin approves registration
      const approveRes = await makeRequest(
        serverUrl,
        'POST',
        `/api/admin/client-registrations/${encodeURIComponent(usClientRegId)}/status`,
        { status: 'APPROVED' },
        adminAuthHeader
      );
      if (approveRes.status !== 200) throw new Error(`Expected 200 approving US client, got ${approveRes.status}`);

      const token = createClientActivationToken({
        registrationId: usClientRegId,
        referenceNumber: usClientRef,
        email: usClientEmail
      });
      const actRes = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
        email: usClientEmail,
        referenceNumber: usClientRef,
        token,
        password: 'UsClientPassword2026!'
      });
      if (actRes.status !== 200) throw new Error(`Expected 200 activating US client, got ${actRes.status}`);
      usClientAuthHeader = { Authorization: `Bearer ${actRes.body.token}` };

      // Upload US DL Front, Back, and Live Camera Capture
      for (const [docType, filename, mime, data] of [
        ['gov_id_front', 'ny-dl-front.png', 'image/png', VALID_PNG_BASE64],
        ['gov_id_back', 'ny-dl-back.png', 'image/png', VALID_PNG_BASE64],
        ['liveness_capture', 'camera-selfie.jpg', 'image/jpeg', VALID_JPEG_BASE64]
      ] as const) {
        const up = await makeRequest(
          serverUrl,
          'POST',
          '/api/kyc/documents',
          { documentType: docType, filename, mimeType: mime, contentBase64: data },
          usClientAuthHeader
        );
        if (up.status !== 201) throw new Error(`Failed US upload ${docType}: ${up.status}`);
      }

      const rawSsn = '123-45-6789';
      const rawSsnDigits = '123456789';
      const usSubmit = await makeRequest(
        serverUrl,
        'POST',
        '/api/kyc/submit',
        {
          legalFullName: 'Jonathan Mercer',
          country: 'United States',
          addressLine1: '350 Park Avenue',
          city: 'New York',
          stateProvince: 'NY',
          postalCode: '10022',
          governmentIdType: 'drivers_license',
          governmentIdNumber: 'NYDL98765432',
          ssn: rawSsn,
          livenessMethod: 'camera_capture',
          livenessVerified: true,
          consentAccepted: true
        },
        usClientAuthHeader
      );
      if (usSubmit.status !== 200 || usSubmit.body.verificationStatus !== 'under_review') {
        throw new Error(`US KYC submit failed: ${usSubmit.status}: ${JSON.stringify(usSubmit.body)}`);
      }
      usVerificationId = usSubmit.body.verification.id;
      if (usSubmit.body.verification.ssnMasked !== '***-**-6789') {
        throw new Error(`Expected masked SSN ***-**-6789, got ${usSubmit.body.verification.ssnMasked}`);
      }

      // Leak audit across client GET, compliance GET, and admin audit logs
      const clientGet = await makeRequest(serverUrl, 'GET', '/api/kyc/status', null, usClientAuthHeader);
      const complianceGet = await makeRequest(
        serverUrl,
        'GET',
        `/api/kyc/admin/submissions/${encodeURIComponent(usVerificationId)}`,
        null,
        complianceAuthHeader
      );
      const auditGet = await makeRequest(serverUrl, 'GET', '/api/admin/audit-logs', null, adminAuthHeader);

      const combined = JSON.stringify({ clientGet: clientGet.body, complianceGet: complianceGet.body, auditGet: auditGet.body });
      if (combined.includes(rawSsn) || combined.includes(rawSsnDigits)) {
        throw new Error('SECURITY VIOLATION: Raw 9-digit US SSN leaked in API or audit payload!');
      }
    });

    // 49. Compliance Short-Lived Signed Document View URL & Tamper Rejection
    await runTest('49. Compliance officer obtains 120s signed URL to view document and tampered signatures return 403', async () => {
      const urlRes = await makeRequest(
        serverUrl,
        'POST',
        `/api/kyc/admin/documents/${encodeURIComponent(ukPassportDocId)}/signed-url`,
        {},
        complianceAuthHeader
      );
      if (urlRes.status !== 200 || !urlRes.body.signedUrl || urlRes.body.expiresInSeconds !== 120) {
        throw new Error(`Failed generating 120s signed URL: ${urlRes.status} ${JSON.stringify(urlRes.body)}`);
      }

      const previewRes = await makeRequest(serverUrl, 'GET', urlRes.body.signedUrl);
      if (previewRes.status !== 200) {
        throw new Error(`Expected 200 fetching signed document preview, got ${previewRes.status}`);
      }

      const tamperedUrl = urlRes.body.signedUrl.replace(/sig=[^&]+/, 'sig=TAMPERED_SIGNATURE_VALUE');
      const tamperedRes = await makeRequest(serverUrl, 'GET', tamperedUrl);
      if (tamperedRes.status !== 403) {
        throw new Error(`Expected 403 on tampered signed preview URL, got ${tamperedRes.status}`);
      }
    });

    // 50. Compliance Decision Lifecycle: Request Info -> Resubmit -> Approve & Reject (with Validation)
    await runTest('50. Compliance officer validates reasons, requests info, approves UK dossier, and rejects US dossier', async () => {
      // Missing reason on request_info / reject -> 400
      const missingReason = await makeRequest(
        serverUrl,
        'POST',
        `/api/kyc/admin/submissions/${encodeURIComponent(ukVerificationId)}/decision`,
        { decision: 'reject', clientMessage: 'No' },
        complianceAuthHeader
      );
      if (missingReason.status !== 400) {
        throw new Error(`Expected 400 for missing/short rejection reason, got ${missingReason.status}`);
      }

      // Request additional information on UK dossier -> action_required
      const reqInfoRes = await makeRequest(
        serverUrl,
        'POST',
        `/api/kyc/admin/submissions/${encodeURIComponent(ukVerificationId)}/decision`,
        {
          decision: 'request_info',
          clientMessage: 'Please upload a clearer utility bill or proof of residential address.',
          internalNotes: 'Passport legible; verifying residential proof.'
        },
        complianceAuthHeader
      );
      if (reqInfoRes.status !== 200 || reqInfoRes.body.submission?.verificationStatus !== 'action_required') {
        throw new Error(`Request info failed: ${reqInfoRes.status}`);
      }

      // UK Client uploads supplemental document and resubmits -> under_review
      const suppUpload = await makeRequest(
        serverUrl,
        'POST',
        '/api/kyc/documents',
        {
          documentType: 'supplemental',
          filename: 'uk-proof-of-address.png',
          mimeType: 'image/png',
          contentBase64: VALID_PNG_BASE64
        },
        ukClientAuthHeader
      );
      if (suppUpload.status !== 201) throw new Error(`Supplemental upload failed: ${suppUpload.status}`);

      const resubmitRes = await makeRequest(serverUrl, 'POST', '/api/kyc/submit', {}, ukClientAuthHeader);
      if (resubmitRes.status !== 200 || resubmitRes.body.verificationStatus !== 'under_review') {
        throw new Error(`Resubmit failed: ${resubmitRes.status}`);
      }

      // Compliance Officer approves UK dossier -> approved
      const approveRes = await makeRequest(
        serverUrl,
        'POST',
        `/api/kyc/admin/submissions/${encodeURIComponent(ukVerificationId)}/decision`,
        {
          decision: 'approve',
          clientMessage: 'Identity verification and residential documentation verified.',
          internalNotes: 'Cleared AML/PEP checks.'
        },
        complianceAuthHeader
      );
      if (approveRes.status !== 200 || approveRes.body.submission?.verificationStatus !== 'approved') {
        throw new Error(`Approve failed: ${approveRes.status}`);
      }

      // Client sees approved status and internalComplianceNotes is NEVER leaked to client
      const clientAfter = await makeRequest(serverUrl, 'GET', '/api/kyc/status', null, ukClientAuthHeader);
      if (clientAfter.body.verificationStatus !== 'approved' || clientAfter.body.canStartVerification !== false) {
        throw new Error('Expected approved status and locked post-approval editing on client side');
      }
      if (JSON.stringify(clientAfter.body).includes('Cleared AML/PEP checks')) {
        throw new Error('PRIVACY VIOLATION: internalComplianceNotes leaked to client endpoint');
      }

      // Compliance Officer rejects US dossier with reason -> rejected
      const rejectRes = await makeRequest(
        serverUrl,
        'POST',
        `/api/kyc/admin/submissions/${encodeURIComponent(usVerificationId)}/decision`,
        {
          decision: 'reject',
          clientMessage: 'Government ID image blurred and corner cropped; unable to verify issuing details.',
          internalNotes: 'Notify client via email to contact services if appealing.'
        },
        complianceAuthHeader
      );
      if (rejectRes.status !== 200 || rejectRes.body.submission?.verificationStatus !== 'rejected') {
        throw new Error(`Reject failed: ${rejectRes.status}`);
      }
    });

  } finally {
    server.close();
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n=============================================================');
  console.log(` TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${results.length})`);
  console.log('=============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
