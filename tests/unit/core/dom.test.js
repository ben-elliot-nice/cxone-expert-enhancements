import { describe, it, expect, beforeEach } from 'vitest';
import { loadCore } from '../helpers/core-loader.js';
import { createMockElement } from '../helpers/test-utils.js';

describe('Core.DOM', () => {
  let Core;

  beforeEach(async () => {
    Core = await loadCore();
    document.body.innerHTML = '';
  });

  describe('create', () => {
    it('should create element with tag name', () => {
      const element = Core.DOM.create('div');

      expect(element.tagName.toLowerCase()).toBe('div');
    });

    it('should set attributes on created element', () => {
      const element = Core.DOM.create('div', {
        id: 'test-id',
        class: 'test-class'
      });

      expect(element.id).toBe('test-id');
      expect(element.className).toBe('test-class');
    });

    it('should handle className attribute specifically', () => {
      const element = Core.DOM.create('div', {
        className: 'custom-class'
      });

      expect(element.className).toBe('custom-class');
    });

    it('should set style object on created element', () => {
      const element = Core.DOM.create('div', {
        style: {
          color: 'red',
          fontSize: '16px'
        }
      });

      expect(element.style.color).toBe('red');
      expect(element.style.fontSize).toBe('16px');
    });

    it('should append string children as text nodes', () => {
      const element = Core.DOM.create('div', {}, ['Hello World']);

      expect(element.textContent).toBe('Hello World');
      expect(element.childNodes.length).toBe(1);
      expect(element.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    });

    it('should append multiple string children', () => {
      const element = Core.DOM.create('div', {}, ['Hello', ' ', 'World']);

      expect(element.textContent).toBe('Hello World');
      expect(element.childNodes.length).toBe(3);
    });

    it('should append HTMLElement children', () => {
      const child = createMockElement('span');
      const element = Core.DOM.create('div', {}, [child]);

      expect(element.children.length).toBe(1);
      expect(element.children[0]).toBe(child);
      expect(element.children[0].tagName.toLowerCase()).toBe('span');
    });

    it('should append mixed string and element children', () => {
      const child = createMockElement('span');
      const element = Core.DOM.create('div', {}, ['Text before', child, 'Text after']);

      expect(element.childNodes.length).toBe(3);
      expect(element.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(element.childNodes[0].textContent).toBe('Text before');
      expect(element.childNodes[1]).toBe(child);
      expect(element.childNodes[2].nodeType).toBe(Node.TEXT_NODE);
      expect(element.childNodes[2].textContent).toBe('Text after');
    });

    it('should create element with all features combined', () => {
      const childSpan = createMockElement('span', { textContent: 'child' });
      const element = Core.DOM.create('div', {
        id: 'complex-element',
        className: 'wrapper',
        'data-test': 'value',
        style: {
          padding: '10px',
          margin: '5px'
        }
      }, ['Prefix: ', childSpan, ' :Suffix']);

      expect(element.id).toBe('complex-element');
      expect(element.className).toBe('wrapper');
      expect(element.getAttribute('data-test')).toBe('value');
      expect(element.style.padding).toBe('10px');
      expect(element.style.margin).toBe('5px');
      expect(element.childNodes.length).toBe(3);
      expect(element.textContent).toContain('Prefix:');
      expect(element.textContent).toContain('child');
      expect(element.textContent).toContain(':Suffix');
    });

    it('should handle empty attributes object', () => {
      const element = Core.DOM.create('div', {});

      expect(element.tagName.toLowerCase()).toBe('div');
      expect(element.attributes.length).toBe(0);
    });

    it('should handle empty children array', () => {
      const element = Core.DOM.create('div', {}, []);

      expect(element.tagName.toLowerCase()).toBe('div');
      expect(element.childNodes.length).toBe(0);
    });

    it('should handle no arguments beyond tag', () => {
      const element = Core.DOM.create('div');

      expect(element.tagName.toLowerCase()).toBe('div');
      expect(element.attributes.length).toBe(0);
      expect(element.childNodes.length).toBe(0);
    });
  });
});
