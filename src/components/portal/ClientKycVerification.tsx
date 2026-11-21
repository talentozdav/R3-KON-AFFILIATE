import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { COUNTRIES, formatInternationalDate, formatInternationalTimestampUTC } from '../../lib/international';
import {
  ClientKycStateResponse,
  GovernmentIdType,
  KycDocumentMetadata,
  KycDocumentType,
  KycStatus
} from '../../types';
import {
  ShieldCheck,
  Lock,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Eye,
  EyeOff,
  Save,
  Send,
  RefreshCw,
  XCircle
} from 'lucide-react';

interface ClientKycVerificationProps {
  kycState: ClientKycStateResponse | null;
  onStateChange: (nextState: ClientKycStateResponse) => void;
  onReload: () => Promise<void>;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function isUSCountry(country: string): boolean {
  const c = String(country || '').trim().toLowerCase();
  return c === 'united states' || c.startsWith('united states (') || c === 'us' || c === 'usa';
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getStatusBadgeConfig(status: KycStatus): { label: string; classes: string } {
  switch (status) {
    case 'approved':
      return { label: 'Verified & Approved', classes: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    case 'under_review':
    case 'submitted':
      return { label: 'Under Compliance Review', classes: 'bg-blue-50 text-blue-800 border-blue-300' };
    case 'action_required':
      return { label: 'Additional Information Required', classes: 'bg-amber-50 text-amber-800 border-amber-300' };
    case 'rejected':
      return { label: 'Verification Rejected', classes: 'bg-red-50 text-red-800 border-red-300' };
    case 'not_started':
    default:
      return { label: 'Not Started', classes: 'bg-stone-100 text-stone-700 border-stone-300' };
  }
}

export const ClientKycVerification: React.FC<ClientKycVerificationProps> = ({
  kycState,
  onStateChange,
  onReload
}) => {
  const v = kycState?.verification;
  const documents = kycState?.documents || [];
  const history = kycState?.history || [];

  const [legalFullName, setLegalFullName] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [governmentIdType, setGovernmentIdType] = useState<GovernmentIdType | ''>('');
  const [governmentIdNumber, setGovernmentIdNumber] = useState('');
  const [ssnInput, setSsnInput] = useState('');
  const [showSsn, setShowSsn] = useState(false);
  const [livenessMethod, setLivenessMethod] = useState<'camera_capture' | 'selfie_upload'>('selfie_upload');
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [uploadingDocType, setUploadingDocType] = useState<KycDocumentType | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Camera capture state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!v) return;
    setLegalFullName(v.legalFullName || '');
    setCountry(v.country || 'United Kingdom');
    setAddressLine1(v.addressLine1 || '');
    setAddressLine2(v.addressLine2 || '');
    setCity(v.city || '');
    setStateProvince(v.stateProvince || '');
    setPostalCode(v.postalCode || '');
    setGovernmentIdType(v.governmentIdType || '');
    setLivenessMethod(v.livenessMethod || 'selfie_upload');
    setConsentAccepted(Boolean(v.consentAccepted));
  }, [v?.id, v?.updatedAt]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  if (!kycState) {
    return (
      <div className="bg-white border border-[#E2DDD3] p-8 text-center text-xs text-stone-500">
        Loading identity verification status...
      </div>
    );
  }

  const isUS = isUSCountry(country);
  const isApproved = kycState.registrationApproved;
  const isEditable = kycState.canStartVerification;
  const statusBadge = getStatusBadgeConfig(kycState.verificationStatus);

  const getUploadedDoc = (types: KycDocumentType[]): KycDocumentMetadata | undefined =>
    documents.find(d => d.uploadStatus === 'uploaded' && types.includes(d.documentType));

  const frontDoc =
    governmentIdType === 'passport'
      ? getUploadedDoc(['passport', 'gov_id_front'])
      : getUploadedDoc(['gov_id_front', 'national_id']);
  const backDoc = getUploadedDoc(['gov_id_back']);
  const selfieDoc = getUploadedDoc(['liveness_capture', 'selfie']);
  const supplementalDocs = documents.filter(d => d.uploadStatus === 'uploaded' && d.documentType === 'supplemental');

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const handleOpenCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera capture is unavailable in this browser. Please upload a clear selfie image below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      }, 60);
    } catch {
      setCameraError('Camera access was declined or unavailable. You may upload a recent identity photograph instead.');
    }
  };

  const handleCaptureCameraFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isEditable) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async blob => {
        if (!blob) {
          setCameraError('Unable to capture frame. Please upload an image file instead.');
          return;
        }
        stopCamera();
        setUploadingDocType('liveness_capture');
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
          await api.uploadClientKycFile('liveness_capture', blob, `live-selfie-${Date.now()}.jpg`);
          setLivenessMethod('camera_capture');
          await api.saveClientKycDraft({ livenessMethod: 'camera_capture', livenessVerified: true });
          await onReload();
          setSuccessMsg('Live camera identity photograph captured and encrypted.');
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to upload captured live selfie.');
        } finally {
          setUploadingDocType(null);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleFileSelected = async (docType: KycDocumentType, file: File | null) => {
    if (!file || !isEditable) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setErrorMsg('Unsupported file format. Accepted formats: JPEG, PNG, WEBP, or PDF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('Selected file exceeds the 10 MB maximum upload limit.');
      return;
    }

    setUploadingDocType(docType);
    try {
      await api.uploadClientKycFile(docType, file);
      if (docType === 'selfie') {
        setLivenessMethod('selfie_upload');
      }
      await onReload();
      setSuccessMsg(`Uploaded "${file.name}" securely to private compliance storage.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload verification document.');
    } finally {
      setUploadingDocType(null);
    }
  };

  const buildDraftPayload = () => {
    const payload: Record<string, any> = {
      legalFullName: legalFullName.trim(),
      country: country.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      stateProvince: stateProvince.trim(),
      postalCode: postalCode.trim(),
      governmentIdType: governmentIdType || undefined,
      governmentIdNumber: governmentIdNumber.trim() || undefined,
      livenessMethod,
      livenessVerified: Boolean(selfieDoc),
      consentAccepted
    };
    if (isUS && ssnInput.trim()) {
      payload.ssn = ssnInput.trim();
    }
    return payload;
  };

  const handleSaveDraft = async () => {
    if (!isEditable) return;
    setIsSavingDraft(true);
    setErrorMsg(null);
    setFieldErrors({});
    setSuccessMsg(null);
    try {
      const updated = await api.saveClientKycDraft(buildDraftPayload());
      onStateChange(updated);
      setSsnInput('');
      setGovernmentIdNumber('');
      setSuccessMsg('Verification progress saved securely. You may resume at any time.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to save KYC draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setFieldErrors({});
    setSuccessMsg(null);

    try {
      const updated = await api.submitClientKyc(buildDraftPayload());
      onStateChange(updated);
      setSsnInput('');
      setGovernmentIdNumber('');
      setSuccessMsg('Your identity verification dossier has been submitted and placed Under Review by R3 Compliance.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Please complete all mandatory verification fields and document uploads.');
      if (err.details) setFieldErrors(err.details);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Dual Status Separation Banner */}
      <div className="bg-white border border-[#E2DDD3] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] uppercase font-mono tracking-widest font-semibold">
                Post-Approval Client Due Diligence (KYC)
              </span>
            </div>
            <h3 className="font-serif text-2xl text-[#0A192F] font-normal">
              Client Identity Verification Dossier
            </h3>
            <p className="text-xs text-stone-600 font-light mt-1 max-w-2xl">
              To maintain regulatory standing across international and US engagements, R3 requires identity verification following registration approval. All uploaded files are stored privately and never exposed publicly.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
              Registration: <strong className="text-[#0A192F]">{kycState.registrationStatus}</strong> ({kycState.registrationReference || '—'})
            </div>
            <span className={`font-mono text-[11px] uppercase px-3 py-1 border ${statusBadge.classes}`}>
              KYC Status: {statusBadge.label}
            </span>
          </div>
        </div>

        {/* 4-Step Workflow Indicator */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5 text-[11px]">
          {[
            {
              step: '01',
              title: 'Registration Approved',
              done: isApproved
            },
            {
              step: '02',
              title: 'Submit Dossier & ID',
              done: ['submitted', 'under_review', 'approved'].includes(kycState.verificationStatus)
            },
            {
              step: '03',
              title: 'Compliance Review',
              done: kycState.verificationStatus === 'approved',
              active: ['submitted', 'under_review'].includes(kycState.verificationStatus)
            },
            {
              step: '04',
              title: 'KYC Verified',
              done: kycState.verificationStatus === 'approved'
            }
          ].map(item => (
            <div
              key={item.step}
              className={`p-3 border ${
                item.done
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : item.active
                  ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                  : 'bg-stone-50 border-stone-200 text-stone-600'
              }`}
            >
              <span className="font-mono text-[10px] opacity-70 block">Step {item.step}</span>
              <span className="font-medium block">{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Approval-First Lock Notice */}
      {!isApproved && (
        <div className="p-5 bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="uppercase tracking-wider font-mono text-[11px] block mb-1">
              Identity Verification Locked Until Registration Approval
            </strong>
            <p className="font-light leading-relaxed">
              Your client registration application is currently <strong className="font-medium">{kycState.registrationStatus}</strong>. In accordance with R3 security policy, identity documents and tax identifiers are never collected prior to administrative approval. You will receive an email invitation from <span className="font-mono">services@r3-konaffiliate.online</span> once approved.
            </p>
          </div>
        </div>
      )}

      {/* Action Required Instructions */}
      {kycState.verificationStatus === 'action_required' && (
        <div className="p-5 bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="uppercase tracking-wider font-mono text-[11px] block mb-1">
              Compliance Officer Request — Additional Information Needed
            </strong>
            <p className="leading-relaxed">{v?.actionRequiredMessage}</p>
            <p className="text-[11px] text-amber-800 mt-1.5 font-light">
              Please update the relevant fields or upload supplemental documentation below, then click Resubmit Verification.
            </p>
          </div>
        </div>
      )}

      {/* Under Review Banner */}
      {(kycState.verificationStatus === 'under_review' || kycState.verificationStatus === 'submitted') && (
        <div className="p-5 bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <strong className="uppercase tracking-wider font-mono text-[11px] block mb-1">
              Verification Under Compliance Review
            </strong>
            <p className="font-light leading-relaxed">
              Submitted on {formatInternationalTimestampUTC(v?.submittedAt)}. Your dossier is locked while an authorised R3 Compliance Officer completes verification. You will be notified by email once reviewed.
            </p>
          </div>
        </div>
      )}

      {/* Approved Banner */}
      {kycState.verificationStatus === 'approved' && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <strong className="uppercase tracking-wider font-mono text-[11px] block mb-1">
              Identity Verification Approved &amp; Completed
            </strong>
            <p className="font-light leading-relaxed">
              Verified on {formatInternationalTimestampUTC(v?.reviewedAt)}. Your dossier meets R3 international and US regulatory compliance requirements across active mandates.
            </p>
          </div>
        </div>
      )}

      {/* Rejected Banner */}
      {kycState.verificationStatus === 'rejected' && (
        <div className="p-5 bg-red-50 border border-red-200 text-red-950 text-xs flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div>
            <strong className="uppercase tracking-wider font-mono text-[11px] block mb-1">
              Identity Verification Not Approved
            </strong>
            <p className="leading-relaxed">{v?.rejectionReason || 'Verification did not satisfy compliance review standards.'}</p>
            <p className="text-[11px] text-red-800 mt-1.5 font-light">
              For appeals or compliance inquiries, please contact <span className="font-mono">services@r3-konaffiliate.online</span> quoting <span className="font-mono">{kycState.registrationReference}</span>.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Verification Form (Locked unless registration is Approved and status is not_started / action_required) */}
      {isApproved && (
        <form onSubmit={handleSubmitVerification} className="space-y-6">
          {/* Section 1: Personal & Residential Details */}
          <div className="bg-white border border-[#E2DDD3] p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold block">
                Section 01 · Principal Details
              </span>
              <h4 className="font-serif text-lg text-[#0A192F]">Legal Name &amp; Primary Jurisdiction</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Legal Full Name (as on Government ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={legalFullName}
                  onChange={e => setLegalFullName(e.target.value)}
                  disabled={!isEditable}
                  required
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100 focus:outline-hidden focus:border-[#0A192F]"
                />
                {fieldErrors.legalFullName && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.legalFullName}</p>}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Verified Account Email
                </label>
                <input
                  type="email"
                  value={v?.verifiedEmail || ''}
                  disabled
                  className="w-full text-xs font-mono px-3.5 py-2.5 border border-stone-200 bg-stone-100 text-stone-600"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Country / Jurisdiction of Residence <span className="text-red-500">*</span>
                </label>
                <select
                  value={country}
                  onChange={e => {
                    const next = e.target.value;
                    setCountry(next);
                    if (!isUSCountry(next)) {
                      setSsnInput('');
                      if (governmentIdType === 'state_id') {
                        setGovernmentIdType('national_id');
                      }
                    }
                  }}
                  disabled={!isEditable}
                  required
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100 focus:outline-hidden focus:border-[#0A192F]"
                >
                  {!COUNTRIES.some(c => c.name === country) && country && (
                    <option value={country}>{country}</option>
                  )}
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.country && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.country}</p>}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Residential Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  placeholder="Street number and name"
                  disabled={!isEditable}
                  required
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100 focus:outline-hidden focus:border-[#0A192F]"
                />
                {fieldErrors.addressLine1 && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.addressLine1}</p>}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Suite / Apartment / Unit (Optional)
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  disabled={!isEditable}
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100 focus:outline-hidden focus:border-[#0A192F]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    disabled={!isEditable}
                    required
                    className="w-full text-xs px-3 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100"
                  />
                  {fieldErrors.city && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.city}</p>}
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    {isUS ? 'State' : 'State / Region'}
                  </label>
                  <input
                    type="text"
                    value={stateProvince}
                    onChange={e => setStateProvince(e.target.value)}
                    disabled={!isEditable}
                    className="w-full text-xs px-3 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                    {isUS ? 'ZIP Code' : 'Postal Code'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    disabled={!isEditable}
                    required
                    className="w-full text-xs px-3 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100"
                  />
                  {fieldErrors.postalCode && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.postalCode}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Country-Adaptive Government ID & US Compliance */}
          <div className="bg-white border border-[#E2DDD3] p-6 space-y-5">
            <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold block">
                  Section 02 · {isUS ? 'United States Identification & Regulatory Filing' : 'International Government Identification'}
                </span>
                <h4 className="font-serif text-lg text-[#0A192F]">
                  Government-Issued Identification Document
                </h4>
              </div>
              <span className="text-[10px] font-mono uppercase px-2.5 py-1 bg-stone-100 border border-stone-200 text-stone-600">
                {isUS ? 'US Jurisdiction Rules' : 'International Non-US Rules (No SSN Required)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={governmentIdType}
                  onChange={e => setGovernmentIdType(e.target.value as GovernmentIdType)}
                  disabled={!isEditable}
                  required
                  className="w-full text-xs px-3.5 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100 focus:outline-hidden focus:border-[#0A192F]"
                >
                  <option value="">Select government identification...</option>
                  {isUS ? (
                    <>
                      <option value="drivers_license">US Driver's Licence</option>
                      <option value="state_id">US State-Issued Identity Card</option>
                      <option value="passport">US Passport</option>
                    </>
                  ) : (
                    <>
                      <option value="passport">Passport</option>
                      <option value="national_id">National Identity Card</option>
                      <option value="drivers_license">Driver's Licence</option>
                    </>
                  )}
                </select>
                {fieldErrors.governmentIdType && (
                  <p className="text-[11px] text-red-600 mt-1">{fieldErrors.governmentIdType}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-stone-700 font-medium mb-1">
                  ID Document Number (Only last 4 stored for reference)
                </label>
                <input
                  type="text"
                  value={governmentIdNumber}
                  onChange={e => setGovernmentIdNumber(e.target.value)}
                  placeholder={v?.governmentIdLast4 ? `Saved ending in ${v.governmentIdLast4}` : 'Document number'}
                  disabled={!isEditable}
                  className="w-full text-xs font-mono px-3.5 py-2.5 border border-stone-300 bg-white disabled:bg-stone-100"
                />
              </div>
            </div>

            {/* US Only Encrypted SSN Field */}
            {isUS && (
              <div className="p-4 bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#0A192F]" />
                    <label className="text-[11px] uppercase tracking-wider text-[#0A192F] font-semibold">
                      US Social Security Number (AES-256 Encrypted) <span className="text-red-500">*</span>
                    </label>
                  </div>
                  {v?.ssnProvided && v.ssnMasked && (
                    <span className="font-mono text-[11px] px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800">
                      Tokenized On File: {v.ssnMasked}
                    </span>
                  )}
                </div>

                <div className="relative max-w-sm">
                  <input
                    type={showSsn ? 'text' : 'password'}
                    value={ssnInput}
                    onChange={e => setSsnInput(e.target.value)}
                    placeholder={v?.ssnProvided ? 'Enter new SSN only to replace existing token' : 'XXX-XX-XXXX'}
                    disabled={!isEditable}
                    autoComplete="off"
                    className="w-full text-xs font-mono px-3.5 py-2.5 pr-10 border border-stone-300 bg-white disabled:bg-stone-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSsn(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-[#0A192F]"
                    aria-label={showSsn ? 'Hide SSN' : 'Show SSN'}
                  >
                    {showSsn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.ssn && <p className="text-[11px] text-red-600">{fieldErrors.ssn}</p>}
                <p className="text-[11px] text-stone-600 font-light leading-relaxed">
                  Required only for clients located in the United States. Your SSN is immediately encrypted using AES-256-GCM prior to database storage and is never displayed in plain text, emails, or audit logs.
                </p>
              </div>
            )}

            {/* Document Uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Front / Biodata Page */}
              <div className="p-4 border border-dashed border-stone-300 bg-stone-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#0A192F]">
                    {governmentIdType === 'passport' ? 'Passport Biodata Page *' : 'Government ID — Front Side *'}
                  </span>
                  {frontDoc && (
                    <span className="text-[10px] font-mono text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 font-light">
                  JPEG, PNG, WEBP or PDF (Max 10 MB). Ensure all four corners and text are sharp and legible.
                </p>
                {frontDoc && (
                  <div className="p-2 bg-white border border-stone-200 text-[11px] flex items-center justify-between font-mono">
                    <span className="truncate pr-2">{frontDoc.originalFilename}</span>
                    <span className="text-stone-400 shrink-0">{formatBytes(frontDoc.fileSizeBytes)}</span>
                  </div>
                )}
                {isEditable && (
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A192F] hover:bg-[#112240] text-white text-[11px] uppercase tracking-wider cursor-pointer transition-colors">
                    {uploadingDocType === (governmentIdType === 'passport' ? 'passport' : 'gov_id_front') ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                    )}
                    <span>{frontDoc ? 'Replace File' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={e =>
                        handleFileSelected(
                          governmentIdType === 'passport' ? 'passport' : 'gov_id_front',
                          e.target.files?.[0] || null
                        )
                      }
                    />
                  </label>
                )}
                {fieldErrors.govIdFront && <p className="text-[11px] text-red-600">{fieldErrors.govIdFront}</p>}
              </div>

              {/* Back Side (required for licence/state ID/national ID) */}
              {governmentIdType !== 'passport' && (
                <div className="p-4 border border-dashed border-stone-300 bg-stone-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#0A192F]">
                      Government ID — Back Side *
                    </span>
                    {backDoc && (
                      <span className="text-[10px] font-mono text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 font-light">
                    Required for driver's licences, state IDs, and two-sided national identity cards.
                  </p>
                  {backDoc && (
                    <div className="p-2 bg-white border border-stone-200 text-[11px] flex items-center justify-between font-mono">
                      <span className="truncate pr-2">{backDoc.originalFilename}</span>
                      <span className="text-stone-400 shrink-0">{formatBytes(backDoc.fileSizeBytes)}</span>
                    </div>
                  )}
                  {isEditable && (
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A192F] hover:bg-[#112240] text-white text-[11px] uppercase tracking-wider cursor-pointer transition-colors">
                      {uploadingDocType === 'gov_id_back' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                      )}
                      <span>{backDoc ? 'Replace File' : 'Upload Back Side'}</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={e => handleFileSelected('gov_id_back', e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                  {fieldErrors.govIdBack && <p className="text-[11px] text-red-600">{fieldErrors.govIdBack}</p>}
                </div>
              )}
            </div>

            {/* Supplemental Documentation (when Action Required or optional extra proof) */}
            {(kycState.verificationStatus === 'action_required' || supplementalDocs.length > 0) && (
              <div className="p-4 border border-amber-200 bg-amber-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#0A192F]">
                    Supplemental Verification Document (Proof of Address / Supporting Record)
                  </span>
                  {isEditable && (
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0A192F] text-white text-[11px] uppercase tracking-wider cursor-pointer">
                      <Upload className="w-3 h-3 text-[#D4AF37]" />
                      <span>Upload Supplemental File</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={e => handleFileSelected('supplemental', e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
                {supplementalDocs.map(doc => (
                  <div key={doc.id} className="p-2 bg-white border border-stone-200 text-[11px] flex items-center justify-between font-mono">
                    <span>{doc.originalFilename}</span>
                    <span className="text-stone-400">{formatBytes(doc.fileSizeBytes)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Selfie & Liveness Check */}
          <div className="bg-white border border-[#E2DDD3] p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold block">
                Section 03 · Biometric Identity Matching
              </span>
              <h4 className="font-serif text-lg text-[#0A192F]">Recent Identity Photograph / Live Camera Check</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="text-xs text-stone-600 font-light space-y-2 leading-relaxed">
                <p>
                  Provide a clear, recent photograph of yourself looking directly at the camera so our compliance team can match your likeness against your government ID.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Even lighting with no heavy shadows or flash glare</li>
                  <li>Remove sunglasses or face-obscuring accessories</li>
                  <li>Only your full face centered in the frame</li>
                </ul>
                {selfieDoc && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center justify-between font-mono">
                    <span className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      {selfieDoc.originalFilename}
                    </span>
                    <span className="shrink-0 ml-2">{formatBytes(selfieDoc.fileSizeBytes)}</span>
                  </div>
                )}
                {fieldErrors.selfie && <p className="text-[11px] text-red-600">{fieldErrors.selfie}</p>}
              </div>

              <div className="space-y-3">
                {isEditable && !isCameraOpen && (
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={handleOpenCamera}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0A192F] hover:bg-[#112240] text-white text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Use Live Camera Check</span>
                    </button>

                    <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#0A192F] text-[#0A192F] hover:bg-stone-50 text-[11px] uppercase tracking-wider cursor-pointer">
                      {uploadingDocType === 'selfie' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{selfieDoc ? 'Replace Selfie File' : 'Upload Selfie Photograph'}</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e => handleFileSelected('selfie', e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                )}

                {cameraError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                    {cameraError}
                  </div>
                )}

                {isCameraOpen && (
                  <div className="border border-stone-300 bg-black p-2 space-y-2">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-64 object-cover" />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleCaptureCameraFrame}
                        className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs uppercase tracking-wider font-medium"
                      >
                        Capture Live Photo
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-2 bg-stone-700 text-white text-xs uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>
          </div>

          {/* Section 4: Data Governance, Privacy & Mandatory Consent */}
          <div className="bg-white border border-[#E2DDD3] p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold block">
                Section 04 · Privacy &amp; Retention Governance
              </span>
              <h4 className="font-serif text-lg text-[#0A192F]">KYC Data Protection &amp; Authorization</h4>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 text-[11px] text-stone-700 font-light space-y-2 leading-relaxed">
              <p>
                <strong className="text-[#0A192F] font-medium">Purpose &amp; Strict Access Control:</strong> Identity verification records, government ID copies, photographs, and encrypted US tax identifiers (where applicable) are collected solely for anti-money laundering (AML), client due diligence, and regulatory compliance. Access is restricted strictly to authorised R3 Compliance Officers and System Security Administrators.
              </p>
              <p>
                <strong className="text-[#0A192F] font-medium">Encryption, Retention &amp; Rights:</strong> Files are encrypted in private storage and audited upon every view. Records are retained for up to seven (7) years following mandate conclusion unless statutory obligations require otherwise. To submit privacy, access, or erasure requests under applicable international or US law, contact{' '}
                <a href="mailto:services@r3-konaffiliate.online" className="font-mono underline text-[#0A192F]">
                  services@r3-konaffiliate.online
                </a>.
              </p>
            </div>

            <label className="flex items-start gap-3 text-xs text-stone-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={e => setConsentAccepted(e.target.checked)}
                disabled={!isEditable}
                className="mt-0.5 accent-[#0A192F]"
              />
              <span className="leading-relaxed">
                I certify that the information and documents provided are authentic and accurate, and I consent to R3 Contingencies processing and storing my verification records under the privacy and retention terms above.
              </span>
            </label>
            {fieldErrors.consentAccepted && <p className="text-[11px] text-red-600">{fieldErrors.consentAccepted}</p>}
          </div>

          {/* Action Buttons */}
          {isEditable && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#0A192F] text-[#0A192F] hover:bg-stone-100 text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDraft ? 'Saving Progress...' : 'Save Draft'}</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isSavingDraft}
                className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-[#0A192F] hover:bg-[#112240] text-[#FAF9F6] border border-[#1A2E4C] text-xs uppercase tracking-widest font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {isSubmitting
                    ? 'Submitting Dossier...'
                    : kycState.verificationStatus === 'action_required'
                    ? 'Resubmit Updated Verification'
                    : 'Submit Identity Verification'}
                </span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* Client Review History Timeline */}
      {history.length > 0 && (
        <div className="bg-white border border-[#E2DDD3] p-6 space-y-3">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
            <FileText className="w-4 h-4 text-[#D4AF37]" />
            <h4 className="font-serif text-base text-[#0A192F]">Verification Status Timeline</h4>
          </div>
          <div className="space-y-2.5">
            {history.map(item => (
              <div key={item.id} className="p-3 bg-stone-50 border border-stone-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#0A192F] font-semibold">
                    {item.action.replace('_', ' ')} → {item.newStatus.replace('_', ' ')}
                  </span>
                  {item.clientMessage && <p className="text-stone-600 font-light mt-0.5">{item.clientMessage}</p>}
                </div>
                <span className="font-mono text-[10px] text-stone-400 shrink-0">
                  {formatInternationalDate(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
