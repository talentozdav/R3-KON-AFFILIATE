import React from 'react';
import { X, Shield } from 'lucide-react';

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
            R3 Contingencies · Legal & Compliance Governance
          </span>
          <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
            {type === 'terms' ? 'Affiliate Partnership Agreement & Terms' : 'Partner Privacy Notice & Data Governance'}
          </h3>
        </div>

        <div className="overflow-y-auto pr-2 space-y-6 text-xs text-stone-700 leading-relaxed font-light flex-1">
          {type === 'terms' ? (
            <>
              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  1. Scope of Affiliate Appointment
                </strong>
                <p>
                  Appointment to the R3 Affiliate Network is non-exclusive, personal to the approved partner, and contingent upon ongoing U.S. federal and state regulatory compliance, including valid entity standing and IRS Form W-9 / tax documentation. Affiliates act solely as independent referrers and possess no authority to bind, contract, or execute agreements on behalf of R3 Contingencies.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  2. Manual Verification of Qualifying Conversions
                </strong>
                <p>
                  Referral fees and commissions are calculated strictly against executed, banked service agreements with qualified prospective clients in USD. Clicks, page visits, and preliminary consultations do not constitute qualifying conversions. Every transaction is subject to manual verification by R3 Governance and Finance officers.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  3. Commercial Terms & Calculation Rules
                </strong>
                <p>
                  Commission calculations strictly utilize active commission rules approved by authorized R3 administrators and are reported in accordance with U.S. tax regulations (IRS Form 1099-NEC where applicable). R3 does not guarantee minimum earnings, conversion rates, or recurring payouts. Unapproved, prospective, or draft commission schedules remain non-binding until formal authorization.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  4. Marketing Standards & Strict Brand Discipline
                </strong>
                <p>
                  Affiliates are strictly prohibited from utilizing programmatic display ads, unsolicited bulk email (CAN-SPAM violations), automated bots, search-engine bidding on R3 trademarks, or public mass solicitation. Introductions must be direct, professional, and discreet. Any breach results in immediate termination and forfeiture of unverified commissions.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  5. Non-Disclosure, Confidentiality & Governing Law
                </strong>
                <p>
                  All details concerning introduced clients, contingency service rates, operational protocols, and internal communications are strictly confidential and governed by United States federal and state trade secret laws (including the Defend Trade Secrets Act). These Terms are governed by the laws of the State of Delaware, USA.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  1. U.S. Regulatory Framework & Data Collection
                </strong>
                <p>
                  R3 Contingencies operates under United States federal and state data privacy standards, including the California Consumer Privacy Act / CPRA (CCPA) and applicable state data protection laws. We collect professional credentials, U.S. Secretary of State registration records, EIN / W-9 tax identifiers, and contact coordinates solely for compliance auditing and affiliate administration.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  2. U.S. Registration Due Diligence & Background Inquiries
                </strong>
                <p>
                  By submitting a candidacy dossier, applicants authorize R3 to verify U.S. state business registrations, corporate good standing, EIN / IRS verification, FINRA/SEC or state professional licenses, FinCEN BSA/AML standing, and U.S. Treasury sanctions registry statuses (OFAC SDN & Consolidated Sanctions).
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  3. Anonymization of Client Referral Data
                </strong>
                <p>
                  To protect the discretion of high-profile clients, client names displayed within affiliate dashboards are masked or anonymized (e.g., "Family Office (New York)" or "Corporate Trust (Delaware)") to prevent unauthorized data dissemination across digital networks.
                </p>
              </div>

              <div>
                <strong className="block text-[#0A192F] font-medium text-sm mb-1">
                  4. Retention & Recordkeeping
                </strong>
                <p>
                  Application records for declined candidates are securely purged within 180 days, except where U.S. federal anti-money laundering (FinCEN / Bank Secrecy Act) or IRS tax compliance mandates historical audit preservation.
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
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
