import React from 'react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Apply',
      subtitle: 'Professional & Entity Credentials',
      description: 'Submit your personal background, entity details, primary client focus, and partnership objectives through the secure R3 application gateway.'
    },
    {
      number: '02',
      title: 'Review',
      subtitle: 'Compliance & Fit Evaluation',
      description: 'The R3 Governance and Affiliate Intake Committee conducts due diligence, verifies professional standing, and ensures jurisdiction alignment.'
    },
    {
      number: '03',
      title: 'Activate',
      subtitle: 'Secure Credential Provisioning',
      description: 'Upon approval, partners receive private dashboard credentials, an assigned Affiliate Number, and a uniquely encrypted referral tracking key.'
    },
    {
      number: '04',
      title: 'Refer',
      subtitle: 'Attributed Client Introductions',
      description: 'Share your dedicated referral link or register client introductions directly in the portal. Track conversions and audited payouts transparently.'
    }
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-[#FAF9F6] border-b border-[#E2DDD3]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-16">
          <div className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-[#D4AF37]" />
            <span>Process & Onboarding</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#0A192F] font-normal tracking-tight leading-tight mb-4">
            Four Steps to Accredited Partnership
          </h2>
          <p className="text-stone-600 text-base leading-relaxed font-light">
            Our onboarding workflow ensures that all active affiliates are vetted, verified, and equipped with institutional-grade attribution tooling.
          </p>
        </div>

        {/* 4-Column Step Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <div
              key={step.number}
              className="p-8 bg-white border border-[#E2DDD3] relative flex flex-col justify-between hover:border-[#0A192F] transition-colors"
            >
              <div>
                <div className="font-mono text-2xl text-[#D4AF37] font-normal mb-6">
                  {step.number}
                </div>
                <h3 className="font-serif text-2xl text-[#0A192F] font-normal mb-1">
                  {step.title}
                </h3>
                <div className="text-[11px] text-stone-500 uppercase tracking-wider mb-4 font-sans">
                  {step.subtitle}
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-light">
                  {step.description}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400 font-mono">
                <span>Stage {idx + 1} of 4</span>
                <span className="text-[#0A192F]">R3 Certified</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
