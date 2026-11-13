import React from 'react';
import { BrandLogo } from '../common/BrandLogo';

interface FooterProps {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenLogin: () => void;
  onOpenInquiry: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenTerms,
  onOpenPrivacy,
  onOpenLogin,
  onOpenInquiry
}) => {
  return (
    <footer className="bg-[#0A192F] text-[#FAF9F6] border-t border-[#1A2E4C] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-14 border-b border-[#1A2E4C]">
          {/* Brand Info */}
          <div className="md:col-span-5 flex flex-col items-start">
            <div className="mb-4">
              <BrandLogo variant="dark" size="md" />
            </div>
            <p className="text-xs text-stone-400 font-light leading-relaxed max-w-sm mb-6">
              United States contingency coordination, corporate registration alignment, and executive advisory frameworks. The R3 Affiliate Network is restricted to verified U.S. and compliant professional partners.
            </p>
            <div className="text-[11px] font-mono text-stone-500 tracking-wider">
              REGISTRATION: 2026-R3-US · US FEDERAL &amp; DELAWARE COMPLIANT
            </div>
          </div>

          {/* Quick Nav */}
          <div className="md:col-span-2 md:col-start-7">
            <span className="block text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-4 font-sans">
              Network
            </span>
            <ul className="space-y-2.5 text-xs text-stone-300 font-light">
              <li>
                <a href="#overview" className="hover:text-white transition-colors">Overview</a>
              </li>
              <li>
                <a href="#partnership" className="hover:text-white transition-colors">Partnership</a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#benefits" className="hover:text-white transition-colors">Affiliate Benefits</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              </li>
            </ul>
          </div>

          {/* Legal & Governance */}
          <div className="md:col-span-2">
            <span className="block text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-4 font-sans">
              Governance
            </span>
            <ul className="space-y-2.5 text-xs text-stone-300 font-light">
              <li>
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="hover:text-white transition-colors text-left"
                >
                  Affiliate Terms
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="hover:text-white transition-colors text-left"
                >
                  Privacy Notice
                </button>
              </li>
              <li>
                <span className="text-stone-500">Compliance Audit</span>
              </li>
              <li>
                <span className="text-stone-500">Sanctions Policy</span>
              </li>
            </ul>
          </div>

          {/* Access */}
          <div className="md:col-span-3">
            <span className="block text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-4 font-sans">
              Direct Access
            </span>
            <div className="space-y-3">
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full text-left py-2 px-3 border border-[#1A2E4C] hover:border-[#D4AF37] text-xs text-stone-300 hover:text-white transition-colors bg-[#060F1E]/60 flex items-center justify-between"
              >
                <span>Member Portal Login</span>
                <span className="text-[#D4AF37] font-mono text-[11px]">→</span>
              </button>
              <button
                type="button"
                onClick={onOpenInquiry}
                className="w-full text-left py-2 px-3 border border-[#1A2E4C] hover:border-[#D4AF37] text-xs text-stone-300 hover:text-white transition-colors bg-[#060F1E]/60 flex items-center justify-between"
              >
                <span>Introduce Client Inquiry</span>
                <span className="text-[#D4AF37] font-mono text-[11px]">→</span>
              </button>
            </div>
            <div className="mt-4 text-[11px] text-stone-400 leading-relaxed font-light space-y-1">
              <div>
                Executive coordination: <a href="mailto:services@r3-konaffiliate.online" className="font-mono text-stone-300 hover:text-[#D4AF37] transition-colors underline underline-offset-2">services@r3-konaffiliate.online</a>
              </div>
              <div>
                Direct telephone inquiry: <a href="tel:+19313660615" className="font-mono text-stone-300 hover:text-[#D4AF37] transition-colors">+1(931)366-0615</a>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Bottom Strip */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-stone-500 font-light gap-4">
          <div>
            © {new Date().getFullYear()} R3 Contingencies. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Discreet Fiduciary Architecture</span>
            <span>·</span>
            <span>Zero Unverified Representations</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
