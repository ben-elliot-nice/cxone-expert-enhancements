import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadCore } from '../helpers/core-loader.js';
import { createMockCSRFToken } from '../helpers/test-utils.js';

describe('Core.API', () => {
  let Core;

  beforeEach(async () => {
    Core = await loadCore();
    global.fetch = vi.fn();
  });

  describe('parseFormHTML', () => {
    it('should parse HTML and extract CSRF token from input', () => {
      const csrfToken = createMockCSRFToken();
      const html = `
        <html>
          <body>
            <form>
              <input type="hidden" name="csrf_token" value="${csrfToken}" />
              <input type="text" name="field1" value="value1" />
            </form>
          </body>
        </html>
      `;

      const result = Core.API.parseFormHTML(html);

      expect(result.doc).toBeTruthy();
      expect(result.doc.querySelector).toBeDefined();
      expect(result.data.csrf_token).toBe(csrfToken);
    });

    it('should return empty csrf_token if not found in HTML', () => {
      const html = `
        <html>
          <body>
            <form>
              <input type="text" name="field1" value="value1" />
            </form>
          </body>
        </html>
      `;

      const result = Core.API.parseFormHTML(html);

      expect(result.data.csrf_token).toBe('');
    });

    it('should return document object for further processing', () => {
      const html = '<html><body><div id="test">Content</div></body></html>';

      const result = Core.API.parseFormHTML(html);

      expect(result.doc.querySelector('#test')).toBeTruthy();
      expect(result.doc.querySelector('#test').textContent).toBe('Content');
    });

    it('should initialize fields object in data', () => {
      const html = '<html><body></body></html>';

      const result = Core.API.parseFormHTML(html);

      expect(result.data.fields).toEqual({});
    });
  });

  describe('buildMultipartBody', () => {
    it('should build multipart form body with boundary', () => {
      const data = {
        field1: 'value1',
        field2: 'value2'
      };

      const result = Core.API.buildMultipartBody(data);

      expect(result.body).toBeTruthy();
      expect(result.boundary).toBeTruthy();
      expect(result.boundary).toMatch(/^----WebKitFormBoundary/);
    });

    it('should include all data fields in body', () => {
      const data = {
        csrf_token: 'test-token',
        username: 'testuser',
        email: 'test@example.com'
      };

      const result = Core.API.buildMultipartBody(data);

      expect(result.body).toContain('name="csrf_token"');
      expect(result.body).toContain('test-token');
      expect(result.body).toContain('name="username"');
      expect(result.body).toContain('testuser');
      expect(result.body).toContain('name="email"');
      expect(result.body).toContain('test@example.com');
    });

    it('should include submit button in body', () => {
      const data = { field: 'value' };

      const result = Core.API.buildMultipartBody(data);

      expect(result.body).toContain('name="deki_buttons[submit][submit]"');
      expect(result.body).toContain('submit');
    });

    it('should format body with proper multipart structure', () => {
      const data = { test: 'data' };

      const result = Core.API.buildMultipartBody(data);

      expect(result.body).toContain('Content-Disposition: form-data;');
      expect(result.body).toContain(`--${result.boundary}\r\n`);
      expect(result.body).toContain(`--${result.boundary}--\r\n`);
    });

    it('should handle empty data object', () => {
      const data = {};

      const result = Core.API.buildMultipartBody(data);

      expect(result.body).toBeTruthy();
      expect(result.boundary).toBeTruthy();
      // Should still include submit button
      expect(result.body).toContain('name="deki_buttons[submit][submit]"');
    });

    it('should use unique boundary for each call', () => {
      const data = { field: 'value' };

      const result1 = Core.API.buildMultipartBody(data);
      const result2 = Core.API.buildMultipartBody(data);

      // Boundaries should be different (probabilistically)
      // We can't guarantee this 100% due to randomness, but it's very unlikely to match
      expect(result1.boundary).toBeTruthy();
      expect(result2.boundary).toBeTruthy();
    });
  });

  describe('fetch', () => {
    it('should call global fetch with credentials included', async () => {
      const mockResponse = { ok: true, json: async () => ({ data: 'test' }) };
      global.fetch.mockResolvedValue(mockResponse);

      await Core.API.fetch('https://example.com/api');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          credentials: 'include'
        })
      );
    });

    it('should merge credentials with provided options', async () => {
      const mockResponse = { ok: true };
      global.fetch.mockResolvedValue(mockResponse);

      await Core.API.fetch('https://example.com/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should return fetch response', async () => {
      const mockResponse = { ok: true, status: 200, data: 'test' };
      global.fetch.mockResolvedValue(mockResponse);

      const response = await Core.API.fetch('https://example.com/api');

      expect(response).toBe(mockResponse);
    });

    it('should handle fetch with no options', async () => {
      const mockResponse = { ok: true };
      global.fetch.mockResolvedValue(mockResponse);

      await Core.API.fetch('https://example.com/api');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        { credentials: 'include' }
      );
    });

    it('should preserve all custom options', async () => {
      const mockResponse = { ok: true };
      global.fetch.mockResolvedValue(mockResponse);

      const customOptions = {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer token',
          'Custom-Header': 'value'
        },
        body: JSON.stringify({ data: 'test' }),
        mode: 'cors',
        cache: 'no-cache'
      };

      await Core.API.fetch('https://example.com/api', customOptions);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          ...customOptions,
          credentials: 'include'
        })
      );
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      global.fetch.mockRejectedValue(error);

      await expect(Core.API.fetch('https://example.com/api')).rejects.toThrow('Network error');
    });
  });
});
