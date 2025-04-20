import React, { useState } from 'react';
import { FileText, Upload, Check, X, AlertCircle } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface GoogleDocsImportButtonProps {
  onImport: (content: string) => void;
}

export function GoogleDocsImportButton({ onImport }: GoogleDocsImportButtonProps) {
  const { systemSettings } = useAppContext();
  const [isImporting, setIsImporting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  const handlePasteFromClipboard = async () => {
    try {
      setIsImporting(true);
      setError(null);
      setSuccess(false);

      // Request clipboard read permission and read HTML content
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        // Check if HTML format is available
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          
          logDebugEvent(
            DebugLevel.INFO,
            DebugEventType.USER_ACTION,
            'Clipboard HTML content retrieved',
            { contentLength: html.length }
          );
          
          // Process the HTML to clean up Google Docs artifacts
          const processedHtml = processGoogleDocsHtml(html);
          
          // Pass the processed HTML to the parent component
          onImport(processedHtml);
          setSuccess(true);
          
          // Reset success message after 3 seconds
          setTimeout(() => {
            setSuccess(false);
          }, 3000);
          
          return;
        }
      }
      
      // If we get here, no HTML content was found
      throw new Error('No HTML content found in clipboard. Please copy content from Google Docs first.');
    } catch (err) {
      console.error('Error importing from clipboard:', err);
      
      // Handle permission errors specifically
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Permission to access clipboard was denied. Please grant clipboard access and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred while importing content');
      }
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.USER_ACTION,
        'Error importing from clipboard',
        { error: err }
      );
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Process Google Docs HTML to clean up artifacts and preserve formatting
   */
  function processGoogleDocsHtml(html: string): string {
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

  return (
    <div className="mb-4">
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
        style={{ color: primaryColor }}
      >
        <FileText className="h-4 w-4 mr-1" />
        Import from Google Docs
      </button>
      
      {showInstructions && (
        <div className="mt-2 p-4 bg-gray-50 rounded-md border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Import from Google Docs</h4>
          
          <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside mb-4">
            <li>Open your Google Doc</li>
            <li>Select the content you want to import</li>
            <li>Copy it to clipboard (Ctrl+C or Cmd+C)</li>
            <li>Click the "Paste from Clipboard" button below</li>
          </ol>
          
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="mb-4 rounded-md bg-green-50 p-3">
              <div className="flex">
                <Check className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm text-green-700">Content imported successfully!</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex space-x-3">
            <button
              onClick={handlePasteFromClipboard}
              disabled={isImporting}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {isImporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Paste from Clipboard
                </>
              )}
            </button>
            
            <button
              onClick={() => setShowInstructions(false)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}