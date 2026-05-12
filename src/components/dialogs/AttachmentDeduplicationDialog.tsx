/**
 * AttachmentDeduplicationDialog - UI for viewing and managing duplicate attachments
 * 
 * This dialog displays attachment deduplication analysis results and allows users
 * to view which emails reference duplicate attachments.
 * 
 * Features:
 * - Display duplicate attachment groups with metadata
 * - Show storage savings potential
 * - View emails referencing each attachment
 * - iCloud Mail-style UI with glassmorphic design
 */

import { useState, useRef } from 'react';
import { X, FileIcon, HardDrive, Mail, ChevronRight, AlertCircle } from 'lucide-react';
import { BaseDialog } from './BaseDialog';
import { Card } from '../ui/Card';
import { useAttachmentDeduplication, useAttachmentReferences, formatBytes, getDeduplicationStatusText, getDeduplicationStatusColor, type DuplicateAttachmentGroup } from '../../hooks/useAttachmentDeduplication';
import type { Email } from '../../types/jmap';
import { useBlobCapability } from '../../hooks/useBlobs';

interface AttachmentDeduplicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog for viewing and managing duplicate attachments
 */
export function AttachmentDeduplicationDialog({
  isOpen,
  onClose,
}: AttachmentDeduplicationDialogProps) {
  const [selectedGroup, setSelectedGroup] = useState<DuplicateAttachmentGroup | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const { data: capability } = useBlobCapability();
  const { data: dedupResult, isLoading, error } = useAttachmentDeduplication({
    limit: 50,
  }, {
    enabled: isOpen,
  });

  const hasBlobCapability = !!capability;

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={selectedGroup ? 'Duplicate Details' : 'Attachment Deduplication'}
      titleId="dedup-dialog-title"
      initialFocusRef={closeButtonRef}
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {selectedGroup ? (
          <DuplicateDetailView
            group={selectedGroup}
            onBack={() => setSelectedGroup(null)}
          />
        ) : (
          <DeduplicationOverview
            hasBlobCapability={hasBlobCapability}
            isLoading={isLoading}
            error={error}
            dedupResult={dedupResult}
            onSelectGroup={setSelectedGroup}
          />
        )}
      </div>
    </BaseDialog>
  );
}

// ============ Sub-components ============

interface DeduplicationOverviewProps {
  hasBlobCapability: boolean;
  isLoading: boolean;
  error: Error | null;
  dedupResult: ReturnType<typeof useAttachmentDeduplication>['data'];
  onSelectGroup: (group: DuplicateAttachmentGroup) => void;
}

