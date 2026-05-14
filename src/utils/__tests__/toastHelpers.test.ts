import { describe, expect, it, vi, beforeEach } from 'vitest'
import { toastOperationError, toastSuccess, toastWithUndo, ToastErrors } from '../toastHelpers'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

describe('toastHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('toastOperationError', () => {
    it('shows identity.create error', () => {
      toastOperationError('identity.create')
      expect(toast.error).toHaveBeenCalledWith('Failed to create identity')
    })

    it('shows identity.update error', () => {
      toastOperationError('identity.update')
      expect(toast.error).toHaveBeenCalledWith('Failed to update identity')
    })

    it('shows identity.delete error', () => {
      toastOperationError('identity.delete')
      expect(toast.error).toHaveBeenCalledWith('Failed to delete identity')
    })

    it('shows vacation.save error', () => {
      toastOperationError('vacation.save')
      expect(toast.error).toHaveBeenCalledWith('Failed to save vacation response')
    })

    it('shows sieve.save error', () => {
      toastOperationError('sieve.save')
      expect(toast.error).toHaveBeenCalledWith('Failed to save rule')
    })

    it('shows sieve.delete error', () => {
      toastOperationError('sieve.delete')
      expect(toast.error).toHaveBeenCalledWith('Failed to delete rule')
    })

    it('shows sieve.activate error', () => {
      toastOperationError('sieve.activate')
      expect(toast.error).toHaveBeenCalledWith('Failed to update rule')
    })

    it('shows folder.create error', () => {
      toastOperationError('folder.create')
      expect(toast.error).toHaveBeenCalledWith('Failed to create folder')
    })

    it('shows folder.rename error', () => {
      toastOperationError('folder.rename')
      expect(toast.error).toHaveBeenCalledWith('Failed to rename folder')
    })

    it('shows folder.delete error', () => {
      toastOperationError('folder.delete')
      expect(toast.error).toHaveBeenCalledWith('Failed to delete folder')
    })

    it('shows email.send error', () => {
      toastOperationError('email.send')
      expect(toast.error).toHaveBeenCalledWith('Failed to send email')
    })

    it('shows email.saveDraft error', () => {
      toastOperationError('email.saveDraft')
      expect(toast.error).toHaveBeenCalledWith('Failed to save draft')
    })

    it('shows email.move error', () => {
      toastOperationError('email.move')
      expect(toast.error).toHaveBeenCalledWith('Failed to move email')
    })

    it('shows email.delete error', () => {
      toastOperationError('email.delete')
      expect(toast.error).toHaveBeenCalledWith('Failed to delete email')
    })

    it('shows email.import error', () => {
      toastOperationError('email.import')
      expect(toast.error).toHaveBeenCalledWith('Failed to import email')
    })

    it('shows email.reopen error', () => {
      toastOperationError('email.reopen')
      expect(toast.error).toHaveBeenCalledWith('Failed to reopen draft')
    })

    it('shows attachment.upload error', () => {
      toastOperationError('attachment.upload')
      expect(toast.error).toHaveBeenCalledWith('Failed to upload attachment')
    })

    it('shows attachment.empty error', () => {
      toastOperationError('attachment.empty')
      expect(toast.error).toHaveBeenCalledWith('Cannot upload file: file is empty (0 bytes)')
    })

    it('shows settings.save error', () => {
      toastOperationError('settings.save')
      expect(toast.error).toHaveBeenCalledWith('Failed to save settings')
    })

    it('shows settings.load error', () => {
      toastOperationError('settings.load')
      expect(toast.error).toHaveBeenCalledWith('Failed to load settings')
    })

    it('shows network.default error', () => {
      toastOperationError('network.default')
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
    })

    it('shows network.timeout error', () => {
      toastOperationError('network.timeout')
      expect(toast.error).toHaveBeenCalledWith('Request timed out. Please try again.')
    })

    it('shows network.offline error', () => {
      toastOperationError('network.offline')
      expect(toast.error).toHaveBeenCalledWith('You appear to be offline. Changes will sync when reconnected.')
    })

    it('shows mdn.send error', () => {
      toastOperationError('mdn.send')
      expect(toast.error).toHaveBeenCalledWith('Failed to send receipt')
    })

    it('falls back to network.default for unknown category', () => {
      toastOperationError('nonexistent.action' as any)
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
    })

    it('falls back to network.default for unknown action', () => {
      toastOperationError('identity.unknown' as any)
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
    })
  })

  describe('toastSuccess', () => {
    it('shows success toast', () => {
      toastSuccess('Email sent')
      expect(toast.success).toHaveBeenCalledWith('Email sent')
    })
  })

  describe('toastWithUndo', () => {
    it('shows undo toast with default label', () => {
      const onUndo = vi.fn()
      toastWithUndo('Email moved', 'Undo', onUndo)
      expect(toast.success).toHaveBeenCalledWith('Email moved', {
        action: { label: 'Undo', onClick: onUndo },
      })
    })

    it('shows undo toast with custom label', () => {
      const onUndo = vi.fn()
      toastWithUndo('Email deleted', 'Restore', onUndo)
      expect(toast.success).toHaveBeenCalledWith('Email deleted', {
        action: { label: 'Restore', onClick: onUndo },
      })
    })
  })

  describe('ToastErrors constant', () => {
    it('has all expected top-level categories', () => {
      const categories = Object.keys(ToastErrors)
      expect(categories).toContain('identity')
      expect(categories).toContain('vacation')
      expect(categories).toContain('sieve')
      expect(categories).toContain('folder')
      expect(categories).toContain('email')
      expect(categories).toContain('attachment')
      expect(categories).toContain('settings')
      expect(categories).toContain('network')
      expect(categories).toContain('mdn')
    })
  })
})
