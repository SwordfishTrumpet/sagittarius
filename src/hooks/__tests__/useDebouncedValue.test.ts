import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from '../useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 300))
    expect(result.current).toBe('initial')
  })

  it('updates value after delay', async () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'first', delay: 300 },
    })

    expect(result.current).toBe('first')

    rerender({ value: 'second', delay: 300 })
    expect(result.current).toBe('first')

    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('second')
  })

  it('resets timer on rapid value changes', async () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'a', delay: 300 },
    })

    rerender({ value: 'b', delay: 300 })
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    rerender({ value: 'c', delay: 300 })
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('c')
  })

  it('handles changing delay values', async () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'x', delay: 300 },
    })

    rerender({ value: 'y', delay: 500 })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('x')

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('y')
  })

  it('clears timeout on unmount', () => {
    const { result, rerender, unmount } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'start', delay: 300 },
    })

    rerender({ value: 'end', delay: 300 })
    unmount()

    // Should not throw or update after unmount
    vi.advanceTimersByTime(500)
    expect(result.current).toBe('start')
  })

  it('works with non-string values (numbers)', async () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 0, delay: 100 },
    })

    rerender({ value: 42, delay: 100 })
    expect(result.current).toBe(0)

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe(42)
  })

  it('works with object values', async () => {
    const obj1 = { a: 1 }
    const obj2 = { a: 2 }
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: obj1, delay: 100 },
    })

    rerender({ value: obj2, delay: 100 })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe(obj2)
  })

  it('works with null and undefined values', async () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: null as string | null, delay: 100 },
    })

    rerender({ value: 'hello', delay: 100 })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('hello')

    rerender({ value: null, delay: 100 })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBeNull()
  })
})
