import { Shield, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { SmimeStatus, SmimeCertificate } from '../types/jmap';

interface SmimeBadgeProps {
  status?: SmimeStatus;
  certificate?: SmimeCertificate | null;
}

export function SmimeBadge({ status, certificate }: SmimeBadgeProps) {
  if (!status || status === 'none') return null;

  const config = {
    signed: { icon: Shield, label: 'Signed', color: 'text-icloud-accent' },
    verified: { icon: ShieldCheck, label: `Verified: ${certificate?.subject || 'Unknown'}`, color: 'text-green-600 dark:text-green-400' },
    failed: { icon: ShieldAlert, label: 'Signature verification failed', color: 'text-red-500' },
    invalid: { icon: ShieldX, label: 'Invalid signature', color: 'text-red-500' },
  };

  const { icon: Icon, label, color } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}
      title={label}
      role="status"
    >
      <Icon size={14} strokeWidth={1.25} aria-hidden="true" />
      <span className="sr-only">S/MIME:</span>
      {label}
    </span>
  );
}
