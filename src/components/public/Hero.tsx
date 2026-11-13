import React from 'react';
import { ArrowRight, Lock, Globe, Shield } from 'lucide-react';

interface HeroProps {
  onApplyClick: () => void;
  onLoginClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onApplyClick, onLoginClick }) => {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-[#E2DDD3]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Proposition */}
          <div className="lg:col-span-7 flex flex-col items-start">
            {/* Quiet kicker */}
            <div className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-6 flex items-center gap-2">
              <span className="w-6 h-px bg-[#D4AF37]" />
              <span>United States Referral &amp; Compliance Network</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#0A192F] font-normal tracking-tight leading-[1.12] mb-6 text-balance">
              Build Trusted Partnerships. Access a U.S. Referral Network.
            </h1>

            <p className="text-stone-600 text-base sm:text-lg leading-relaxed max-w-2xl mb-10 font-light">
              Join the R3 Affiliate Network and introduce qualified U.S. and corporate clients to R3 Contingencies' domestic contingency coordination, compliance registration, and executive support services.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-12">
              <button
                onClick={onApplyClick}
                className="inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] px-8 py-3.5 text-xs uppercase tracking-widest font-medium transition-all group shadow-sm"
              >
                <span>Apply for Partnership</span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37] transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={onLoginClick}
                className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-stone-100 text-[#0A192F] border border-stone-300 px-6 py-3.5 text-xs uppercase tracking-widest font-medium transition-colors"
              >
                <span>Existing Member Login</span>
              </button>
            </div>

            {/* Discreet Trust Disclosures (No pill badges) */}
            <div className="pt-8 border-t border-[#E2DDD3] w-full grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-stone-600">
              <div>
                <span className="block font-medium text-[#0A192F] mb-1">Selective Admission</span>
                <span className="text-stone-500 leading-normal">Applications undergo rigorous U.S. KYC, OFAC sanctions, and entity registration review.</span>
              </div>
              <div>
                <span className="block font-medium text-[#0A192F] mb-1">Discreet Coordination</span>
                <span className="text-stone-500 leading-normal">Confidential handling of sensitive U.S. executive and high-net-worth referrals.</span>
              </div>
              <div>
                <span className="block font-medium text-[#0A192F] mb-1">Verified Conversions</span>
                <span className="text-stone-500 leading-normal">Commissions calculated solely against executed, banked U.S. service agreements.</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Anchor */}
          <div className="lg:col-span-5 relative">
            <div className="relative border border-[#E2DDD3] bg-white p-2 shadow-sm">
              <div className="relative aspect-[4/3] sm:aspect-[16/11] overflow-hidden bg-stone-900">
                <img
                  src="/images/hero_executive_suite.jpg"
                  alt="R3 Contingencies Executive Advisory Suite"
                  className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.05]"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/src/assets/images/hero_executive_suite_1793913449800.jpg';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/80 via-transparent to-transparent pointer-events-none" />

                {/* Subtle caption */}
                <div className="absolute bottom-4 left-4 right-4 text-white text-[11px] flex items-center justify-between pointer-events-none font-sans tracking-wide">
                  <span className="opacity-90">R3 U.S. Contingency Coordination Center</span>
                  <span className="font-mono opacity-70">EST. 2026</span>
                </div>
              </div>
            </div>

            {/* Subdued architectural statement card below */}
            <div className="mt-4 p-5 bg-[#FAF9F6] border border-[#E2DDD3] text-xs text-stone-600 leading-relaxed">
              <span className="text-[#D4AF37] font-serif text-lg leading-none mr-1.5">“</span>
              R3 Contingencies provides United States contingency coordination, corporate registration oversight, and federal compliance advisory frameworks for accredited private and corporate partners.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
