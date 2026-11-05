import React, { useState } from 'react';
import { api } from '../../lib/api';
import { AffiliateApplication } from '../../types';
import { X, Search, CheckCircle2, Clock, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

interface StatusLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateClick?: (app: Partial<AffiliateApplication>) => void;
}

export const StatusLookupModal: React.FC<StatusLookupModalProps> = ({
  isOpen,
  onClose,
  onActivateClick
}) => {
  const [refInput, setRefInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appResult, setAppResult] = useState<Partial<AffiliateApplication> | null>(null);

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refInput.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setAppResult(null);

    try {
      const result = await api.checkApplicationStatus(refInput.trim(), emailInput.trim() || undefined);
      setAppResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'No application matching this reference number was found.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Approved for Partnership</span>
          </div>
        );
      case 'UNDER_REVIEW':
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Under Compliance Review</span>
          </div>
        );
      case 'INFORMATION_REQUESTED':
        return (
          <div className="flex items-center gap-1.5 text-xs text-blue-800 font-medium">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Additional Clarification Requested</span>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
            <XCircle className="w-4 h-4 text-stone-500" />
            <span>Application Ineligible</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-stone-800 font-medium">
            <Clock className="w-4 h-4 text-stone-500" />
            <span>Submitted · Awaiting Review</span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-lg w-full p-8 shadow-xl relative animate-in fade-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
            Registry Verification
          </span>
          <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
            Track Application Status
          </h3>
          <p className="text-xs text-stone-600 mt-1 font-light">
            Enter your application reference code (e.g. <span className="font-mono">R3-APP-2026-8812</span>) to view current compliance status.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-4 mb-6">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
              Reference Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="R3-APP-2026-XXXX"
              className="w-full text-xs font-mono px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
              Email Address (Optional Verification)
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Registered corporate email"
              className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !refInput.trim()}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] py-2.5 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{isLoading ? 'Searching Registry...' : 'Inspect Application Status'}</span>
          </button>
        </form>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {appResult && (
          <div className="p-5 bg-white border border-[#E2DDD3] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <span className="font-mono text-xs text-stone-500">{appResult.referenceNumber}</span>
              {getStatusBadge(appResult.status)}
            </div>

            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500 font-light">Applicant:</span>
                <span className="font-medium text-[#0A192F]">{appResult.fullName}</span>
              </div>
              {appResult.businessName && (
                <div className="flex justify-between">
                  <span className="text-stone-500 font-light">Entity:</span>
                  <span className="font-medium text-[#0A192F]">{appResult.businessName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500 font-light">Logged Date:</span>
                <span className="font-mono text-stone-700">
                  {new Date(appResult.submittedAt || '').toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {appResult.statusNotes && (
              <div className="p-3 bg-stone-50 border border-stone-200 text-[11px] text-stone-700 leading-relaxed font-light">
                <strong className="block font-medium text-[#0A192F] mb-0.5">Compliance Notes:</strong>
                {appResult.statusNotes}
              </div>
            )}

            {appResult.status === 'APPROVED' && !appResult.activatedAffiliateId && (
              <div className="pt-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 mb-3">
                  Your application has been approved. The R3 intake office will disburse your credentials, or an administrator can activate your portal immediately.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
