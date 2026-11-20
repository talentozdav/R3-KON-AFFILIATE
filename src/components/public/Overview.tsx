import React from 'react';
import { Building2, Globe2, FileCheck2, KeyRound } from 'lucide-react';

export const Overview: React.FC = () => {
  return (
    <section id="overview" className="py-20 lg:py-28 bg-[#FAF9F6] border-b border-[#E2DDD3]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-[#D4AF37]" />
            <span>Institutional Framework</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#0A192F] font-normal tracking-tight leading-tight mb-4">
            A Discreet, International Partnership Architecture
          </h2>
          <p className="text-stone-600 text-base leading-relaxed font-light">
            R3 Contingencies coordinates contingency planning, business risk support, and executive advisory protocols for individuals, corporations, and family offices across the globe. The Affiliate Network offers a structured, compliant channel for international advisors and corporate introducers to connect qualified clients with R3 services.
          </p>
        </div>

        {/* 2-Column Split: Visual Pavilion + Pillar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          {/* Left Column: Image with architectural caption */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="border border-[#E2DDD3] bg-white p-2">
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-900">
                <img
                  src="/images/partner_network_pavilion.jpg"
                  alt="R3 Global Network Pavilion"
                  className="w-full h-full object-cover object-center filter brightness-[0.95]"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/src/assets/images/partner_network_pavilion_1793913449334.jpg';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 text-white text-[11px] font-sans tracking-wide">
                  <span>International Contingency Coordination</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-6 bg-white border border-[#E2DDD3]">
              <h3 className="font-serif text-lg text-[#0A192F] font-normal mb-2">
                Global Compliance &amp; Integrity Charter
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-light mb-4">
                To maintain strong governance across international jurisdictions, all applications undergo thorough KYC, entity registration verification, and applicable sanctions/AML due diligence. R3 maintains zero tolerance for spam, misleading marketing, or mass consumer solicitation.
              </p>
              <div className="text-[11px] text-stone-500 uppercase tracking-wider font-mono">
                Cross-Border KYC &amp; Governance Compliance
              </div>
            </div>
          </div>

          {/* Right Column: Key Pillars */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 bg-white border border-[#E2DDD3] hover:border-stone-400 transition-colors">
              <div className="w-9 h-9 bg-stone-100 flex items-center justify-center text-[#0A192F] mb-4">
                <Building2 className="w-4 h-4" />
              </div>
              <h4 className="font-serif text-lg text-[#0A192F] font-normal mb-2">Individuals, Corporates &amp; Family Offices</h4>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                Applications and client registrations are welcomed from independent professionals as well as incorporated companies, advisory firms, and multi-jurisdictional family offices.
              </p>
            </div>

            <div className="p-6 bg-white border border-[#E2DDD3] hover:border-stone-400 transition-colors">
              <div className="w-9 h-9 bg-stone-100 flex items-center justify-center text-[#0A192F] mb-4">
                <Globe2 className="w-4 h-4" />
              </div>
              <h4 className="font-serif text-lg text-[#0A192F] font-normal mb-2">Worldwide Participation</h4>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                Open to clients and affiliate partners from every country—across Africa, Europe, the Americas, the Middle East, and Asia-Pacific—subject to standard compliance screening.
              </p>
            </div>

            <div className="p-6 bg-white border border-[#E2DDD3] hover:border-stone-400 transition-colors">
              <div className="w-9 h-9 bg-stone-100 flex items-center justify-center text-[#0A192F] mb-4">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <h4 className="font-serif text-lg text-[#0A192F] font-normal mb-2">Manual Verification</h4>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                Every qualifying conversion is reviewed manually against executed client agreements and confirmed banking settlement before commission approval.
              </p>
            </div>

            <div className="p-6 bg-white border border-[#E2DDD3] hover:border-stone-400 transition-colors">
              <div className="w-9 h-9 bg-stone-100 flex items-center justify-center text-[#0A192F] mb-4">
                <KeyRound className="w-4 h-4" />
              </div>
              <h4 className="font-serif text-lg text-[#0A192F] font-normal mb-2">Dedicated Portal Access</h4>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                Approved affiliates and clients receive secure credentials to dedicated portals with transparent referral attribution, brief tracking, and audited ledgers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
