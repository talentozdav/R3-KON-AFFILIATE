import React, { useState } from 'react';
import { api } from '../../lib/api';
import { formatInternationalDate, formatInternationalTimestampUTC } from '../../lib/international';
import {
  ComplianceKycOverview,
  ComplianceKycSubmission,
  KycStatus
} from '../../types';
import {
  ShieldCheck,
  Eye,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  X,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface AdminKycCompliancePanelProps {
  overview: ComplianceKycOverview | null;
  submissions: ComplianceKycSubmission[];
  onRefresh: () => Promise<void>;
}

function getStatusBadgeClasses(status: KycStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'under_review':
    case 'submitted':
      return 'bg-blue-50 text-blue-800 border-blue-300';
    case 'action_required':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    case 'rejected':
      return 'bg-red-50 text-red-800 border-red-300';
    case 'not_started':
    default:
      return 'bg-stone-100 text-stone-700 border-stone-300';
  }
}

export const AdminKycCompliancePanel: React.FC<AdminKycCompliancePanelProps> = ({
  overview,
  submissions,
  onRefresh
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedDossier, setSelectedDossier] = useState<ComplianceKycSubmission | null>(null);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);

  // Short-lived signed document viewer state (never stored in localStorage)
  const [activeDocPreview, setActiveDocPreview] = useState<{
    docId: string;
    signedUrl: string;
    mimeType: string;
    originalFilename: string;
    expiresInSeconds: number;
  } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Decision state
  const [clientMessage, setClientMessage] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const filteredSubmissions = submissions.filter(item => {
    if (statusFilter === 'ALL') return true;
    return item.verificationStatus === statusFilter;
  });

  const handleOpenDossier = async (item: ComplianceKycSubmission) => {
    setPanelError(null);
    setActiveDocPreview(null);
    setSelectedDossier(item);
    setClientMessage('');
    setInternalNotes(item.internalComplianceNotes || '');
    setIsLoadingDossier(true);
    try {
      const res = await api.getAdminKycSubmission(item.id);
      setSelectedDossier(res.submission);
      setInternalNotes(res.submission.internalComplianceNotes || '');
    } catch (err: any) {
      setPanelError(err.message || 'Unable to load detailed KYC dossier.');
    } finally {
      setIsLoadingDossier(false);
    }
  };

  const handleCloseDossier = () => {
    setSelectedDossier(null);
    setActiveDocPreview(null);
    setClientMessage('');
    setInternalNotes('');
    setPanelError(null);
  };

  const handleViewDocument = async (docId: string) => {
    setLoadingDocId(docId);
    setPanelError(null);
    try {
      const res = await api.getAdminKycDocumentSignedUrl(docId);
      setActiveDocPreview({
        docId,
        signedUrl: res.signedUrl,
        mimeType: res.mimeType,
        originalFilename: res.originalFilename,
        expiresInSeconds: res.expiresInSeconds
      });
    } catch (err: any) {
      setPanelError(err.message || 'Unable to generate temporary signed document link.');
    } finally {
      setLoadingDocId(null);
    }
  };

  const handleDecision = async (decision: 'approve' | 'reject' | 'request_info') => {
    if (!selectedDossier) return;
    setPanelError(null);

    if ((decision === 'reject' || decision === 'request_info') && clientMessage.trim().length < 5) {
      setPanelError(
        decision === 'reject'
          ? 'A clear rejection reason (at least 5 characters) is mandatory and will be emailed to the client.'
          : 'Clear client instructions specifying the additional information required (at least 5 characters) must be provided.'
      );
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const res = await api.decideAdminKycSubmission(selectedDossier.id, {
        decision,
        clientMessage: clientMessage.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined
      });
      setSelectedDossier(res.submission);
      setClientMessage('');
      await onRefresh();
    } catch (err: any) {
      setPanelError(err.message || 'Compliance decision failed.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] uppercase font-mono tracking-widest font-semibold">
              Restricted Compliance Governance (KYC)
            </span>
          </div>
          <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
            Client Identity Verification Queue
          </h3>
          <p className="text-xs text-stone-600 font-light">
            Strictly restricted to authorised Compliance Officers and Super Administrators. Documents open via short-lived audited links.
          </p>
        </div>

        {/* Status Filter Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {['ALL', 'under_review', 'action_required', 'approved', 'rejected', 'not_started'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-[10px] uppercase font-mono border transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#0A192F] text-[#FAF9F6] border-[#0A192F]'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Metric Strip */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-4 bg-white border border-[#E2DDD3]">
            <span className="text-[10px] uppercase font-mono text-stone-500 block">Total Dossiers</span>
            <span className="font-mono text-2xl font-semibold text-[#0A192F]">{overview.total}</span>
          </div>
          <div className="p-4 bg-white border border-[#E2DDD3]">
            <span className="text-[10px] uppercase font-mono text-blue-700 block">Under Review</span>
            <span className="font-mono text-2xl font-semibold text-blue-800">{overview.pendingReview}</span>
          </div>
          <div className="p-4 bg-white border border-[#E2DDD3]">
            <span className="text-[10px] uppercase font-mono text-amber-700 block">Action Required</span>
            <span className="font-mono text-2xl font-semibold text-amber-800">{overview.actionRequired}</span>
          </div>
          <div className="p-4 bg-white border border-[#E2DDD3]">
            <span className="text-[10px] uppercase font-mono text-emerald-700 block">Approved</span>
            <span className="font-mono text-2xl font-semibold text-emerald-800">{overview.approved}</span>
          </div>
          <div className="p-4 bg-white border border-[#E2DDD3]">
            <span className="text-[10px] uppercase font-mono text-red-700 block">Rejected</span>
            <span className="font-mono text-2xl font-semibold text-red-800">{overview.rejected}</span>
          </div>
          <div className="p-4 bg-white border border-[#E2DDD3]">
            <span className="text-[10px] uppercase font-mono text-stone-500 block">Not Started</span>
            <span className="font-mono text-2xl font-semibold text-stone-700">{overview.notStarted}</span>
          </div>
        </div>
      )}

      {/* Submissions Table */}
      <div className="bg-white border border-[#E2DDD3] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-[#E2DDD3] text-[10px] uppercase font-medium text-stone-600 tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Registration Ref</th>
              <th className="py-3.5 px-4">Principal / Email</th>
              <th className="py-3.5 px-4">Jurisdiction</th>
              <th className="py-3.5 px-4">ID &amp; US SSN Token</th>
              <th className="py-3.5 px-4">Verification Status</th>
              <th className="py-3.5 px-4">Submitted / Updated</th>
              <th className="py-3.5 px-4 text-right">Compliance Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredSubmissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-stone-500 font-light">
                  No client KYC dossiers found for filter '{statusFilter}'.
                </td>
              </tr>
            ) : (
              filteredSubmissions.map(item => (
                <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono">
                    <span className="font-semibold text-[#0A192F] block">{item.registrationReference || '—'}</span>
                    <span className="text-[10px] text-emerald-700 uppercase">Reg: {item.registrationStatus}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-[#0A192F] block">{item.legalFullName}</span>
                    <span className="text-[11px] font-mono text-stone-500 block">{item.verifiedEmail}</span>
                    {item.clientCompany && <span className="text-[10px] text-stone-400">{item.clientCompany}</span>}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-stone-800 block">{item.country}</span>
                    <span className="font-mono text-[10px] text-stone-400">
                      {item.isUnitedStates ? 'US Rules' : 'International'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    <span className="text-stone-800 block">
                      {item.governmentIdType ? item.governmentIdType.replace('_', ' ').toUpperCase() : 'Pending'}
                      {item.governmentIdLast4 ? ` (•••${item.governmentIdLast4})` : ''}
                    </span>
                    <span className="text-[10px] text-stone-500">
                      {item.isUnitedStates
                        ? item.ssnProvided
                          ? `SSN: ${item.ssnMasked}`
                          : 'SSN: Pending'
                        : 'SSN: Not Applicable (Non-US)'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${getStatusBadgeClasses(item.verificationStatus)}`}>
                      {item.verificationStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-stone-500">
                    {formatInternationalDate(item.submittedAt || item.updatedAt)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleOpenDossier(item)}
                      className="px-3 py-1.5 bg-[#0A192F] hover:bg-[#112240] text-white text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Inspect Dossier</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Compliance Review Dossier Modal */}
      {selectedDossier && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-6">
            <button
              onClick={handleCloseDossier}
              className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F]"
              aria-label="Close KYC dossier"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-stone-200 pb-4">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold block mb-1">
                Compliance Inspection Workspace · Private &amp; Audited
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
                  {selectedDossier.legalFullName}
                </h3>
                <span className={`font-mono text-[10px] uppercase px-2.5 py-0.5 border ${getStatusBadgeClasses(selectedDossier.verificationStatus)}`}>
                  KYC: {selectedDossier.verificationStatus.replace('_', ' ')}
                </span>
                <span className="font-mono text-[10px] uppercase px-2.5 py-0.5 border bg-emerald-50 text-emerald-800 border-emerald-200">
                  Registration: {selectedDossier.registrationStatus}
                </span>
              </div>
              <p className="text-xs font-mono text-stone-500 mt-1">
                Ref: {selectedDossier.registrationReference || '—'} · {selectedDossier.verifiedEmail}
                {isLoadingDossier && ' · Syncing...'}
              </p>
            </div>

            {panelError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{panelError}</span>
              </div>
            )}

            {/* Structured Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-white border border-[#E2DDD3] p-4 space-y-2">
                <h4 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1.5">
                  Principal Jurisdiction &amp; Address
                </h4>
                <div><strong>Country:</strong> {selectedDossier.country}</div>
                <div>
                  <strong>Address:</strong>{' '}
                  {[
                    selectedDossier.addressLine1,
                    selectedDossier.addressLine2,
                    selectedDossier.city,
                    selectedDossier.stateProvince,
                    selectedDossier.postalCode
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Not yet entered'}
                </div>
                <div><strong>Liveness Method:</strong> {selectedDossier.livenessMethod?.replace('_', ' ') || '—'}</div>
              </div>

              <div className="bg-white border border-[#E2DDD3] p-4 space-y-2">
                <h4 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1.5">
                  Identification, Encryption &amp; Consent
                </h4>
                <div>
                  <strong>Government ID:</strong>{' '}
                  {selectedDossier.governmentIdType ? selectedDossier.governmentIdType.replace('_', ' ').toUpperCase() : '—'}
                  {selectedDossier.governmentIdLast4 ? ` (Ending •••${selectedDossier.governmentIdLast4})` : ''}
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#0A192F]" />
                  <strong>US SSN:</strong>{' '}
                  <span className="font-mono">
                    {selectedDossier.isUnitedStates
                      ? selectedDossier.ssnProvided
                        ? `${selectedDossier.ssnMasked} (AES-256 Encrypted)`
                        : 'Not Provided'
                      : 'Not Applicable (Non-US Client)'}
                  </span>
                </div>
                <div>
                  <strong>Consent:</strong>{' '}
                  {selectedDossier.consentAccepted
                    ? `Accepted (${selectedDossier.consentVersion || 'v1'}) on ${formatInternationalDate(selectedDossier.consentTimestamp)}`
                    : 'Not Accepted'}
                </div>
                <div>
                  <strong>Retention Until:</strong> {formatInternationalDate(selectedDossier.retentionExpiresAt)}
                </div>
              </div>
            </div>

            {/* Private Uploaded Documents */}
            <div className="bg-white border border-[#E2DDD3] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[#0A192F] flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Encrypted Identity Documents ({selectedDossier.documents.length})</span>
                </h4>
                <span className="text-[10px] font-mono text-stone-500">
                  Audited 120-Second Short-Lived Signed URLs Only
                </span>
              </div>

              {selectedDossier.documents.length === 0 ? (
                <p className="text-xs text-stone-500 font-light">No identity documents uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedDossier.documents.map(doc => (
                    <div key={doc.id} className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] uppercase text-[#0A192F] font-semibold block">
                          {doc.documentType.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-stone-600 truncate block">{doc.originalFilename}</span>
                        <span className="text-[10px] font-mono text-stone-400">
                          {doc.mimeType} · {Math.max(1, Math.round(doc.fileSizeBytes / 1024))} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewDocument(doc.id)}
                        disabled={loadingDocId === doc.id}
                        className="px-2.5 py-1.5 bg-[#0A192F] hover:bg-[#112240] text-white text-[10px] font-mono uppercase tracking-wider shrink-0 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {loadingDocId === doc.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Eye className="w-3 h-3 text-[#D4AF37]" />
                        )}
                        <span>View</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Controlled Signed URL Document Preview */}
              {activeDocPreview && (
                <div className="mt-4 p-4 border border-[#0A192F]/30 bg-stone-900 text-white space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <strong className="font-mono">{activeDocPreview.originalFilename}</strong>
                      <span className="text-[10px] text-amber-300 ml-3 font-mono">
                        Expires in {activeDocPreview.expiresInSeconds}s · Access Audited
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={activeDocPreview.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono underline text-[#D4AF37] inline-flex items-center gap-1"
                      >
                        <span>Open Tab</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setActiveDocPreview(null)}
                        className="text-stone-300 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {activeDocPreview.mimeType === 'application/pdf' ? (
                    <iframe
                      src={activeDocPreview.signedUrl}
                      title={activeDocPreview.originalFilename}
                      className="w-full h-96 bg-white"
                    />
                  ) : (
                    <div className="flex justify-center bg-black/50 p-2">
                      <img
                        src={activeDocPreview.signedUrl}
                        alt={activeDocPreview.originalFilename}
                        className="max-h-96 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Compliance Decision Controls */}
            <div className="bg-white border border-[#E2DDD3] p-5 space-y-4">
              <div className="border-b border-stone-100 pb-2">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[#0A192F]">
                  Compliance Determination &amp; Notification
                </h4>
              </div>

              {(selectedDossier.verificationStatus === 'submitted' ||
                selectedDossier.verificationStatus === 'under_review') ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                      Client Message / Reason (Mandatory for Request Additional Info or Reject)
                    </label>
                    <textarea
                      rows={3}
                      value={clientMessage}
                      onChange={e => setClientMessage(e.target.value)}
                      placeholder="Specify exact additional document needed or formal reason for rejection (sent to client via email)..."
                      className="w-full p-2.5 border border-stone-300 bg-white focus:outline-hidden focus:border-[#0A192F]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                      Internal Compliance Officer Notes (Staff Only — Never Sent to Client)
                    </label>
                    <textarea
                      rows={2}
                      value={internalNotes}
                      onChange={e => setInternalNotes(e.target.value)}
                      placeholder="Confidential sanctions/PEP screening or due diligence notes..."
                      className="w-full p-2.5 border border-stone-300 bg-stone-50 focus:outline-hidden focus:border-[#0A192F]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() => handleDecision('request_info')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs uppercase tracking-wider font-medium disabled:opacity-50 cursor-pointer"
                    >
                      Request Additional Info
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() => handleDecision('reject')}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs uppercase tracking-wider font-medium disabled:opacity-50 cursor-pointer"
                    >
                      Reject Verification
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() => handleDecision('approve')}
                      className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs uppercase tracking-wider font-medium ml-auto disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Identity Verification</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-stone-400" />
                    <span>
                      Current status is <strong className="font-mono uppercase">{selectedDossier.verificationStatus.replace('_', ' ')}</strong>. Decisions become available when the client submits or resubmits their dossier.
                    </span>
                  </div>
                  {selectedDossier.reviewedByEmail && (
                    <div className="text-[11px] font-mono text-stone-500">
                      Last reviewed by {selectedDossier.reviewedByEmail} ({selectedDossier.reviewedByRole}) on{' '}
                      {formatInternationalTimestampUTC(selectedDossier.reviewedAt)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Review History Timeline */}
            {selectedDossier.history.length > 0 && (
              <div className="bg-white border border-[#E2DDD3] p-5 space-y-2.5">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[#0A192F] flex items-center gap-2 border-b border-stone-100 pb-2">
                  <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Immutable Compliance Review History</span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedDossier.history.map(h => (
                    <div key={h.id} className="p-2.5 bg-stone-50 border border-stone-200 text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-mono text-[10px] text-stone-500">
                        <span className="font-semibold text-[#0A192F]">
                          {h.action.toUpperCase()} ({h.previousStatus || '—'} → {h.newStatus})
                        </span>
                        <span>{formatInternationalTimestampUTC(h.createdAt)}</span>
                      </div>
                      <div className="text-[11px] font-mono text-stone-500">
                        Actor: {h.actorEmail} ({h.actorRole})
                      </div>
                      {h.clientMessage && <p className="text-stone-700 font-light">{h.clientMessage}</p>}
                      {h.internalNotes && (
                        <p className="text-[11px] text-amber-900 bg-amber-50 px-2 py-1 border border-amber-200">
                          Internal Note: {h.internalNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