function DeduplicationOverview({
  hasBlobCapability,
  isLoading,
  error,
  dedupResult,
  onSelectGroup,
}: DeduplicationOverviewProps) {
  if (!hasBlobCapability) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-[#FF9500] mx-auto mb-4" strokeWidth={1.5} />
        <h3 className="text-[17px] font-semibold text-[#1C1C1E] mb-2">
          Blob Management Not Available
        </h3>
        <p className="text-[13px] text-[#6C6C70] max-w-xs mx-auto">
          Your JMAP server does not support RFC 9404 Blob Management, which is required for attachment deduplication analysis.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[13px] text-[#6C6C70]">Analyzing attachments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-[#FF3B30] mx-auto mb-4" strokeWidth={1.5} />
        <h3 className="text-[17px] font-semibold text-[#1C1C1E] mb-2">
          Analysis Failed
        </h3>
        <p className="text-[13px] text-[#6C6C70] max-w-xs mx-auto">
          {error.message}
        </p>
      </div>
    );
  }

  if (!dedupResult || dedupResult.duplicateCount === 0) {
    return (
      <div className="p-8 text-center">
        <HardDrive className="w-12 h-12 text-[#34C759] mx-auto mb-4" strokeWidth={1.5} />
        <h3 className="text-[17px] font-semibold text-[#1C1C1E] mb-2">
          No Duplicates Found
        </h3>
        <p className="text-[13px] text-[#6C6C70] max-w-xs mx-auto">
          Great! Your attachments are efficiently stored with no duplicates detected.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Summary Card */}
      <Card padding="medium" className="mb-4 bg-gradient-to-br from-[#007AFF]/5 to-transparent">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-[24px] font-bold text-[#007AFF]">
              {dedupResult.duplicateCount}
            </div>
            <div className="text-[11px] text-[#6C6C70] uppercase tracking-wide font-medium">
              Duplicate Blobs
            </div>
          </div>
          <div className="text-center">
            <div className="text-[24px] font-bold text-[#34C759]">
              {formatBytes(dedupResult.totalPotentialSavings)}
            </div>
            <div className="text-[11px] text-[#6C6C70] uppercase tracking-wide font-medium">
              Potential Savings
            </div>
          </div>
        </div>
      </Card>

      {/* Duplicate List */}
      <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-2xl border border-[#E5E5EA] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5EA] dark:border-[#38383A]">
          <h4 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">
            {dedupResult.duplicateCount} Duplicate Attachments
          </h4>
        </div>
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
          {dedupResult.duplicates.map((group) => (
            <DuplicateItem
              key={group.blobId}
              group={group}
              onClick={() => onSelectGroup(group)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DuplicateItemProps {
  group: DuplicateAttachmentGroup;
  onClick: () => void;
}

function DuplicateItem({ group, onClick }: DuplicateItemProps) {
  const attachment = group.attachment;
  const isImage = attachment.type?.startsWith('image/');
  const statusColor = getDeduplicationStatusColor(group.referenceCount);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white dark:bg-[#1C1C1E] rounded-xl border border-[#E5E5E5] hover:border-[#007AFF]/30 hover:shadow-sm transition-all text-left group"
    >
      <div className="w-10 h-10 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] flex items-center justify-center shrink-0">
        <FileIcon className="w-5 h-5 text-[#007AFF]" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-[13px] text-[#1C1C1E] truncate">
          {attachment.name || 'Unnamed Attachment'}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#6C6C70]">
          <span>{formatBytes(group.size)}</span>
          <span>·</span>
          <span style={{ color: statusColor }}>
            {getDeduplicationStatusText(group.referenceCount)}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-[11px] font-medium text-[#34C759]">
          Save {formatBytes(group.potentialSavings)}
        </div>
        <ChevronRight className="w-4 h-4 text-[#C7C7CC] group-hover:text-[#007AFF] transition-colors ml-auto" strokeWidth={2} />
      </div>
    </button>
  );
}

interface DuplicateDetailViewProps {
  group: DuplicateAttachmentGroup;
  onBack: () => void;
}

function DuplicateDetailView({ group, onBack }: DuplicateDetailViewProps) {
  const { data: referencingEmails, isLoading } = useAttachmentReferences(group.blobId);
  const attachment = group.attachment;

  return (
    <div className="p-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[13px] text-[#007AFF] hover:opacity-80 transition-opacity mb-4"
      >
        <ChevronRight className="w-4 h-4 rotate-180" strokeWidth={2} />
        Back to List
      </button>

      {/* Attachment Info */}
      <Card padding="medium" className="mb-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] flex items-center justify-center shrink-0">
            <FileIcon className="w-6 h-6 text-[#007AFF]" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[15px] text-[#1C1C1E] truncate">
              {attachment.name || 'Unnamed Attachment'}
            </h4>
            <div className="text-[13px] text-[#6C6C70] space-y-0.5">
              <p>Type: {attachment.type || 'Unknown'}</p>
              <p>Size: {formatBytes(group.size)}</p>
              <p>Blob ID: <code className="text-[11px] bg-[#F2F2F7] dark:bg-[#2C2C2E] px-1.5 py-0.5 rounded">{group.blobId.slice(0, 16)}...</code></p>
            </div>
          </div>
        </div>
      </Card>

      {/* Deduplication Stats */}
      <Card padding="medium" className="mb-4 bg-gradient-to-br from-[#34C759]/5 to-transparent">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[20px] font-bold text-[#1C1C1E]">{group.referenceCount}</div>
            <div className="text-[10px] text-[#6C6C70] uppercase">References</div>
          </div>
          <div>
            <div className="text-[20px] font-bold text-[#FF9500]">{group.referenceCount - 1}</div>
            <div className="text-[10px] text-[#6C6C70] uppercase">Redundant</div>
          </div>
          <div>
            <div className="text-[20px] font-bold text-[#34C759]">{formatBytes(group.potentialSavings)}</div>
            <div className="text-[10px] text-[#6C6C70] uppercase">Savings</div>
          </div>
        </div>
      </Card>

      {/* Referencing Emails */}
      <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-2xl border border-[#E5E5EA] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5EA] dark:border-[#38383A]">
          <h4 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">
            Referenced in {group.referenceCount} Emails
          </h4>
        </div>
        <div className="p-3">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : referencingEmails && referencingEmails.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {referencingEmails.map((email) => (
                <EmailListItem key={email.id} email={email} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#6C6C70] text-center py-4">
              No emails found referencing this attachment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmailListItemProps {
  email: Email;
}

function EmailListItem({ email }: EmailListItemProps) {
  const from = email.from?.[0];
  const fromText = from ? (from.name || from.email) : 'Unknown Sender';
  const date = new Date(email.receivedAt).toLocaleDateString();

  return (
    <div className="flex items-start gap-3 p-3 bg-[#F2F2F7] dark:bg-[#2C2C2E]/50 rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1C1C1E] flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-[#007AFF]" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[13px] text-[#1C1C1E] truncate">
          {email.subject || '(No Subject)'}
        </div>
        <div className="text-[11px] text-[#6C6C70] truncate">
          {fromText}
        </div>
        <div className="text-[10px] text-[#8E8E93] mt-0.5">
          {date}
        </div>
      </div>
    </div>
  );
}
