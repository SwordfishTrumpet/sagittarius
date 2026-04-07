import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  useDuplicateEmailTemplate,
} from '../useEmailTemplates'
import type { EmailTemplate } from '../../types/jmap'

const getPrimaryAccount = vi.hoisted(() => vi.fn().mockReturnValue('account-1'))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount,
  },
}))

const invalidateQueriesMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> | unknown; queryKey: unknown[]; enabled?: boolean }) => {
    const [data, setData] = vi.mocked(require('react').useState)(undefined)
    const [isLoading, setIsLoading] = vi.mocked(require('react').useState)(false)
    const [error, setError] = vi.mocked(require('react').useState)(null)
    const [isSuccess, setIsSuccess] = vi.mocked(require('react').useState)(false)

    vi.mocked(require('react').useEffect)(() => {
      if (options.enabled === false) return
      setIsLoading(true)
      const result = options.queryFn()
      // Handle both sync and async queryFn
      const promise = result instanceof Promise ? result : Promise.resolve(result)
      promise
        .then((resolved: unknown) => {
          setData(resolved)
          setIsSuccess(true)
          setIsLoading(false)
        })
        .catch((err: Error) => {
          setError(err)
          setIsLoading(false)
        })
    }, [options.queryKey.join(',')])

    return { data, isLoading, error, isSuccess, isEnabled: options.enabled !== false }
  },
  useMutation: (options: { mutationFn: (vars: unknown) => Promise<unknown>; onSuccess?: () => void }) => {
    const [isPending, setIsPending] = vi.mocked(require('react').useState)(false)

    const mutateAsync = async (variables: unknown) => {
      setIsPending(true)
      try {
        const result = await options.mutationFn(variables)
        setIsPending(false)
        options.onSuccess?.()
        return result
      } catch (err) {
        setIsPending(false)
        throw err
      }
    }

    return { mutateAsync, isPending }
  },
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}))

describe('useEmailTemplates', () => {
  const STORAGE_KEY = 'sagittarius_email_templates:account-1'

  beforeEach(() => {
    localStorage.clear()
    getPrimaryAccount.mockReturnValue('account-1')
    invalidateQueriesMock.mockClear()
  })

  it('returns empty array when no templates exist', async () => {
    const { result } = renderHook(() => useEmailTemplates())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('returns templates from localStorage', async () => {
    const mockTemplates: EmailTemplate[] = [
      {
        id: 'template_1234567890000_abc123',
        name: 'Welcome Email',
        subject: 'Welcome to our service!',
        body: '<p>Welcome aboard!</p>',
        to: 'newuser@example.com',
        createdAt: 1234567890000,
        updatedAt: 1234567890000,
        accountId: 'account-1',
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockTemplates))

    const { result } = renderHook(() => useEmailTemplates())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].name).toBe('Welcome Email')
  })

  it('returns undefined when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useEmailTemplates())

    await waitFor(() => expect(result.current.isEnabled).toBe(false))
  })

  it('filters out invalid templates from localStorage', async () => {
    const invalidData = [
      { id: 'valid', name: 'Valid', subject: 'Subject', body: 'Body', createdAt: 1, updatedAt: 1, accountId: 'account-1' },
      { id: 'invalid', name: 'Invalid' }, // Missing required fields
      null,
      'not an object',
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invalidData))

    const { result } = renderHook(() => useEmailTemplates())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].name).toBe('Valid')
  })
})

describe('useCreateEmailTemplate', () => {
  const STORAGE_KEY = 'sagittarius_email_templates:account-1'

  beforeEach(() => {
    localStorage.clear()
    getPrimaryAccount.mockReturnValue('account-1')
    invalidateQueriesMock.mockClear()
  })

  it('creates a new template', async () => {
    const { result } = renderHook(() => useCreateEmailTemplate())

    const newTemplate = await result.current.mutateAsync({
      name: 'Meeting Request',
      subject: 'Meeting: {{topic}}',
      body: '<p>Can we schedule a meeting about {{topic}}?</p>',
      to: 'team@example.com',
    })

    expect(newTemplate.name).toBe('Meeting Request')
    expect(newTemplate.subject).toBe('Meeting: {{topic}}')
    expect(newTemplate.to).toBe('team@example.com')
    expect(newTemplate.id).toMatch(/^template_/)
    expect(newTemplate.accountId).toBe('account-1')

    // Verify stored in localStorage
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('Meeting Request')

    // Verify query invalidation
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['emailTemplates', 'account-1'] })
  })

  it('throws error when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useCreateEmailTemplate())

    await expect(
      result.current.mutateAsync({
        name: 'Test',
        subject: 'Subject',
        body: 'Body',
      })
    ).rejects.toThrow('No account selected')
  })

  it('appends to existing templates', async () => {
    const existingTemplate: EmailTemplate = {
      id: 'template_existing',
      name: 'Existing',
      subject: 'Existing Subject',
      body: 'Body',
      createdAt: 1000,
      updatedAt: 1000,
      accountId: 'account-1',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([existingTemplate]))

    const { result } = renderHook(() => useCreateEmailTemplate())

    await result.current.mutateAsync({
      name: 'New Template',
      subject: 'New Subject',
      body: 'New Body',
    })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    expect(stored).toHaveLength(2)
    expect(stored[1].name).toBe('New Template')
  })
})

