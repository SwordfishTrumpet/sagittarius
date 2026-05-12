import React, { useState, useId } from 'react';
import { Plus, Minus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import type { SieveRule, SieveCondition, SieveAction } from '../../types/sieve';
import { generateSieveScript } from '../../utils/sieveGenerator';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const FIELD_OPTIONS: { value: SieveCondition['field']; label: string }[] = [
  { value: 'from', label: 'From' },
  { value: 'to', label: 'To' },
  { value: 'subject', label: 'Subject' },
  { value: 'header', label: 'Header' },
  { value: 'size', label: 'Size (bytes)' },
];

const OPERATOR_OPTIONS: { value: SieveCondition['operator']; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'is', label: 'is exactly' },
  { value: 'matches', label: 'matches (wildcard)' },
  { value: 'not-contains', label: 'does not contain' },
  { value: 'greater-than', label: 'greater than' },
  { value: 'less-than', label: 'less than' },
];

const ACTION_TYPE_OPTIONS: { value: SieveAction['type']; label: string }[] = [
  { value: 'fileinto', label: 'Move to folder' },
  { value: 'redirect', label: 'Redirect to address' },
  { value: 'flag', label: 'Mark as flagged' },
  { value: 'discard', label: 'Discard (delete silently)' },
  { value: 'keep', label: 'Keep in inbox' },
  { value: 'vacation', label: 'Send vacation reply' },
];

function actionNeedsValue(type: SieveAction['type']): boolean {
  return type === 'fileinto' || type === 'redirect' || type === 'vacation';
}

function actionValuePlaceholder(type: SieveAction['type']): string {
  switch (type) {
    case 'fileinto': return 'Folder name (e.g. INBOX/Work)';
    case 'redirect': return 'Email address';
    case 'vacation': return 'Out-of-office reply text';
    default: return '';
  }
}

function makeCondition(): SieveCondition {
  return { field: 'from', operator: 'contains', value: '' };
}

