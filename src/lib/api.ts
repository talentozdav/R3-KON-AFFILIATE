import {
  User,
  AffiliateApplication,
  Affiliate,
  AffiliateDashboardData,
  AdminOverviewMetrics,
  Conversion,
  Commission,
  CommissionRule,
  Payout,
  AuditLogEntry,
  ReferralLead
} from '../types';

let currentAuthToken: string | null = localStorage.getItem('r3_auth_token');

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  if (token) {
    localStorage.setItem('r3_auth_token', token);
  } else {
    localStorage.removeItem('r3_auth_token');
  }
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (currentAuthToken) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    // Gracefully handle non-JSON responses (such as Vercel proxy HTML 404/500 pages)
    data = {
      error: `HTTP ${response.status}`,
      message: response.ok ? 'Unexpected response format.' : `Server returned status ${response.status} (${response.statusText || 'Error'})`
    };
  }

  if (!response.ok) {
    const errorMsg = data.message || data.error || `Request failed with status ${response.status}`;
    const errorObj = new Error(errorMsg) as Error & { details?: Record<string, string>; status?: number };
    errorObj.details = data.details;
    errorObj.status = response.status;
    throw errorObj;
  }

  return data as T;
}

export const api = {
  // Auth
  async getCurrentUser(): Promise<{ authenticated: boolean; user: User | null }> {
    return request('/api/auth/me');
  },

  async login(email: string, password?: string): Promise<{ success: boolean; token: string; user: User }> {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAuthToken(res.token);
    return res;
  },

  async activateAccount(email: string, referenceNumber: string, password: string): Promise<{ success: boolean; token: string; user: User; message: string }> {
    const res = await request<{ success: boolean; token: string; user: User; message: string }>('/api/auth/activate', {
      method: 'POST',
      body: JSON.stringify({ email, referenceNumber, password })
    });
    setAuthToken(res.token);
    return res;
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  },

  async switchPersona(email: string): Promise<{ success: boolean; token: string; user: User }> {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/auth/switch-persona', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    setAuthToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors on logout
    }
    setAuthToken(null);
  },

  // Applications
  async submitApplication(data: Partial<AffiliateApplication>): Promise<{
    success: boolean;
    referenceNumber: string;
    message: string;
    status: string;
  }> {
    return request('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async checkApplicationStatus(ref: string, email?: string): Promise<Partial<AffiliateApplication>> {
    const query = new URLSearchParams({ ref });
    if (email) query.set('email', email);
    return request(`/api/applications/status?${query.toString()}`);
  },

  // Affiliate Portal
  async getAffiliatePortal(affiliateId?: string): Promise<{ success: boolean; data: AffiliateDashboardData }> {
    const query = affiliateId ? `?affiliateId=${affiliateId}` : '';
    return request(`/api/affiliates/portal${query}`);
  },

  async submitAffiliateLead(data: {
    clientIdentifier: string;
    clientType: string;
    region: string;
    serviceCategory: string;
    estimatedValue?: number;
    notes?: string;
    affiliateId?: string;
  }): Promise<{ success: boolean; lead: ReferralLead; message: string }> {
    return request('/api/affiliates/submit-lead', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Referrals
  async trackReferralClick(code: string, referer?: string): Promise<{
    success: boolean;
    affiliateNumber: string;
    referralCode: string;
    isUnique: boolean;
    partnerEntity: string;
  }> {
    return request('/api/referrals/track', {
      method: 'POST',
      body: JSON.stringify({ code, referer })
    });
  },

  async validateReferralCode(code: string): Promise<{
    valid: boolean;
    affiliateNumber?: string;
    referralCode?: string;
    partnerName?: string;
  }> {
    return request(`/api/referrals/validate/${encodeURIComponent(code)}`);
  },

  async submitClientInquiry(data: {
    referralCode?: string;
    clientName: string;
    organization?: string;
    email: string;
    phone?: string;
    country: string;
    serviceInterest: string;
    briefSummary?: string;
  }): Promise<{ success: boolean; message: string; attributed: boolean }> {
    return request('/api/referrals/inquire', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Admin APIs
  async getAdminOverview(): Promise<{ metrics: AdminOverviewMetrics }> {
    return request('/api/admin/overview');
  },

  async getAdminApplications(): Promise<{ applications: AffiliateApplication[] }> {
    return request('/api/admin/applications');
  },

  async reviewApplication(id: string, status: string, statusNotes?: string): Promise<{ success: boolean; application: AffiliateApplication }> {
    return request(`/api/admin/applications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, statusNotes })
    });
  },

  async activateApplication(id: string, customCode?: string, approvedRatePercent?: number): Promise<{ success: boolean; affiliate: Affiliate }> {
    return request(`/api/admin/applications/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({ customCode, approvedRatePercent })
    });
  },

  async getAdminAffiliates(): Promise<{ affiliates: Affiliate[] }> {
    return request('/api/admin/affiliates');
  },

  async updateAffiliateStatus(id: string, status: string, reason?: string): Promise<{ success: boolean; affiliate: Affiliate }> {
    return request(`/api/admin/affiliates/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason })
    });
  },

  async getAdminReferrals(): Promise<{ leads: ReferralLead[]; clicks: any[] }> {
    return request('/api/admin/referrals');
  },

  async getAdminConversions(): Promise<{ conversions: Conversion[] }> {
    return request('/api/admin/conversions');
  },

  async createConversion(data: {
    affiliateId: string;
    leadId?: string;
    membershipTierOrCategory: string;
    eligibleSaleAmount: number;
    verificationStatus: string;
    verificationNotes?: string;
  }): Promise<{ success: boolean; conversion: Conversion }> {
    return request('/api/admin/conversions/create', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async verifyConversion(id: string, verificationStatus: string, verificationNotes?: string): Promise<{ success: boolean; conversion: Conversion }> {
    return request(`/api/admin/conversions/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verificationStatus, verificationNotes })
    });
  },

  async getAdminCommissions(): Promise<{ commissions: Commission[] }> {
    return request('/api/admin/commissions');
  },

  async generateCommission(conversionId: string, ruleId?: string, customRate?: number): Promise<{ success: boolean; commission: Commission }> {
    return request('/api/admin/commissions/generate', {
      method: 'POST',
      body: JSON.stringify({ conversionId, ruleId, customRate })
    });
  },

  async actionCommission(id: string, action: 'approve' | 'reverse', auditReason: string): Promise<{ success: boolean; commission: Commission }> {
    return request(`/api/admin/commissions/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, auditReason })
    });
  },

  async getAdminCommissionRules(): Promise<{ rules: CommissionRule[] }> {
    return request('/api/admin/commission-rules');
  },

  async createCommissionRule(data: Partial<CommissionRule>): Promise<{ success: boolean; rule: CommissionRule }> {
    return request('/api/admin/commission-rules', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async toggleRuleStatus(id: string, status: 'active' | 'inactive'): Promise<{ success: boolean; rule: CommissionRule }> {
    return request(`/api/admin/commission-rules/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async getAdminPayouts(): Promise<{ payouts: Payout[] }> {
    return request('/api/admin/payouts');
  },

  async preparePayout(affiliateId: string, payoutPeriod?: string, paymentMethod?: string): Promise<{ success: boolean; payout: Payout }> {
    return request('/api/admin/payouts/prepare', {
      method: 'POST',
      body: JSON.stringify({ affiliateId, payoutPeriod, paymentMethod })
    });
  },

  async recordPayoutPayment(id: string, paymentReference: string, notes?: string): Promise<{ success: boolean; payout: Payout }> {
    return request(`/api/admin/payouts/${id}/record-payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentReference, notes })
    });
  },

  async getAdminAuditLogs(): Promise<{ auditLogs: AuditLogEntry[] }> {
    return request('/api/admin/audit-logs');
  },

  // Client Membership & Portal
  async registerClient(data: {
    fullName: string;
    email: string;
    phone?: string;
    company?: string;
    country: string;
    serviceCategory: string;
    requirementsBrief?: string;
    referralCode?: string;
  }): Promise<{
    success: boolean;
    referenceNumber: string;
    message: string;
    emailSent: boolean;
    registrationId?: string;
  }> {
    return request('/api/client/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async activateClientAccount(data: {
    email: string;
    password: string;
    fullName?: string;
    referenceNumber?: string;
    token?: string;
  }): Promise<{ success: boolean; message: string; token: string }> {
    const res = await request<{ success: boolean; message: string; token: string }>('/api/client/activate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setAuthToken(res.token);
    return res;
  },

  async clientLogin(email: string, password: string): Promise<{ success: boolean; token: string; user: User }> {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/client/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAuthToken(res.token);
    return res;
  },

  async getClientProfile(): Promise<{ authenticated: boolean; client: any }> {
    return request('/api/client/me');
  },

  async submitClientPortalInquiry(data: {
    serviceInterest: string;
    briefSummary: string;
    priority?: string;
  }): Promise<{ success: boolean; referenceNumber: string; message: string }> {
    return request('/api/client/inquiries', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getClientInquiries(): Promise<{ inquiries: any[] }> {
    return request('/api/client/inquiries');
  },

  // Admin Client CRM
  async getAdminClientRegistrations(): Promise<{ registrations: any[] }> {
    return request('/api/admin/client-registrations');
  },

  async updateAdminClientRegistrationStatus(id: string, status: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/client-registrations/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async resendAdminClientInvitation(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/client-registrations/${id}/resend-invite`, {
      method: 'POST'
    });
  },

  async getAdminClientNotes(registrationId: string): Promise<{ notes: any[] }> {
    return request(`/api/admin/client-notes/${registrationId}`);
  },

  async addAdminClientNote(data: {
    registrationId: string;
    noteType?: string;
    content: string;
  }): Promise<{ success: boolean; note: any }> {
    return request('/api/admin/client-notes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getAdminClientFollowups(registrationId?: string): Promise<{ followups: any[] }> {
    const query = registrationId ? `?registrationId=${registrationId}` : '';
    return request(`/api/admin/client-followups${query}`);
  },

  async addAdminClientFollowup(data: {
    registrationId: string;
    title: string;
    dueDate: string;
    priority?: string;
    assignedTo?: string;
    notes?: string;
  }): Promise<{ success: boolean; followup: any }> {
    return request('/api/admin/client-followups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
