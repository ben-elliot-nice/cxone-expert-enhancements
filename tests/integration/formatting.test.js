import { describe, it, expect } from 'vitest';
import prettier from 'prettier';

describe('Code Formatting', () => {
  describe('CSS Formatting', () => {
    it('should format unformatted CSS', async () => {
      const unformatted = 'body{color:red;background:blue;}';
      const expected = 'body {\n  color: red;\n  background: blue;\n}\n';

      const formatted = await prettier.format(unformatted, {
        parser: 'css'
      });

      expect(formatted).toBe(expected);
      // Should preserve both declarations and add trailing newline
      expect(formatted.endsWith('\n')).toBe(true);
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

      await expect(prettier.format(invalid, { parser: 'css' }))
        .rejects.toThrow(/(SyntaxError|CssSyntaxError|Unexpected)/);
    });
  });

  describe('HTML Formatting', () => {
    it('should format unformatted HTML', async () => {
      const unformatted = '<div><p>Hello</p><p>World</p></div>';
      const expected = `<div>\n  <p>Hello</p>\n  <p>World</p>\n</div>\n`;

      const formatted = await prettier.format(unformatted, {
        parser: 'html',
        printWidth: 20
      });

      expect(formatted).toBe(expected);
    });

    it('should preserve HTML structure', async () => {
      const html = '<div class="test"><span>Content</span></div>';

      const formatted = await prettier.format(html, {
        parser: 'html',
        printWidth: 20
      });

      expect(formatted).toContain('class="test"');
      expect(formatted).toContain('<span');
      // With narrow printWidth we expect line breaks around span/text
      expect(formatted).toMatch(/<div class="test">\s+<span\s+>Content<\/span\s+>\s+<\/div>\n/);
      expect(formatted.endsWith('\n')).toBe(true);
    });
  });
});
