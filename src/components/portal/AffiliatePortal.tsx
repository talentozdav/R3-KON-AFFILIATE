import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AffiliateDashboardData } from '../../types';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Users,
  Award,
  Wallet,
  ArrowUpRight,
  LogOut,
  X,
  FilePlus2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AffiliatePortalProps {
  onClose: () => void;
}

export const AffiliatePortal: React.FC<AffiliatePortalProps> = ({ onClose }) => {
  const { user, logout } = useAuth();
  const [data, setData] = useState<AffiliateDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'links' | 'leads' | 'conversions' | 'commissions' | 'payouts' | 'submit_lead'>('overview');
  const [copiedLink, setCopiedLink] = useState(false);

  // New Lead Submission Form state
  const [leadClient, setLeadClient] = useState('');
  const [leadType, setLeadType] = useState('Corporate');
  const [leadRegion, setLeadRegion] = useState('');
  const [leadCategory, setLeadCategory] = useState('Executive Contingency Retainer');
  const [leadNotes, setLeadNotes] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccessMsg, setLeadSuccessMsg] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAffiliatePortal();
      setData(res.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load affiliate partner dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const referralUrl = data?.affiliate.referralCode
    ? `${window.location.origin}/?ref=${data.affiliate.referralCode}`
    : '';

  const handleCopyLink = () => {
    if (referralUrl) {
      navigator.clipboard.writeText(referralUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadClient.trim()) return;

    setLeadSubmitting(true);
    setLeadSuccessMsg(null);
    try {
      const res = await api.submitAffiliateLead({
        clientIdentifier: leadClient.trim(),
        clientType: leadType,
        region: leadRegion.trim() || 'International',
        serviceCategory: leadCategory,
        notes: leadNotes.trim() || undefined
      });
      setLeadSuccessMsg(res.message);
      setLeadClient('');
      setLeadNotes('');
      setLeadRegion('');
      fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Error submitting lead');
    } finally {
      setLeadSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-xs flex flex-col justify-start items-center p-3 sm:p-6 lg:p-8">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] w-full max-w-6xl shadow-2xl flex flex-col my-auto">
        {/* Top Header */}
        <div className="p-6 bg-[#0A192F] text-[#FAF9F6] border-b border-[#1A2E4C] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#FAF9F6] text-[#0A192F] flex items-center justify-center font-serif font-bold text-base">
              R3
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl tracking-wide uppercase text-white">
                  Affiliate Partner Dashboard
                </h2>
                <span className="text-[11px] font-mono text-[#D4AF37] px-2 py-0.5 bg-[#1A2E4C] border border-[#2A3E5C]">
                  {data?.affiliate.affiliateNumber || 'R3-AFF-PARTNER'}
                </span>
              </div>
              <div className="text-xs text-stone-400 font-light flex items-center gap-2 mt-0.5">
                <span>{data?.affiliate.businessName || data?.affiliate.fullName || user?.fullName}</span>
                <span>·</span>
                <span className="capitalize text-emerald-400 font-mono text-[11px]">
                  ● Status: {data?.affiliate.status || 'Active'}
                </span>
                <span>·</span>
                <span className="text-stone-400 font-mono text-[11px]">
                  Approved Rate: {data?.affiliate.approvedRatePercent ?? 10.0}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={fetchDashboard}
              className="p-2 text-stone-400 hover:text-white transition-colors border border-[#1A2E4C] hover:border-stone-500"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider text-stone-300 hover:text-white border border-[#1A2E4C] hover:border-stone-500 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white transition-colors"
              title="Close Portal View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Segmented buttons) */}
        <div className="px-6 py-3 bg-white border-b border-[#E2DDD3] overflow-x-auto flex items-center gap-2 text-xs">
          {[
            { id: 'overview', label: 'Dashboard Overview' },
            { id: 'links', label: 'Referral Links & URL' },
            { id: 'leads', label: `Attributed Leads (${data?.leads.length ?? 0})` },
            { id: 'conversions', label: `Conversions (${data?.conversions.length ?? 0})` },
            { id: 'commissions', label: `Commission Ledger (${data?.commissions.length ?? 0})` },
            { id: 'payouts', label: `Payout History (${data?.payouts.length ?? 0})` },
            { id: 'submit_lead', label: '+ Register Lead' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 font-medium transition-colors whitespace-nowrap uppercase tracking-wider text-[11px] border ${
                activeTab === tab.id
                  ? 'bg-[#0A192F] text-[#FAF9F6] border-[#0A192F]'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 lg:p-8 overflow-y-auto max-h-[calc(85vh-140px)]">
          {isLoading && !data ? (
            <div className="py-20 text-center text-xs text-stone-500 font-mono">
              Loading partner records...
            </div>
          ) : errorMsg ? (
            <div className="p-6 bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          ) : data ? (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* KPI Stat Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="p-4 bg-white border border-[#E2DDD3]">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans block mb-1">
                        Referral Clicks
                      </span>
                      <span className="font-mono text-2xl text-[#0A192F] font-semibold tabular-nums">
                        {data.stats.totalClicks}
                      </span>
                      <span className="block text-[10px] text-stone-400 mt-1">Logged impressions</span>
                    </div>

                    <div className="p-4 bg-white border border-[#E2DDD3]">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans block mb-1">
                        Unique Visitors
                      </span>
                      <span className="font-mono text-2xl text-[#0A192F] font-semibold tabular-nums">
                        {data.stats.uniqueVisitors}
                      </span>
                      <span className="block text-[10px] text-stone-400 mt-1">Verified unique IPs</span>
                    </div>

                    <div className="p-4 bg-white border border-[#E2DDD3]">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans block mb-1">
                        Leads Generated
                      </span>
                      <span className="font-mono text-2xl text-[#0A192F] font-semibold tabular-nums">
                        {data.stats.leadsGenerated}
                      </span>
                      <span className="block text-[10px] text-stone-400 mt-1">Active introductions</span>
                    </div>

                    <div className="p-4 bg-white border border-[#E2DDD3]">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans block mb-1">
                        Verified Conversions
                      </span>
                      <span className="font-mono text-2xl text-emerald-800 font-semibold tabular-nums">
                        {data.stats.verifiedConversions}
                      </span>
                      <span className="block text-[10px] text-emerald-700 mt-1">Cleared banking audits</span>
                    </div>

                    <div className="p-4 bg-white border border-[#E2DDD3]">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans block mb-1">
                        Approved Commissions
                      </span>
                      <span className="font-mono text-2xl text-[#0A192F] font-semibold tabular-nums">
                        ${data.stats.approvedCommissions.toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-stone-400 mt-1">USD eligible balance</span>
                    </div>

                    <div className="p-4 bg-white border border-[#E2DDD3]">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans block mb-1">
                        Paid Settlements
                      </span>
                      <span className="font-mono text-2xl text-[#D4AF37] font-semibold tabular-nums">
                        ${data.stats.paidCommissions.toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-stone-400 mt-1">Disbursed via wire</span>
                    </div>
                  </div>

                  {/* Referral Link Quick Banner */}
                  <div className="p-5 bg-white border border-[#E2DDD3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold font-sans block">
                        Your Unique Referral URL
                      </span>
                      <div className="font-mono text-xs text-[#0A192F] select-all break-all bg-stone-50 p-2 border border-stone-200">
                        {referralUrl}
                      </div>
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240] transition-colors shrink-0"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />}
                      <span>{copiedLink ? 'Copied URL' : 'Copy Referral URL'}</span>
                    </button>
                  </div>

                  {/* Recent Pipeline Activity Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Attributed Leads */}
                    <div className="bg-white border border-[#E2DDD3] p-5">
                      <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                        <h4 className="font-serif text-lg text-[#0A192F] font-normal">Recent Pipeline Leads</h4>
                        <button
                          onClick={() => setActiveTab('leads')}
                          className="text-[11px] text-[#0A192F] hover:text-[#D4AF37] uppercase tracking-wider font-mono"
                        >
                          View All →
                        </button>
                      </div>

                      {data.leads.length === 0 ? (
                        <p className="text-xs text-stone-500 py-4 font-light">No active leads logged yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {data.leads.slice(0, 4).map((lead) => (
                            <div key={lead.id} className="p-3 bg-stone-50 border border-stone-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-medium text-[#0A192F] block">{lead.clientIdentifier}</span>
                                <span className="text-[11px] text-stone-500 font-light">{lead.serviceCategory} · {lead.region}</span>
                              </div>
                              <span className="font-mono text-[10px] uppercase px-2 py-0.5 border border-stone-300 bg-white text-stone-700">
                                {lead.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Commissions */}
                    <div className="bg-white border border-[#E2DDD3] p-5">
                      <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                        <h4 className="font-serif text-lg text-[#0A192F] font-normal">Recent Commission Ledger</h4>
                        <button
                          onClick={() => setActiveTab('commissions')}
                          className="text-[11px] text-[#0A192F] hover:text-[#D4AF37] uppercase tracking-wider font-mono"
                        >
                          View All →
                        </button>
                      </div>

                      {data.commissions.length === 0 ? (
                        <p className="text-xs text-stone-500 py-4 font-light">No verified commissions recorded yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {data.commissions.slice(0, 4).map((com) => (
                            <div key={com.id} className="p-3 bg-stone-50 border border-stone-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-mono text-[11px] text-[#0A192F] font-medium block">{com.commissionReference}</span>
                                <span className="text-[11px] text-stone-500 font-light">
                                  {com.appliedCommissionRate}% on ${com.eligibleTransactionAmount.toLocaleString()} USD
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-medium text-[#0A192F] block tabular-nums">
                                  ${com.commissionAmount.toLocaleString()} USD
                                </span>
                                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 border ${
                                  com.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  {com.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: REFERRAL LINKS */}
              {activeTab === 'links' && (
                <div className="space-y-6">
                  <div className="bg-white border border-[#E2DDD3] p-6 sm:p-8">
                    <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
                      Attribution Protocol
                    </span>
                    <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-2">
                      Partner Referral Credentials
                    </h3>
                    <p className="text-xs text-stone-600 leading-relaxed font-light mb-6 max-w-2xl">
                      Each partner possesses a unique encrypted identifier. When shared with prospective clients or professional contacts, incoming inquiries and site interactions are attributed directly to your partner dossier.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-stone-100">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-stone-600 font-medium mb-1.5">
                          Assigned Referral Code
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 font-mono text-base font-semibold text-[#0A192F]">
                          {data.affiliate.referralCode}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-stone-600 font-medium mb-1.5">
                          Assigned Affiliate Number
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 font-mono text-base font-semibold text-[#0A192F]">
                          {data.affiliate.affiliateNumber}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-[11px] uppercase tracking-wider text-stone-600 font-medium mb-1.5">
                        Complete Web Referral URL
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          readOnly
                          value={referralUrl}
                          className="flex-1 font-mono text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-300 text-stone-800 select-all"
                        />
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240] transition-colors"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />}
                          <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-600 font-light">
                      <div>
                        <strong className="block text-[#0A192F] font-medium mb-1">Session Durability:</strong>
                        Attribution cookies persist for 90 days following first verified referral interaction.
                      </div>
                      <div>
                        <strong className="block text-[#0A192F] font-medium mb-1">Server Verification:</strong>
                        Attribution logs are verified against IP and User-Agent headers to eliminate spoofing.
                      </div>
                      <div>
                        <strong className="block text-[#0A192F] font-medium mb-1">Compliance Boundary:</strong>
                        Strict prohibition on paid search arbitrage, mass spam, or public banner display.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: LEADS */}
              {activeTab === 'leads' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Attributed Client Leads</h3>
                      <p className="text-xs text-stone-600 font-light">
                        Clients introduced through your referral link or registered directly by your practice. Names are masked for discretion.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('submit_lead')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240]"
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Register Client Lead</span>
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Client / Identifier</th>
                          <th className="py-3 px-4">Entity Type</th>
                          <th className="py-3 px-4">Service Scope</th>
                          <th className="py-3 px-4">Region</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Logged Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.leads.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-stone-500 font-light">
                              No client leads attributed yet. Share your referral link or use the Register Lead form.
                            </td>
                          </tr>
                        ) : (
                          data.leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3.5 px-4 font-medium text-[#0A192F]">
                                {lead.clientIdentifier}
                                {lead.notes && (
                                  <span className="block text-[11px] text-stone-500 font-light italic mt-0.5">
                                    {lead.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-stone-600">{lead.clientType}</td>
                              <td className="py-3.5 px-4 text-stone-600">{lead.serviceCategory}</td>
                              <td className="py-3.5 px-4 text-stone-600">{lead.region}</td>
                              <td className="py-3.5 px-4">
                                <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                                  lead.status === 'converted'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : lead.status === 'qualified'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                                    : lead.status === 'disqualified'
                                    ? 'bg-stone-100 text-stone-500 border-stone-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  {lead.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-stone-500 text-[11px]">
                                {new Date(lead.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: CONVERSIONS */}
              {activeTab === 'conversions' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Verified Conversion Records</h3>
                    <p className="text-xs text-stone-600 font-light">
                      Executed contracts verified against signed client agreements and confirmed bank settlement. Affiliates cannot self-approve conversions.
                    </p>
                  </div>

                  <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Transaction Ref</th>
                          <th className="py-3 px-4">Service Category</th>
                          <th className="py-3 px-4 text-right">Eligible Contract Value</th>
                          <th className="py-3 px-4">Verification Status</th>
                          <th className="py-3 px-4">Execution Date</th>
                          <th className="py-3 px-4">Audit Officer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.conversions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-stone-500 font-light">
                              No conversion records currently logged.
                            </td>
                          </tr>
                        ) : (
                          data.conversions.map((conv) => (
                            <tr key={conv.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                                {conv.transactionReference}
                              </td>
                              <td className="py-3.5 px-4 text-stone-700">
                                {conv.membershipTierOrCategory}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-medium text-[#0A192F] tabular-nums">
                                ${conv.eligibleSaleAmount.toLocaleString()} {conv.currency}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                                  conv.verificationStatus === 'verified'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  {conv.verificationStatus}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-stone-500 text-[11px]">
                                {new Date(conv.transactionDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                                {conv.verifiedBy || 'Pending Compliance Audit'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: COMMISSION LEDGER */}
              {activeTab === 'commissions' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Commission Ledger</h3>
                    <p className="text-xs text-stone-600 font-light">
                      Financial ledger detailing applied approved commission percentages, recorded amounts, and governance authorization.
                    </p>
                  </div>

                  <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Commission Ref</th>
                          <th className="py-3 px-4">Linked Transaction</th>
                          <th className="py-3 px-4 text-right">Eligible Base</th>
                          <th className="py-3 px-4 text-right">Applied Rate</th>
                          <th className="py-3 px-4 text-right">Commission Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Recorded Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.commissions.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-stone-500 font-light">
                              No commission entries logged in ledger.
                            </td>
                          </tr>
                        ) : (
                          data.commissions.map((com) => (
                            <tr key={com.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                                {com.commissionReference}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-stone-600 text-[11px]">
                                {com.transactionReference}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-stone-600 tabular-nums">
                                ${com.eligibleTransactionAmount.toLocaleString()} USD
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-medium text-[#0A192F] tabular-nums">
                                {com.appliedCommissionRate.toFixed(2)}%
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0A192F] tabular-nums">
                                ${com.commissionAmount.toLocaleString()} {com.currency}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                                  com.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : com.status === 'approved'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  {com.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-stone-500 text-[11px]">
                                {new Date(com.dateRecorded).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: PAYOUT HISTORY */}
              {activeTab === 'payouts' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Disbursed Payout History</h3>
                    <p className="text-xs text-stone-600 font-light">
                      Settlement cycles executed to your partner banking institution. Wire confirmation numbers are archived for tax accounting.
                    </p>
                  </div>

                  <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Payout Ref</th>
                          <th className="py-3 px-4">Period / Cycle</th>
                          <th className="py-3 px-4 text-right">Settled Amount</th>
                          <th className="py-3 px-4">Method</th>
                          <th className="py-3 px-4">Bank / Wire Reference</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Disbursed Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.payouts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-stone-500 font-light">
                              No completed payout cycles logged yet.
                            </td>
                          </tr>
                        ) : (
                          data.payouts.map((pay) => (
                            <tr key={pay.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                                {pay.payoutReference}
                              </td>
                              <td className="py-3.5 px-4 text-stone-800 font-medium">
                                {pay.payoutPeriod}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-[#D4AF37] tabular-nums">
                                ${pay.amount.toLocaleString()} {pay.currency}
                              </td>
                              <td className="py-3.5 px-4 text-stone-600">
                                {pay.paymentMethod}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-stone-700 text-[11px]">
                                {pay.paymentReference || 'Scheduled Processing'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                                  pay.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  {pay.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-stone-500 text-[11px]">
                                {pay.processedAt
                                  ? new Date(pay.processedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : 'Scheduled'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: SUBMIT CLIENT LEAD */}
              {activeTab === 'submit_lead' && (
                <div className="max-w-xl mx-auto py-4">
                  <div className="bg-white border border-[#E2DDD3] p-8 shadow-xs">
                    <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
                      Direct Introductions
                    </span>
                    <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-2">
                      Register Client Introduction
                    </h3>
                    <p className="text-xs text-stone-600 font-light mb-6">
                      Introduce a prospective client directly under your affiliate attribution code ({data.affiliate.referralCode}).
                    </p>

                    {leadSuccessMsg && (
                      <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-medium">Lead Registered Successfully</strong>
                          {leadSuccessMsg}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleLeadSubmit} className="space-y-4">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                          Client Description / Family Office Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={leadClient}
                          onChange={(e) => setLeadClient(e.target.value)}
                          placeholder="e.g. Single Family Office (Zurich) or Principal S.V."
                          required
                          className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                            Client Type
                          </label>
                          <select
                            value={leadType}
                            onChange={(e) => setLeadType(e.target.value)}
                            className="w-full text-xs px-3 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                          >
                            <option value="Corporate">Corporate</option>
                            <option value="Institutional">Institutional / Fund</option>
                            <option value="Individual">Private Principal</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                            Region / Jurisdiction
                          </label>
                          <input
                            type="text"
                            value={leadRegion}
                            onChange={(e) => setLeadRegion(e.target.value)}
                            placeholder="e.g. Western Europe / DIFC"
                            className="w-full text-xs px-3.5 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                          Contingency Category
                        </label>
                        <select
                          value={leadCategory}
                          onChange={(e) => setLeadCategory(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                        >
                          <option value="Executive Contingency Retainer">Executive Contingency Retainer</option>
                          <option value="Institutional Crisis Advisory">Institutional Crisis Advisory & Rapid Deployment</option>
                          <option value="Private Sovereign Support">Private Sovereign & Maritime Support</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                          Confidential Operational Notes
                        </label>
                        <textarea
                          rows={3}
                          value={leadNotes}
                          onChange={(e) => setLeadNotes(e.target.value)}
                          placeholder="Provide context on client needs, timeline, or key risk factors..."
                          className="w-full text-xs p-3 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={leadSubmitting || !leadClient.trim()}
                        className="w-full py-3 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest font-medium hover:bg-[#112240] transition-colors disabled:opacity-50"
                      >
                        {leadSubmitting ? 'Registering...' : 'Register Introduction into Ledger'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
