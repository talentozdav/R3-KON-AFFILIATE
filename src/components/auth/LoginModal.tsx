import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Lock, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login, switchPersona } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await login(email.trim());
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPersona = async (personaEmail: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await switchPersona(personaEmail);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate persona.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-md w-full p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-[#D4AF37]">
            <Lock className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest font-semibold font-sans">
              Encrypted Authentication Gateway
            </span>
          </div>
          <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
            Member & Admin Sign In
          </h3>
          <p className="text-xs text-stone-600 mt-1 font-light">
            Access your private affiliate dashboard or R3 administrative console.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 mb-6">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
              Authorized Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.com"
              required
              className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
              Security Key / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50"
          >
            <span>{isLoading ? 'Verifying Identity...' : 'Sign In to Portal'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
          </button>
        </form>

        {/* Evaluation / Pre-configured Persona Selector */}
        <div className="pt-5 border-t border-stone-200">
          <span className="block text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-2.5 font-sans">
            Evaluation Quick-Sign-In:
          </span>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => handleQuickPersona('alexander.v@vanderbilt-capital.com')}
              className="w-full text-left p-2.5 bg-white hover:bg-stone-50 border border-stone-200 transition-colors flex items-center justify-between text-xs"
            >
              <div>
                <strong className="block text-[#0A192F]">Alexander Vanderbilt</strong>
                <span className="text-[11px] text-stone-500 font-light">Active Affiliate (Vanderbilt Capital Advisory · R3-AFF-2041)</span>
              </div>
              <span className="text-[10px] font-mono uppercase text-[#D4AF37]">Affiliate</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona('superadmin@r3contingencies.com')}
              className="w-full text-left p-2.5 bg-white hover:bg-stone-50 border border-stone-200 transition-colors flex items-center justify-between text-xs"
            >
              <div>
                <strong className="block text-[#0A192F]">Julian Sterling</strong>
                <span className="text-[11px] text-stone-500 font-light">Super Administrator (Head of Governance & Rules)</span>
              </div>
              <span className="text-[10px] font-mono uppercase text-blue-700">Super Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona('affiliates@r3contingencies.com')}
              className="w-full text-left p-2.5 bg-white hover:bg-stone-50 border border-stone-200 transition-colors flex items-center justify-between text-xs"
            >
              <div>
                <strong className="block text-[#0A192F]">Elena Rostova</strong>
                <span className="text-[11px] text-stone-500 font-light">Affiliate Director (Application Review & Activation)</span>
              </div>
              <span className="text-[10px] font-mono uppercase text-amber-700">Manager</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona('finance@r3contingencies.com')}
              className="w-full text-left p-2.5 bg-white hover:bg-stone-50 border border-stone-200 transition-colors flex items-center justify-between text-xs"
            >
              <div>
                <strong className="block text-[#0A192F]">Marcus Vance</strong>
                <span className="text-[11px] text-stone-500 font-light">Chief Financial Officer (Commissions & Payout Batches)</span>
              </div>
              <span className="text-[10px] font-mono uppercase text-emerald-700">Finance</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
