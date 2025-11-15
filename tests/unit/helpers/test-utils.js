import { vi } from 'vitest';

/**
 * Create a mock localStorage with data
 */
export function createMockLocalStorage(initialData = {}) {
  const store = { ...initialData };

  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };
}

/**
 * Create a mock fetch response
 */
export function createMockResponse(data, options = {}) {
  return Promise.resolve({
    ok: options.ok !== undefined ? options.ok : true,
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Map(Object.entries(options.headers || {}))
  });
}

/**
 * Create a mock DOM element
 */
export function createMockElement(tagName, attributes = {}) {
  const element = document.createElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'innerHTML') {
      element.innerHTML = value;
    } else {
      element.setAttribute(key, value);
    }
  });
  return element;
}

/**
 * Wait for a condition to be true
 */
export function waitFor(condition, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error('Timeout waiting for condition'));
      }
    }, 10);
  });
}

/**
 * Create a mock CSRF token
 */
export function createMockCSRFToken() {
  return 'mock-csrf-token-' + Math.random().toString(36).substr(2, 9);
}
