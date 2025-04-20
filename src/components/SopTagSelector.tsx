import React, { useState } from 'react';
import { Plus, X, Tag, Building2, Briefcase, Users } from 'lucide-react';
import { SopTag, SopAccessLevel } from '../lib/types';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

interface SopTagSelectorProps {
  availableTags: SopTag[];
  selectedTags: string[];
  onChange: (selectedTags: string[]) => void;
  accessLevel?: SopAccessLevel;
}

export function SopTagSelector({ availableTags, selectedTags, onChange, accessLevel = 'client' }: SopTagSelectorProps) {
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#94A3B8');
  const [error, setError] = useState<string | null>(null);
  const { clientId, agencyId, systemId, role } = useAuthStore();

  const canCreateTags = ['system_admin', 'agency_admin', 'client_admin'].includes(role);

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId));
    } else {
      onChange([...selectedTags, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name is required');
      return;
    }

    // Determine which ID to use based on access level
    let entityId: string | null = null;
    if (accessLevel === 'client') {
      entityId = clientId;
      if (!entityId) {
        setError('Client ID is required to create a tag');
        return;
      }
    } else if (accessLevel === 'agency') {
      entityId = agencyId;
      if (!entityId) {
        setError('Agency ID is required to create a tag');
        return;
      }
    } else if (accessLevel === 'system') {
      entityId = systemId;
      if (!entityId) {
        setError('System ID is required to create a tag');
        return;
      }
    }

    try {
      setError(null);
      
      const tagData: any = {
        name: newTagName.trim(),
        color: newTagColor,
        access_level: accessLevel
      };

      // Set the appropriate ID based on access level
      if (accessLevel === 'system') {
        tagData.system_id = entityId;
      } else if (accessLevel === 'agency') {
        tagData.agency_id = entityId;
      } else {
        tagData.client_id = entityId;
      }

      const { data, error } = await supabase
        .from('sop_tags')
        .insert([tagData])
        .select()
        .single();

      if (error) throw error;

      // Add the new tag to available tags
      availableTags.push(data);
      
      // Select the new tag
      onChange([...selectedTags, data.id]);
      
      // Reset form
      setNewTagName('');
      setNewTagColor('#94A3B8');
      setIsCreatingTag(false);
    } catch (err) {
      console.error('Error creating tag:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getAccessLevelIcon = (tag: SopTag) => {
    if (!tag.access_level) return null;
    
    switch (tag.access_level) {
      case 'system':
        return <Building2 className="h-3 w-3 ml-1 text-purple-500" title="System-wide tag" />;
      case 'agency':
        return <Briefcase className="h-3 w-3 ml-1 text-blue-500" title="Agency-level tag" />;
      case 'client':
        return <Users className="h-3 w-3 ml-1 text-indigo-500" title="Client-level tag" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Selected and available tags */}
      <div className="flex flex-wrap gap-2">
        {availableTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleTagToggle(tag.id)}
            className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ${
              selectedTags.includes(tag.id)
                ? 'ring-2 ring-offset-1'
                : ''
            }`}
            style={{
              backgroundColor: `${tag.color}20`, // 20% opacity
              color: tag.color,
              ringColor: selectedTags.includes(tag.id) ? tag.color : undefined
            }}
          >
            <Tag className="h-3 w-3 mr-1" />
            {tag.name}
            {getAccessLevelIcon(tag)}
          </button>
        ))}
        
        {availableTags.length === 0 && !isCreatingTag && (
          <span className="text-sm text-gray-500">No tags available</span>
        )}
        
        {canCreateTags && !isCreatingTag && (
          <button
            type="button"
            onClick={() => setIsCreatingTag(true)}
            className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <Plus className="h-3 w-3 mr-1" />
            Create Tag
          </button>
        )}
      </div>

      {/* Create tag form */}
      {isCreatingTag && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
          
          <div className="flex items-center space-x-4">
            <div className="flex-grow">
              <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700">
                Tag Name
              </label>
              <input
                type="text"
                id="tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Enter tag name"
              />
            </div>
            
            <div>
              <label htmlFor="tag-color" className="block text-sm font-medium text-gray-700">
                Color
              </label>
              <div className="mt-1 flex items-center">
                <input
                  type="color"
                  id="tag-color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-8 w-8 rounded border border-gray-300"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCreatingTag(false)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              <X className="h-4 w-4 inline-block mr-1" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateTag}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 inline-block mr-1" />
              Create Tag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}