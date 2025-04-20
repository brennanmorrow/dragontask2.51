import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Upload, Trash2, FileText, Download, File, Image, Film, Music, Archive, Code, Database, FileSpreadsheet, WholeWord as FileWord, File as FilePdf } from 'lucide-react';
import { TaskAttachment } from '../lib/types';
import { useAuthStore } from '../lib/store';
import { formatFileSize } from '../lib/supabase';

interface TaskAttachmentsProps {
  attachments: TaskAttachment[];
  onAddAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}

export function TaskAttachments({ attachments, onAddAttachment, onDeleteAttachment }: TaskAttachmentsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    // Add file size check (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      await onAddAttachment(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while uploading the file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Function to get the appropriate icon based on file type
  const getFileIcon = (fileType: string, fileName: string) => {
    // Check file extension first (more reliable for some file types)
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') return <FilePdf className="h-5 w-5 text-red-500" />;
    if (['doc', 'docx'].includes(extension || '')) return <FileWord className="h-5 w-5 text-blue-500" />;
    if (['xls', 'xlsx', 'csv'].includes(extension || '')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    
    // Then check MIME type
    if (fileType.startsWith('image/')) return <Image className="h-5 w-5 text-purple-500" />;
    if (fileType.startsWith('video/')) return <Film className="h-5 w-5 text-pink-500" />;
    if (fileType.startsWith('audio/')) return <Music className="h-5 w-5 text-yellow-500" />;
    if (fileType.includes('zip') || fileType.includes('compressed') || fileType.includes('archive')) 
      return <Archive className="h-5 w-5 text-gray-500" />;
    if (fileType.includes('json') || fileType.includes('xml') || fileType.includes('html')) 
      return <Code className="h-5 w-5 text-indigo-500" />;
    if (fileType.includes('sql') || fileType.includes('database')) 
      return <Database className="h-5 w-5 text-blue-700" />;
    
    // Default file icon
    return <File className="h-5 w-5 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Attachments</h3>
      
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Upload area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-4 text-center
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          transition-all duration-200
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Uploading...</span>
          </div>
        ) : (
          <div>
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label
                htmlFor="file-upload"
                className="cursor-pointer rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Upload File
              </label>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileInput}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Drag and drop any file here, or click to select
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Maximum file size: 50MB
            </p>
          </div>
        )}
      </div>

      {/* Attachments list */}
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {getFileIcon(attachment.type, attachment.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{attachment.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {formatFileSize(attachment.size)} • {attachment.type.split('/')[1]?.toUpperCase() || attachment.type} • 
                  Uploaded by {attachment.user_email} on {format(new Date(attachment.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <a
                href={attachment.url}
                download={attachment.name}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
                title="Download"
              >
                <Download className="h-5 w-5" />
              </a>
              {user?.id === attachment.user_id && (
                <button
                  onClick={() => onDeleteAttachment(attachment.id)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-200"
                  title="Delete"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {attachments.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <FileText className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No attachments</h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload files to share with the team
            </p>
          </div>
        )}
      </div>
    </div>
  );
}