import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Pencil, Tag, Clock, CheckCircle, XCircle, Building2, Briefcase, Users, Link2, History, MessageSquare, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { SOP, SopTag, SopVersion, SopComment, SopReference, SopStatusHistory, SopAccessLevel } from '../lib/types';
import { SopViewer } from '../components/SopViewer';
import { SopStatusChanger } from '../components/SopStatusChanger';
import { SopTagSelector } from '../components/SopTagSelector';
import { SopComments } from '../components/SopComments';
import { SopReferences } from '../components/SopReferences';
import { SopVersionHistory } from '../components/SopVersionHistory';
import { SopAccessLevelButton } from '../components/SopAccessLevelButton';
import { SopAccessLevelHistory } from '../components/SopAccessLevelHistory';
import { RichTextEditor } from '../components/RichTextEditor';
import { useAppContext } from '../lib/AppContext';
import { extractLinksFromHtml } from '../lib/supabase';
import { GoogleDocsImportButton } from '../components/GoogleDocsImportButton';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

export function SopDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const { systemSettings } = useAppContext();
  const [sop, setSop] = useState<SOP | null>(null);
  const [versions, setVersions] = useState<SopVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<SopVersion | null>(null);
  const [comments, setComments] = useState<SopComment[]>([]);
  const [references, setReferences] = useState<SopReference[]>([]);
  const [statusHistory, setStatusHistory] = useState<SopStatusHistory[]>([]);
  const [accessLevelHistory, setAccessLevelHistory] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<SopTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'comments' | 'history' | 'references'>('content');

  // Get theme colors
  const primaryColor = systemSettings?.primary_color || '#EF4444';

  useEffect(() => {
    if (id) {
      fetchSOP();
      fetchVersions();
      fetchComments();
      fetchReferences();
      fetchStatusHistory();
      fetchAccessLevelHistory();
      fetchAvailableTags();
    }
  }, [id]);

  async function fetchSOP() {
    try {
      setIsLoading(true);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching SOP details',
        { sopId: id }
      );
      
      const { data, error } = await supabase
        .from('sops')
        .select(`
          *,
          tags:sop_tag_assignments(
            tag:sop_tags(id, name, color)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Transform tags to expected format
      const transformedSop = {
        ...data,
        tags: data.tags?.map((ta: any) => ta.tag) || []
      };
      
      setSop(transformedSop);
      setSelectedTags(transformedSop.tags.map((tag: SopTag) => tag.id));
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP details fetched successfully',
        { sopId: id }
      );
    } catch (err) {
      console.error('Error fetching SOP:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching SOP details',
        { error: err, sopId: id }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchVersions() {
    try {
      const { data, error } = await supabase
        .from('sop_version_details')
        .select('*')
        .eq('sop_id', id)
        .order('version_number', { ascending: false });

      if (error) throw error;
      
      setVersions(data);
      
      // Set current version to the latest one
      if (data.length > 0) {
        setCurrentVersion(data[0]);
        setEditedContent(data[0].content);
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchComments() {
    try {
      const { data, error } = await supabase
        .from('sop_comments')
        .select('*')
        .eq('sop_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Build comment tree
      const commentMap = new Map();
      const rootComments: SopComment[] = [];
      
      // First pass: create map of all comments
      data.forEach(comment => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });
      
      // Second pass: build the tree
      data.forEach(comment => {
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            parent.replies.push(commentMap.get(comment.id));
          } else {
            rootComments.push(commentMap.get(comment.id));
          }
        } else {
          rootComments.push(commentMap.get(comment.id));
        }
      });
      
      setComments(rootComments);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchReferences() {
    try {
      const { data, error } = await supabase
        .from('sop_references')
        .select('*')
        .eq('sop_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setReferences(data);
    } catch (err) {
      console.error('Error fetching references:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchStatusHistory() {
    try {
      const { data, error } = await supabase
        .from('sop_status_history')
        .select('*')
        .eq('sop_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setStatusHistory(data);
    } catch (err) {
      console.error('Error fetching status history:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchAccessLevelHistory() {
    try {
      const { data, error } = await supabase
        .rpc('get_sop_access_level_history', { p_sop_id: id });

      if (error) throw error;
      setAccessLevelHistory(data || []);
    } catch (err) {
      console.error('Error fetching access level history:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function fetchAvailableTags() {
    try {
      let query = supabase
        .from('sop_tags')
        .select('*')
        .order('name');

      // Filter tags based on user role and selected access level
      if (sop) {
        if (sop.access_level === 'client' && sop.client_id) {
          query = query.eq('access_level', 'client').eq('client_id', sop.client_id);
        } else if (sop.access_level === 'agency' && sop.agency_id) {
          query = query.eq('access_level', 'agency').eq('agency_id', sop.agency_id);
        } else if (sop.access_level === 'system' && sop.system_id) {
          query = query.eq('access_level', 'system').eq('system_id', sop.system_id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (err) {
      console.error('Error fetching available tags:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleSave() {
    if (!user || !sop || !currentVersion) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Saving SOP content',
        { sopId: id }
      );
      
      // Create a new version
      const newVersionNumber = currentVersion.version_number + 1;
      
      const { data: newVersion, error: versionError } = await supabase
        .from('sop_versions')
        .insert([{
          sop_id: sop.id,
          version_number: newVersionNumber,
          content: editedContent,
          created_by: user.id
        }])
        .select()
        .single();

      if (versionError) throw versionError;
      
      // Update SOP updated_at timestamp
      const { error: sopError } = await supabase
        .from('sops')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sop.id);

      if (sopError) throw sopError;
      
      // Update tags
      const { error: tagDeleteError } = await supabase
        .from('sop_tag_assignments')
        .delete()
        .eq('sop_id', sop.id);

      if (tagDeleteError) throw tagDeleteError;
      
      if (selectedTags.length > 0) {
        const tagAssignments = selectedTags.map(tagId => ({
          sop_id: sop.id,
          tag_id: tagId
        }));

        const { error: tagInsertError } = await supabase
          .from('sop_tag_assignments')
          .insert(tagAssignments);

        if (tagInsertError) throw tagInsertError;
      }
      
      // Extract and update references
      const links = extractLinksFromHtml(editedContent);
      
      // Delete existing references
      const { error: refDeleteError } = await supabase
        .from('sop_references')
        .delete()
        .eq('sop_id', sop.id);

      if (refDeleteError) throw refDeleteError;
      
      // Add new references
      if (links.length > 0) {
        const references = links.map(link => ({
          sop_id: sop.id,
          title: link.title || link.url,
          url: link.url,
          created_by: user.id
        }));

        const { error: refInsertError } = await supabase
          .from('sop_references')
          .insert(references);

        if (refInsertError) throw refInsertError;
      }
      
      // Refresh data
      await fetchSOP();
      await fetchVersions();
      await fetchReferences();
      
      // Exit edit mode
      setIsEditing(false);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP content saved successfully',
        { sopId: id, newVersion: newVersionNumber }
      );
    } catch (err) {
      console.error('Error saving SOP:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error saving SOP content',
        { error: err, sopId: id }
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(newStatus: 'draft' | 'review' | 'approved' | 'archived', reason: string) {
    if (!sop) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Changing SOP status',
        { sopId: id, oldStatus: sop.status, newStatus }
      );
      
      // Update SOP status
      const { error: updateError } = await supabase
        .from('sops')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', sop.id);

      if (updateError) throw updateError;
      
      // Create status history entry
      const { error: historyError } = await supabase
        .from('sop_status_history')
        .insert([{
          sop_id: sop.id,
          old_status: sop.status,
          new_status: newStatus,
          changed_by: user?.id,
          reason: reason || null
        }]);

      if (historyError) throw historyError;
      
      // Refresh data
      await fetchSOP();
      await fetchStatusHistory();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP status changed successfully',
        { sopId: id, oldStatus: sop.status, newStatus }
      );
    } catch (err) {
      console.error('Error changing SOP status:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error changing SOP status',
        { error: err, sopId: id }
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddComment(content: string, parentId?: string) {
    if (!user || !sop) return;
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Adding SOP comment',
        { sopId: id, hasParent: !!parentId }
      );
      
      const { data, error } = await supabase
        .from('sop_comments')
        .insert([{
          sop_id: sop.id,
          user_id: user.id,
          user_email: user.email,
          content,
          parent_id: parentId || null
        }])
        .select();

      if (error) throw error;
      
      // Refresh comments
      await fetchComments();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP comment added successfully',
        { sopId: id, commentId: data?.[0]?.id }
      );
      
      return data?.[0]?.id;
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error adding SOP comment',
        { error: err, sopId: id }
      );
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Deleting SOP comment',
        { sopId: id, commentId }
      );
      
      const { error } = await supabase
        .from('sop_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      
      // Refresh comments
      await fetchComments();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP comment deleted successfully',
        { sopId: id, commentId }
      );
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error deleting SOP comment',
        { error: err, sopId: id, commentId }
      );
    }
  }

  async function handleAddReference(title: string, url: string) {
    if (!user || !sop) return;
    
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Adding SOP reference',
        { sopId: id, title, url }
      );
      
      const { error } = await supabase
        .from('sop_references')
        .insert([{
          sop_id: sop.id,
          title,
          url,
          created_by: user.id
        }]);

      if (error) throw error;
      
      // Refresh references
      await fetchReferences();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP reference added successfully',
        { sopId: id, title, url }
      );
    } catch (err) {
      console.error('Error adding reference:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error adding SOP reference',
        { error: err, sopId: id }
      );
    }
  }

  async function handleDeleteReference(referenceId: string) {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Deleting SOP reference',
        { sopId: id, referenceId }
      );
      
      const { error } = await supabase
        .from('sop_references')
        .delete()
        .eq('id', referenceId);

      if (error) throw error;
      
      // Refresh references
      await fetchReferences();
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'SOP reference deleted successfully',
        { sopId: id, referenceId }
      );
    } catch (err) {
      console.error('Error deleting reference:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error deleting SOP reference',
        { error: err, sopId: id, referenceId }
      );
    }
  }

  async function handleViewVersion(versionId: string) {
    try {
      const version = versions.find(v => v.id === versionId);
      if (version) {
        setCurrentVersion(version);
        setEditedContent(version.content);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error viewing version:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  async function handleRestoreVersion(versionId: string) {
    try {
      const version = versions.find(v => v.id === versionId);
      if (version) {
        setCurrentVersion(version);
        setEditedContent(version.content);
        setIsEditing(true);
      }
    } catch (err) {
      console.error('Error restoring version:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  // Handle content import from Google Docs
  const handleImportContent = (importedContent: string) => {
    setEditedContent(importedContent);
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'Content imported from Google Docs',
      { sopId: id, contentLength: importedContent.length }
    );
  };

  // Handle access level change
  const handleAccessLevelChanged = () => {
    fetchSOP();
    fetchAccessLevelHistory();
  };

  // Check if user has permission to edit
  const canEdit = ['system_admin', 'agency_admin', 'client_admin'].includes(role) && 
                 sop?.status !== 'archived';

  // Check if user has permission to change status
  const canChangeStatus = ['system_admin', 'agency_admin', 'client_admin'].includes(role);

  // Check if user has permission to change access level
  const canChangeAccessLevel = ['system_admin', 'agency_admin'].includes(role);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (error || !sop || !currentVersion) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              {error || 'SOP not found'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/sops')}
            className="mr-4 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {sop.title}
            </h2>
            {sop.description && (
              <p className="mt-1 text-sm text-gray-500">{sop.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Status badge */}
          <div className="flex items-center">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
              sop.status === 'draft' ? 'bg-gray-100 text-gray-800' :
              sop.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
              sop.status === 'approved' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {sop.status === 'draft' ? <FileText className="h-3 w-3 mr-1" /> :
               sop.status === 'review' ? <Clock className="h-3 w-3 mr-1" /> :
               sop.status === 'approved' ? <CheckCircle className="h-3 w-3 mr-1" /> :
               <XCircle className="h-3 w-3 mr-1" />}
              {sop.status}
            </span>
          </div>
          
          {/* Access level badge */}
          <div className="flex items-center">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
              sop.access_level === 'system' ? 'bg-purple-100 text-purple-800' :
              sop.access_level === 'agency' ? 'bg-blue-100 text-blue-800' :
              'bg-indigo-100 text-indigo-800'
            }`}>
              {sop.access_level === 'system' ? <Building2 className="h-3 w-3 mr-1" /> :
               sop.access_level === 'agency' ? <Briefcase className="h-3 w-3 mr-1" /> :
               <Users className="h-3 w-3 mr-1" />}
              {sop.access_level}
            </span>
          </div>
          
          {/* Status changer */}
          {canChangeStatus && (
            <SopStatusChanger
              currentStatus={sop.status}
              onStatusChange={handleStatusChange}
            />
          )}
          
          {/* Access level changer button */}
          {canChangeAccessLevel && (
            <SopAccessLevelButton
              sopId={sop.id}
              currentAccessLevel={sop.access_level}
              currentEntityId={
                sop.access_level === 'system' ? sop.system_id :
                sop.access_level === 'agency' ? sop.agency_id :
                sop.client_id
              }
              onAccessLevelChanged={handleAccessLevelChanged}
            />
          )}
          
          {/* Edit button */}
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </button>
          )}
          
          {/* Save button */}
          {isEditing && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </button>
          )}
          
          {/* Cancel button */}
          {isEditing && (
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedContent(currentVersion.content);
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {sop.tags && sop.tags.length > 0 ? (
          sop.tags.map((tag: SopTag) => (
            <span 
              key={tag.id}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              <Tag className="h-3 w-3 mr-1" />
              {tag.name}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-500">No tags</span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('content')}
            className={`${
              activeTab === 'content'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            style={activeTab === 'content' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            Content
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`${
              activeTab === 'comments'
                ?'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'comments' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Comments
          </button>
          <button
            onClick={() => setActiveTab('references')}
            className={`${
              activeTab === 'references'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'references' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <Link2 className="h-4 w-4 mr-2" />
            References
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            style={activeTab === 'history' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              {/* Tag selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <SopTagSelector
                  availableTags={availableTags}
                  selectedTags={selectedTags}
                  onChange={setSelectedTags}
                  accessLevel={sop.access_level}
                />
              </div>
              
              {/* Google Docs Import Button */}
              <GoogleDocsImportButton onImport={handleImportContent} />
              
              {/* Rich text editor */}
              <RichTextEditor
                content={editedContent}
                onChange={setEditedContent}
                placeholder="Enter SOP content here..."
              />
            </div>
          ) : (
            <SopViewer content={currentVersion.content} />
          )}
        </div>
      )}

      {/* Comments */}
      {activeTab === 'comments' && (
        <SopComments
          comments={comments}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
        />
      )}

      {/* References */}
      {activeTab === 'references' && (
        <SopReferences
          references={references}
          isEditing={isEditing}
          onAddReference={handleAddReference}
          onDeleteReference={handleDeleteReference}
        />
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Version History</h3>
            <SopVersionHistory
              versions={versions}
              statusHistory={statusHistory}
              onViewVersion={handleViewVersion}
              onRestoreVersion={handleRestoreVersion}
            />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Access Level History</h3>
            <SopAccessLevelHistory history={accessLevelHistory} />
          </div>
        </div>
      )}
    </div>
  );
}