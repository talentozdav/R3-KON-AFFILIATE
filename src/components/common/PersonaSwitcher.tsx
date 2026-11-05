import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, Shield, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface PersonaSwitcherProps {
  onOpenPortal: () => void;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ onOpenPortal }) => {
  const { user, switchPersona, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const personas = [
    {
      email: 'alexander.v@vanderbilt-capital.com',
      name: 'Alexander Vanderbilt',
      roleLabel: 'Affiliate Partner',
      badge: 'R3-AFF-2041',
      desc: 'Managing Director, Vanderbilt Capital Advisory'
    },
    {
      email: 'superadmin@r3contingencies.com',
      name: 'Julian Sterling',
      roleLabel: 'Super Admin',
      badge: 'Head of Governance',
      desc: 'System Rules & Security Authority'
    },
    {
      email: 'affiliates@r3contingencies.com',
      name: 'Elena Rostova',
      roleLabel: 'Affiliate Manager',
      badge: 'Intake Director',
      desc: 'Application Due Diligence & Activation'
    },
    {
      email: 'finance@r3contingencies.com',
      name: 'Marcus Vance',
      roleLabel: 'Finance Manager',
      badge: 'CFO',
      desc: 'Conversions, Commissions & Wire Payouts'
    }
  ];

  const handleSelect = async (email: string) => {
    await switchPersona(email);
    onOpenPortal();
  };

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40">
      <div className="bg-[#0A192F] text-[#FAF9F6] border border-[#1A2E4C] shadow-2xl">
        {/* Toggle Bar */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 px-3.5 py-2 text-xs font-mono tracking-wider hover:bg-[#112240] transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          <span className="text-[11px] uppercase text-[#D4AF37] font-semibold">
            Test Persona:
          </span>
          <span className="text-stone-300">
            {user ? `${user.fullName} (${user.role.replace('_', ' ')})` : 'Public Visitor Mode'}
          </span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-stone-400" /> : <ChevronUp className="w-3.5 h-3.5 text-stone-400" />}
        </button>

        {/* Expanded Drawer */}
        {isOpen && (
          <div className="p-3 border-t border-[#1A2E4C] space-y-1.5 w-80 text-xs bg-[#060F1E]">
            <div className="text-[10px] uppercase tracking-wider text-stone-400 px-2 pb-1 font-sans">
              Switch Test Account (One-Click Testing)
            </div>

            {personas.map((p) => {
              const isCurrent = user?.email.toLowerCase() === p.email.toLowerCase();
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => handleSelect(p.email)}
                  className={`w-full text-left p-2 border transition-colors flex items-start justify-between ${
                    isCurrent
                      ? 'bg-[#1A2E4C] border-[#D4AF37] text-white'
                      : 'bg-[#0A192F] border-[#1A2E4C] text-stone-300 hover:border-stone-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-white text-xs">{p.name}</strong>
                      {isCurrent && <Check className="w-3 h-3 text-[#D4AF37]" />}
                    </div>
                    <span className="block text-[10px] text-stone-400 font-light mt-0.5">{p.desc}</span>
                  </div>
                  <span className="text-[9px] font-mono text-[#D4AF37] uppercase px-1.5 py-0.5 bg-[#060F1E] border border-[#1A2E4C] shrink-0">
                    {p.roleLabel}
                  </span>
                </button>
              );
            })}

            {user && (
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setIsOpen(false);
                }}
                className="w-full text-center py-1.5 text-[10px] uppercase font-mono tracking-wider text-stone-400 hover:text-white border border-[#1A2E4C] hover:border-stone-500 mt-2"
              >
                Log Out to Public Visitor Mode
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
