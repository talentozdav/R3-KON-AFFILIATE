import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpRight, UserCheck, Menu, X } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#overview', label: 'Overview' },
    { href: '#partnership', label: 'Partnership' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#benefits', label: 'Benefits' },
    { href: '#faq', label: 'FAQ' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E2DDD3]">
      {/* Discreet referral attribution banner if arriving via partner link */}
      {referredBy && (
        <div className="bg-[#0A192F] text-[#FAF9F6] text-xs py-1.5 px-4 text-center tracking-wide border-b border-[#1A2E4C] flex items-center justify-center gap-2 flex-wrap">
          <span className="text-[#D4AF37] uppercase tracking-wider font-medium">Partner Referral</span>
          <span className="text-stone-400">·</span>
          <span>
            Introduced through accredited partner code:{' '}
            <strong className="text-[#D4AF37] font-mono tracking-wider">{referredBy}</strong>
          </span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-20 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Brand Wordmark with R3 Contingencies insignia */}
        <a href="#overview" className="flex items-center shrink-0 group">
          <BrandLogo variant="light" size="md" />
        </a>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-[13px] tracking-wide uppercase font-medium text-stone-700">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenStatusLookup}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#0A192F] px-3 py-2 transition-colors whitespace-nowrap"
          >
            <span>Application Status</span>
          </button>

          {isAuthenticated && user ? (
            <button
              type="button"
              onClick={onOpenPortal}
              className="inline-flex items-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] px-3.5 sm:px-4 py-2 text-xs font-medium tracking-wide uppercase transition-colors whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>
                {user.role === 'affiliate' ? 'Partner Portal' : user.role === 'client' ? 'Client Portal' : 'Admin Area'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#0A192F] hover:text-[#D4AF37] px-2.5 sm:px-3 py-2 transition-colors whitespace-nowrap"
              >
                <span>Member Login</span>
              </button>
              <a
                href="#apply"
                className="inline-flex items-center gap-1.5 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] px-3.5 sm:px-4 py-2 text-xs font-medium tracking-wide uppercase transition-colors whitespace-nowrap shadow-xs"
              >
                <span>Apply</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#D4AF37]" />
              </a>
            </div>
          )}

          {/* Mobile navigation toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 text-stone-700 hover:text-[#0A192F] border border-stone-200 transition-colors"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-[#E2DDD3] px-6 py-4 space-y-3 text-xs uppercase tracking-wider font-medium text-stone-700">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 hover:text-[#0A192F] transition-colors"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenStatusLookup();
            }}
            className="block w-full text-left py-1.5 text-stone-600 hover:text-[#0A192F] border-t border-stone-100 pt-3"
          >
            Check Application Status
          </button>
        </div>
      )}
    </header>
  );
};
