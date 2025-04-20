import React, { useEffect } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  Heading1, Heading2, Heading3, List, ListOrdered, 
  Image as ImageIcon, Table as TableIcon, 
  Highlighter, Palette, Undo, Redo, 
  ChevronDown, Plus, Check, X
} from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { GoogleDocsPasteHandler } from './GoogleDocsPasteHandler';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function RichTextEditor({ content, onChange, placeholder = 'Start writing...', readOnly = false }: RichTextEditorProps) {
  const { systemSettings } = useAppContext();
  
  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';
  const secondaryColor = systemSettings?.secondary_color || '#B91C1C';
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Image.configure({
        allowBase64: false,
        inline: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder,
      }),
      // Add the Google Docs paste handler
      GoogleDocsPasteHandler,
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      
      // Log content updates for debugging
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'Rich text content updated',
        { contentLength: editor.getHTML().length }
      );
    },
    onPaste: ({ editor, event }) => {
      // Safely check for clipboardData
      if (!event?.clipboardData) {
        logDebugEvent(
          DebugLevel.INFO,
          DebugEventType.USER_ACTION,
          'Paste event without clipboard data',
          { eventType: event?.type }
        );
        return false;
      }

      // Log paste events for debugging
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.USER_ACTION,
        'Content pasted into editor',
        { 
          hasHtml: event.clipboardData.types.includes('text/html'),
          hasText: event.clipboardData.types.includes('text/plain'),
          types: event.clipboardData.types.join(', ')
        }
      );
      
      // Let the paste handler extensions handle the actual paste
      return false;
    }
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt('Enter the URL of the image:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter the URL:', previousUrl);
    
    // cancelled
    if (url === null) {
      return;
    }
    
    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const setColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
  };

  const setHighlight = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
  };

  const colors = [
    '#EF4444', // red
    '#F97316', // orange
    '#EAB308', // yellow
    '#22C55E', // green
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#000000', // black
  ];

  const highlights = [
    '#FEF08A', // yellow
    '#BBF7D0', // green
    '#BFDBFE', // blue
    '#FBCFE8', // pink
  ];

  return (
    <div className="rich-text-editor border border-gray-300 rounded-lg overflow-hidden">
      {!readOnly && (
        <div className="bg-gray-50 border-b border-gray-300 p-2 flex flex-wrap gap-1 items-center">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded ${editor.isActive('underline') ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded ${editor.isActive('strike') ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded ${editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-1.5 rounded ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-1.5 rounded ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-1.5 rounded ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-1.5 rounded ${editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Justify"
          >
            <AlignJustify className="h-4 w-4" />
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button
            onClick={setLink}
            className={`p-1.5 rounded ${editor.isActive('link') ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            onClick={addImage}
            className="p-1.5 rounded hover:bg-gray-200"
            title="Add Image"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            onClick={addTable}
            className="p-1.5 rounded hover:bg-gray-200"
            title="Add Table"
          >
            <TableIcon className="h-4 w-4" />
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <div className="relative group">
            <button
              className="p-1.5 rounded hover:bg-gray-200 flex items-center"
              title="Text Color"
            >
              <Palette className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-1" />
            </button>
            <div className="absolute hidden group-hover:flex flex-wrap gap-1 bg-white shadow-lg rounded p-2 z-10 top-full left-0 w-32">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setColor(color)}
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: color }}
                  title={`Set text color to ${color}`}
                />
              ))}
            </div>
          </div>
          
          <div className="relative group">
            <button
              className="p-1.5 rounded hover:bg-gray-200 flex items-center"
              title="Highlight"
            >
              <Highlighter className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-1" />
            </button>
            <div className="absolute hidden group-hover:flex flex-wrap gap-1 bg-white shadow-lg rounded p-2 z-10 top-full left-0 w-32">
              {highlights.map(color => (
                <button
                  key={color}
                  onClick={() => setHighlight(color)}
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: color }}
                  title={`Highlight with ${color}`}
                />
              ))}
              <button
                onClick={() => editor.chain().focus().unsetHighlight().run()}
                className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center"
                title="Remove highlight"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>
      )}
      
      <EditorContent 
        editor={editor} 
        className={`prose max-w-none p-4 min-h-[300px] ${readOnly ? 'cursor-default' : ''}`}
      />
      
      {!readOnly && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 ${editor.isActive('underline') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <UnderlineIcon className="h-4 w-4" />
            </button>
            <button
              onClick={setLink}
              className={`p-1.5 ${editor.isActive('link') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <LinkIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              className={`p-1.5 ${editor.isActive('highlight') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <Highlighter className="h-4 w-4" />
            </button>
          </div>
        </BubbleMenu>
      )}
      
      {!readOnly && (
        <FloatingMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className="p-1.5 hover:bg-gray-100"
            >
              <Heading1 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className="p-1.5 hover:bg-gray-100"
            >
              <Heading2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="p-1.5 hover:bg-gray-100"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className="p-1.5 hover:bg-gray-100"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <button
              onClick={addImage}
              className="p-1.5 hover:bg-gray-100"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>
        </FloatingMenu>
      )}
    </div>
  );
}