describe('useUpdateEmailTemplate', () => {
  const STORAGE_KEY = 'sagittarius_email_templates:account-1'

  beforeEach(() => {
    localStorage.clear()
    getPrimaryAccount.mockReturnValue('account-1')
    invalidateQueriesMock.mockClear()
  })

  it('updates an existing template', async () => {
    const existingTemplate: EmailTemplate = {
      id: 'template_existing',
      name: 'Old Name',
      subject: 'Old Subject',
      body: 'Old Body',
      createdAt: 1000,
      updatedAt: 1000,
      accountId: 'account-1',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([existingTemplate]))

    const { result } = renderHook(() => useUpdateEmailTemplate())

    const updated = await result.current.mutateAsync({
      id: 'template_existing',
      name: 'New Name',
      subject: 'New Subject',
    })

    expect(updated.name).toBe('New Name')
    expect(updated.subject).toBe('New Subject')
    expect(updated.body).toBe('Old Body') // Unchanged
    expect(updated.updatedAt).toBeGreaterThan(1000)
    expect(updated.createdAt).toBe(1000) // Unchanged

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    expect(stored[0].name).toBe('New Name')
  })

  it('throws error when template not found', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))

    const { result } = renderHook(() => useUpdateEmailTemplate())

    await expect(
      result.current.mutateAsync({
        id: 'nonexistent',
        name: 'New Name',
      })
    ).rejects.toThrow('Template not found')
  })

  it('throws error when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useUpdateEmailTemplate())

    await expect(
      result.current.mutateAsync({
        id: 'template_123',
        name: 'New Name',
      })
    ).rejects.toThrow('No account selected')
  })
})

describe('useDeleteEmailTemplate', () => {
  const STORAGE_KEY = 'sagittarius_email_templates:account-1'

  beforeEach(() => {
    localStorage.clear()
    getPrimaryAccount.mockReturnValue('account-1')
    invalidateQueriesMock.mockClear()
  })

  it('deletes an existing template', async () => {
    const templates: EmailTemplate[] = [
      {
        id: 'template_1',
        name: 'Template 1',
        subject: 'Subject 1',
        body: 'Body 1',
        createdAt: 1000,
        updatedAt: 1000,
        accountId: 'account-1',
      },
      {
        id: 'template_2',
        name: 'Template 2',
        subject: 'Subject 2',
        body: 'Body 2',
        createdAt: 2000,
        updatedAt: 2000,
        accountId: 'account-1',
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))

    const { result } = renderHook(() => useDeleteEmailTemplate())

    await result.current.mutateAsync('template_1')

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe('template_2')

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['emailTemplates', 'account-1'] })
  })

  it('throws error when template not found', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))

    const { result } = renderHook(() => useDeleteEmailTemplate())

    await expect(result.current.mutateAsync('nonexistent')).rejects.toThrow('Template not found')
  })
})

describe('useDuplicateEmailTemplate', () => {
  const STORAGE_KEY = 'sagittarius_email_templates:account-1'

  beforeEach(() => {
    localStorage.clear()
    getPrimaryAccount.mockReturnValue('account-1')
    invalidateQueriesMock.mockClear()
  })

  it('duplicates an existing template', async () => {
    const existingTemplate: EmailTemplate = {
      id: 'template_original',
      name: 'Original',
      subject: 'Original Subject',
      body: '<p>Original body</p>',
      to: 'recipient@example.com',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
      createdAt: 1000,
      updatedAt: 1000,
      accountId: 'account-1',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([existingTemplate]))

    const { result } = renderHook(() => useDuplicateEmailTemplate())

    const duplicated = await result.current.mutateAsync('template_original')

    expect(duplicated.name).toBe('Original (Copy)')
    expect(duplicated.subject).toBe('Original Subject')
    expect(duplicated.body).toBe('<p>Original body</p>')
    expect(duplicated.to).toBe('recipient@example.com')
    expect(duplicated.id).not.toBe('template_original')

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    expect(stored).toHaveLength(2)
  })

  it('throws error when template not found', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))

    const { result } = renderHook(() => useDuplicateEmailTemplate())

    await expect(result.current.mutateAsync('nonexistent')).rejects.toThrow('Template not found')
  })
})
