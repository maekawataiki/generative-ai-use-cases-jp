import { describe, it, expect } from 'vitest';
import {
  isHTML,
  isMarkdown,
  parseHTML,
  parseMarkdown,
  parseContent,
} from '../../src/components/Writer/lib/contentParser';

describe('contentParser', () => {
  describe('isHTML', () => {
    it('should detect HTML tags', () => {
      expect(isHTML('<p>Hello</p>')).toBe(true);
      expect(isHTML('<h1>Title</h1>')).toBe(true);
      expect(isHTML('<div><p>Content</p></div>')).toBe(true);
      expect(isHTML('<br/>')).toBe(true);
    });

    it('should not detect plain text as HTML', () => {
      expect(isHTML('Just plain text')).toBe(false);
      expect(isHTML('No tags here')).toBe(false);
    });

    it('should not detect markdown as HTML', () => {
      expect(isHTML('# Heading')).toBe(false);
      expect(isHTML('**bold**')).toBe(false);
    });
  });

  describe('isMarkdown', () => {
    it('should detect markdown headers', () => {
      expect(isMarkdown('# Heading 1')).toBe(true);
      expect(isMarkdown('## Heading 2')).toBe(true);
      expect(isMarkdown('### Heading 3')).toBe(true);
    });

    it('should detect markdown formatting', () => {
      expect(isMarkdown('**bold text**')).toBe(true);
      expect(isMarkdown('*italic text*')).toBe(true);
      expect(isMarkdown('__bold text__')).toBe(true);
      expect(isMarkdown('_italic text_')).toBe(true);
    });

    it('should detect markdown links', () => {
      expect(isMarkdown('[link](https://example.com)')).toBe(true);
    });

    it('should detect markdown lists', () => {
      expect(isMarkdown('- list item')).toBe(true);
      expect(isMarkdown('* list item')).toBe(true);
      expect(isMarkdown('1. numbered item')).toBe(true);
    });

    it('should detect markdown code', () => {
      expect(isMarkdown('`inline code`')).toBe(true);
      expect(isMarkdown('```\ncode block\n```')).toBe(true);
    });

    it('should not detect plain text as markdown', () => {
      expect(isMarkdown('Just plain text')).toBe(false);
      expect(isMarkdown('No markdown here')).toBe(false);
    });
  });

  describe('parseHTML', () => {
    it('should parse simple paragraph', () => {
      const result = parseHTML('<p>Hello World</p>');
      expect(result.type).toBe('doc');
      expect(result.content).toHaveLength(1);
      expect(result.content![0].type).toBe('paragraph');
      expect(result.content![0].content![0].text).toBe('Hello World');
    });

    it('should parse headings', () => {
      const result = parseHTML('<h1>Title</h1>');
      expect(result.content![0].type).toBe('heading');
      expect(result.content![0].attrs?.level).toBe(1);
    });

    it('should parse bold text', () => {
      const result = parseHTML('<p><strong>Bold</strong></p>');
      expect(result.content![0].content![0].marks).toBeDefined();
      expect(result.content![0].content![0].marks![0].type).toBe('bold');
    });

    it('should parse italic text', () => {
      const result = parseHTML('<p><em>Italic</em></p>');
      expect(result.content![0].content![0].marks).toBeDefined();
      expect(result.content![0].content![0].marks![0].type).toBe('italic');
    });

    it('should parse links', () => {
      const result = parseHTML('<p><a href="https://example.com">Link</a></p>');
      const linkMark = result.content![0].content![0].marks?.find(
        (m: any) => m.type === 'link'
      );
      expect(linkMark).toBeDefined();
      expect(linkMark?.attrs?.href).toBe('https://example.com');
    });

    it('should parse bullet lists', () => {
      const result = parseHTML('<ul><li>Item 1</li><li>Item 2</li></ul>');
      expect(result.content![0].type).toBe('bulletList');
      expect(result.content![0].content).toHaveLength(2);
      expect(result.content![0].content![0].type).toBe('listItem');
    });

    it('should parse nested formatting', () => {
      const result = parseHTML('<p><strong>Bold <em>and italic</em></strong></p>');
      expect(result.content![0].content).toBeDefined();
      // Should have multiple text nodes with different marks
      expect(result.content![0].content!.length).toBeGreaterThan(0);
    });
  });

  describe('parseMarkdown', () => {
    it('should parse markdown headings', () => {
      const result = parseMarkdown('# Heading 1');
      expect(result.content![0].type).toBe('heading');
      expect(result.content![0].attrs?.level).toBe(1);
    });

    it('should parse markdown bold', () => {
      const result = parseMarkdown('**bold text**');
      expect(result.content![0].content![0].marks).toBeDefined();
      expect(result.content![0].content![0].marks![0].type).toBe('bold');
    });

    it('should parse markdown italic', () => {
      const result = parseMarkdown('*italic text*');
      expect(result.content![0].content![0].marks).toBeDefined();
      expect(result.content![0].content![0].marks![0].type).toBe('italic');
    });

    it('should parse markdown links', () => {
      const result = parseMarkdown('[link](https://example.com)');
      const linkMark = result.content![0].content![0].marks?.find(
        (m: any) => m.type === 'link'
      );
      expect(linkMark).toBeDefined();
      expect(linkMark?.attrs?.href).toBe('https://example.com');
    });
  });

  describe('parseContent', () => {
    it('should parse HTML content', () => {
      const result = parseContent('<h1>Title</h1>');
      expect(result.content![0].type).toBe('heading');
    });

    it('should parse Markdown content', () => {
      const result = parseContent('# Title');
      expect(result.content![0].type).toBe('heading');
    });

    it('should parse plain text', () => {
      const result = parseContent('Just plain text');
      expect(result.content![0].type).toBe('paragraph');
      expect(result.content![0].content![0].text).toBe('Just plain text');
    });

    it('should handle empty content', () => {
      const result = parseContent('');
      expect(result.type).toBe('doc');
      expect(result.content![0].type).toBe('paragraph');
    });
  });
});
