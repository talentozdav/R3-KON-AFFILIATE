import React from 'react';
import { Link2, Activity, Users, ShieldCheck, FileSpreadsheet, CreditCard, Headphones, AlertCircle } from 'lucide-react';

export const Benefits: React.FC = () => {
  const features = [
    {
      icon: Link2,
      title: 'Unique Referral Links',
      description: 'Dedicated encrypted URLs and personalized partner identifiers with server-side attribution logging.'
    },
    {
      icon: Activity,
      title: 'Referral Activity Tracking',
      description: 'Transparent visibility into inbound link impressions, unique visitors, and conversion velocity.'
    },
    {
      icon: Users,
      title: 'Lead Visibility',
      description: 'Privacy-compliant pipeline status tracking from initial introduction through coordination and contract.'
    },
    {
      icon: ShieldCheck,
      title: 'Verified Conversion Records',
      description: 'Formal audit trails linking executed client engagements and banking settlement to transaction references.'
    },
    {
      icon: FileSpreadsheet,
      title: 'Commission Reporting',
      description: 'Itemized financial ledger displaying applied commercial rates, dates recorded, and governance approvals.'
    },
    {
      icon: CreditCard,
      title: 'Payout History',
      description: 'Complete archive of disbursed settlement cycles, wire references, currency breakdowns, and remittance records.'
    },
    {
      icon: Headphones,
      title: 'Partner Account Support',
      description: 'Direct line to dedicated R3 affiliate directors and senior contingency coordinators for case alignment.'
    }
  ];

  return (
    <section id="benefits" className="py-20 lg:py-28 bg-[#FAF9F6] border-b border-[#E2DDD3]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-16">
          <div className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-[#D4AF37]" />
            <span>Platform Capabilities</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#0A192F] font-normal tracking-tight leading-tight mb-4">
            Institutional Infrastructure for Private Partners
          </h2>
          <p className="text-stone-600 text-base leading-relaxed font-light">
            Every accredited affiliate accesses a private, encrypted membership workspace engineered for discretion, precision, and compliance.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`p-7 bg-white border border-[#E2DDD3] hover:border-[#0A192F] transition-colors ${
                  idx === 0 ? 'md:col-span-2 lg:col-span-2' : ''
                }`}
              >
                <div className="w-9 h-9 bg-stone-50 border border-stone-200 flex items-center justify-center text-[#0A192F] mb-5">
                  <Icon className="w-4 h-4 text-[#0A192F]" />
                </div>
                <h3 className="font-serif text-xl text-[#0A192F] font-normal mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed font-light">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Clear Non-Hype Commercial Disclosure Box */}
        <div className="p-6 bg-stone-100/70 border border-stone-300 flex items-start gap-4 text-xs text-stone-700 leading-relaxed">
          <AlertCircle className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
          <div>
            <strong className="font-medium text-[#0A192F] block mb-1">Notice on Commercial Representations</strong>
            R3 Contingencies does not promise guaranteed earnings, automatic conversions, or minimum revenue streams. Commission calculations apply exclusively to verified, executed client contingency agreements following institutional review and banking confirmation. Unapproved or speculative commercial terms remain inactive.
          </div>
        </div>
      </div>
    </section>
  );
};
