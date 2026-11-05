import React, { useState } from 'react';
import { api } from '../../lib/api';
import { X, CheckCircle2, Shield, ArrowRight } from 'lucide-react';

interface ClientInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode?: string | null;
}

export const ClientInquiryModal: React.FC<ClientInquiryModalProps> = ({
  isOpen,
  onClose,
  referralCode
}) => {
  const [clientName, setClientName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [serviceInterest, setServiceInterest] = useState('Executive Contingency Retainer');
  const [briefSummary, setBriefSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !email) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.submitClientInquiry({
        referralCode: referralCode || undefined,
        clientName: clientName.trim(),
        organization: organization.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        country: country.trim() || 'International',
        serviceInterest,
        briefSummary: briefSummary.trim() || undefined
      });
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit inquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setClientName('');
    setOrganization('');
    setEmail('');
    setPhone('');
    setCountry('');
    setBriefSummary('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-lg w-full p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {isSubmitted ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-stone-100 flex items-center justify-center mx-auto mb-4 text-[#D4AF37]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Confidential Intake Logged
            </span>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-3">
              Inquiry Dispatched to Senior Coordination
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed font-light mb-6 max-w-sm mx-auto">
              Your inquiry has been received under strict non-disclosure protocols. An R3 Senior Coordinator will make contact via encrypted channels within 4 business hours.
            </p>
            {referralCode && (
              <div className="p-3 bg-stone-100 text-[11px] font-mono text-stone-600 mb-6 border border-stone-200">
                Attributed Partner: {referralCode}
              </div>
            )}
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest font-medium hover:bg-[#112240] transition-colors"
            >
              Close Window
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
                Executive Intake Gateway
              </span>
              <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
                Confidential Client Inquiry
              </h3>
              <p className="text-xs text-stone-600 mt-1 font-light">
                Introduce a client or request contingency coordination protocols. All submissions are protected under fiduciary non-disclosure.
              </p>
              {referralCode && (
                <div className="mt-3 text-[11px] font-mono text-[#0A192F] bg-stone-100 px-3 py-1.5 border border-stone-200 flex items-center gap-1.5">
                  <span className="text-[#D4AF37]">Partner Attribution:</span>
                  <span>{referralCode}</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Principal / Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Marcus Aurelius"
                  required
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Organization / Family Office (Optional)
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Aurelius Capital Holdings"
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@enterprise.com"
                    required
                    className="w-full text-xs px-3.5 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    Phone / Signal
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 20 ..."
                    className="w-full text-xs px-3.5 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Service Specialization
                </label>
                <select
                  value={serviceInterest}
                  onChange={(e) => setServiceInterest(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                >
                  <option value="Executive Contingency Retainer">Executive Contingency Retainer</option>
                  <option value="Institutional Crisis Advisory">Institutional Crisis Advisory & Rapid Deployment</option>
                  <option value="Private Sovereign Support">Private Sovereign & Maritime Support</option>
                  <option value="Multi-Jurisdictional Umbrella">Multi-Jurisdictional Umbrella</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Brief Overview of Requirements
                </label>
                <textarea
                  rows={2}
                  value={briefSummary}
                  onChange={(e) => setBriefSummary(e.target.value)}
                  placeholder="Confidential summary of situation or coverage requirements..."
                  className="w-full text-xs p-3 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Transmitting...' : 'Transmit Confidential Inquiry'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
