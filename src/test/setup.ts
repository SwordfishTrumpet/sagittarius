/**
 * Vitest global test setup
 *
 * Provides browser-like globals (sessionStorage, fetch, etc.)
 * required by the JMAP client and related modules.
 */
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  document.body.innerHTML = '';
});

// Mock location for navigation-related tests
// We need to intercept location access to prevent jsdom errors
if (typeof window !== 'undefined') {
  const mockLocation = {
    href: 'http://localhost:8081/',
    protocol: 'http:',
    host: 'localhost:8081',
    hostname: 'localhost',
    port: '8081',
    pathname: '/',
    search: '',
    hash: '',
    origin: 'http://localhost:8081',
    replace: vi.fn(),
    assign: vi.fn(),
    reload: vi.fn(),
    toString: () => 'http://localhost:8081/',
  };
  
  // Override the location getter on the window prototype
  const windowProto = Object.getPrototypeOf(window);
  const originalDescriptor = Object.getOwnPropertyDescriptor(windowProto, 'location');
  
  if (originalDescriptor) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => mockLocation,
      set: (val: string | Location) => {
        if (typeof val === 'string') {
          mockLocation.href = val;
        }
      },
    });
  }
}
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

// Provide a minimal sessionStorage stub when jsdom doesn't expose one
if (typeof globalThis.sessionStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.sessionStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}

// Provide a minimal localStorage stub
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}
