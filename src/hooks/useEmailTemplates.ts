import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '../utils/logger';
import { jmapClient } from '../api/jmap';
import type { EmailTemplate, CreateTemplatePayload, UpdateTemplatePayload } from '../types/jmap';

const STORAGE_KEY = 'sagittarius_email_templates';

function generateId(): string {
  return `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getStorageKey(accountId: string): string {
  return `${STORAGE_KEY}:${accountId}`;
}

/**
 * Load templates from localStorage for a specific account
 */
function loadTemplates(accountId: string): EmailTemplate[] {
  try {
    const raw = localStorage.getItem(getStorageKey(accountId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is EmailTemplate => {
      if (!item || typeof item !== 'object') return false;
      const t = item as Record<string, unknown>;
      return (
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        typeof t.subject === 'string' &&
        typeof t.body === 'string' &&
        typeof t.createdAt === 'number' &&
        typeof t.updatedAt === 'number' &&
        typeof t.accountId === 'string'
      );
    });
  } catch {
    logger.warn('[useEmailTemplates] Failed to load templates from localStorage');
    return [];
  }
}

/**
 * Save templates to localStorage for a specific account
 */
function saveTemplates(accountId: string, templates: EmailTemplate[]): void {
  try {
    localStorage.setItem(getStorageKey(accountId), JSON.stringify(templates));
  } catch {
    logger.warn('[useEmailTemplates] Failed to save templates to localStorage');
  }
}

/**
 * Hook to fetch email templates for the current account
 */
export function useEmailTemplates() {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['emailTemplates', accountId],
    queryFn: () => {
      if (!accountId) return [];
      return loadTemplates(accountId);
    },
    enabled: !!accountId,
    staleTime: Infinity, // Local data, always fresh
  });
}

/**
 * Hook to create a new email template
 */
export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation<EmailTemplate, Error, CreateTemplatePayload>({
    mutationFn: async (payload) => {
      if (!accountId) throw new Error('No account selected');

      const now = Date.now();
      const newTemplate: EmailTemplate = {
        id: generateId(),
        ...payload,
        createdAt: now,
        updatedAt: now,
        accountId,
      };

      const existing = loadTemplates(accountId);
      saveTemplates(accountId, [...existing, newTemplate]);

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', accountId] });
    },
  });
}

/**
 * Hook to update an existing email template
 */
export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation<EmailTemplate, Error, { id: string } & UpdateTemplatePayload>({
    mutationFn: async ({ id, ...updates }) => {
      if (!accountId) throw new Error('No account selected');

      const existing = loadTemplates(accountId);
      const template = existing.find((t) => t.id === id);

      if (!template) {
        throw new Error('Template not found');
      }

      const updated: EmailTemplate = {
        ...template,
        ...updates,
        id, // Ensure ID doesn't change
        accountId, // Ensure accountId doesn't change
        updatedAt: Date.now(),
      };

      const newList = existing.map((t) => (t.id === id ? updated : t));
      saveTemplates(accountId, newList);

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', accountId] });
    },
  });
}

/**
 * Hook to delete an email template
 */
export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      if (!accountId) throw new Error('No account selected');

      const existing = loadTemplates(accountId);
      const newList = existing.filter((t) => t.id !== id);

      if (newList.length === existing.length) {
        throw new Error('Template not found');
      }

      saveTemplates(accountId, newList);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', accountId] });
    },
  });
}

/**
 * Hook to duplicate an existing email template
 */
export function useDuplicateEmailTemplate() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation<EmailTemplate, Error, string>({
    mutationFn: async (id) => {
      if (!accountId) throw new Error('No account selected');

      const existing = loadTemplates(accountId);
      const template = existing.find((t) => t.id === id);

      if (!template) {
        throw new Error('Template not found');
      }

      const now = Date.now();
      const duplicated: EmailTemplate = {
        ...template,
        id: generateId(),
        name: `${template.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
      };

      saveTemplates(accountId, [...existing, duplicated]);

      return duplicated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates', accountId] });
    },
  });
}
