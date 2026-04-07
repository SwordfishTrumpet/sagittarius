/**
 * BlobMigrationDialog - UI for cross-account blob migration
 * 
 * This dialog allows users to migrate blobs (attachments) between JMAP accounts.
 * Useful for consolidating emails when managing multiple accounts.
 * 
 * Features:
 * - Select source and target accounts
 * - View blob list with metadata
 * - Track migration progress
 * - Handle partial failures with retry
 * - iCloud Mail-style UI with glassmorphic design
 */

import { useState, useRef, useCallback } from 'react';
import { 
  X, 
  ArrowRightLeft, 
  HardDrive, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BaseDialog } from './BaseDialog';
import { Card, FormSection, FormField } from '../ui/Card';
import { 
  useBlobMigration, 
  useMigrationEstimate,
  type BlobMigrationItem,
  type BlobMigrationResult,
  isMigrationSuccessful,
  hasMigrationFailures,
} from '../../hooks/useBlobMigration';
import { useBlobCapability } from '../../hooks/useBlobs';
import { useAccounts, type AccountInfo } from '../../hooks/useAccountManager';

interface BlobMigrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialBlobs?: BlobMigrationItem[];
  sourceAccountId?: string;
}

/**
 * Dialog for migrating blobs between accounts
 */
export function BlobMigrationDialog({
  isOpen,
  onClose,
  initialBlobs = [],
  sourceAccountId,
}: BlobMigrationDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<string>(sourceAccountId || '');
  const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
  const [expandedResults, setExpandedResults] = useState(false);

  const { data: capability } = useBlobCapability();
  const accounts = useAccounts();
  const { 
    mutateAsync: migrateBlobs, 
    isPending: isMigrating, 
    migrationState,
    resetState,
  } = useBlobMigration();
  const { estimateTime, formatDuration } = useMigrationEstimate();

  const hasBlobCapability = !!capability;
  const hasMultipleAccounts = accounts.length > 1;

  // Calculate total size from blobs
  const totalSize = initialBlobs.reduce((sum, b) => sum + (b.size || 0), 0);
  const estimatedDuration = estimateTime(totalSize, initialBlobs.length);

  // Reset state when dialog opens/closes
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleMigrate = async () => {
    if (!selectedSourceAccount || !selectedTargetAccount || initialBlobs.length === 0) {
      return;
    }

    try {
      await migrateBlobs({
        sourceAccountId: selectedSourceAccount,
        targetAccountId: selectedTargetAccount,
        blobs: initialBlobs,
      });
    } catch {
      // Error is handled by the mutation
    }
  };

  const canMigrate = 
    selectedSourceAccount && 
    selectedTargetAccount && 
    selectedSourceAccount !== selectedTargetAccount &&
    initialBlobs.length > 0 &&
    !isMigrating;

  const isComplete = isMigrationSuccessful(migrationState) || hasMigrationFailures(migrationState);

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Migrate Attachments"
      titleId="migration-dialog-title"
      initialFocusRef={closeButtonRef}
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {!hasBlobCapability ? (
          <CapabilityWarning />
        ) : !hasMultipleAccounts ? (
          <SingleAccountWarning />
        ) : (
          <div className="p-4 space-y-4">
            {/* Account Selection */}
            {!isComplete && (
              <FormSection>
                <FormField label="From Account">
                  <select
                    value={selectedSourceAccount}
                    onChange={(e) => setSelectedSourceAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F2F2F7] rounded-lg text-[15px] text-[#1C1C1E] border border-[#E5E5EA] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    disabled={isMigrating || !!sourceAccountId}
                  >
                    <option value="">Select source account...</option>
                    {accounts?.map((account: AccountInfo) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="To Account">
                  <select
                    value={selectedTargetAccount}
                    onChange={(e) => setSelectedTargetAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F2F2F7] rounded-lg text-[15px] text-[#1C1C1E] border border-[#E5E5EA] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    disabled={isMigrating}
                  >
                    <option value="">Select target account...</option>
                    {accounts?.filter((a: AccountInfo) => a.id !== selectedSourceAccount).map((account: AccountInfo) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </FormSection>
            )}

            {/* Migration Summary */}
            {initialBlobs.length > 0 && (
              <Card padding="medium" className="bg-gradient-to-br from-[#007AFF]/5 to-transparent">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
                    <ArrowRightLeft className="w-5 h-5 text-[#007AFF]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[15px] text-[#1C1C1E]">
                      {initialBlobs.length} Attachment{initialBlobs.length === 1 ? '' : 's'}
                    </h4>
                    <p className="text-[13px] text-[#6C6C70]">
                      Total: {formatBytes(totalSize)} · Est. {formatDuration(estimatedDuration)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Progress */}
            {isMigrating && (
              <MigrationProgress 
                progress={migrationState.progress}
                completed={migrationState.completedBlobs}
                total={migrationState.totalBlobs}
                failed={migrationState.failedBlobs}
              />
            )}

            {/* Results */}
            {isComplete && (
              <MigrationResults
                results={migrationState.results}
                expanded={expandedResults}
                onToggleExpand={() => setExpandedResults(!expandedResults)}
              />
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {!isComplete ? (
                <>
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 bg-[#F2F2F7] hover:bg-[#E5E5EA] rounded-xl text-[15px] font-medium text-[#1C1C1E] transition-colors"
                    disabled={isMigrating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMigrate}
                    disabled={!canMigrate}
                    className="flex-1 px-4 py-3 bg-[#007AFF] hover:bg-[#0051D5] disabled:bg-[#C7C7CC] disabled:cursor-not-allowed rounded-xl text-[15px] font-medium text-white transition-colors"
                  >
                    {isMigrating ? 'Migrating...' : 'Migrate'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleClose}
                  className="w-full px-4 py-3 bg-[#007AFF] hover:bg-[#0051D5] rounded-xl text-[15px] font-medium text-white transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseDialog>
  );
}

// ============ Sub-components ============

function CapabilityWarning() {
  return (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 text-[#FF9500] mx-auto mb-4" strokeWidth={1.5} />
      <h3 className="text-[17px] font-semibold text-[#1C1C1E] mb-2">
        Blob Management Not Available
      </h3>
      <p className="text-[13px] text-[#6C6C70] max-w-xs mx-auto">
        Your JMAP server does not support RFC 9404 Blob Management, which is required for cross-account blob migration.
      </p>
    </div>
  );
}

function SingleAccountWarning() {
  return (
    <div className="p-8 text-center">
      <HardDrive className="w-12 h-12 text-[#8E8E93] mx-auto mb-4" strokeWidth={1.5} />
      <h3 className="text-[17px] font-semibold text-[#1C1C1E] mb-2">
        Multiple Accounts Required
      </h3>
      <p className="text-[13px] text-[#6C6C70] max-w-xs mx-auto">
        Blob migration requires at least two accounts. Add another account to use this feature.
      </p>
    </div>
  );
}

interface MigrationProgressProps {
  progress: number;
  completed: number;
  total: number;
  failed: number;
}

function MigrationProgress({ progress, completed, total, failed }: MigrationProgressProps) {
  return (
    <Card padding="medium">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[#1C1C1E]">Migration Progress</span>
          <span className="text-[13px] text-[#6C6C70]">{progress}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[12px]">
          <span className="text-[#34C759]">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" strokeWidth={2} />
            {completed} done
          </span>
          {failed > 0 && (
            <span className="text-[#FF3B30]">
              <XCircle className="w-3.5 h-3.5 inline mr-1" strokeWidth={2} />
              {failed} failed
            </span>
          )}
          <span className="text-[#8E8E93]">
            of {total} total
          </span>
        </div>
      </div>
    </Card>
  );
}

interface MigrationResultsProps {
  results: BlobMigrationResult[];
  expanded: boolean;
  onToggleExpand: () => void;
}

function MigrationResults({ results, expanded, onToggleExpand }: MigrationResultsProps) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return (
    <Card padding="medium" className={failed.length > 0 ? 'bg-[#FF3B30]/5' : 'bg-[#34C759]/5'}>
      <div className="space-y-3">
        {/* Summary */}
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            failed.length > 0 ? 'bg-[#FF3B30]/10' : 'bg-[#34C759]/10'
          }`}>
            {failed.length > 0 ? (
              <AlertCircle className="w-4 h-4 text-[#FF3B30]" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#34C759]" strokeWidth={2} />
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-[15px] text-[#1C1C1E]">
              {failed.length > 0 ? 'Migration Partially Complete' : 'Migration Complete'}
            </h4>
            <p className="text-[13px] text-[#6C6C70]">
              {successful.length} succeeded{failed.length > 0 ? `, ${failed.length} failed` : ''}
            </p>
          </div>
        </div>

        {/* Expandable Details */}
        {results.length > 0 && (
          <div className="border-t border-[#E5E5EA] pt-3">
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-[13px] text-[#007AFF] hover:opacity-80 transition-opacity"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4" strokeWidth={2} />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" strokeWidth={2} />
                  View Details
                </>
              )}
            </button>

            {expanded && (
              <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto">
                {results.map((result) => (
                  <ResultItem key={result.sourceBlobId} result={result} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ResultItem({ result }: { result: BlobMigrationResult }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${
      result.success ? 'bg-[#34C759]/10' : 'bg-[#FF3B30]/10'
    }`}>
      {result.success ? (
        <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" strokeWidth={2} />
      ) : (
        <XCircle className="w-4 h-4 text-[#FF3B30] shrink-0" strokeWidth={2} />
      )}
      <div className="flex-1 min-w-0">
        <code className="text-[11px] text-[#1C1C1E] truncate block">
          {result.sourceBlobId.slice(0, 20)}...
        </code>
        {result.error && (
          <span className="text-[10px] text-[#FF3B30]">{result.error}</span>
        )}
      </div>
    </div>
  );
}

// ============ Utilities ============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
