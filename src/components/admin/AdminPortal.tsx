import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  AdminOverviewMetrics,
  AffiliateApplication,
  Affiliate,
  ReferralLead,
  Conversion,
  Commission,
  CommissionRule,
  Payout,
  AuditLogEntry,
  ApplicationStatus,
  AffiliateStatus,
  ClientRegistration,
  ClientNote,
  ClientFollowup
} from '../../types';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  FileCheck2,
  DollarSign,
  TrendingUp,
  RefreshCw,
  X,
  LogOut,
  Layers,
  Settings,
  History,
  AlertTriangle,
  Plus,
  Send,
  Eye,
  MessageSquare,
  Calendar,
  MailCheck,
  Building,
  UserCheck
} from 'lucide-react';

interface AdminPortalProps {
  onClose: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onClose }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'affiliates' | 'conversions' | 'commissions' | 'rules' | 'payouts' | 'audit' | 'client_crm'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);

  // Data collections
  const [applications, setApplications] = useState<AffiliateApplication[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [leads, setLeads] = useState<ReferralLead[]>([]);
  const [clicks, setClicks] = useState<any[]>([]);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [clientRegistrations, setClientRegistrations] = useState<ClientRegistration[]>([]);

  // Modals & Action States
  const [selectedApp, setSelectedApp] = useState<AffiliateApplication | null>(null);
  const [appReviewNotes, setAppReviewNotes] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [activationRate, setActivationRate] = useState(10.0);

  // Client CRM Modal & Action States
  const [selectedClientForNotes, setSelectedClientForNotes] = useState<ClientRegistration | null>(null);
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientFollowups, setClientFollowups] = useState<ClientFollowup[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newFollowupDueDate, setNewFollowupDueDate] = useState('');
  const [newFollowupNotes, setNewFollowupNotes] = useState('');
  const [isResendingInvite, setIsResendingInvite] = useState<string | null>(null);

  // New Conversion Modal state
  const [showNewConversionModal, setShowNewConversionModal] = useState(false);
  const [convAffiliateId, setConvAffiliateId] = useState('');
  const [convLeadId, setConvLeadId] = useState('');
  const [convCategory, setConvCategory] = useState('Executive Contingency Retainer');
  const [convAmount, setConvAmount] = useState(75000);
  const [convNotes, setConvNotes] = useState('');

  // Commission Action Modal state
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [commissionActionType, setCommissionActionType] = useState<'approve' | 'reverse'>('approve');
  const [commissionAuditReason, setCommissionAuditReason] = useState('');

  // Generate Commission Modal state
  const [showGenerateCommissionModal, setShowGenerateCommissionModal] = useState(false);
  const [genConversionId, setGenConversionId] = useState('');
  const [genRuleId, setGenRuleId] = useState('');

  // New Rule Modal state
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState('Executive Contingency Retainer');
  const [ruleRate, setRuleRate] = useState(10.0);
  const [ruleStatus, setRuleStatus] = useState<'active' | 'inactive'>('active');
  const [ruleDesc, setRuleDesc] = useState('');

  // Payout Batch Modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAffiliateId, setPayoutAffiliateId] = useState('');
  const [payoutPeriod, setPayoutPeriod] = useState('November 2026 Cycle');
  const [payoutMethod, setPayoutMethod] = useState('Fedwire (Domestic US)');

  // Record Payment Modal state
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [wireRef, setWireRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');

  // Application Filter state
  const [appStatusFilter, setAppStatusFilter] = useState<string>('ALL');

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [m, apps, affs, refs, convs, comms, rls, pays, logs, clients] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminApplications(),
        api.getAdminAffiliates(),
        api.getAdminReferrals(),
        api.getAdminConversions(),
        api.getAdminCommissions(),
        api.getAdminCommissionRules(),
        api.getAdminPayouts(),
        api.getAdminAuditLogs(),
        api.getAdminClientRegistrations()
      ]);

      setMetrics(m.metrics);
      setApplications(apps.applications);
      setAffiliates(affs.affiliates);
      setLeads(refs.leads);
      setClicks(refs.clicks);
      setConversions(convs.conversions);
      setCommissions(comms.commissions);
      setRules(rls.rules);
      setPayouts(pays.payouts);
      setAuditLogs(logs.auditLogs);
      setClientRegistrations(clients.registrations || []);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 1. Application Review Action
  const handleReviewApp = async (status: ApplicationStatus) => {
    if (!selectedApp) return;
    try {
      await api.reviewApplication(selectedApp.id, status, appReviewNotes);
      setSelectedApp(null);
      setAppReviewNotes('');
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error updating application status');
    }
  };

  // 2. Activate Approved Application
  const handleActivateApp = async () => {
    if (!selectedApp) return;
    try {
      await api.activateApplication(selectedApp.id, activationCode || undefined, Number(activationRate));
      setSelectedApp(null);
      setActivationCode('');
      fetchAllData();
      alert(`Application ${selectedApp.referenceNumber} has been activated into a live Affiliate Partner!`);
    } catch (err: any) {
      alert(err.message || 'Error activating affiliate');
    }
  };

  // 3. Toggle Affiliate Status
  const handleUpdateAffiliateStatus = async (affId: string, currentStatus: AffiliateStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const reason = prompt(`Reason for setting status to ${newStatus}:`, 'Governance periodic compliance review');
    if (reason === null) return;

    try {
      await api.updateAffiliateStatus(affId, newStatus, reason);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error updating affiliate status');
    }
  };

  // 4. Create New Conversion
  const handleCreateConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convAffiliateId) {
      alert('Please select an affiliate partner');
      return;
    }

    try {
      await api.createConversion({
        affiliateId: convAffiliateId,
        leadId: convLeadId || undefined,
        membershipTierOrCategory: convCategory,
        eligibleSaleAmount: Number(convAmount),
        verificationStatus: 'verified',
        verificationNotes: convNotes || 'Executed contingency retainer banked in escrow.'
      });
      setShowNewConversionModal(false);
      setConvNotes('');
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error recording conversion');
    }
  };

  // 5. Verify / Reverse Conversion
  const handleVerifyConversion = async (convId: string, newStatus: string) => {
    const notes = prompt(`Verification audit notes for ${newStatus}:`, 'Verified by R3 compliance and banking audit.');
    if (notes === null) return;

    try {
      await api.verifyConversion(convId, newStatus, notes);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error verifying conversion');
    }
  };

  // 6. Generate Commission using Approved Rule
  const handleGenerateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genConversionId) {
      alert('Please select a conversion record');
      return;
    }

    try {
      await api.generateCommission(genConversionId, genRuleId || undefined);
      setShowGenerateCommissionModal(false);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error calculating commission');
    }
  };

  // 7. Approve / Reverse Commission with Audit Reason
  const handleCommissionAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommission || !commissionAuditReason.trim()) {
      alert('Formal audit reason is mandatory');
      return;
    }

    try {
      await api.actionCommission(selectedCommission.id, commissionActionType, commissionAuditReason.trim());
      setSelectedCommission(null);
      setCommissionAuditReason('');
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error updating commission');
    }
  };

  // 8. Create Commission Rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !ruleRate) return;

    try {
      await api.createCommissionRule({
        name: ruleName.trim(),
        serviceCategory: ruleCategory,
        ratePercent: Number(ruleRate),
        status: ruleStatus,
        description: ruleDesc.trim()
      });
      setShowNewRuleModal(false);
      setRuleName('');
      setRuleDesc('');
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error creating rule');
    }
  };

  // 9. Toggle Rule Status (Keep unapproved inactive!)
  const handleToggleRuleStatus = async (ruleId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.toggleRuleStatus(ruleId, nextStatus);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error updating rule status');
    }
  };

  // 10. Prepare Payout Batch
  const handlePreparePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutAffiliateId) return;

    try {
      await api.preparePayout(payoutAffiliateId, payoutPeriod, payoutMethod);
      setShowPayoutModal(false);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error preparing payout batch');
    }
  };

  // 11. Record Completed Wire Settlement
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayout || !wireRef.trim()) {
      alert('Fedwire / ACH / wire payment reference is required');
      return;
    }

    try {
      await api.recordPayoutPayment(selectedPayout.id, wireRef.trim(), payoutNotes.trim());
      setSelectedPayout(null);
      setWireRef('');
      setPayoutNotes('');
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error recording payout payment');
    }
  };

  // 12. Client CRM Handlers
  const handleOpenClientNotes = async (client: ClientRegistration) => {
    setSelectedClientForNotes(client);
    try {
      const [notesRes, followupsRes] = await Promise.all([
        api.getAdminClientNotes(client.id),
        api.getAdminClientFollowups(client.id)
      ]);
      setClientNotes(notesRes.notes || []);
      setClientFollowups(followupsRes.followups || []);
    } catch (err: any) {
      console.error('Error fetching client CRM notes:', err);
    }
  };

  const handleAddClientNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForNotes || !newNoteContent.trim()) return;
    try {
      const res = await api.addAdminClientNote({
        registrationId: selectedClientForNotes.id,
        content: newNoteContent.trim()
      });
      setClientNotes((prev) => [res.note, ...prev]);
      setNewNoteContent('');
    } catch (err: any) {
      alert(err.message || 'Failed to record note');
    }
  };

  const handleAddClientFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForNotes || !newFollowupDueDate) return;
    try {
      const res = await api.addAdminClientFollowup({
        registrationId: selectedClientForNotes.id,
        title: 'Fiduciary Review',
        dueDate: newFollowupDueDate,
        notes: newFollowupNotes.trim()
      });
      setClientFollowups((prev) => [...prev, res.followup]);
      setNewFollowupDueDate('');
      setNewFollowupNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to schedule followup');
    }
  };

  const handleResendClientInvite = async (clientId: string) => {
    setIsResendingInvite(clientId);
    try {
      const res = await api.resendAdminClientInvitation(clientId);
      alert(res.message || 'Invitation email dispatched successfully via Resend.');
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to resend invitation');
    } finally {
      setIsResendingInvite(null);
    }
  };

  const handleUpdateClientStatus = async (clientId: string, newStatus: any) => {
    try {
      await api.updateAdminClientRegistrationStatus(clientId, newStatus);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (appStatusFilter === 'ALL') return true;
    return app.status === appStatusFilter;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-xs flex flex-col justify-start items-center p-3 sm:p-6 lg:p-8">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] w-full max-w-7xl shadow-2xl flex flex-col my-auto">
        {/* Top Bar */}
        <div className="p-6 bg-[#0A192F] text-[#FAF9F6] border-b border-[#1A2E4C] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black border border-stone-800 rounded-xs flex items-center justify-center p-1 shrink-0 shadow-xs">
              <img
                src="/logo-emblem.png"
                alt="R3 Contingencies"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/favicon.svg';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl tracking-wide uppercase text-white">
                  Administration & Governance Control
                </h2>
                <span className="text-[10px] font-mono uppercase text-[#D4AF37] px-2 py-0.5 bg-[#1A2E4C] border border-[#2A3E5C]">
                  Role: {user?.role.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-stone-400 font-light flex items-center gap-2 mt-0.5">
                <span>{user?.fullName}</span>
                <span>·</span>
                <span className="text-stone-300 font-mono text-[11px]">{user?.email}</span>
                <span>·</span>
                <span className="text-emerald-400 font-mono text-[11px]">Strict Server Authorization</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={fetchAllData}
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
              title="Close Admin Area"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="px-6 py-3 bg-white border-b border-[#E2DDD3] overflow-x-auto flex items-center gap-2 text-xs">
          {[
            { id: 'overview', label: 'Program Overview' },
            { id: 'applications', label: `Applications (${metrics?.pendingApplications ?? 0} Pending)` },
            { id: 'affiliates', label: `Affiliates Directory (${affiliates.length})` },
            { id: 'client_crm', label: `Client CRM (${clientRegistrations.length})` },
            { id: 'conversions', label: `Conversions (${conversions.length})` },
            { id: 'commissions', label: `Commission Ledger (${commissions.length})` },
            { id: 'rules', label: `Commission Rules (${rules.length})` },
            { id: 'payouts', label: `Payout Batches (${payouts.length})` },
            { id: 'audit', label: `Audit Log (${auditLogs.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 font-medium transition-colors whitespace-nowrap uppercase tracking-wider text-[11px] border ${
                activeTab === tab.id
                  ? 'bg-[#0A192F] text-[#FAF9F6] border-[#0A192F]'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-6 lg:p-8 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && metrics && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white border border-[#E2DDD3]">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 block mb-1">
                    Pending Candidacies
                  </span>
                  <span className="font-mono text-3xl font-semibold text-amber-700 tabular-nums">
                    {metrics.pendingApplications}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 font-light">
                    of {metrics.totalApplications} total submitted
                  </span>
                </div>

                <div className="p-5 bg-white border border-[#E2DDD3]">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 block mb-1">
                    Active Affiliates
                  </span>
                  <span className="font-mono text-3xl font-semibold text-[#0A192F] tabular-nums">
                    {metrics.activeAffiliates}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 font-light">
                    Accredited partners in good standing
                  </span>
                </div>

                <div className="p-5 bg-white border border-[#E2DDD3]">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 block mb-1">
                    Verified Conversions
                  </span>
                  <span className="font-mono text-3xl font-semibold text-emerald-800 tabular-nums">
                    {metrics.verifiedConversions}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 font-light">
                    {metrics.pendingConversions} pending banking audit
                  </span>
                </div>

                <div className="p-5 bg-white border border-[#E2DDD3]">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 block mb-1">
                    Approved Unpaid Commissions
                  </span>
                  <span className="font-mono text-3xl font-semibold text-[#D4AF37] tabular-nums">
                    ${metrics.approvedUnpaidCommissions.toLocaleString()}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1 font-light">
                    USD scheduled for disbursement
                  </span>
                </div>
              </div>

              {/* Secondary Metrics Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-white border border-[#E2DDD3]">
                  <span className="text-stone-500 block">Pending Commission Approvals</span>
                  <span className="font-mono text-xl font-medium text-[#0A192F] tabular-nums">
                    ${metrics.pendingCommissionApproval.toLocaleString()} USD
                  </span>
                </div>
                <div className="p-4 bg-white border border-[#E2DDD3]">
                  <span className="text-stone-500 block">Total Historical Disbursed Payouts</span>
                  <span className="font-mono text-xl font-medium text-[#0A192F] tabular-nums">
                    ${metrics.totalPaidOutCommissions.toLocaleString()} USD
                  </span>
                </div>
                <div className="p-4 bg-white border border-[#E2DDD3]">
                  <span className="text-stone-500 block">Active Approved Commission Rules</span>
                  <span className="font-mono text-xl font-medium text-[#0A192F] tabular-nums">
                    {metrics.activeCommissionRulesCount} Active Rules
                  </span>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="p-6 bg-white border border-[#E2DDD3]">
                <h4 className="font-serif text-lg text-[#0A192F] mb-4">Direct Administrative Operations</h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setActiveTab('applications')}
                    className="px-4 py-2 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240]"
                  >
                    Review Application Queue ({metrics.pendingApplications})
                  </button>
                  <button
                    onClick={() => setShowNewConversionModal(true)}
                    className="px-4 py-2 border border-[#0A192F] text-[#0A192F] text-xs uppercase tracking-wider hover:bg-stone-50"
                  >
                    + Record Eligible Transaction
                  </button>
                  <button
                    onClick={() => setShowGenerateCommissionModal(true)}
                    className="px-4 py-2 border border-[#0A192F] text-[#0A192F] text-xs uppercase tracking-wider hover:bg-stone-50"
                  >
                    Calculate Commission with Rules
                  </button>
                  <button
                    onClick={() => setShowPayoutModal(true)}
                    className="px-4 py-2 border border-[#D4AF37] text-[#0A192F] text-xs uppercase tracking-wider hover:bg-amber-50/50"
                  >
                    Prepare Payout Batch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPLICATIONS */}
          {activeTab === 'applications' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Partnership Application Queue</h3>
                  <p className="text-xs text-stone-600 font-light">
                    Submitted candidacies awaiting due diligence, partner interview, or account provisioning.
                  </p>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'INFORMATION_REQUESTED', 'REJECTED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setAppStatusFilter(st)}
                      className={`px-2.5 py-1 text-[10px] uppercase font-mono border transition-colors ${
                        appStatusFilter === st
                          ? 'bg-[#0A192F] text-[#FAF9F6] border-[#0A192F]'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Applications Table */}
              <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Candidate / Entity</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Country</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredApplications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-stone-500 font-light">
                          No applications matching filter '{appStatusFilter}'.
                        </td>
                      </tr>
                    ) : (
                      filteredApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                            {app.referenceNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-[#0A192F] block">{app.fullName}</span>
                            <span className="text-[11px] text-stone-500 font-light">
                              {app.applicantType === 'Business' ? app.businessName : 'Individual'} · {app.email}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-stone-700">{app.partnershipCategory}</td>
                          <td className="py-3.5 px-4 text-stone-700">{app.country}</td>
                          <td className="py-3.5 px-4">
                            <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                              app.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : app.status === 'UNDER_REVIEW'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : app.status === 'INFORMATION_REQUESTED'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : app.status === 'REJECTED'
                                ? 'bg-stone-100 text-stone-500 border-stone-300'
                                : 'bg-stone-50 text-stone-800 border-stone-300'
                            }`}>
                              {app.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-stone-500 text-[11px]">
                            {new Date(app.submittedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setAppReviewNotes(app.statusNotes || '');
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium border border-stone-300 hover:border-[#0A192F] text-[#0A192F] transition-colors"
                            >
                              Review Dossier
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AFFILIATES */}
          {activeTab === 'affiliates' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Active Affiliates Directory</h3>
                <p className="text-xs text-stone-600 font-light">
                  Accredited partners, unique referral keys, traffic counts, and governance controls.
                </p>
              </div>

              <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Affiliate No.</th>
                      <th className="py-3 px-4">Partner Name & Business</th>
                      <th className="py-3 px-4">Referral Code</th>
                      <th className="py-3 px-4 text-right">Clicks</th>
                      <th className="py-3 px-4 text-right">Unique Visitors</th>
                      <th className="py-3 px-4 text-right">Approved Rate</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {affiliates.map((aff) => (
                      <tr key={aff.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                          {aff.affiliateNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-[#0A192F] block">{aff.fullName}</span>
                          <span className="text-[11px] text-stone-500 font-light">
                            {aff.businessName || 'Individual Partner'} · {aff.email}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-[#D4AF37]">
                          {aff.referralCode}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {aff.totalClicks}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {aff.uniqueVisitors}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-[#0A192F] tabular-nums">
                          {aff.approvedRatePercent.toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                            aff.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}>
                            {aff.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleUpdateAffiliateStatus(aff.id, aff.status)}
                            className={`px-2 py-1 text-[10px] uppercase font-mono border transition-colors ${
                              aff.status === 'active'
                                ? 'text-red-700 border-red-200 hover:bg-red-50'
                                : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                            }`}
                          >
                            {aff.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CONVERSIONS */}
          {activeTab === 'conversions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Conversion Verification Queue</h3>
                  <p className="text-xs text-stone-600 font-light">
                    Review transaction evidence, banking audit logs, and verify eligible contracts.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewConversionModal(true)}
                  className="px-4 py-2 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240]"
                >
                  + Record Eligible Sale
                </button>
              </div>

              <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tx Reference</th>
                      <th className="py-3 px-4">Affiliate Partner</th>
                      <th className="py-3 px-4">Service Category</th>
                      <th className="py-3 px-4 text-right">Contract Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Auditor / Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {conversions.map((conv) => {
                      const aff = affiliates.find(a => a.id === conv.affiliateId);
                      return (
                        <tr key={conv.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                            {conv.transactionReference}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-[#0A192F] block">
                              {aff?.businessName || aff?.fullName || conv.affiliateId}
                            </span>
                            <span className="text-[11px] font-mono text-[#D4AF37]">
                              {aff?.referralCode}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-stone-700">{conv.membershipTierOrCategory}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0A192F] tabular-nums">
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
                          <td className="py-3.5 px-4 text-stone-600 text-[11px]">
                            {conv.verifiedBy ? (
                              <span>Audited by: {conv.verifiedBy}</span>
                            ) : (
                              <span>{conv.verificationNotes || 'Awaiting banking clearance'}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            {conv.verificationStatus !== 'verified' ? (
                              <button
                                onClick={() => handleVerifyConversion(conv.id, 'verified')}
                                className="px-2 py-1 text-[10px] uppercase font-mono border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              >
                                Verify Sale
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVerifyConversion(conv.id, 'reversed')}
                                className="px-2 py-1 text-[10px] uppercase font-mono border border-red-300 text-red-800 hover:bg-red-50"
                              >
                                Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: COMMISSION LEDGER */}
          {activeTab === 'commissions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Program Commission Ledger</h3>
                  <p className="text-xs text-stone-600 font-light">
                    Commission calculations must strictly apply verified transactions and active approved rules.
                  </p>
                </div>
                <button
                  onClick={() => setShowGenerateCommissionModal(true)}
                  className="px-4 py-2 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240]"
                >
                  + Calculate Commission
                </button>
              </div>

              <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Commission Ref</th>
                      <th className="py-3 px-4">Affiliate</th>
                      <th className="py-3 px-4">Linked Tx</th>
                      <th className="py-3 px-4 text-right">Base Amount</th>
                      <th className="py-3 px-4 text-right">Rate</th>
                      <th className="py-3 px-4 text-right">Commission Due</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Governance Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {commissions.map((com) => {
                      const aff = affiliates.find(a => a.id === com.affiliateId);
                      return (
                        <tr key={com.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                            {com.commissionReference}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-[#0A192F] block">
                              {aff?.businessName || aff?.fullName || com.affiliateId}
                            </span>
                            <span className="text-[11px] font-mono text-stone-500">
                              {aff?.affiliateNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-stone-600 text-[11px]">
                            {com.transactionReference}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            ${com.eligibleTransactionAmount.toLocaleString()} USD
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-[#0A192F] tabular-nums">
                            {com.appliedCommissionRate.toFixed(2)}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0A192F] tabular-nums">
                            ${com.commissionAmount.toLocaleString()} USD
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                              com.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : com.status === 'approved'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : com.status === 'reversed'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}>
                              {com.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {com.status === 'pending' && (
                              <button
                                onClick={() => {
                                  setSelectedCommission(com);
                                  setCommissionActionType('approve');
                                }}
                                className="px-2 py-1 text-[10px] uppercase font-mono border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              >
                                Approve
                              </button>
                            )}
                            {com.status === 'approved' && !com.payoutId && (
                              <button
                                onClick={() => {
                                  setSelectedCommission(com);
                                  setCommissionActionType('reverse');
                                }}
                                className="px-2 py-1 text-[10px] uppercase font-mono border border-red-300 text-red-800 hover:bg-red-50"
                              >
                                Reverse
                              </button>
                            )}
                            {com.status === 'paid' && (
                              <span className="font-mono text-[10px] text-stone-400">Paid in Batch</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: COMMISSION RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Authorized Commission Rules</h3>
                  <p className="text-xs text-stone-600 font-light">
                    Commission rates and commercial terms must be approved by authorized R3 administrators. Unapproved rules remain strictly inactive.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewRuleModal(true)}
                  className="px-4 py-2 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240]"
                >
                  + Create Commission Rule
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-6 bg-white border border-[#E2DDD3]">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono block mb-1">
                          Category: {rule.serviceCategory}
                        </span>
                        <h4 className="font-serif text-lg text-[#0A192F] font-normal">{rule.name}</h4>
                      </div>
                      <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${
                        rule.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-stone-100 text-stone-600 border-stone-300'
                      }`}>
                        {rule.status}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 font-light mb-4">
                      {rule.description || 'No description provided.'}
                    </p>

                    <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-stone-400 font-light block text-[11px]">Approved Rate</span>
                        <span className="font-mono text-xl font-bold text-[#0A192F]">{rule.ratePercent}%</span>
                      </div>

                      <div className="text-right">
                        <span className="text-stone-400 font-light block text-[11px]">Authorized Officer</span>
                        <span className="font-mono text-stone-600 text-[11px]">{rule.approvedBy || 'Pending Board Approval'}</span>
                      </div>

                      <button
                        onClick={() => handleToggleRuleStatus(rule.id, rule.status)}
                        className={`px-3 py-1.5 text-[10px] uppercase font-mono border transition-colors ${
                          rule.status === 'active'
                            ? 'text-stone-700 border-stone-300 hover:bg-stone-50'
                            : 'text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        {rule.status === 'active' ? 'Deactivate' : 'Approve & Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: PAYOUT BATCHES */}
          {activeTab === 'payouts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Disbursement Payout Batches</h3>
                  <p className="text-xs text-stone-600 font-light">
                    Prepare payout batches for approved commissions and record completed U.S. Fedwire and ACH transfers.
                  </p>
                </div>
                <button
                  onClick={() => setShowPayoutModal(true)}
                  className="px-4 py-2 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-wider hover:bg-[#112240]"
                >
                  + Prepare Payout Batch
                </button>
              </div>

              <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Payout Ref</th>
                      <th className="py-3 px-4">Affiliate</th>
                      <th className="py-3 px-4">Cycle Period</th>
                      <th className="py-3 px-4 text-right">Batch Amount</th>
                      <th className="py-3 px-4">Disbursement Method</th>
                      <th className="py-3 px-4">Wire Reference</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {payouts.map((pay) => {
                      const aff = affiliates.find(a => a.id === pay.affiliateId);
                      return (
                        <tr key={pay.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-[#0A192F]">
                            {pay.payoutReference}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-[#0A192F] block">
                              {aff?.businessName || aff?.fullName || pay.affiliateId}
                            </span>
                            <span className="text-[11px] font-mono text-stone-500">
                              {aff?.affiliateNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-stone-700">{pay.payoutPeriod}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#D4AF37] tabular-nums">
                            ${pay.amount.toLocaleString()} {pay.currency}
                          </td>
                          <td className="py-3.5 px-4 text-stone-600">{pay.paymentMethod}</td>
                          <td className="py-3.5 px-4 font-mono text-stone-700 text-[11px]">
                            {pay.paymentReference || 'Scheduled'}
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
                          <td className="py-3.5 px-4 text-right">
                            {pay.status !== 'paid' && (
                              <button
                                onClick={() => setSelectedPayout(pay)}
                                className="px-2.5 py-1 text-[10px] uppercase font-mono border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              >
                                Record Wire Settlement
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Institutional Audit Trail</h3>
                <p className="text-xs text-stone-600 font-light">
                  Immutable record of administrative actions, compliance reviews, status transitions, and banking disbursements.
                </p>
              </div>

              <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Timestamp (UTC)</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Target Type</th>
                      <th className="py-3 px-4">Target ID</th>
                      <th className="py-3 px-4">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-4 text-stone-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-US', { hour12: false })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#0A192F]">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-stone-700">
                          {log.actorEmail}
                          <span className="block text-[10px] text-stone-400 font-sans">Role: {log.actorRole}</span>
                        </td>
                        <td className="py-3 px-4 uppercase text-stone-600">{log.targetType}</td>
                        <td className="py-3 px-4 text-stone-500">{log.targetId}</td>
                        <td className="py-3 px-4 text-stone-800 font-sans text-xs">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: CLIENT CRM */}
          {activeTab === 'client_crm' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Institutional Client CRM & Retainers</h3>
                  <p className="text-xs text-stone-600 font-light">
                    Direct corporate registrants, fiduciary account activation status, Resend invitations, and confidential advisory briefs.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono">
                    Active Clients: {clientRegistrations.filter(c => c.status === 'APPROVED').length}
                  </div>
                  <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono">
                    Pending Invites: {clientRegistrations.filter(c => c.status === 'PENDING').length}
                  </div>
                </div>
              </div>

              {/* Table of Client Registrations */}
              <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Client Dossier</th>
                      <th className="py-3.5 px-4">Contact Coordinates</th>
                      <th className="py-3.5 px-4">Jurisdiction</th>
                      <th className="py-3.5 px-4">Tier / Category</th>
                      <th className="py-3.5 px-4">Status & Invitation</th>
                      <th className="py-3.5 px-4 text-right">Fiduciary Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {clientRegistrations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-stone-500 font-light">
                          No client registrations recorded. Submissions through the portal or inquiry modal persist directly here in real time.
                        </td>
                      </tr>
                    ) : (
                      clientRegistrations.map((client) => (
                        <tr key={client.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#0A192F] text-sm">{client.fullName}</div>
                            {client.company && (
                              <div className="text-stone-500 text-[11px] font-light flex items-center gap-1">
                                <Building className="w-3 h-3 text-stone-400" />
                                <span>{client.company}</span>
                              </div>
                            )}
                            <div className="font-mono text-[10px] text-stone-400 mt-0.5">
                              {client.referenceNumber} · {new Date(client.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs">
                            <div className="text-stone-800">{client.email}</div>
                            <div className="text-stone-400 text-[11px] font-sans">{client.phone}</div>
                          </td>
                          <td className="py-3.5 px-4 font-light text-stone-700">
                            {client.country || 'United States'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 bg-stone-100 border border-stone-200 text-stone-800 text-[11px]">
                              {client.serviceCategory || 'Executive Contingency'}
                            </span>
                            {client.requirementsBrief && (
                              <div className="text-[10px] text-stone-400 mt-1 line-clamp-1">
                                {client.requirementsBrief}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider border ${
                                  client.status === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : client.status === 'IN_REVIEW'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : client.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-stone-100 text-stone-600 border-stone-200'
                                }`}
                              >
                                {client.status.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                                <MailCheck className="w-3 h-3 text-emerald-600" />
                                {client.invitationStatus === 'sent' || client.invitationSentAt ? 'Invite Dispatched' : 'Pending Invite'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Status select */}
                              <select
                                value={client.status}
                                onChange={(e) => handleUpdateClientStatus(client.id, e.target.value)}
                                className="text-[11px] px-2 py-1 bg-white border border-stone-300 text-stone-700"
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="IN_REVIEW">IN REVIEW</option>
                                <option value="APPROVED">APPROVED</option>
                                <option value="DECLINED">DECLINED</option>
                                <option value="ARCHIVED">ARCHIVED</option>
                              </select>

                              {/* Resend Invite */}
                              <button
                                onClick={() => handleResendClientInvite(client.id)}
                                disabled={isResendingInvite === client.id}
                                className="px-2.5 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                title="Resend Account Activation Invitation via Resend"
                              >
                                {isResendingInvite === client.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                <span>Invite</span>
                              </button>

                              {/* Notes & Followups */}
                              <button
                                onClick={() => handleOpenClientNotes(client)}
                                className="px-2.5 py-1 text-[11px] bg-[#0A192F] hover:bg-[#112240] text-white inline-flex items-center gap-1 transition-colors"
                              >
                                <MessageSquare className="w-3 h-3 text-[#D4AF37]" />
                                <span>CRM Notes</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: APPLICATION REVIEW DOSSIER */}
      {selectedApp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-2xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedApp(null)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Due Diligence Dossier
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-1">
              Review Application: {selectedApp.referenceNumber}
            </h3>
            <p className="text-xs text-stone-600 mb-6 font-light">
              Current Status: <strong className="font-mono text-[#0A192F]">{selectedApp.status}</strong> · Submitted: {new Date(selectedApp.submittedAt).toLocaleDateString()}
            </p>

            <div className="space-y-4 text-xs bg-white border border-[#E2DDD3] p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-stone-100">
                <div>
                  <span className="text-stone-400 block font-light text-[11px]">Full Name</span>
                  <span className="font-medium text-[#0A192F] text-sm">{selectedApp.fullName}</span>
                </div>
                <div>
                  <span className="text-stone-400 block font-light text-[11px]">Applicant Type</span>
                  <span className="font-medium text-[#0A192F] text-sm">
                    {selectedApp.applicantType} {selectedApp.businessName ? `(${selectedApp.businessName})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block font-light text-[11px]">Corporate Email</span>
                  <span className="font-mono text-[#0A192F]">{selectedApp.email}</span>
                </div>
                <div>
                  <span className="text-stone-400 block font-light text-[11px]">Direct Phone & Country</span>
                  <span className="text-[#0A192F]">{selectedApp.phone} · {selectedApp.country}</span>
                </div>
              </div>

              <div>
                <span className="text-stone-400 block font-light text-[11px] mb-1">Partnership Category</span>
                <span className="font-medium text-[#0A192F]">{selectedApp.partnershipCategory}</span>
              </div>

              <div>
                <span className="text-stone-400 block font-light text-[11px] mb-1">Professional / Industry Background</span>
                <p className="text-stone-700 leading-relaxed font-light bg-stone-50 p-3 border border-stone-200">
                  {selectedApp.industryBackground}
                </p>
              </div>

              <div>
                <span className="text-stone-400 block font-light text-[11px] mb-1">Client Network & Target Audience</span>
                <p className="text-stone-700 leading-relaxed font-light bg-stone-50 p-3 border border-stone-200">
                  {selectedApp.audienceDescription}
                </p>
              </div>

              <div>
                <span className="text-stone-400 block font-light text-[11px] mb-1">Partnership Objectives</span>
                <p className="text-stone-700 leading-relaxed font-light bg-stone-50 p-3 border border-stone-200">
                  {selectedApp.partnershipObjectives}
                </p>
              </div>

              {selectedApp.additionalInfo && (
                <div>
                  <span className="text-stone-400 block font-light text-[11px] mb-1">Additional Information</span>
                  <p className="text-stone-700 leading-relaxed font-light bg-stone-50 p-3 border border-stone-200">
                    {selectedApp.additionalInfo}
                  </p>
                </div>
              )}
            </div>

            {/* Compliance Review Notes */}
            <div className="mb-6">
              <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                Compliance Review Notes / Decision Rationale
              </label>
              <textarea
                rows={3}
                value={appReviewNotes}
                onChange={(e) => setAppReviewNotes(e.target.value)}
                placeholder="Log internal compliance checks, partner interview notes, or clarification required..."
                className="w-full text-xs p-3 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              />
            </div>

            {/* Decision Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#E2DDD3]">
              <button
                type="button"
                onClick={() => handleReviewApp('UNDER_REVIEW')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs uppercase tracking-wider font-medium"
              >
                Mark Under Review
              </button>
              <button
                type="button"
                onClick={() => handleReviewApp('INFORMATION_REQUESTED')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs uppercase tracking-wider font-medium"
              >
                Request Clarification
              </button>
              <button
                type="button"
                onClick={() => handleReviewApp('REJECTED')}
                className="px-4 py-2 bg-stone-600 hover:bg-stone-700 text-white text-xs uppercase tracking-wider font-medium"
              >
                Decline Candidate
              </button>
              <button
                type="button"
                onClick={() => handleReviewApp('APPROVED')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs uppercase tracking-wider font-medium ml-auto"
              >
                Approve Application
              </button>
            </div>

            {/* Activation Section (Only if approved and not yet activated) */}
            {selectedApp.status === 'APPROVED' && !selectedApp.activatedAffiliateId && (
              <div className="mt-6 pt-6 border-t border-stone-300 bg-emerald-50/50 p-6 border border-emerald-200">
                <span className="text-[10px] uppercase tracking-widest text-emerald-800 font-semibold block mb-1">
                  Step 2 · Partner Account Provisioning
                </span>
                <h4 className="font-serif text-lg text-[#0A192F] mb-3">
                  Activate into Live Affiliate Partner
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                      Custom Referral Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                      placeholder="e.g. VANCE-R3"
                      className="w-full text-xs font-mono px-3 py-2 border border-stone-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                      Approved Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={activationRate}
                      onChange={(e) => setActivationRate(Number(e.target.value))}
                      className="w-full text-xs font-mono px-3 py-2 border border-stone-300 bg-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleActivateApp}
                  className="w-full py-2.5 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest hover:bg-[#112240] transition-colors"
                >
                  Generate Affiliate ID & Activate Portal Access
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: NEW CONVERSION */}
      {showNewConversionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-lg w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setShowNewConversionModal(false)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Banking Audit & Verification
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-4">
              Record Eligible Transaction
            </h3>

            <form onSubmit={handleCreateConversion} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Attributed Affiliate Partner <span className="text-red-500">*</span>
                </label>
                <select
                  value={convAffiliateId}
                  onChange={(e) => setConvAffiliateId(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                >
                  <option value="">Select accredited partner...</option>
                  {affiliates.map((aff) => (
                    <option key={aff.id} value={aff.id}>
                      {aff.affiliateNumber} — {aff.businessName || aff.fullName} ({aff.referralCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Service Specialization Category
                </label>
                <select
                  value={convCategory}
                  onChange={(e) => setConvCategory(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                >
                  <option value="Executive Contingency Retainer">Executive Contingency Retainer</option>
                  <option value="Institutional Crisis Advisory">Institutional Crisis Advisory & Rapid Deployment</option>
                  <option value="Private Sovereign Support">Private U.S. Principal &amp; Fiduciary Support</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Eligible Contract Sale Amount (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={convAmount}
                  onChange={(e) => setConvAmount(Number(e.target.value))}
                  required
                  className="w-full text-xs font-mono px-3.5 py-2 border border-stone-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Verification Audit Notes
                </label>
                <textarea
                  rows={2}
                  value={convNotes}
                  onChange={(e) => setConvNotes(e.target.value)}
                  placeholder="Escrow transaction ref, contract signature details..."
                  className="w-full text-xs p-3 border border-stone-300 bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest hover:bg-[#112240]"
                >
                  Record & Verify Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GENERATE COMMISSION WITH APPROVED RULES */}
      {showGenerateCommissionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-lg w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setShowGenerateCommissionModal(false)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Commission Engine
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-2">
              Calculate Commission
            </h3>
            <p className="text-xs text-stone-600 mb-4 font-light">
              Commission calculation must strictly utilize a verified eligible transaction and an approved active commercial rule.
            </p>

            <form onSubmit={handleGenerateCommission} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Select Verified Transaction <span className="text-red-500">*</span>
                </label>
                <select
                  value={genConversionId}
                  onChange={(e) => setGenConversionId(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                >
                  <option value="">Select verified conversion...</option>
                  {conversions
                    .filter((c) => c.verificationStatus === 'verified')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.transactionReference} — ${c.eligibleSaleAmount.toLocaleString()} USD ({c.membershipTierOrCategory})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Apply Approved Commission Rule
                </label>
                <select
                  value={genRuleId}
                  onChange={(e) => setGenRuleId(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                >
                  <option value="">Use Affiliate Default Approved Rate</option>
                  {rules
                    .filter((r) => r.status === 'active')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.ratePercent}%)
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest hover:bg-[#112240]"
                >
                  Calculate & Log into Commission Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: COMMISSION ACTION WITH MANDATORY AUDIT REASON */}
      {selectedCommission && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-md w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setSelectedCommission(null)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Governance Audit Requirement
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-1">
              {commissionActionType === 'approve' ? 'Approve Commission' : 'Reverse Commission'}
            </h3>
            <p className="text-xs text-stone-600 mb-4 font-light">
              Commission {selectedCommission.commissionReference}: ${selectedCommission.commissionAmount.toLocaleString()} USD
            </p>

            <form onSubmit={handleCommissionAction} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Compliance / Audit Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={commissionAuditReason}
                  onChange={(e) => setCommissionAuditReason(e.target.value)}
                  required
                  placeholder="State the formal governance reason for this ledger action (min 5 chars)..."
                  className="w-full text-xs p-3 border border-stone-300 bg-white"
                />
              </div>

              <button
                type="submit"
                className={`w-full py-3 text-[#FAF9F6] text-xs uppercase tracking-widest ${
                  commissionActionType === 'approve' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-700 hover:bg-red-800'
                }`}
              >
                Confirm {commissionActionType === 'approve' ? 'Approval' : 'Reversal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: NEW COMMISSION RULE */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-lg w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setShowNewRuleModal(false)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Commercial Policy
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-4">
              Create Commission Rule
            </h3>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Rule Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. U.S. Delaware Fiduciary Special Tier"
                  required
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    Service Scope
                  </label>
                  <select
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 bg-white"
                  >
                    <option value="Executive Contingency Retainer">Executive Contingency Retainer</option>
                    <option value="Institutional Crisis Advisory">Institutional Crisis Advisory</option>
                    <option value="Private Sovereign Support">Private U.S. Principal &amp; Fiduciary Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    Rate Percent (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="50"
                    value={ruleRate}
                    onChange={(e) => setRuleRate(Number(e.target.value))}
                    required
                    className="w-full text-xs font-mono px-3 py-2 border border-stone-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Initial Status
                </label>
                <select
                  value={ruleStatus}
                  onChange={(e) => setRuleStatus(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-stone-300 bg-white"
                >
                  <option value="active">Active (Authorized)</option>
                  <option value="inactive">Inactive / Draft (Awaiting R3 Approval)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Rule Description & Commercial Terms
                </label>
                <textarea
                  rows={2}
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  placeholder="Governing stipulations..."
                  className="w-full text-xs p-3 border border-stone-300 bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest hover:bg-[#112240]"
              >
                Save Commission Rule
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: PREPARE PAYOUT BATCH */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-lg w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setShowPayoutModal(false)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Treasury Settlement
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-4">
              Prepare Payout Batch
            </h3>

            <form onSubmit={handlePreparePayout} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Select Affiliate with Approved Commissions <span className="text-red-500">*</span>
                </label>
                <select
                  value={payoutAffiliateId}
                  onChange={(e) => setPayoutAffiliateId(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                >
                  <option value="">Select affiliate...</option>
                  {affiliates.map((aff) => {
                    const approvedAmt = commissions
                      .filter((c) => c.affiliateId === aff.id && c.status === 'approved' && !c.payoutId)
                      .reduce((s, c) => s + c.commissionAmount, 0);
                    return (
                      <option key={aff.id} value={aff.id}>
                        {aff.affiliateNumber} — {aff.businessName || aff.fullName} (${approvedAmt.toLocaleString()} USD outstanding)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Settlement Cycle Label
                </label>
                <input
                  type="text"
                  value={payoutPeriod}
                  onChange={(e) => setPayoutPeriod(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Disbursement Banking Method
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 bg-white"
                >
                  <option value="Fedwire (Domestic US)">Fedwire (Domestic US)</option>
                  <option value="ACH Direct Deposit (US)">ACH Direct Deposit (US)</option>
                  <option value="US Domestic Bank Wire">US Domestic Bank Wire</option>
                  <option value="SWIFT Wire Transfer">SWIFT Wire Transfer</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest hover:bg-[#112240]"
              >
                Compile Scheduled Payout Batch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: RECORD COMPLETED SETTLEMENT */}
      {selectedPayout && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-md w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setSelectedPayout(null)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Treasury Execution
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-1">
              Record Wire Payment
            </h3>
            <p className="text-xs text-stone-600 mb-4 font-light">
              Payout {selectedPayout.payoutReference}: ${selectedPayout.amount.toLocaleString()} USD
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Bank Wire / Remittance Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={wireRef}
                  onChange={(e) => setWireRef(e.target.value)}
                  placeholder="e.g. FEDWIRE-R3-994102-CITI"
                  required
                  className="w-full text-xs font-mono px-3.5 py-2.5 border border-stone-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Settlement Confirmation Notes
                </label>
                <textarea
                  rows={2}
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="Remittance advice emailed, banking confirmation..."
                  className="w-full text-xs p-3 border border-stone-300 bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-[#FAF9F6] text-xs uppercase tracking-widest"
              >
                Confirm Wire Disbursed & Settle Batch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: CLIENT CRM CONFIDENTIAL NOTES & FOLLOWUPS */}
      {selectedClientForNotes && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-3xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedClientForNotes(null)}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Fiduciary Records & Due Diligence (Staff Only)
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-1">
              Client CRM Dossier: {selectedClientForNotes.fullName}
            </h3>
            <p className="text-xs text-stone-600 mb-6 font-light">
              Ref: <span className="font-mono text-[#0A192F]">{selectedClientForNotes.referenceNumber}</span> · {selectedClientForNotes.email} · {selectedClientForNotes.country || 'United States'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Staff CRM Notes */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[#0A192F] flex items-center gap-1.5 border-b border-stone-200 pb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Confidential Internal Notes</span>
                </h4>

                {/* New Note Form */}
                <form onSubmit={handleAddClientNote} className="space-y-2">
                  <textarea
                    rows={3}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Enter compliance check, retainer discussion, risk review..."
                    required
                    className="w-full text-xs p-2.5 bg-white border border-stone-300 focus:outline-hidden focus:border-[#0A192F]"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-[#0A192F] hover:bg-[#112240] text-white text-[11px] uppercase tracking-wider transition-colors"
                  >
                    Record Staff Note
                  </button>
                </form>

                {/* Notes List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {clientNotes.length === 0 ? (
                    <div className="text-xs text-stone-500 font-light p-3 bg-stone-50 border border-stone-200 text-center">
                      No internal notes recorded yet.
                    </div>
                  ) : (
                    clientNotes.map((note) => (
                      <div key={note.id} className="p-3 bg-white border border-stone-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono">
                          <span>{note.authorEmail}</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-stone-800 leading-relaxed font-light">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Scheduled Followups */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[#0A192F] flex items-center gap-1.5 border-b border-stone-200 pb-2">
                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Scheduled Follow-up Reminders</span>
                </h4>

                {/* New Followup Form */}
                <form onSubmit={handleAddClientFollowup} className="space-y-2">
                  <input
                    type="date"
                    value={newFollowupDueDate}
                    onChange={(e) => setNewFollowupDueDate(e.target.value)}
                    required
                    className="w-full text-xs p-2 bg-white border border-stone-300"
                  />
                  <input
                    type="text"
                    value={newFollowupNotes}
                    onChange={(e) => setNewFollowupNotes(e.target.value)}
                    placeholder="e.g. Call regarding U.S. corporate compliance advisory"
                    className="w-full text-xs p-2 bg-white border border-stone-300"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-[#D4AF37] hover:bg-[#c29e2f] text-[#0A192F] text-[11px] font-semibold uppercase tracking-wider transition-colors"
                  >
                    Schedule Follow-up
                  </button>
                </form>

                {/* Followups List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {clientFollowups.length === 0 ? (
                    <div className="text-xs text-stone-500 font-light p-3 bg-stone-50 border border-stone-200 text-center">
                      No pending follow-ups scheduled.
                    </div>
                  ) : (
                    clientFollowups.map((fu) => (
                      <div key={fu.id} className="p-3 bg-white border border-stone-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-amber-700 font-semibold">Due: {fu.dueDate}</span>
                          <span className="uppercase text-stone-400">{fu.status}</span>
                        </div>
                        {fu.notes && <p className="text-stone-700 font-light">{fu.notes}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
