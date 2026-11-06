import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { X, Lock, KeyRound, UserCheck, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AuthMode = 'login' | 'activate' | 'forgot';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login, activateAccount } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  // Sign in fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Activation fields
  const [activateEmail, setActivateEmail] = useState('');
  const [activateRef, setActivateRef] = useState('');
  const [activatePassword, setActivatePassword] = useState('');
  const [activateConfirm, setActivateConfirm] = useState('');

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await login(loginEmail.trim(), loginPassword);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activateEmail.trim() || !activateRef.trim() || !activatePassword) {
      setErrorMsg('All activation fields are required.');
      return;
    }

    if (activatePassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters in length.');
      return;
    }

    if (activatePassword !== activateConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const msg = await activateAccount(activateEmail.trim(), activateRef.trim(), activatePassword);
      setSuccessMsg(msg || 'Account activated successfully. Accessing portal...');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Activation failed. Please confirm your approval status and reference code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.forgotPassword(forgotEmail.trim());
      setForgotSuccess(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
      <div className="bg-[#FAF9F6] border border-[#E2DDD3] max-w-md w-full p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-stone-500 hover:text-[#0A192F] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="mb-4">
            <BrandLogo variant="light" size="sm" showSubtitle={false} />
          </div>
          <div className="flex items-center gap-2 mb-2 text-[#D4AF37]">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-semibold font-sans">
              Encrypted Fiduciary Gateway
            </span>
          </div>
          <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
            {mode === 'login' && 'Member & Admin Sign In'}
            {mode === 'activate' && 'Activate Approved Account'}
            {mode === 'forgot' && 'Reset Account Password'}
          </h3>
          <p className="text-xs text-stone-600 mt-1 font-light">
            {mode === 'login' && 'Access your private affiliate dashboard or R3 administrative console.'}
            {mode === 'activate' && 'Approved partners enter their application reference number to set security credentials.'}
            {mode === 'forgot' && 'Enter your authorized email to receive secure password recovery instructions.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 mb-5 text-xs">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 ${
              mode === 'login'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('activate'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 ${
              mode === 'activate'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Activate Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('forgot'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 ${
              mode === 'forgot'
                ? 'border-[#0A192F] text-[#0A192F]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Recovery
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 font-light">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: SIGN IN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                Authorized Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="partner@firm.com"
                required
                className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setErrorMsg(null); }}
                  className="text-[11px] text-[#0A192F] hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>{isLoading ? 'Verifying Identity...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
            </button>
          </form>
        )}

        {/* MODE 2: ACTIVATE ACCOUNT */}
        {mode === 'activate' && (
          <form onSubmit={handleActivateSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                Approved Application Email
              </label>
              <input
                type="email"
                value={activateEmail}
                onChange={(e) => setActivateEmail(e.target.value)}
                placeholder="applicant@firm.com"
                required
                className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                Application Reference Code
              </label>
              <input
                type="text"
                value={activateRef}
                onChange={(e) => setActivateRef(e.target.value.toUpperCase())}
                placeholder="R3-2026-XXXX"
                required
                className="w-full text-xs font-mono uppercase px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              />
              <span className="text-[10px] text-stone-500 font-light mt-0.5 block">
                Issued upon application submission and confirmed upon intake approval.
              </span>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                Create Secure Password
              </label>
              <input
                type="password"
                value={activatePassword}
                onChange={(e) => setActivatePassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
                className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={activateConfirm}
                onChange={(e) => setActivateConfirm(e.target.value)}
                placeholder="Confirm password"
                minLength={8}
                required
                className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50 cursor-pointer mt-2"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{isLoading ? 'Activating Credentials...' : 'Activate & Enter Dashboard'}</span>
            </button>
          </form>
        )}

        {/* MODE 3: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <div>
            {forgotSuccess ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                <h4 className="font-serif text-lg text-[#0A192F] mb-1">Request Received</h4>
                <p className="text-xs text-stone-600 font-light mb-5">
                  {forgotSuccess}
                </p>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setForgotSuccess(null); }}
                  className="px-4 py-2 bg-[#0A192F] text-white text-xs uppercase tracking-wider"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    Registered Account Email
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="partner@firm.com"
                    required
                    className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-white transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{isLoading ? 'Processing Request...' : 'Issue Password Reset'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer Support Info */}
        <div className="pt-5 mt-5 border-t border-stone-200 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 font-light">
            <HelpCircle className="w-3 h-3 text-[#D4AF37]" />
            <span>Need assistance? Contact Secretariat:</span>
          </div>
          <div className="mt-1 text-xs">
            <a
              href="mailto:services@r3-konaffiliate.online"
              className="font-mono text-stone-700 hover:text-[#0A192F] underline underline-offset-2"
            >
              services@r3-konaffiliate.online
            </a>
            <span className="text-stone-400 mx-2">·</span>
            <a
              href="tel:+19313660615"
              className="font-mono text-stone-700 hover:text-[#0A192F]"
            >
              +1(931)366-0615
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
