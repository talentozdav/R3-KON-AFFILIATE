import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, ArrowUpRight, UserCheck } from 'lucide-react';

interface HeaderProps {
  onOpenLogin: () => void;
  onOpenStatusLookup: () => void;
  onOpenPortal: () => void;
  referredBy?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLogin,
  onOpenStatusLookup,
  onOpenPortal,
  referredBy
}) => {
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E2DDD3]">
      {/* Discreet referral attribution banner if arriving via partner link */}
      {referredBy && (
        <div className="bg-[#0A192F] text-[#FAF9F6] text-xs py-1.5 px-4 text-center tracking-wide border-b border-[#1A2E4C] flex items-center justify-center gap-2">
          <span className="text-[#D4AF37] uppercase tracking-wider font-medium">Partner Referral</span>
          <span className="text-stone-400">·</span>
          <span>Introduced through accredited partner code: <strong className="text-[#D4AF37] font-mono tracking-wider">{referredBy}</strong></span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <a href="#overview" className="flex items-center gap-3 shrink-0 group">
          <div className="w-8 h-8 bg-[#0A192F] text-[#D4AF37] flex items-center justify-center border border-[#1A2E4C] transition-colors group-hover:border-[#D4AF37]">
            <span className="font-serif font-bold text-base tracking-tighter">R3</span>
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-semibold text-lg tracking-wider text-[#0A192F] uppercase">
              R3 Contingencies
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-sans -mt-0.5">
              Global Affiliate Network
            </span>
          </div>
        </a>

        {/* Zone 2: Navigation Links (4-5 single-line clean text links) */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] tracking-wide uppercase font-medium text-stone-700">
          <a href="#overview" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
            Overview
          </a>
          <a href="#partnership" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
            Partnership
          </a>
          <a href="#how-it-works" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
            How It Works
          </a>
          <a href="#benefits" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
            Benefits
          </a>
          <a href="#faq" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
            FAQ
          </a>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenStatusLookup}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#0A192F] px-3 py-2 transition-colors whitespace-nowrap"
          >
            <span>Application Status</span>
          </button>

          {isAuthenticated && user ? (
            <button
              onClick={onOpenPortal}
              className="inline-flex items-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] px-4 py-2 text-xs font-medium tracking-wide uppercase transition-colors whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>
                {user.role === 'affiliate' ? 'Partner Portal' : 'Admin Area'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#0A192F] hover:text-[#D4AF37] px-3 py-2 transition-colors whitespace-nowrap"
              >
                <span>Member Login</span>
              </button>
              <a
                href="#apply"
                className="inline-flex items-center gap-1.5 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] px-4 py-2 text-xs font-medium tracking-wide uppercase transition-colors whitespace-nowrap shadow-xs"
              >
                <span>Apply</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#D4AF37]" />
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
