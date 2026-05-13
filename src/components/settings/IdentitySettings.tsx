import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useIdentities } from '../../hooks/jmap/useIdentities';
import { useIdentityActions, type IdentityData } from '../../hooks/useIdentityActions';
import { toastOperationError } from '../../utils/toastHelpers';

interface IdentityFormState {
  name: string;
  email: string;
  replyTo: string;
  textSignature: string;
}

const EMPTY_FORM: IdentityFormState = {
  name: '',
  email: '',
  replyTo: '',
  textSignature: '',
};

function formToPayload(form: IdentityFormState): IdentityData {
  const payload: IdentityData = {
    name: form.name,
    email: form.email,
    textSignature: form.textSignature || undefined,
  };
  if (form.replyTo) {
    payload.replyTo = [{ email: form.replyTo }];
  }
  return payload;
}

interface IdentityFormProps {
  initial?: IdentityFormState;
  onSave: (data: IdentityFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function IdentityForm({ initial = EMPTY_FORM, onSave, onCancel, isSaving }: IdentityFormProps) {
  const [form, setForm] = useState<IdentityFormState>(initial);
  const set = (key: keyof IdentityFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="bg-icloud-bg-layer1 bg-icloud-bg-primary/50 rounded-2xl border border-icloud-border overflow-hidden">
      {/* Display Name */}
      <div className="bg-icloud-bg-layer2 bg-icloud-bg-primary border-b border-icloud-border">
        <label className="block px-4 pt-3 text-[11px] font-semibold text-icloud-text-secondary  uppercase tracking-wide">
          Display Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={set('name')}
          placeholder="Your Name"
          className="w-full px-4 pb-3 pt-1 text-[15px] text-icloud-text-primary placeholder:text-[#C7C7CC] dark:placeholder:text-[#636366] bg-transparent focus:outline-none"
        />
      </div>

      {/* Email */}
      <div className="bg-icloud-bg-layer2 bg-icloud-bg-primary border-b border-icloud-border">
        <label className="block px-4 pt-3 text-[11px] font-semibold text-icloud-text-secondary uppercase tracking-wide">
          Email Address
        </label>
        <input
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="you@example.com"
          className="w-full px-4 pb-3 pt-1 text-[15px] text-icloud-text-primary placeholder:text-[#C7C7CC] dark:placeholder:text-[#636366] bg-transparent focus:outline-none"
        />
      </div>

      {/* Reply-To */}
      <div className="bg-icloud-bg-layer2 bg-icloud-bg-primary border-b border-icloud-border">
        <label className="block px-4 pt-3 text-[11px] font-semibold text-icloud-text-secondary uppercase tracking-wide">
          Reply-To (optional)
        </label>
        <input
          type="email"
          value={form.replyTo}
          onChange={set('replyTo')}
          placeholder="replies@example.com"
          className="w-full px-4 pb-3 pt-1 text-[15px] text-icloud-text-primary placeholder:text-[#C7C7CC] dark:placeholder:text-[#636366] bg-transparent focus:outline-none"
        />
      </div>

      {/* Signature */}
      <div className="bg-icloud-bg-layer2">
        <label className="block px-4 pt-3 text-[11px] font-semibold text-icloud-text-secondary uppercase tracking-wide">
          Signature
        </label>
        <textarea
          value={form.textSignature}
          onChange={set('textSignature')}
          rows={4}
          placeholder="-- &#10;Your signature"
          className="w-full px-4 pb-3 pt-1 text-[15px] text-icloud-text-primary placeholder:text-[#C7C7CC] dark:placeholder:text-[#636366] bg-transparent focus:outline-none resize-none font-mono text-[13px]"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-icloud-bg-layer1">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-icloud-bg-layer2 border border-icloud-border text-[14px] text-icloud-text-primary hover:bg-icloud-bg-layer1 transition-colors"
        >
          <X size={13} strokeWidth={1.5} />
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={isSaving || !form.name || !form.email}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-icloud-accent hover:bg-icloud-accent-hover disabled:opacity-50 text-white text-[14px] font-medium transition-colors"
        >
          <Check size={13} strokeWidth={2} />
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function IdentitySettings() {
  const { data: identities = [], isLoading } = useIdentities();
  const { createIdentity, updateIdentity, deleteIdentity } = useIdentityActions();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (form: IdentityFormState) => {
    try {
      await createIdentity.mutateAsync({ ...formToPayload(form) });
      toast.success('Identity created');
      setShowAddForm(false);
    } catch {
      toastOperationError('identity.create');
    }
  };

  const handleUpdate = async (identityId: string, form: IdentityFormState) => {
    try {
      await updateIdentity.mutateAsync({ identityId, updates: formToPayload(form) });
      toast.success('Identity updated');
      setEditingId(null);
    } catch {
      toastOperationError('identity.update');
    }
  };

  const handleDelete = async (identityId: string, name: string) => {
    try {
      await deleteIdentity.mutateAsync({ identityId });
      toast.success(`Removed "${name}"`);
    } catch {
      toastOperationError('identity.delete');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-icloud-text-primary">Identities</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-icloud-accent hover:bg-icloud-accent-hover text-white text-[13px] font-medium transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            Add Identity
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <IdentityForm
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
          isSaving={createIdentity.isPending}
        />
      )}

      {/* Identity list */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-icloud-border rounded-2xl" />
          ))}
        </div>
      ) : identities.length === 0 && !showAddForm ? (
        <div className="bg-icloud-bg-layer1 rounded-2xl px-5 py-8 text-center">
          <p className="text-[15px] text-icloud-text-secondary">No identities configured</p>
          <p className="text-[13px] text-[#C7C7CC] mt-1">Click "Add Identity" to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {identities.map((identity) => (
            <div key={identity.id}>
              {editingId === identity.id ? (
                <IdentityForm
                  initial={{
                    name: identity.name ?? '',
                    email: identity.email ?? '',
                    replyTo: identity.replyTo?.[0]?.email ?? '',
                    textSignature: identity.textSignature ?? '',
                  }}
                  onSave={(form) => handleUpdate(identity.id, form)}
                  onCancel={() => setEditingId(null)}
                  isSaving={updateIdentity.isPending}
                />
              ) : (
                <div className="bg-icloud-bg-layer2 rounded-2xl border border-icloud-border px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-icloud-text-primary truncate">{identity.name}</p>
                    <p className="text-[13px] text-icloud-text-secondary truncate">{identity.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingId(identity.id)}
                      className="w-8 h-8 rounded-lg hover:bg-icloud-bg-layer1 flex items-center justify-center transition-colors text-icloud-text-secondary hover:text-icloud-accent"
                      aria-label="Edit identity"
                    >
                      <Edit2 size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(identity.id, identity.name)}
                      disabled={deleteIdentity.isPending}
                      className="w-8 h-8 rounded-lg hover:bg-[#FFF1F0] flex items-center justify-center transition-colors text-icloud-text-secondary hover:text-icloud-red disabled:opacity-40"
                      aria-label="Delete identity"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
