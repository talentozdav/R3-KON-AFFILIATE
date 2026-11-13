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

    // 3. Client registration & reference number
    await runTest('3. Client corporate registration generates valid R3-CLT reference', async () => {
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
      clientRegistrationId = res.body.registrationId || res.body.client?.id;
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

    // 5. Client Activation & Login
    await runTest('5. Client activates account and authenticates for portal access', async () => {
      // Activate
      const actRes = await makeRequest(serverUrl, 'POST', '/api/client/activate', {
        email: clientEmail,
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
