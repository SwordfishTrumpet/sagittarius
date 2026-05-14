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
    <div className="bg-icloud-bg-layer2 rounded-2xl border border-icloud-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-icloud-border bg-icloud-bg-layer1/50 bg-icloud-card">
        <h3 className="text-[15px] font-semibold text-icloud-text-primary">
          {rule ? 'Edit Rule' : 'New Rule'}
        </h3>
      </div>

      <div className="p-5 space-y-6">
        {/* Rule name */}
        <div className="space-y-1.5">
          <label
            htmlFor={`${baseId}-name`}
            className="block text-[12px] font-semibold text-icloud-text-secondary  uppercase tracking-wide"
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
            className={`w-full px-3 py-2 rounded-xl border text-[14px] bg-icloud-card placeholder-[#C7C7CC]   focus:outline-none focus:ring-2 focus:ring-icloud-accent transition ${
              nameError ? 'border-[icloud-red]' : 'border-icloud-border'
            }`}
          />
          {nameError && (
            <p className="text-[12px] text-icloud-red">{nameError}</p>
          )}
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-icloud-text-secondary  uppercase tracking-wide">
              Conditions
            </span>
            {/* allOf / anyOf toggle */}
            <div className="flex rounded-lg overflow-hidden border border-icloud-border text-[12px] font-medium">
              <button
                type="button"
                onClick={() => setConditionOperator('allOf')}
                className={`px-3 py-1 transition-colors ${
                  conditionOperator === 'allOf'
                    ? 'bg-icloud-accent text-white'
                    : 'bg-icloud-card text-icloud-text-secondary   hover:bg-icloud-bg-layer1 dark:hover:bg-icloud-text-primary/10 dark:hover:bg-icloud-text-primary/10'
                }`}
              >
                All of
              </button>
              <button
                type="button"
                onClick={() => setConditionOperator('anyOf')}
                className={`px-3 py-1 transition-colors ${
                  conditionOperator === 'anyOf'
                    ? 'bg-icloud-accent text-white'
                    : 'bg-icloud-card text-icloud-text-secondary   hover:bg-icloud-bg-layer1 dark:hover:bg-icloud-text-primary/10 dark:hover:bg-icloud-text-primary/10'
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
                  className="flex-shrink-0 w-36 px-2 py-1.5 rounded-lg border border-icloud-border text-[13px] bg-icloud-card focus:outline-none focus:ring-2 focus:ring-icloud-accent"
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
                  className="flex-shrink-0 w-40 px-2 py-1.5 rounded-lg border border-icloud-border text-[13px] bg-icloud-card focus:outline-none focus:ring-2 focus:ring-icloud-accent"
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
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-icloud-border text-[13px] bg-icloud-card placeholder-[#C7C7CC]   focus:outline-none focus:ring-2 focus:ring-icloud-accent"
                />

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeCondition(i)}
                  disabled={conditions.length === 1}
                  className="shrink-0 p-1.5 rounded-lg text-icloud-red hover:bg-icloud-red/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
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
            className="flex items-center gap-1.5 text-[13px] font-medium text-icloud-accent hover:opacity-70 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add Condition
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <span className="block text-[12px] font-semibold text-icloud-text-secondary  uppercase tracking-wide">
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
                  className="flex-shrink-0 w-52 px-2 py-1.5 rounded-lg border border-icloud-border text-[13px] bg-icloud-card focus:outline-none focus:ring-2 focus:ring-icloud-accent"
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
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-icloud-border text-[13px] bg-icloud-card placeholder-[#C7C7CC]   focus:outline-none focus:ring-2 focus:ring-icloud-accent"
                  />
                ) : (
                  <span className="flex-1" />
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeAction(i)}
                  disabled={actions.length === 1}
                  className="shrink-0 p-1.5 rounded-lg text-icloud-red hover:bg-icloud-red/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
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
            className="flex items-center gap-1.5 text-[13px] font-medium text-icloud-accent hover:opacity-70 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add Action
          </button>
        </div>

        {/* Collapsible Sieve preview */}
        <div className="rounded-xl border border-icloud-border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-icloud-bg-layer1 text-[13px] font-medium text-icloud-text-primary hover:bg-icloud-border transition-colors"
          >
            <span>Sieve Preview</span>
            {showPreview ? (
              <ChevronUp className="w-4 h-4 text-icloud-text-secondary " strokeWidth={1.5} />
            ) : (
              <ChevronDown className="w-4 h-4 text-icloud-text-secondary " strokeWidth={1.5} />
            )}
          </button>
          {showPreview && (
            <pre className="px-4 py-3 text-[12px] font-mono text-icloud-text-primary bg-icloud-card overflow-x-auto whitespace-pre leading-relaxed">
              {previewScript}
            </pre>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-5 py-4 border-t border-icloud-border bg-icloud-bg-layer1/40 bg-icloud-card flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-[13px] font-medium text-icloud-text-secondary  bg-white border border-icloud-border rounded-xl hover:bg-icloud-bg-layer1 dark:hover:bg-icloud-text-primary/10 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-icloud-accent hover:bg-[#0051D5] rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2 shadow-sm"
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
