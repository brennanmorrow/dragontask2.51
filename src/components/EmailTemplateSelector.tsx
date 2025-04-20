import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Check, RefreshCw } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  description: string;
  variables: string[];
}

interface EmailTemplateSelectorProps {
  onSelect: (templateId: string, templateName: string) => void;
  selectedTemplateId?: string;
}

export function EmailTemplateSelector({ onSelect, selectedTemplateId }: EmailTemplateSelectorProps) {
  const { systemSettings } = useAppContext();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching email templates',
        {}
      );
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, description, variables')
        .order('name');
      
      if (error) throw error;
      
      setTemplates(data || []);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Email templates fetched successfully',
        { count: data?.length || 0 }
      );
    } catch (err) {
      console.error('Error fetching email templates:', err);
      setError('Failed to load email templates');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching email templates',
        { error: err }
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map(template => (
        <div 
          key={template.id} 
          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
            selectedTemplateId === template.id 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
          }`}
          style={selectedTemplateId === template.id ? { 
            borderColor: primaryColor, 
            backgroundColor: `${primaryColor}10` 
          } : {}}
          onClick={() => onSelect(template.id, template.name)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <FileText className="h-4 w-4 text-gray-500 mr-2" />
              <h3 className="text-sm font-medium text-gray-900">{template.name}</h3>
            </div>
            {selectedTemplateId === template.id && (
              <Check className="h-4 w-4" style={{ color: primaryColor }} />
            )}
          </div>
          <p className="text-xs text-gray-500 mb-2">{template.description}</p>
          <div className="text-xs text-gray-500">
            <strong>Variables:</strong> {template.variables.join(', ')}
          </div>
        </div>
      ))}
    </div>
  );
}