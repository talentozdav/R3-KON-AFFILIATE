import React, { useState } from 'react';
import { api } from '../../lib/api';
import { ApplicantType } from '../../types';
import { CheckCircle2, AlertCircle, Copy, Check, ArrowRight } from 'lucide-react';

interface ApplicationFormProps {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  referredBy?: string | null;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  onOpenTerms,
  onOpenPrivacy,
  referredBy
}) => {
  const [applicantType, setApplicantType] = useState<ApplicantType>('Business');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [partnershipCategory, setPartnershipCategory] = useState('Wealth Advisory');
  const [industryBackground, setIndustryBackground] = useState('');
  const [audienceDescription, setAudienceDescription] = useState('');
  const [partnershipObjectives, setPartnershipObjectives] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const categories = [
    'Wealth Advisory & Multi-Family Office',
    'Corporate Risk & Fiduciary Practice',
    'Private Client Legal & Tax Advisory',
    'Executive Leadership & Board Consulting',
    'U.S. Federal & Multi-State Regulatory Advisory',
    'Boutique Financial Advisory',
    'Other Specialized Advisory'
  ];

  const validateClientSide = () => {
    const errs: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = 'Full legal name is required.';
    }

    if (applicantType === 'Business' && (!businessName.trim() || businessName.trim().length < 2)) {
      errs.businessName = 'Registered U.S. entity or LLC/corporate practice name is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errs.email = 'Valid corporate or professional email is required.';
    }

    if (!phone.trim() || phone.trim().length < 6) {
      errs.phone = 'Valid direct U.S. phone number is required.';
    }

    if (!country.trim() || country.trim().length < 2) {
      errs.country = 'U.S. State / jurisdiction of registration is required.';
    }

    if (!industryBackground.trim() || industryBackground.trim().length < 20) {
      errs.industryBackground = 'Please provide at least 20 characters describing your professional background.';
    }

    if (!audienceDescription.trim() || audienceDescription.trim().length < 20) {
      errs.audienceDescription = 'Please describe your client network or audience (minimum 20 characters).';
    }

    if (!partnershipObjectives.trim() || partnershipObjectives.trim().length < 20) {
      errs.partnershipObjectives = 'Please articulate your partnership objectives (minimum 20 characters).';
    }

    if (!termsAccepted) {
      errs.termsAccepted = 'Acceptance of the R3 Global Affiliate Terms is mandatory.';
    }

    if (!privacyAccepted) {
      errs.privacyAccepted = 'Acceptance of the Privacy Notice & Data Governance is mandatory.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!validateClientSide()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitApplication({
        fullName: fullName.trim(),
        applicantType,
        businessName: applicantType === 'Business' ? businessName.trim() : undefined,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        country: country.trim(),
        partnershipCategory,
        industryBackground: industryBackground.trim(),
        audienceDescription: audienceDescription.trim(),
        partnershipObjectives: partnershipObjectives.trim(),
        additionalInfo: additionalInfo.trim() || (referredBy ? `Attributed referral key: ${referredBy}` : undefined),
        termsAccepted,
        privacyAccepted
      });

      setSubmittedRef(res.referenceNumber);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while submitting your application.');
      if (err.details) {
        setFieldErrors(err.details);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRef = () => {
    if (submittedRef) {
      navigator.clipboard.writeText(submittedRef);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleReset = () => {
    setSubmittedRef(null);
    setFullName('');
    setBusinessName('');
    setEmail('');
    setPhone('');
    setCountry('');
    setIndustryBackground('');
    setAudienceDescription('');
    setPartnershipObjectives('');
    setAdditionalInfo('');
    setTermsAccepted(false);
    setPrivacyAccepted(false);
    setFieldErrors({});
  };

  return (
    <section id="apply" className="py-20 lg:py-28 bg-[#FAF9F6] border-b border-[#E2DDD3]">
      <div className="max-w-4xl mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-px bg-[#D4AF37]" />
            <span>Formal Candidacy Gateway</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#0A192F] font-normal tracking-tight leading-tight mb-4">
            Apply for Partnership
          </h2>
          <p className="text-stone-600 text-sm leading-relaxed font-light">
            Complete the formal partnership application below. Applications are reviewed in strict confidence by the R3 Intake Committee. Please allow 3–5 business days for compliance review.
          </p>
        </div>

        {/* Success Confirmation State */}
        {submittedRef ? (
          <div className="p-8 sm:p-12 bg-white border border-[#E2DDD3] shadow-xs">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-stone-100 flex items-center justify-center text-[#0A192F] shrink-0">
                <CheckCircle2 className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#D4AF37] block mb-1">
                  Submission Logged · Status: Submitted
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl text-[#0A192F] font-normal mb-2">
                  Partnership Application Received
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed font-light">
                  Thank you, <strong className="font-medium text-[#0A192F]">{fullName}</strong>. Your candidacy dossier has been formally logged into the R3 Contingencies compliance registry.
                </p>
              </div>
            </div>

            {/* Reference Box */}
            <div className="p-6 bg-stone-50 border border-stone-200 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-stone-500 uppercase tracking-wider block font-sans mb-1">
                  Application Reference Number
                </span>
                <span className="font-mono text-xl text-[#0A192F] tracking-wide font-medium">
                  {submittedRef}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyRef}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wider border border-stone-300 hover:border-[#0A192F] text-stone-700 hover:text-[#0A192F] transition-colors self-start sm:self-auto bg-white"
              >
                {copiedRef ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    <span>Copy Reference</span>
                  </>
                )}
              </button>
            </div>

            {/* Next Steps Brief */}
            <div className="space-y-3 mb-8 text-xs text-stone-600 leading-relaxed font-light">
              <p>
                <strong>What happens next:</strong>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-stone-50 border border-stone-100">
                  <span className="block font-mono text-[10px] text-stone-400 mb-1">Phase 1</span>
                  <strong className="block text-[#0A192F] mb-1">Compliance Due Diligence</strong>
                  Our intake officers review jurisdictional licenses and professional background.
                </div>
                <div className="p-4 bg-stone-50 border border-stone-100">
                  <span className="block font-mono text-[10px] text-stone-400 mb-1">Phase 2</span>
                  <strong className="block text-[#0A192F] mb-1">Partner Interview</strong>
                  Qualified candidates are invited to a confidential alignment consultation.
                </div>
                <div className="p-4 bg-stone-50 border border-stone-100">
                  <span className="block font-mono text-[10px] text-stone-400 mb-1">Phase 3</span>
                  <strong className="block text-[#0A192F] mb-1">Portal Activation</strong>
                  Upon approval, secure private portal credentials and referral keys are issued.
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-stone-200 flex items-center justify-between">
              <span className="text-[11px] text-stone-500 font-sans">
                You can check review progress anytime using the "Application Status" tool.
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs uppercase tracking-wider text-[#0A192F] hover:text-[#D4AF37] transition-colors"
              >
                Submit Another Application
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-8 sm:p-12 bg-white border border-[#E2DDD3] space-y-8 shadow-xs">
            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-medium">Submission Error</strong>
                  {errorMsg}
                </div>
              </div>
            )}

            {/* Applicant Type Segmented Control */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-2">
                Applicant Type
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setApplicantType('Business')}
                  className={`py-2.5 px-4 text-xs uppercase tracking-wider font-medium border transition-colors ${
                    applicantType === 'Business'
                      ? 'bg-[#0A192F] text-[#FAF9F6] border-[#0A192F]'
                      : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                  }`}
                >
                  Corporate Entity
                </button>
                <button
                  type="button"
                  onClick={() => setApplicantType('Individual')}
                  className={`py-2.5 px-4 text-xs uppercase tracking-wider font-medium border transition-colors ${
                    applicantType === 'Individual'
                      ? 'bg-[#0A192F] text-[#FAF9F6] border-[#0A192F]'
                      : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                  }`}
                >
                  Individual Advisor
                </button>
              </div>
            </div>

            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Full Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
                {fieldErrors.fullName && (
                  <p className="mt-1 text-[11px] text-red-600">{fieldErrors.fullName}</p>
                )}
              </div>

              {applicantType === 'Business' && (
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                    Registered U.S. Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Vance & Partners Advisory LLC"
                    className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                  />
                  {fieldErrors.businessName && (
                    <p className="mt-1 text-[11px] text-red-600">{fieldErrors.businessName}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Professional Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alexander@vance-partners.com"
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Direct Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (212) 555-0192"
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
                {fieldErrors.phone && (
                  <p className="mt-1 text-[11px] text-red-600">{fieldErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  U.S. State / Jurisdiction of Registration <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Delaware / New York / California (USA)"
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
                {fieldErrors.country && (
                  <p className="mt-1 text-[11px] text-red-600">{fieldErrors.country}</p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Partnership Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={partnershipCategory}
                  onChange={(e) => setPartnershipCategory(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Detailed Professional Background */}
            <div className="space-y-6 pt-4 border-t border-stone-200">
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Professional or Industry Background <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={industryBackground}
                  onChange={(e) => setIndustryBackground(e.target.value)}
                  placeholder="Summarize your U.S. professional experience, FINRA/SEC or state bar standing, corporate registrations, or advisory specialization..."
                  className="w-full text-xs p-3.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
                {fieldErrors.industryBackground && (
                  <p className="mt-1 text-[11px] text-red-600">{fieldErrors.industryBackground}</p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Audience &amp; Client Network Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={audienceDescription}
                  onChange={(e) => setAudienceDescription(e.target.value)}
                  placeholder="Describe the nature of your U.S. client base (e.g. domestic UHNW principals, corporate risk officers, family offices, Delaware trusts)..."
                  className="w-full text-xs p-3.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
                {fieldErrors.audienceDescription && (
                  <p className="mt-1 text-[11px] text-red-600">{fieldErrors.audienceDescription}</p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Partnership Objectives <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={partnershipObjectives}
                  onChange={(e) => setPartnershipObjectives(e.target.value)}
                  placeholder="Articulate why you wish to partner with R3 Contingencies and how our contingency frameworks support your clients..."
                  className="w-full text-xs p-3.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
                {fieldErrors.partnershipObjectives && (
                  <p className="mt-1 text-[11px] text-red-600">{fieldErrors.partnershipObjectives}</p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-700 font-medium mb-1.5">
                  Additional Information (Optional)
                </label>
                <textarea
                  rows={2}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Any referral reference, existing R3 contact, or supplementary context..."
                  className="w-full text-xs p-3.5 border border-stone-300 focus:outline-hidden focus:border-[#0A192F] bg-[#FAF9F6]/40 transition-colors"
                />
              </div>
            </div>

            {/* Terms & Privacy Checkboxes */}
            <div className="space-y-4 pt-4 border-t border-stone-200">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#0A192F] border-stone-300 rounded-none focus:ring-0"
                />
                <span className="text-xs text-stone-700 leading-normal font-light">
                  I accept the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenTerms();
                    }}
                    className="underline text-[#0A192F] hover:text-[#D4AF37] font-medium"
                  >
                    R3 Global Affiliate Terms
                  </button>
                  . I understand that application does not constitute automatic acceptance and that commissions are contingent on verified, executed client agreements.
                </span>
              </label>
              {fieldErrors.termsAccepted && (
                <p className="text-[11px] text-red-600 pl-7">{fieldErrors.termsAccepted}</p>
              )}

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#0A192F] border-stone-300 rounded-none focus:ring-0"
                />
                <span className="text-xs text-stone-700 leading-normal font-light">
                  I acknowledge and accept the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenPrivacy();
                    }}
                    className="underline text-[#0A192F] hover:text-[#D4AF37] font-medium"
                  >
                    R3 Privacy & Due Diligence Notice
                  </button>
                  , authorizing R3 Contingencies to conduct U.S. KYC, OFAC sanctions, entity registration, and institutional compliance checks.
                </span>
              </label>
              {fieldErrors.privacyAccepted && (
                <p className="text-[11px] text-red-600 pl-7">{fieldErrors.privacyAccepted}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] px-10 py-3.5 text-xs uppercase tracking-widest font-medium transition-all disabled:opacity-50 shadow-sm"
              >
                <span>{isSubmitting ? 'Verifying & Submitting...' : 'Submit Partnership Application'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};
