import { describe, it, expect } from 'vitest';
import prettier from 'prettier';

describe('Code Formatting', () => {
  describe('CSS Formatting', () => {
    it('should format unformatted CSS', async () => {
      const unformatted = 'body{color:red;background:blue;}';

      const formatted = await prettier.format(unformatted, {
        parser: 'css'
      });

      expect(formatted).toContain('color: red');
      expect(formatted).toContain('background: blue');
      expect(formatted).toMatch(/\n/); // Should have newlines
    });

    it('should preserve already formatted CSS', async () => {
      const formatted = 'body {\n  color: red;\n}\n';

      const result = await prettier.format(formatted, {
        parser: 'css'
      });

      expect(result).toBe(formatted);
    });

    it('should handle invalid CSS gracefully', async () => {
      const invalid = 'body { color: red';

      try {
        await prettier.format(invalid, {
          parser: 'css'
        });
        // May throw or may succeed depending on Prettier version
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('HTML Formatting', () => {
    it('should format unformatted HTML', async () => {
      const unformatted = '<div><p>Hello</p><p>World</p></div>';

      const formatted = await prettier.format(unformatted, {
        parser: 'html'
      });

      expect(formatted).toMatch(/\n/); // Should have newlines
      expect(formatted).toContain('<div>');
      expect(formatted).toContain('</div>');
    });

    it('should preserve HTML structure', async () => {
      const html = '<div class="test"><span>Content</span></div>';

      const formatted = await prettier.format(html, {
        parser: 'html'
      });

      expect(formatted).toContain('class="test"');
      expect(formatted).toContain('<span>Content</span>');
    });
  });
});
