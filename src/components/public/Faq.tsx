import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const Faq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Who can apply to the R3 Global Affiliate Network?',
      a: 'The program is open to qualified individual professionals and corporate advisory practices—including private wealth managers, family office directors, corporate counsel, M&A advisors, executive recruiters, and specialized crisis or security consultants. Applicants must demonstrate a reputable professional standing and client network.'
    },
    {
      q: 'Is affiliate approval automatic?',
      a: 'No. Admission is never automatic. Every application undergoes a comprehensive compliance review and background audit by the R3 Intake Committee. Applications may be approved, declined, or placed on hold pending additional clarification.'
    },
    {
      q: 'How does referral tracking work?',
      a: 'Approved affiliates receive an authenticated referral code and unique encrypted URL. When a prospect engages through your referral link or is introduced directly via your affiliate portal, server-side attribution logs the record to your partner account with multi-week session durability.'
    },
    {
      q: 'How are conversions verified?',
      a: 'Conversions are verified manually by R3 Governance and Finance officers. A referral is only classified as a verified conversion once a client contingency engagement contract is signed, legal compliance is cleared, and initial banking settlement is confirmed.'
    },
    {
      q: 'How are commissions calculated?',
      a: 'Commissions are calculated as an approved percentage of the eligible, verified contract value, utilizing active commission rules authorized by R3 leadership. Affiliates cannot edit commission rates or self-approve transactions.'
    },
    {
      q: 'When and how are commissions paid?',
      a: 'Commission settlements are batched by the Finance department following banking clearance of client retainers. Payouts are disbursed via international wire transfer (SWIFT, Fedwire, CHAPS, or SEPA) according to scheduled settlement cycles.'
    },
    {
      q: 'How can an affiliate access their dashboard?',
      a: 'Once an application is approved and activated, partners sign in with their authorized corporate email address. The private portal displays live attribution metrics, referral codes, active leads, verified conversions, and audited payout history.'
    },
    {
      q: 'How can an affiliate contact partner support?',
      a: 'Active affiliates and applicants can reach the R3 Partner Secretariat directly at services@r3-konaffiliate.online or by phone at +1(931)366-0615. Active partners also enjoy an integrated direct lead submission gateway and dedicated affiliate liaison in their private dashboard.'
    }
  ];

  return (
    <section id="faq" className="py-20 lg:py-28 bg-[#FAF9F6] border-b border-[#E2DDD3]">
      <div className="max-w-4xl mx-auto px-6 lg:px-12">
        <div className="max-w-2xl mb-16 text-center mx-auto">
          <div className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-3 flex items-center justify-center gap-2">
            <span className="w-6 h-px bg-[#D4AF37]" />
            <span>Governance & Guidance</span>
            <span className="w-6 h-px bg-[#D4AF37]" />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#0A192F] font-normal tracking-tight leading-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-stone-600 text-sm leading-relaxed font-light">
            Clear, transparent standards governing the R3 Global Affiliate Network partnership structure.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.q}
                className="border border-[#E2DDD3] bg-white transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full py-5 px-6 flex items-center justify-between text-left gap-4 hover:text-[#0A192F] transition-colors"
                >
                  <span className="font-serif text-lg text-[#0A192F] font-normal">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-500 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#0A192F]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-xs text-stone-600 leading-relaxed font-light border-t border-stone-100">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
