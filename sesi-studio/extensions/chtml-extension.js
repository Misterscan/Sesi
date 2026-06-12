/* 
{
  "name": "ClearHTML Support",
  "version": "1.0.0",
  "description": "Provides rich hover documentation and link navigation for CHTML files.",
  "icon": "extensions/assets/Clear-HTML-Support.svg",
  "commands": ["Show Docs", "Navigate Path"]
}
*/
/* Sesi Studio Extension: ClearHTML (CHTML) Support */
(function() {
  const CHTML_DOCS = {
    'document': {
      html: '<html>',
      desc: 'The root container for the document. Represents the outer page layout wrapper.',
      example: 'document language="en" {\n  metadata { ... }\n  page { ... }\n}'
    },
    'metadata': {
      html: '<head>',
      desc: 'Container for metadata definitions such as page title, character encoding, or styles.',
      example: 'metadata {\n  character-encoding "utf-8"\n  page-title "My Site"\n}'
    },
    'page': {
      html: '<body>',
      desc: 'The main wrapper containing all visible page structure and visual content.',
      example: 'page {\n  page-header { ... }\n  main-content { ... }\n}'
    },
    'page-header': {
      html: '<header>',
      desc: 'A header section containing site logos, headings, or main navigation links.',
      example: 'page-header {\n  heading level=1 "My Site"\n}'
    },
    'navigation': {
      html: '<nav>',
      desc: 'Represents a block containing navigation links.',
      example: 'navigation {\n  link to="/home" "Home"\n  link to="/about" "About"\n}'
    },
    'main-content': {
      html: '<main>',
      desc: 'The main content area of the document. Should contain unique main content.',
      example: 'main-content {\n  content-section { ... }\n}'
    },
    'content-section': {
      html: '<section>',
      desc: 'A thematic group of content, typically with a heading.',
      example: 'content-section {\n  heading level=2 "Features"\n  paragraph "Content here..."\n}'
    },
    'article-content': {
      html: '<article>',
      desc: 'A self-contained composition (e.g. blog post, news story, forum post).',
      example: 'article-content {\n  heading level=2 "Post Title"\n  paragraph "Article body..."\n}'
    },
    'complementary-content': {
      html: '<aside>',
      desc: 'Content that is tangentially related to the main content (e.g. sidebars, callouts).',
      example: 'complementary-content {\n  heading level=3 "Quick Info"\n}'
    },
    'page-footer': {
      html: '<footer>',
      desc: 'The footer of the page or section, containing copyrights, links, or contact info.',
      example: 'page-footer {\n  paragraph "© 2026 Company Inc."\n}'
    },
    'group': {
      html: '<div>',
      desc: 'A generic structural flow container with no semantic meaning of its own.',
      example: 'group style-group="card" {\n  paragraph "Card contents"\n}'
    },
    'heading': {
      html: '<h1> - <h6>',
      desc: 'A section heading. Level is specified by the `level` attribute (1-6).',
      example: 'heading level=1 "Main Title"\nheading level=2 "Section Title"'
    },
    'paragraph': {
      html: '<p>',
      desc: 'A block-level paragraph of text.',
      example: 'paragraph "This is a body paragraph containing prose."'
    },
    'link': {
      html: '<a>',
      desc: 'A hyperlink. Target URL is specified by the `to` attribute.',
      example: 'link to="https://example.com" "Visit Site"'
    },
    'image': {
      html: '<img>',
      desc: 'An image element. Source path/URL is specified by `source` and alt text by `description`.',
      example: 'image source="logo.png" description="Company Logo" width="200" height="100"'
    },
    'list': {
      html: '<ul> or <ol>',
      desc: 'A list container. Type is specified by `type` ("bulleted" or "numbered").',
      example: 'list type="bulleted" {\n  item "First item"\n  item "Second item"\n}'
    },
    'item': {
      html: '<li>',
      desc: 'A single item inside a list.',
      example: 'item "List entry item"'
    },
    'submit-button': {
      html: '<button type="submit">',
      desc: 'A button used to submit a form or trigger actions.',
      example: 'submit-button "Save Changes"'
    },
    'label': {
      html: '<label>',
      desc: 'A label for a form input element.',
      example: 'label "Enter your email"'
    },
    'character-encoding': {
      html: '<meta charset="...">',
      desc: 'Declares the document\'s character encoding.',
      example: 'character-encoding "utf-8"'
    },
    'page-title': {
      html: '<title>',
      desc: 'Defines the document\'s title, which is shown in the browser\'s title bar.',
      example: 'page-title "My Project"'
    }
  };

  function initCHTMLIntelligence() {
    if (!window.monaco) return;

    // 1. Hover Provider for CHTML
    monaco.languages.registerHoverProvider('chtml', {
      provideHover: function(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        
        const doc = CHTML_DOCS[word.word];
        if (doc) {
          return {
            contents: [
              { value: `### ClearHTML: **${word.word}**` },
              { value: `Compiles to: \`${doc.html}\`` },
              { value: `**Description:** ${doc.desc}` },
              { value: `**Example:**\n\`\`\`chtml\n${doc.example}\n\`\`\`` }
            ]
          };
        }
        return null;
      }
    });

    // 2. Link Provider for clickable paths
    monaco.languages.registerLinkProvider('chtml', {
      provideLinks: function(model) {
        const links = [];
        const text = model.getValue();
        const pattern = /\b(to|source)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"}]+))/g;
        let match;

        while ((match = pattern.exec(text)) !== null) {
          const urlStr = match[2] ?? match[3] ?? match[4];
          if (!urlStr) continue;

          // Simple detection of web links vs local files
          const isWeb = urlStr.startsWith('http') || urlStr.startsWith('mailto');
          
          const startOffset = match.index + match[0].indexOf(urlStr);
          const startPos = model.getPositionAt(startOffset);
          const endPos = model.getPositionAt(startOffset + urlStr.length);

          links.push({
            range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
            url: isWeb ? urlStr : undefined, // If local, we handle via custom logic if possible
            tooltip: isWeb ? 'Open link' : 'Local file reference'
          });
        }
        return { links };
      }
    });

    console.log('💎 ClearHTML Extension loaded.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCHTMLIntelligence);
  } else {
    initCHTMLIntelligence();
  }
})();
