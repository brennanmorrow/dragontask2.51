import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

/**
 * Custom extension for TipTap to handle Google Docs paste events
 * This extension intercepts paste events from Google Docs and processes them
 * to maintain formatting while cleaning up unwanted artifacts
 */
export const GoogleDocsPasteHandler = Extension.create({
  name: 'googleDocsPasteHandler',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('googleDocsPasteHandler'),
        props: {
          handlePaste: (view, event, slice) => {
            // Check if the paste event contains HTML (which Google Docs will)
            const html = event.clipboardData?.getData('text/html');
            if (!html) return false;

            // Check if this is likely from Google Docs
            const isGoogleDocs = html.includes('id="docs-internal-guid') || 
                                html.includes('google-docs') || 
                                html.includes('googleusercontent');

            logDebugEvent(
              DebugLevel.INFO,
              DebugEventType.USER_ACTION,
              'Paste event detected',
              { 
                isGoogleDocs,
                contentLength: html.length,
                hasHtml: true
              }
            );

            if (!isGoogleDocs) return false;

            // Process the HTML to clean up Google Docs artifacts
            const cleanedHtml = processGoogleDocsHtml(html);
            
            try {
              // Create a temporary div to parse the HTML
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = cleanedHtml;
              
              // Get the content as a document fragment
              const fragment = view.state.schema.dom.parseFragment(tempDiv);
              
              // Insert the content at the current cursor position
              const { tr } = view.state;
              
              // Replace the selection with our fragment
              const transaction = tr.replaceSelection(slice.content);
              view.dispatch(transaction);
              
              logDebugEvent(
                DebugLevel.SUCCESS,
                DebugEventType.USER_ACTION,
                'Google Docs content pasted successfully',
                { contentLength: cleanedHtml.length }
              );
              
              return true;
            } catch (error) {
              logDebugEvent(
                DebugLevel.ERROR,
                DebugEventType.USER_ACTION,
                'Error processing pasted content',
                { error }
              );
              
              // If there's an error, fall back to the default paste handler
              return false;
            }
          },
        },
      }),
    ];
  },
});

/**
 * Process Google Docs HTML to clean up artifacts and preserve formatting
 */
function processGoogleDocsHtml(html: string): string {
  // Log the original HTML for debugging
  logDebugEvent(
    DebugLevel.INFO,
    DebugEventType.DATA_PROCESSING,
    'Processing Google Docs HTML',
    { originalLength: html.length }
  );

  // Remove Google Docs specific styles and attributes
  let cleanedHtml = html
    // Remove Google Docs internal IDs
    .replace(/id="docs-internal-guid-[^"]*"/g, '')
    
    // Remove Google-specific style classes
    .replace(/class="[^"]*google-[^"]*"/g, '')
    
    // Clean up excessive inline styles but preserve important ones
    .replace(/style="([^"]*)"/g, (match, styles) => {
      // Keep only essential styles
      const essentialStyles = styles
        .split(';')
        .filter((style: string) => {
          const prop = style.split(':')[0]?.trim();
          return prop && [
            'font-weight', 'font-style', 'text-decoration', 
            'color', 'background-color', 'text-align'
          ].includes(prop);
        })
        .join(';');
      
      return essentialStyles ? `style="${essentialStyles}"` : '';
    })
    
    // Fix list formatting
    .replace(/<p([^>]*)>(\s*)<span([^>]*)>([0-9]+)\.\s*<\/span>/g, '<li$1><span$3>$4. </span>')
    .replace(/<p([^>]*)>(\s*)<span([^>]*)>•\s*<\/span>/g, '<li$1><span$3>• </span>')
    
    // Convert Google Docs tables to standard HTML tables
    .replace(/<table([^>]*)border="0"([^>]*)>/g, '<table$1border="1"$2>')
    
    // Fix heading styles
    .replace(/<p([^>]*)style="([^"]*)font-size:\s*([0-9]+)pt([^"]*)"/g, (match, p1, p2, size, p3) => {
      const fontSize = parseInt(size);
      if (fontSize >= 20) return `<h1${p1}>`;
      if (fontSize >= 16) return `<h2${p1}>`;
      if (fontSize >= 14) return `<h3${p1}>`;
      return match; // Keep original if not a heading size
    });
  
  // Handle images - preserve them but ensure they're properly formatted
  cleanedHtml = cleanedHtml.replace(/<img([^>]*)>/g, (match, attributes) => {
    // Ensure images have max-width for responsiveness
    if (!attributes.includes('style=')) {
      return `<img${attributes} style="max-width: 100%; height: auto;">`;
    }
    return match;
  });

  // Log the cleaning process
  logDebugEvent(
    DebugLevel.INFO,
    DebugEventType.DATA_PROCESSING,
    'Google Docs HTML cleaned',
    { 
      originalLength: html.length, 
      cleanedLength: cleanedHtml.length,
      reductionPercentage: ((html.length - cleanedHtml.length) / html.length * 100).toFixed(2) + '%'
    }
  );

  return cleanedHtml;
}