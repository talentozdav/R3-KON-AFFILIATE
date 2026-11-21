import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Shield,
  Lock,
  LogOut,
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  Globe,
  Phone,
  Mail,
  HelpCircle,
  FolderLock
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { formatInternationalDate } from '../../lib/international';
import { ClientKycStateResponse, KycStatus } from '../../types';
import { ClientKycVerification } from './ClientKycVerification';

interface ClientPortalProps {
  onClose: () => void;
  initialTab?: 'overview' | 'inquiries' | 'new_inquiry' | 'identity_verification' | 'security';
}

function getKycTabBadgeText(status?: KycStatus): string {
  switch (status) {
    case 'approved':
      return 'Verified';
    case 'under_review':
    case 'submitted':
      return 'Under Review';
    case 'action_required':
      return 'Action Needed';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}

export const ClientPortal: React.FC<ClientPortalProps> = ({ onClose, initialTab }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'inquiries' | 'new_inquiry' | 'identity_verification' | 'security'>(() => {
    if (initialTab) return initialTab;
    try {
      const target = sessionStorage.getItem('r3_portal_target_tab');
      if (target === 'identity_verification') {
        sessionStorage.removeItem('r3_portal_target_tab');
        return 'identity_verification';
      }
    } catch {
      // ignore storage errors
    }
    return 'overview';
  });
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [kycState, setKycState] = useState<ClientKycStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New inquiry submission form state
  const [serviceInterest, setServiceInterest] = useState('Executive Contingency Retainer');
  const [briefSummary, setBriefSummary] = useState('');
  const [priority, setPriority] = useState('high');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadKycStatus = async () => {
    try {
      const state = await api.getClientKycStatus();
      setKycState(state);
    } catch (err: any) {
      console.warn('[Client Portal] KYC status notice:', err.message);
    }
  };

  const fetchClientData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [inqRes, kycRes] = await Promise.allSettled([
        api.getClientInquiries(),
        api.getClientKycStatus()
      ]);
      if (inqRes.status === 'fulfilled') {
        setInquiries(inqRes.value.inquiries || []);
      }
      if (kycRes.status === 'fulfilled') {
        setKycState(kycRes.value);
      }
    } catch (err: any) {
      console.warn('[Client Portal] Inquiries fetch notice:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefSummary.trim()) return;

    setIsSubmitting(true);
    setSubmitSuccess(null);
    setErrorMsg(null);

    try {
      const res = await api.submitClientPortalInquiry({
        serviceInterest,
        briefSummary: briefSummary.trim(),
        priority
      });
      setSubmitSuccess(res.message);
      setBriefSummary('');
      fetchClientData();
      setTimeout(() => setActiveTab('inquiries'), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch inquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-xs flex flex-col justify-start items-center p-3 sm:p-6 lg:p-8">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] w-full max-w-5xl shadow-2xl flex flex-col my-auto">
        {/* Top Header */}
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
                  Client Coordination Portal
                </h2>
                <span className="font-mono text-[10px] tracking-widest uppercase bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 border border-[#D4AF37]/30">
                  Fiduciary Grade
                </span>
              </div>
              <p className="text-xs text-stone-400 font-light mt-0.5">
                Authenticated Principal: <strong className="text-white font-medium">{user?.fullName || 'Client Member'}</strong> ({user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-white border border-[#1A2E4C] hover:border-stone-600 px-3 py-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1.5 transition-colors"
              aria-label="Close portal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-[#E2DDD3] px-6 flex items-center gap-8 text-xs font-medium uppercase tracking-wider overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Dossier & Overview
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`py-4 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'inquiries'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Advisory Briefs ({inquiries.length})
          </button>
          <button
            onClick={() => setActiveTab('new_inquiry')}
            className={`py-4 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'new_inquiry'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            + Transmit Direct Brief
          </button>
          <button
            onClick={() => setActiveTab('identity_verification')}
            className={`py-4 border-b-2 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-2 ${
              activeTab === 'identity_verification'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Identity Verification</span>
            {kycState && (
              <span
                className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                  kycState.verificationStatus === 'approved'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : kycState.verificationStatus === 'action_required'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : kycState.verificationStatus === 'rejected'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : 'bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                {getKycTabBadgeText(kycState.verificationStatus)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-4 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Security & Compliance
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-8 bg-[#FAF9F6] min-h-[420px]">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KYC Action Callout */}
              {kycState && kycState.registrationApproved && kycState.verificationStatus !== 'approved' && (
                <div className="p-4 bg-[#0A192F] text-[#FAF9F6] border border-[#1A2E4C] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#D4AF37] block mb-0.5">
                      Identity Verification Required
                    </span>
                    <span className="font-light text-stone-200">
                      {kycState.verificationStatus === 'action_required'
                        ? 'R3 Compliance has requested additional verification details.'
                        : kycState.verificationStatus === 'under_review' || kycState.verificationStatus === 'submitted'
                        ? 'Your identity verification dossier is currently under compliance review.'
                        : kycState.verificationStatus === 'rejected'
                        ? 'Identity verification was not approved. Open the Identity Verification dossier for details.'
                        : 'Your registration is approved. Please complete identity verification (KYC) to unlock full compliance clearance.'}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('identity_verification')}
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c29e2f] text-[#0A192F] text-[11px] font-semibold uppercase tracking-wider shrink-0 cursor-pointer"
                  >
                    Open Verification Portal
                  </button>
                </div>
              )}

              {/* Membership Status Card */}
              <div className="bg-white border border-[#E2DDD3] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
                    <Shield className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-mono tracking-widest font-semibold">
                      Contingency Coverage Status
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
                    {user?.membershipTier || 'Executive Contingency Retainer'}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 font-light leading-relaxed max-w-xl">
                    Active international coordination protocol. Priority access to dedicated crisis response units, cross-border asset protection counsel, corporate continuity planning, and executive deployment.
                  </p>
                </div>
                <div className="bg-stone-50 border border-stone-200 p-4 text-right shrink-0 space-y-1">
                  <span className="text-[10px] text-stone-500 uppercase font-mono block">Dossier ID</span>
                  <span className="font-mono text-sm font-semibold text-[#0A192F] block">
                    {kycState?.registrationReference || user?.id?.slice(0, 13) || 'R3-CLT-ACTIVE'}
                  </span>
                  <span className="block text-[11px] font-mono text-stone-700">
                    Registration: <strong>{kycState?.registrationStatus || 'PENDING'}</strong>
                  </span>
                  <span
                    className={`block text-[11px] font-medium flex items-center justify-end gap-1 ${
                      kycState?.verificationStatus === 'approved' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>KYC: {getKycTabBadgeText(kycState?.verificationStatus)}</span>
                  </span>
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-[#E2DDD3] p-6">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-2">
                    Primary Contact
                  </div>
                  <div className="text-sm font-serif text-[#0A192F] font-normal mb-1">
                    {user?.fullName}
                  </div>
                  <div className="text-xs text-stone-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-stone-400" />
                      <span className="font-mono">{user?.email}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2DDD3] p-6">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-2">
                    Direct Secretariat
                  </div>
                  <div className="text-sm font-serif text-[#0A192F] font-normal mb-1">
                    Priority Operations Line
                  </div>
                  <div className="text-xs text-stone-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-stone-400" />
                      <a href="mailto:services@r3-konaffiliate.online" className="font-mono hover:underline">
                        services@r3-konaffiliate.online
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <a href="tel:+19313660615" className="font-mono hover:underline">
                        +1(931)366-0615
                      </a>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2DDD3] p-6">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-2">
                    Confidentiality Guarantee
                  </div>
                  <div className="text-sm font-serif text-[#0A192F] font-normal mb-1">
                    Strict NDA Binding
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed font-light">
                    All matters logged in this dossier remain protected under strict bilateral non-disclosure protocols and international fiduciary confidentiality standards.
                  </p>
                </div>
              </div>

              {/* Recent Inquiries Snippet */}
              <div className="bg-white border border-[#E2DDD3] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-serif text-lg text-[#0A192F]">Recent Advisory Briefs</h4>
                  <button
                    onClick={() => setActiveTab('new_inquiry')}
                    className="text-xs font-mono uppercase tracking-wider text-[#0A192F] hover:text-[#D4AF37] underline underline-offset-4 cursor-pointer"
                  >
                    + New Brief
                  </button>
                </div>

                {inquiries.length === 0 ? (
                  <div className="py-8 text-center text-stone-500 text-xs font-light">
                    No active advisory briefs currently filed. Use the "Transmit Direct Brief" button to file an encrypted request.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inquiries.slice(0, 3).map((inq) => (
                      <div key={inq.id || inq.reference_number} className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-[#0A192F] block font-mono">{inq.reference_number || inq.referenceNumber}</strong>
                          <span className="text-stone-600">{inq.service_interest || inq.serviceInterest}</span>
                        </div>
                        <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200">
                          {inq.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INQUIRIES LIST */}
          {activeTab === 'inquiries' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl text-[#0A192F] font-normal">Advisory Briefs & Inquiries</h3>
                  <p className="text-xs text-stone-600 font-light mt-0.5">
                    Encrypted historical archive of all instructions, situational briefs, and contingency matters.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('new_inquiry')}
                  className="bg-[#0A192F] text-[#FAF9F6] px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-[#112240] transition-colors cursor-pointer"
                >
                  + Transmit New Brief
                </button>
              </div>

              {inquiries.length === 0 ? (
                <div className="bg-white border border-[#E2DDD3] p-12 text-center">
                  <FolderLock className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                  <h4 className="font-serif text-lg text-[#0A192F] mb-1">No Briefs on Record</h4>
                  <p className="text-xs text-stone-600 font-light max-w-sm mx-auto mb-4">
                    Your account has zero active briefs logged. When urgent contingency coordination or advisory counsel is required, transmit a new brief directly.
                  </p>
                  <button
                    onClick={() => setActiveTab('new_inquiry')}
                    className="px-4 py-2 bg-[#0A192F] text-white text-xs uppercase tracking-wider font-medium"
                  >
                    File New Brief
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {inquiries.map((inq) => (
                    <div key={inq.id || inq.reference_number} className="bg-white border border-[#E2DDD3] p-6 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-100 mb-4">
                        <div>
                          <span className="font-mono text-xs text-[#D4AF37] tracking-wider block font-medium">
                            {inq.reference_number || inq.referenceNumber}
                          </span>
                          <h4 className="font-serif text-lg text-[#0A192F] mt-0.5">
                            {inq.service_interest || inq.serviceInterest}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase px-2 py-0.5 border bg-amber-50 text-amber-800 border-amber-300">
                            Priority: {inq.priority || 'High'}
                          </span>
                          <span className="font-mono text-[10px] uppercase px-2 py-0.5 border bg-blue-50 text-blue-800 border-blue-300">
                            Status: {inq.status}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-stone-700 leading-relaxed font-light mb-4 whitespace-pre-wrap">
                        {inq.brief_summary || inq.briefSummary}
                      </div>

                      <div className="text-[11px] text-stone-400 font-mono flex items-center justify-between pt-2 border-t border-stone-100">
                        <span>Logged: {formatInternationalDate(inq.created_at || inq.createdAt || new Date())}</span>
                        <span>Assigned Officer: {inq.assigned_coordinator || 'Intake Committee'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NEW INQUIRY FORM */}
          {activeTab === 'new_inquiry' && (
            <div className="max-w-2xl mx-auto bg-white border border-[#E2DDD3] p-8 shadow-xs">
              <div className="mb-6">
                <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-widest font-semibold font-mono">
                    Encrypted Case Gateway
                  </span>
                </div>
                <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
                  Transmit Confidential Brief
                </h3>
                <p className="text-xs text-stone-600 font-light mt-1">
                  Submissions are received immediately by the R3 Senior Crisis Secretariat under strict non-disclosure protections.
                </p>
              </div>

              {submitSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                    Service Focus / Retainer Scope
                  </label>
                  <select
                    value={serviceInterest}
                    onChange={(e) => setServiceInterest(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                  >
                    <option value="Executive Contingency Retainer">Executive Contingency Retainer</option>
                    <option value="Institutional Crisis Advisory & Rapid Deployment">Institutional Crisis Advisory & Rapid Deployment</option>
                    <option value="Private Client & Family Office Advisory">Private Client &amp; Family Office Advisory</option>
                    <option value="Cross-Border Corporate Asset Protection">Cross-Border Corporate Asset Protection</option>
                    <option value="Executive Security & Regulatory Defense">Executive Security &amp; Regulatory Defense</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                  >
                    <option value="urgent">Urgent — Immediate Emergency Response Required</option>
                    <option value="high">High — 4-Hour Response Window</option>
                    <option value="standard">Standard — Standard Business Advisory</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                    Confidential Situation Brief / Requirements
                  </label>
                  <textarea
                    rows={6}
                    value={briefSummary}
                    onChange={(e) => setBriefSummary(e.target.value)}
                    placeholder="Articulate the circumstances, countries or jurisdictions involved, key personnel, or required operational support..."
                    required
                    className="w-full text-xs p-3.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors font-light leading-relaxed"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{isSubmitting ? 'Transmitting Over Secure Channel...' : 'Transmit Confidential Brief'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: IDENTITY VERIFICATION (KYC) */}
          {activeTab === 'identity_verification' && (
            <ClientKycVerification
              kycState={kycState}
              onStateChange={(next) => setKycState(next)}
              onReload={loadKycStatus}
            />
          )}

          {/* TAB 5: SECURITY & COMPLIANCE */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E2DDD3] p-6 space-y-4">
                <h3 className="font-serif text-xl text-[#0A192F]">Global Security Architecture &amp; Compliance Governance</h3>
                <p className="text-xs text-stone-600 leading-relaxed font-light">
                  R3 Contingencies operates under cross-border corporate governance standards, international anti-money laundering (AML/KYC) due diligence, and binding non-disclosure protocols tailored for clients worldwide.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-stone-100 text-xs">
                  <div className="p-4 bg-stone-50 border border-stone-200">
                    <strong className="block text-[#0A192F] mb-1">Row Level Security (RLS)</strong>
                    Your client records are isolated cryptographically within our database. Zero cross-tenant or affiliate visibility into your identifying dossier.
                  </div>
                  <div className="p-4 bg-stone-50 border border-stone-200">
                    <strong className="block text-[#0A192F] mb-1">Encrypted Inbound Dispatch</strong>
                    Direct communication with your designated Senior Contingency Coordinator occurs through encrypted channels.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
