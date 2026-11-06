/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/public/Header';
import { Hero } from './components/public/Hero';
import { Overview } from './components/public/Overview';
import { HowItWorks } from './components/public/HowItWorks';
import { Benefits } from './components/public/Benefits';
import { Faq } from './components/public/Faq';
import { ApplicationForm } from './components/public/ApplicationForm';
import { Footer } from './components/public/Footer';
import { LoginModal } from './components/auth/LoginModal';
import { StatusLookupModal } from './components/public/StatusLookupModal';
import { LegalModal } from './components/public/LegalModals';
import { ClientInquiryModal } from './components/public/ClientInquiryModal';
import { AffiliatePortal } from './components/portal/AffiliatePortal';
import { AdminPortal } from './components/admin/AdminPortal';
import { api } from './lib/api';

function AppContent() {
  const { user, isAuthenticated } = useAuth();

  // Modals state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isStatusLookupOpen, setIsStatusLookupOpen] = useState(false);
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);
  const [isPortalOpen, setIsPortalOpen] = useState(false);

  // Referral tracking state
  const [referredByCode, setReferredByCode] = useState<string | null>(null);

  // Check URL for ?ref=... parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');

    if (refParam) {
      const cleanRef = refParam.trim().toUpperCase();
      setReferredByCode(cleanRef);
      // Track referral click in backend
      api.trackReferralClick(cleanRef, document.referrer)
        .then((res) => {
          console.log(`[R3 Referral] Tracked attribution for code: ${res.referralCode} (Unique: ${res.isUnique})`);
        })
        .catch((err) => {
          console.warn('[R3 Referral] Referral code invalid or inactive:', err.message);
        });
    }
  }, []);

  const handleOpenPortal = () => {
    setIsPortalOpen(true);
  };

  const scrollToApply = () => {
    const el = document.getElementById('apply');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0A192F] flex flex-col font-sans selection:bg-[#D4AF37]/20 selection:text-[#0A192F]">
      {/* Public Header */}
      <Header
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenStatusLookup={() => setIsStatusLookupOpen(true)}
        onOpenPortal={handleOpenPortal}
        referredBy={referredByCode}
      />

      {/* Main Single-Page Content */}
      <main className="flex-1">
        <Hero
          onApplyClick={scrollToApply}
          onLoginClick={() => {
            if (isAuthenticated) {
              setIsPortalOpen(true);
            } else {
              setIsLoginOpen(true);
            }
          }}
        />

        <Overview />

        <div id="partnership">
          <HowItWorks />
        </div>

        <Benefits />

        <Faq />

        <ApplicationForm
          onOpenTerms={() => setLegalModalType('terms')}
          onOpenPrivacy={() => setLegalModalType('privacy')}
          referredBy={referredByCode}
        />
      </main>

      {/* Public Footer */}
      <Footer
        onOpenTerms={() => setLegalModalType('terms')}
        onOpenPrivacy={() => setLegalModalType('privacy')}
        onOpenLogin={() => {
          if (isAuthenticated) {
            setIsPortalOpen(true);
          } else {
            setIsLoginOpen(true);
          }
        }}
        onOpenInquiry={() => setIsInquiryOpen(true)}
      />

      {/* Modals & Portals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setIsPortalOpen(true)}
      />

      <StatusLookupModal
        isOpen={isStatusLookupOpen}
        onClose={() => setIsStatusLookupOpen(false)}
      />

      <LegalModal
        isOpen={legalModalType !== null}
        type={legalModalType || 'terms'}
        onClose={() => setLegalModalType(null)}
      />

      <ClientInquiryModal
        isOpen={isInquiryOpen}
        onClose={() => setIsInquiryOpen(false)}
        referralCode={referredByCode}
      />

      {/* Private Portals */}
      {isPortalOpen && isAuthenticated && user && (
        user.role === 'affiliate' ? (
          <AffiliatePortal onClose={() => setIsPortalOpen(false)} />
        ) : (
          <AdminPortal onClose={() => setIsPortalOpen(false)} />
        )
      )}

      {/* Modals and portal render clean with no demo switchers */}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