function makeAction(): SieveAction {
  return { type: 'fileinto', value: '' };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SieveRuleEditorProps {
  rule?: SieveRule;
  onSave: (rule: SieveRule) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SieveRuleEditor({
  rule,
  onSave,
  onCancel,
  isSaving = false,
}: SieveRuleEditorProps) {
  const baseId = useId();

  const [name, setName] = useState(rule?.name ?? 'New Rule');
  const [conditionOperator, setConditionOperator] = useState<'allOf' | 'anyOf'>(
    rule?.conditionOperator ?? 'allOf',
  );
  const [conditions, setConditions] = useState<SieveCondition[]>(
    rule?.conditions.length ? rule.conditions : [makeCondition()],
  );
  const [actions, setActions] = useState<SieveAction[]>(
    rule?.actions.length ? rule.actions : [makeAction()],
  );
  const [showPreview, setShowPreview] = useState(false);
  const [nameError, setNameError] = useState('');

  // --- preview script ---
  const previewScript = generateSieveScript([
    {
      id: rule?.id ?? '__preview__',
      name,
      enabled: true,
      conditionOperator,
      conditions,
      actions,
    },
  ]);

  // --- condition helpers ---
  const addCondition = () => setConditions((c) => [...c, makeCondition()]);
  const removeCondition = (i: number) =>
    setConditions((c) => c.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, patch: Partial<SieveCondition>) =>
    setConditions((c) => c.map((cond, idx) => (idx === i ? { ...cond, ...patch } : cond)));

  // --- action helpers ---
  const addAction = () => setActions((a) => [...a, makeAction()]);
  const removeAction = (i: number) =>
    setActions((a) => a.filter((_, idx) => idx !== i));
  const updateAction = (i: number, patch: Partial<SieveAction>) =>
    setActions((a) => a.map((act, idx) => (idx === i ? { ...act, ...patch } : act)));

  // --- save ---
  const handleSave = () => {
    if (!name.trim()) {
      setNameError('Rule name is required');
      return;
    }
    setNameError('');
    onSave({
      id: rule?.id ?? `rule-${Date.now()}`,
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      conditionOperator,
      conditions,
      actions,
    });
  };

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#38383A] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E5E5EA] dark:border-[#38383A] bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]">
        <h3 className="text-[15px] font-semibold text-[#1C1C1E] dark:text-white">
          {rule ? 'Edit Rule' : 'New Rule'}
        </h3>
      </div>

      <div className="p-5 space-y-6">
        {/* Rule name */}
        <div className="space-y-1.5">
          <label
            htmlFor={`${baseId}-name`}
            className="block text-[12px] font-semibold text-[#8E8E93] dark:text-[#A1A1A6] uppercase tracking-wide"
          >
            Rule Name
          </label>
          <input
            id={`${baseId}-name`}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError('');
            }}
            placeholder="My rule"
            className={`w-full px-3 py-2 rounded-xl border text-[14px] bg-white dark:bg-[#2C2C2E] placeholder-[#C7C7CC] dark:placeholder-[#636366] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 transition ${
              nameError ? 'border-[#FF3B30]' : 'border-[#E5E5EA]'
            }`}
          />
          {nameError && (
            <p className="text-[12px] text-[#FF3B30]">{nameError}</p>
          )}
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#8E8E93] dark:text-[#A1A1A6] uppercase tracking-wide">
              Conditions
            </span>
            {/* allOf / anyOf toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#E5E5EA] dark:border-[#38383A] text-[12px] font-medium">
              <button
                type="button"
                onClick={() => setConditionOperator('allOf')}
                className={`px-3 py-1 transition-colors ${
                  conditionOperator === 'allOf'
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-white dark:bg-[#2C2C2E] text-[#8E8E93] dark:text-[#A1A1A6] dark:text-[#A1A1A6] hover:bg-[#F2F2F7] dark:hover:bg-white/10 dark:hover:bg-white/10'
                }`}
              >
                All of
              </button>
              <button
                type="button"
                onClick={() => setConditionOperator('anyOf')}
                className={`px-3 py-1 transition-colors ${
                  conditionOperator === 'anyOf'
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-white dark:bg-[#2C2C2E] text-[#8E8E93] dark:text-[#A1A1A6] dark:text-[#A1A1A6] hover:bg-[#F2F2F7] dark:hover:bg-white/10 dark:hover:bg-white/10'
                }`}
              >
                Any of
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Field */}
                <select
                  value={cond.field}
                  onChange={(e) =>
                    updateCondition(i, { field: e.target.value as SieveCondition['field'] })
                  }
                  className="flex-shrink-0 w-36 px-2 py-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[13px] bg-white dark:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                >
                  {FIELD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  value={cond.operator}
                  onChange={(e) =>
                    updateCondition(i, {
                      operator: e.target.value as SieveCondition['operator'],
                    })
                  }
                  className="flex-shrink-0 w-40 px-2 py-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[13px] bg-white dark:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                >
                  {OPERATOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {/* Value */}
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                  placeholder={cond.field === 'size' ? 'bytes, e.g. 1048576' : 'value…'}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[13px] bg-white dark:bg-[#2C2C2E] placeholder-[#C7C7CC] dark:placeholder-[#636366] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeCondition(i)}
                  disabled={conditions.length === 1}
                  className="shrink-0 p-1.5 rounded-lg text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remove condition"
                >
                  <Minus className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add Condition
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <span className="block text-[12px] font-semibold text-[#8E8E93] dark:text-[#A1A1A6] uppercase tracking-wide">
            Actions
          </span>

          <div className="space-y-2">
            {actions.map((action, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Action type */}
                <select
                  value={action.type}
                  onChange={(e) => {
                    const newType = e.target.value as SieveAction['type'];
                    updateAction(i, {
                      type: newType,
                      value: actionNeedsValue(newType) ? (action.value ?? '') : undefined,
                    });
                  }}
                  className="flex-shrink-0 w-52 px-2 py-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[13px] bg-white dark:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                >
                  {ACTION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {/* Optional value */}
                {actionNeedsValue(action.type) ? (
                  <input
                    type="text"
                    value={action.value ?? ''}
                    onChange={(e) => updateAction(i, { value: e.target.value })}
                    placeholder={actionValuePlaceholder(action.type)}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#38383A] text-[13px] bg-white dark:bg-[#2C2C2E] placeholder-[#C7C7CC] dark:placeholder-[#636366] dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                  />
                ) : (
                  <span className="flex-1" />
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeAction(i)}
                  disabled={actions.length === 1}
                  className="shrink-0 p-1.5 rounded-lg text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remove action"
                >
                  <Minus className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addAction}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add Action
          </button>
        </div>

        {/* Collapsible Sieve preview */}
        <div className="rounded-xl border border-[#E5E5EA] dark:border-[#38383A] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#F2F2F7] text-[13px] font-medium text-[#1C1C1E] dark:text-white hover:bg-[#E5E5EA] transition-colors"
          >
            <span>Sieve Preview</span>
            {showPreview ? (
              <ChevronUp className="w-4 h-4 text-[#8E8E93] dark:text-[#A1A1A6]" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8E8E93] dark:text-[#A1A1A6]" strokeWidth={1.5} />
            )}
          </button>
          {showPreview && (
            <pre className="px-4 py-3 text-[12px] font-mono text-[#1C1C1E] dark:text-white bg-white dark:bg-[#2C2C2E] overflow-x-auto whitespace-pre leading-relaxed">
              {previewScript}
            </pre>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-5 py-4 border-t border-[#E5E5EA] dark:border-[#38383A] bg-[#F2F2F7]/40 dark:bg-[#2C2C2E] flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-[13px] font-medium text-[#8E8E93] dark:text-[#A1A1A6] bg-white border border-[#E5E5EA] dark:border-[#38383A] rounded-xl hover:bg-[#F2F2F7] dark:hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-[#007AFF] hover:bg-[#0051D5] rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2 shadow-sm"
        >
          {isSaving && (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
          )}
          {isSaving ? 'Saving…' : 'Save Rule'}
        </button>
      </div>
    </div>
  );
}
