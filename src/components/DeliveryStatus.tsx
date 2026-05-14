import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useSubmissionStatus, type EmailSubmission } from '../hooks/useSubmissions';

interface DeliveryStatusProps {
  emailId: string;
}

// Derive the most representative "overall" delivery status from all recipients.
function deriveOverallStatus(
  submissions: EmailSubmission[],
): 'pending' | 'delivered' | 'queued' | 'failed' | null {
  if (submissions.length === 0) return null;

  const latest = submissions[submissions.length - 1];

  // If the undo window is still open, show "Scheduled"
  if (latest.undoStatus === 'pending') return 'pending';

  const statuses = Object.values(latest.deliveryStatus ?? {}).map(
    (d) => d.delivered,
  );

  if (statuses.length === 0) return 'queued';

  if (statuses.includes('no')) return 'failed';
  if (statuses.every((s) => s === 'yes')) return 'delivered';
  if (statuses.some((s) => s === 'queued')) return 'queued';

  return null;
}

type BadgeConfig = {
  label: string;
  icon: React.ReactNode;
  className: string;
};

function getBadgeConfig(
  status: 'pending' | 'delivered' | 'queued' | 'failed',
): BadgeConfig {
  switch (status) {
    case 'pending':
      return {
        label: 'Scheduled',
        icon: <Clock className="w-3 h-3" strokeWidth={1.5} />,
        className: 'bg-icloud-accent/10 text-icloud-accent',
      };
    case 'delivered':
      return {
        label: 'Delivered',
        icon: <CheckCircle className="w-3 h-3" strokeWidth={1.5} />,
        className: 'bg-icloud-green/10 text-icloud-green',
      };
    case 'queued':
      return {
        label: 'Queued',
        icon: <AlertCircle className="w-3 h-3" strokeWidth={1.5} />,
        className: 'bg-icloud-orange/10 text-icloud-orange',
      };
    case 'failed':
      return {
        label: 'Failed',
        icon: <XCircle className="w-3 h-3" strokeWidth={1.5} />,
        className: 'bg-icloud-red/10 text-icloud-red',
      };
  }
}

/**
 * DeliveryStatus — small inline badge showing the delivery status of a sent
 * email, derived from EmailSubmission records.
 */
export function DeliveryStatus({ emailId }: DeliveryStatusProps) {
  const { data: submissions, isLoading } = useSubmissionStatus(emailId);

  if (isLoading) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-icloud-bg-layer1  ">
          <span className="w-2 h-2 rounded-full bg-icloud-text-tertiary animate-pulse" />
          Checking…
        </span>
    );
  }

  if (!submissions || submissions.length === 0) return null;

  const status = deriveOverallStatus(submissions);
  if (!status) return null;

  const { label, icon, className } = getBadgeConfig(status);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold select-none ${className}`}
      title={`Delivery status: ${label}`}
    >
      {icon}
      {label}
    </span>
  );
}
