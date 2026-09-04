import React from 'react';
import toast, { type Toast } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import '../components/Toast.css';

type Tone = 'success' | 'error' | 'info';

interface NfToastProps {
  t: Toast;
  tone: Tone;
  msg: string;
}

const ICONS: Record<Tone, React.ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
};

function NfToastEl({ t, tone, msg }: NfToastProps) {
  const role = tone === 'error' ? 'alert' : 'status';
  return (
    <div
      role={role}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`nf-toast nf-toast--${tone} ${t.visible ? 'nf-toast--in' : 'nf-toast--out'}`}
    >
      <span className="nf-toast__bar" aria-hidden="true" />
      <span className="nf-toast__icon" aria-hidden="true">{ICONS[tone]}</span>
      <span className="nf-toast__msg">{msg}</span>
      <button
        type="button"
        className="nf-toast__dismiss"
        aria-label="Dismiss notification"
        onClick={() => toast.dismiss(t.id)}
      >
        <X size={14} />
      </button>
    </div>
  );
}

const BASE_OPTS = { duration: 4000, style: {} };

export const nfToast = {
  success: (msg: string) =>
    toast.custom((t) => <NfToastEl t={t} tone="success" msg={msg} />, BASE_OPTS),
  error: (msg: string) =>
    toast.custom((t) => <NfToastEl t={t} tone="error" msg={msg} />, {
      ...BASE_OPTS,
      duration: 5000,
    }),
  info: (msg: string) =>
    toast.custom((t) => <NfToastEl t={t} tone="info" msg={msg} />, BASE_OPTS),
};
