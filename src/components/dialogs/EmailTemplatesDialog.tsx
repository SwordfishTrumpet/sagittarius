import { useRef, useState } from 'react';
import { Plus, Search, Trash2, Copy, Edit2, FileText, X, ChevronLeft } from 'lucide-react';
import { BaseDialog } from './BaseDialog';
import { Card, FormSection, FormField } from '../ui/Card';
import { useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate, useDuplicateEmailTemplate } from '../../hooks/useEmailTemplates';
import { toastOperationError } from '../../utils/toastHelpers';
import type { EmailTemplate } from '../../types/jmap';

interface EmailTemplatesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: EmailTemplate) => void;
  selectionMode?: boolean;
}

type ViewMode = 'list' | 'create' | 'edit';

export function EmailTemplatesDialog({
  isOpen,
  onClose,
  onSelectTemplate,
  selectionMode = false,
}: EmailTemplatesDialogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formCc, setFormCc] = useState('');
  const [formBcc, setFormBcc] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: templates = [], isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();
  const duplicateTemplate = useDuplicateEmailTemplate();

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setFormTo('');
    setFormCc('');
    setFormBcc('');
    setEditingTemplate(null);
  };

  const handleClose = () => {
    resetForm();
    setViewMode('list');
    setSearchQuery('');
    onClose();
  };

  const handleCreateNew = () => {
    resetForm();
    setViewMode('create');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormSubject(template.subject);
    setFormBody(template.body);
    setFormTo(template.to || '');
    setFormCc(template.cc || '');
    setFormBcc(template.bcc || '');
    setViewMode('edit');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim()) return;

    try {
      if (viewMode === 'edit' && editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          name: formName.trim(),
          subject: formSubject.trim(),
          body: formBody,
          to: formTo || undefined,
          cc: formCc || undefined,
          bcc: formBcc || undefined,
        });
      } else {
        await createTemplate.mutateAsync({
          name: formName.trim(),
          subject: formSubject.trim(),
          body: formBody,
          to: formTo || undefined,
          cc: formCc || undefined,
          bcc: formBcc || undefined,
        });
      }
      setViewMode('list');
      resetForm();
    } catch {
      toastOperationError('email.save');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteTemplate.mutateAsync(id);
    } catch {
      toastOperationError('email.delete');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate.mutateAsync(id);
    } catch {
      toastOperationError('email.copy');
    }
  };

  const handleSelect = (template: EmailTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      handleClose();
    }
  };

  const isFormValid = formName.trim() && formSubject.trim();
  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  // List view
  if (viewMode === 'list') {
    return (
      <BaseDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={selectionMode ? 'Select Template' : 'Email Templates'}
        titleId="email-templates-dialog-title"
      >
        <div className="flex flex-col h-[500px]">
          {/* Search and New button */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E5EA]">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-2 bg-[#F2F2F7] rounded-lg text-[13px] text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />
            </div>
            {!selectionMode && (
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#007AFF] text-white rounded-lg text-[13px] font-medium hover:bg-[#0051D5] transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={1.5} />
                New
              </button>
            )}
          </div>

          {/* Template list */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-[#E5E5EA] rounded-xl" />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileText className="w-12 h-12 text-[#C7C7CC] mb-3" strokeWidth={1.5} />
                <p className="text-[15px] text-[#8E8E93]">
                  {searchQuery ? 'No templates match your search' : 'No templates yet'}
                </p>
                {!searchQuery && !selectionMode && (
                  <button
                    onClick={handleCreateNew}
                    className="mt-3 text-[13px] text-[#007AFF] hover:underline"
                  >
                    Create your first template
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => selectionMode && handleSelect(template)}
                    className={`group bg-white rounded-xl border border-[#E5E5EA] overflow-hidden transition-all hover:border-[#007AFF]/30 ${
                      selectionMode ? 'cursor-pointer hover:bg-[#F2F2F7]' : ''
                    }`}
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-medium text-[#1C1C1E] truncate">
                            {template.name}
                          </h3>
                          <p className="text-[13px] text-[#8E8E93] truncate">
                            {template.subject}
                          </p>
                          {template.to && (
                            <p className="text-[12px] text-[#C7C7CC] truncate mt-0.5">
                              To: {template.to}
                            </p>
                          )}
                        </div>
                        {!selectionMode && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(template);
                              }}
                              className="p-1.5 text-[#8E8E93] hover:bg-[#F2F2F7] rounded-lg transition-colors"
                              aria-label="Edit template"
                            >
                              <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicate(template.id);
                              }}
                              className="p-1.5 text-[#8E8E93] hover:bg-[#F2F2F7] rounded-lg transition-colors"
                              aria-label="Duplicate template"
                            >
                              <Copy className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(template.id);
                              }}
                              className="p-1.5 text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-colors"
                              aria-label="Delete template"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectionMode && (
            <div className="px-4 py-3 border-t border-[#E5E5EA]">
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-[#F2F2F7] text-[#1C1C1E] rounded-lg text-[13px] font-medium hover:bg-[#E5E5E5] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </BaseDialog>
    );
  }

  // Create/Edit view
  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={() => {
        setViewMode('list');
        resetForm();
      }}
      title={viewMode === 'edit' ? 'Edit Template' : 'New Template'}
      titleId="email-template-form-title"
      initialFocusRef={nameInputRef}
    >
      <div className="flex flex-col h-[500px]">
        {/* Back button */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E5E5EA]">
          <button
            onClick={() => {
              setViewMode('list');
              resetForm();
            }}
            className="flex items-center gap-1 text-[13px] text-[#007AFF] hover:underline"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            Back to templates
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <FormSection>
            <FormField label="Template Name">
              <input
                ref={nameInputRef}
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Meeting Request"
                className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none"
              />
            </FormField>
          </FormSection>

          <FormSection>
            <FormField label="Subject">
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g., Meeting request: {{topic}}"
                className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none"
              />
            </FormField>
          </FormSection>

          <FormSection>
            <FormField label="Body">
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={6}
                placeholder="Enter email body text..."
                className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none resize-none"
              />
            </FormField>
          </FormSection>

          {/* Optional recipient fields */}
          <div className="pt-2">
            <p className="px-1 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              Optional Default Recipients
            </p>
            <FormSection>
              <FormField label="To">
                <input
                  type="text"
                  value={formTo}
                  onChange={(e) => setFormTo(e.target.value)}
                  placeholder="Default recipient(s)"
                  className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none"
                />
              </FormField>
            </FormSection>
          </div>

          <FormSection>
            <FormField label="Cc">
              <input
                type="text"
                value={formCc}
                onChange={(e) => setFormCc(e.target.value)}
                placeholder="Default CC recipient(s)"
                className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none"
              />
            </FormField>
          </FormSection>

          <FormSection>
            <FormField label="Bcc">
              <input
                type="text"
                value={formBcc}
                onChange={(e) => setFormBcc(e.target.value)}
                placeholder="Default BCC recipient(s)"
                className="w-full px-4 pb-3 pt-1 text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] bg-transparent focus:outline-none"
              />
            </FormField>
          </FormSection>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-4 py-4 border-t border-[#E5E5EA]">
          <button
            onClick={() => {
              setViewMode('list');
              resetForm();
            }}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-[#F2F2F7] text-[#1C1C1E] rounded-lg font-medium text-[13px] hover:bg-[#E5E5E5] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid || isSaving}
            className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg font-medium text-[13px] hover:bg-[#0051D5] transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : viewMode === 'edit' ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}
