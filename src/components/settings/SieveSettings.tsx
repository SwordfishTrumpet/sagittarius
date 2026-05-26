import React, { useState } from 'react';
import { Plus, Filter, ToggleLeft, ToggleRight, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSieve, useSieveActions } from '../../hooks/useSieve';
import { SieveRuleEditor } from './SieveRuleEditor';
import type { SieveRule } from '../../types/sieve';
import { generateSieveScript } from '../../utils/sieveGenerator';
import { jmapClient } from '../../api/jmap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a SieveRule[] into a Blob with content-type message/sieve,
 * uploads it, and returns the blobId.
 */
async function uploadSieveBlob(rules: SieveRule[]): Promise<string> {
  const script = generateSieveScript(rules);
  const blob = new Blob([script], { type: 'application/sieve' });
  const file = new File([blob], 'rules.sieve', { type: 'application/sieve' });
  const result = await jmapClient.uploadBlob(file);
  const blobId: string = result.blobId ?? result.id;
  if (!blobId) throw new Error('Upload returned no blobId');
  return blobId;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SieveSettings() {
  const { data: scripts, isLoading, error } = useSieve();
  const { createScript, deleteScript, activateScript, validateScript } =
    useSieveActions();

  // Editing state: null = no editor open, 'new' = creating, scriptId = editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Not supported
  if (scripts === null) {
    return (
      <div className="p-6">
        <h2 className="text-[17px] font-semibold text-icloud-text-primary mb-4">Filters</h2>
        <div className="bg-icloud-bg-layer1 bg-icloud-bg-primary/50 rounded-2xl px-5 py-8 text-center">
          <Filter size={32} strokeWidth={1.5} className="mx-auto mb-3 text-icloud-text-tertiary" />
          <p className="text-[15px] text-icloud-text-secondary ">Sieve filters are not supported</p>
          <p className="text-[13px] text-icloud-text-tertiary mt-1">
            Your server does not advertise the JMAP Sieve capability.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-icloud-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-icloud-red/5 border border-[icloud-red]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-icloud-red shrink-0" strokeWidth={1.5} />
          <p className="text-[13px] text-icloud-red">Failed to load filters</p>
        </div>
      </div>
    );
  }

  // Handle saving a new or edited rule.
  // Each script = one rule in this simplified UI model.
  const handleSave = async (rule: SieveRule) => {
    setIsSaving(true);
    try {
      // Build a single-rule script blob
      const blobId = await uploadSieveBlob([rule]);

      // Validate first
      await validateScript.mutateAsync(blobId);

      if (editingId === 'new') {
        // Create a new script
        await createScript.mutateAsync({
          name: rule.name,
          blobId,
          isActive: false,
        });
        toast.success(`Rule "${rule.name}" created`);
      } else if (editingId) {
        // Update existing (we re-create for simplicity — some servers support update)
        await createScript.mutateAsync({
          name: rule.name,
          blobId,
          isActive: false,
        });
        toast.success(`Rule "${rule.name}" updated`);
      }

      setEditingId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save rule: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteScript.mutateAsync(id);
      toast.success(`Rule "${name}" deleted`);
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleToggleActive = async (
    id: string,
    name: string,
    isActive: boolean,
  ) => {
    try {
      await activateScript.mutateAsync(id);
      toast.success(`Rule "${name}" ${isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update rule');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[17px] font-semibold text-icloud-text-primary">Filters</h2>
        {editingId === null && (
          <button
            onClick={() => setEditingId('new')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-icloud-accent text-white text-[13px] font-semibold rounded-xl hover:bg-icloud-accent-hover transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Create Rule
          </button>
        )}
      </div>

      {/* Rule editor (inline) */}
      {editingId !== null && (
        <div className="mb-6">
          <SieveRuleEditor
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Script list */}
      {!scripts || scripts.length === 0 ? (
        <div className="bg-icloud-bg-layer1 rounded-2xl px-5 py-10 text-center">
          <Filter size={32} strokeWidth={1.5} className="mx-auto mb-3 text-icloud-text-tertiary" />
          <p className="text-[15px] text-icloud-text-secondary font-medium">No filter rules yet</p>
          <p className="text-[13px] text-icloud-text-tertiary mt-1">
            Create a rule to automatically sort, flag, or redirect messages.
          </p>
        </div>
      ) : (
        <div className="bg-icloud-bg-layer2 rounded-2xl border border-icloud-border divide-y divide-icloud-border overflow-hidden">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-icloud-bg-layer1/50 dark:hover:bg-white/5 dark:hover:bg-white/5 transition-colors group"
            >
              {/* Name + status */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    script.isActive ? 'bg-icloud-green' : 'bg-icloud-gray3'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-icloud-text-primary truncate">
                    {script.name}
                  </p>
                  <p className="text-[12px] text-icloud-text-secondary">
                    {script.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Toggle active */}
                <button
                  onClick={() =>
                    handleToggleActive(script.id, script.name, script.isActive)
                  }
                  className="p-2 rounded-lg hover:bg-icloud-accent/10 transition-colors"
                  title={script.isActive ? 'Deactivate' : 'Activate'}
                  aria-label={script.isActive ? `Deactivate rule ${script.name}` : `Activate rule ${script.name}`}
                >
                  {script.isActive ? (
                    <ToggleRight
                      className="w-4 h-4 text-icloud-accent"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <ToggleLeft
                      className="w-4 h-4 text-icloud-text-secondary"
                      strokeWidth={1.5}
                    />
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(script.id, script.name)}
                  className="p-2 rounded-lg hover:bg-icloud-red/10 text-icloud-red transition-colors"
                  title="Delete rule"
                  aria-label={`Delete rule ${script.name}`}
                >
                  {deleteScript.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
