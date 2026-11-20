import React from 'react';
import { X } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-2xl w-full p-8 sm:p-10 shadow-2xl relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 pb-4 border-b border-[#E2DDD3]">
          <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
            R3 Contingencies · Global Legal &amp; Compliance Governance
          </span>
          <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
            {type === 'terms' ? 'Global Affiliate Partnership Agreement & Terms' : 'Partner Privacy Notice & Data Governance'}
          </h3>
        </div>

        <div className="overflow-y-auto pr-2 space-y-6 text-xs text-stone-700 leading-relaxed font-light flex-1">
          {type === 'terms' ? (
            <>
              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  1. Scope of International Affiliate Appointment
                </strong>
                <p>
                  Appointment to the R3 Global Affiliate Network is open to qualified individuals and corporate entities worldwide, on a non-exclusive basis, contingent upon ongoing regulatory compliance, KYC verification, and applicable tax/sanctions documentation in the partner&apos;s jurisdiction. Affiliates act solely as independent introducers and possess no authority to bind, contract, or execute agreements on behalf of R3 Contingencies.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  2. Manual Verification of Qualifying Conversions
                </strong>
                <p>
                  Referral fees and commissions are calculated strictly against executed, banked service agreements with qualified prospective clients in the designated settlement currency (USD unless otherwise agreed in writing). Clicks, page visits, and preliminary consultations do not constitute qualifying conversions. Every transaction is subject to manual verification by R3 Governance and Finance officers.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  3. Commercial Terms &amp; Settlement Rules
                </strong>
                <p>
                  Commission calculations strictly apply active percentage-based commission rules approved by authorized R3 administrators and are disbursed upon compliance clearance. Partners are responsible for complying with tax and reporting obligations in their respective countries. R3 does not guarantee minimum earnings, conversion rates, or recurring payouts.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  4. Marketing Standards &amp; Strict Brand Discipline
                </strong>
                <p>
                  Affiliates are strictly prohibited from utilizing programmatic display ads, unsolicited bulk email, automated bots, search-engine bidding on R3 trademarks, or deceptive solicitation. Introductions must be direct, professional, and discreet. Any breach results in immediate termination and forfeiture of unverified commissions.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  5. Non-Disclosure &amp; Cross-Border Confidentiality
                </strong>
                <p>
                  All details concerning introduced clients, contingency service agreements, operational protocols, and internal communications are strictly confidential under binding international non-disclosure and fiduciary privacy obligations.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  1. International Data Protection &amp; Collection
                </strong>
                <p>
                  R3 Contingencies handles personal and corporate registration data in accordance with internationally recognized data protection and privacy safeguards. We collect professional credentials, corporate registration details, tax/compliance identifiers, and international contact information solely for partner administration, client onboarding, and regulatory due diligence.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  2. Cross-Border Due Diligence &amp; Compliance Checks
                </strong>
                <p>
                  By submitting an application or registration, applicants authorize R3 to conduct identity (KYC), corporate registration, reputational, and applicable international anti-money laundering (AML) and sanctions compliance screening across relevant jurisdictions.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  3. Anonymization of Client Referral Data
                </strong>
                <p>
                  To protect client discretion worldwide, identifying client names, email addresses, and telephone numbers are never disclosed within affiliate dashboards; entries are masked (e.g., &ldquo;Corporate Advisory (United Kingdom)&rdquo; or &ldquo;Private Principal (Nigeria)&rdquo;).
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  4. Retention &amp; Recordkeeping
                </strong>
                <p>
                  Application records for declined candidates are securely purged within 180 days, except where applicable anti-money laundering, tax, or statutory audit obligations mandate historical record preservation.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="pt-6 mt-4 border-t border-[#E2DDD3] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#0A192F] text-[#FAF9F6] text-xs uppercase tracking-widest font-medium hover:bg-[#112240] transition-colors"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
