import { JSONContent } from 'novel';

/**
 * Type definition for a TipTap mark (formatting applied to text)
 */
type TextMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

/**
 * Detect if the content is likely HTML
 */
export const isHTML = (content: string): boolean => {
  const htmlPattern = /<([a-z][\w-]*)[^>]*>.*<\/\1>|<[a-z][\w-]*\s*\/>/is;
  return htmlPattern.test(content.trim());
};

/**
 * Detect if the content is likely Markdown
 */
export const isMarkdown = (content: string): boolean => {
  const markdownPatterns = [
    /^#{1,6}\s+.+$/m, // Headers
    /^\*\*.*\*\*$/m, // Bold
    /^__.*__$/m, // Bold alternative
    /^\*.*\*$/m, // Italic
    /^_.*_$/m, // Italic alternative
    /^\[.*\]\(.*\)$/m, // Links
    /^!\[.*\]\(.*\)$/m, // Images
    /^[-*+]\s+.+$/m, // Unordered lists
    /^\d+\.\s+.+$/m, // Ordered lists
    /^>\s+.+$/m, // Blockquotes
    /^```[\s\S]*```$/m, // Code blocks
    /^`[^`]+`$/m, // Inline code
    /^[-*_]{3,}$/m, // Horizontal rules
  ];

  return markdownPatterns.some((pattern) => pattern.test(content));
};

/**
 * Parse HTML content to TipTap JSON format
 */
export const parseHTML = (htmlContent: string): JSONContent => {
  try {
    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Convert common HTML elements to TipTap JSON structure
    const content: JSONContent[] = [];

    // Helper to collect text marks
    const getMarks = (element: Element): TextMark[] => {
      const marks: TextMark[] = [];
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'strong':
        case 'b':
          marks.push({ type: 'bold' });
          break;
        case 'em':
        case 'i':
          marks.push({ type: 'italic' });
          break;
        case 'u':
          marks.push({ type: 'underline' });
          break;
        case 'code':
          marks.push({ type: 'code' });
          break;
        case 'a':
          marks.push({
            type: 'link',
            attrs: {
              href: element.getAttribute('href') || '',
              target: element.getAttribute('target') || null,
            },
          });
          break;
      }

      return marks;
    };

    // Process inline elements (text with marks)
    const processInlineNode = (
      node: Node,
      inheritedMarks: TextMark[] = []
    ): JSONContent[] => {
      const results: JSONContent[] = [];

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text && text.length > 0) {
          if (inheritedMarks.length > 0) {
            results.push({ type: 'text', marks: inheritedMarks, text });
          } else {
            results.push({ type: 'text', text });
          }
        }
        return results;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        
        // Check if this is an inline element
        const inlineElements = ['strong', 'b', 'em', 'i', 'u', 'code', 'a', 'span'];
        
        if (inlineElements.includes(tagName)) {
          const marks = [...inheritedMarks, ...getMarks(element)];
          
          // Process children with accumulated marks
          node.childNodes.forEach((child) => {
            results.push(...processInlineNode(child, marks));
          });
          
          return results;
        }

        // For other elements, process children without adding marks
        node.childNodes.forEach((child) => {
          results.push(...processInlineNode(child, inheritedMarks));
        });
      }

      return results;
    };

    // Process block-level nodes
    const processNode = (node: Node): JSONContent | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          return { type: 'text', text };
        }
        return null;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();

        // Map HTML elements to TipTap node types
        switch (tagName) {
          case 'p': {
            const inlineContent = processInlineNode(element);
            return {
              type: 'paragraph',
              content: inlineContent.length > 0 ? inlineContent : undefined,
            };
          }
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6': {
            const inlineContent = processInlineNode(element);
            return {
              type: 'heading',
              attrs: { level: parseInt(tagName[1]) },
              content: inlineContent.length > 0 ? inlineContent : undefined,
            };
          }
          case 'ul': {
            const items: JSONContent[] = [];
            element.childNodes.forEach((child) => {
              const processed = processNode(child);
              if (processed) {
                items.push(processed);
              }
            });
            return {
              type: 'bulletList',
              content: items.length > 0 ? items : undefined,
            };
          }
          case 'ol': {
            const items: JSONContent[] = [];
            element.childNodes.forEach((child) => {
              const processed = processNode(child);
              if (processed) {
                items.push(processed);
              }
            });
            return {
              type: 'orderedList',
              content: items.length > 0 ? items : undefined,
            };
          }
          case 'li': {
            const inlineContent = processInlineNode(element);
            const paragraphContent: JSONContent = {
              type: 'paragraph',
              content: inlineContent.length > 0 ? inlineContent : undefined,
            };
            return {
              type: 'listItem',
              content: [paragraphContent],
            };
          }
          case 'blockquote': {
            const blockContent: JSONContent[] = [];
            element.childNodes.forEach((child) => {
              const processed = processNode(child);
              if (processed) {
                blockContent.push(processed);
              }
            });
            return {
              type: 'blockquote',
              content: blockContent.length > 0 ? blockContent : [{ type: 'paragraph' }],
            };
          }
          case 'pre': {
            const codeElement = element.querySelector('code');
            return {
              type: 'codeBlock',
              content: [
                {
                  type: 'text',
                  text: (codeElement || element).textContent || '',
                },
              ],
            };
          }
          case 'br':
            return { type: 'hardBreak' };
          case 'hr':
            return { type: 'horizontalRule' };
          case 'div':
          case 'section':
          case 'article': {
            // For container elements, process children and return them
            const children: JSONContent[] = [];
            element.childNodes.forEach((child) => {
              const processed = processNode(child);
              if (processed) {
                children.push(processed);
              }
            });
            // Return children directly, not wrapped
            return children.length === 1 ? children[0] : null;
          }
          default:
            return null;
        }
      }

      return null;
    };

    // Process body children
    doc.body.childNodes.forEach((node) => {
      const processed = processNode(node);
      if (processed) {
        if (Array.isArray(processed)) {
          content.push(...processed);
        } else {
          content.push(processed);
        }
      }
    });

    // If no content was parsed, return a paragraph with the original text
    if (content.length === 0) {
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: htmlContent }],
          },
        ],
      };
    }

    return {
      type: 'doc',
      content,
    };
  } catch (error) {
    console.error('Error parsing HTML:', error);
    // Fallback to plain text
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: htmlContent }],
        },
      ],
    };
  }
};

/**
 * Parse Markdown content to TipTap JSON format
 */
export const parseMarkdown = (markdownContent: string): JSONContent => {
  // The Markdown extension will handle parsing when the editor is initialized
  // For now, we'll convert common markdown patterns to HTML and then parse
  try {
    let html = markdownContent;

    // Convert headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Convert bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Convert links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    // Convert inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Convert unordered lists
    html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Convert ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Convert blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Convert horizontal rules
    html = html.replace(/^[-*_]{3,}$/gm, '<hr>');

    // Convert line breaks to paragraphs
    const lines = html.split('\n\n');
    html = lines
      .map((line) => {
        const trimmed = line.trim();
        if (
          trimmed &&
          !trimmed.startsWith('<') &&
          !trimmed.match(/^<\w+>/)
        ) {
          return `<p>${trimmed}</p>`;
        }
        return trimmed;
      })
      .join('\n');

    return parseHTML(html);
  } catch (error) {
    console.error('Error parsing Markdown:', error);
    // Fallback to plain text
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: markdownContent }],
        },
      ],
    };
  }
};

/**
 * Parse content based on its type (HTML, Markdown, or plain text)
 */
export const parseContent = (content: string): JSONContent => {
  if (!content || content.trim() === '') {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const trimmedContent = content.trim();

  if (isHTML(trimmedContent)) {
    return parseHTML(trimmedContent);
  }

  if (isMarkdown(trimmedContent)) {
    return parseMarkdown(trimmedContent);
  }

  // Plain text - wrap in paragraph
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: content }],
      },
    ],
  };
};
