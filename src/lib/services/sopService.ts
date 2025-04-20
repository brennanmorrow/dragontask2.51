import { supabase } from '../supabase';
import { SOP, SopTag, SopVersion, SopComment, SopReference, SopStatusHistory, SopAccessLevel } from '../types';
import { logDebugEvent, DebugLevel, DebugEventType } from '../debugSystem';

/**
 * Fetch SOPs with filtering options
 */
export async function fetchSOPs(options: {
  clientId?: string;
  agencyId?: string;
  systemId?: string;
  status?: string[];
  accessLevel?: SopAccessLevel[];
  tags?: string[];
  searchTerm?: string;
}) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Fetching SOPs',
      options
    );
    
    let query = supabase
      .from('sops')
      .select(`
        *,
        tags:sop_tag_assignments(
          tag:sop_tags(id, name, color)
        )
      `);
    
    // Apply filters
    if (options.clientId) {
      query = query.eq('client_id', options.clientId);
    }
    
    if (options.agencyId) {
      query = query.eq('agency_id', options.agencyId);
    }
    
    if (options.systemId) {
      query = query.eq('system_id', options.systemId);
    }
    
    if (options.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }
    
    if (options.accessLevel && options.accessLevel.length > 0) {
      query = query.in('access_level', options.accessLevel);
    }
    
    if (options.searchTerm) {
      query = query.or(`title.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%`);
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    // Transform tags to expected format
    const transformedSops = data?.map(sop => ({
      ...sop,
      tags: sop.tags?.map((ta: any) => ta.tag) || []
    })) || [];
    
    // Filter by tags if needed
    if (options.tags && options.tags.length > 0) {
      return transformedSops.filter(sop => 
        options.tags!.every(tagId => 
          sop.tags.some((tag: SopTag) => tag.id === tagId)
        )
      );
    }
    
    return transformedSops;
  } catch (err) {
    console.error('Error fetching SOPs:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching SOPs',
      { error: err }
    );
    throw err;
  }
}

/**
 * Fetch a single SOP by ID
 */
export async function fetchSOP(id: string) {
  try {
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
    
    return transformedSop;
  } catch (err) {
    console.error('Error fetching SOP:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching SOP details',
      { error: err, sopId: id }
    );
    throw err;
  }
}

/**
 * Fetch SOP versions
 */
export async function fetchSopVersions(sopId: string) {
  try {
    const { data, error } = await supabase
      .from('sop_version_details')
      .select('*')
      .eq('sop_id', sopId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error('Error fetching SOP versions:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error fetching SOP versions',
      { error: err, sopId }
    );
    throw err;
  }
}

/**
 * Create a new SOP
 */
export async function createSOP(sopData: {
  title: string;
  description?: string;
  access_level: SopAccessLevel;
  system_id?: string;
  agency_id?: string;
  client_id?: string;
  created_by: string;
  content?: string;
  tags?: string[];
}) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Creating new SOP',
      { title: sopData.title, accessLevel: sopData.access_level }
    );
    
    // Create the SOP
    const { data: newSop, error: sopError } = await supabase
      .from('sops')
      .insert([{
        title: sopData.title,
        description: sopData.description || null,
        status: 'draft',
        created_by: sopData.created_by,
        access_level: sopData.access_level,
        system_id: sopData.system_id,
        agency_id: sopData.agency_id,
        client_id: sopData.client_id
      }])
      .select()
      .single();

    if (sopError) throw sopError;
    
    // If content is provided, update the initial version
    if (sopData.content) {
      const { error: versionError } = await supabase
        .from('sop_versions')
        .update({ content: sopData.content })
        .eq('sop_id', newSop.id)
        .eq('version_number', 1);

      if (versionError) throw versionError;
    }
    
    // Add tags if provided
    if (sopData.tags && sopData.tags.length > 0) {
      const tagAssignments = sopData.tags.map(tagId => ({
        sop_id: newSop.id,
        tag_id: tagId
      }));

      const { error: tagError } = await supabase
        .from('sop_tag_assignments')
        .insert(tagAssignments);

      if (tagError) throw tagError;
    }
    
    return newSop;
  } catch (err) {
    console.error('Error creating SOP:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error creating SOP',
      { error: err }
    );
    throw err;
  }
}

/**
 * Update SOP status
 */
export async function updateSopStatus(
  sopId: string, 
  newStatus: 'draft' | 'review' | 'approved' | 'archived', 
  reason?: string
) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Updating SOP status',
      { sopId, newStatus, reason }
    );
    
    // Get current status
    const { data: currentSop, error: fetchError } = await supabase
      .from('sops')
      .select('status')
      .eq('id', sopId)
      .single();
      
    if (fetchError) throw fetchError;
    
    // Update SOP status
    const { error: updateError } = await supabase
      .from('sops')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', sopId);

    if (updateError) throw updateError;
    
    // Create status history entry
    const { error: historyError } = await supabase
      .from('sop_status_history')
      .insert([{
        sop_id: sopId,
        old_status: currentSop.status,
        new_status: newStatus,
        changed_by: (await supabase.auth.getUser()).data.user?.id,
        reason: reason || null
      }]);

    if (historyError) throw historyError;
    
    return true;
  } catch (err) {
    console.error('Error updating SOP status:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error updating SOP status',
      { error: err, sopId }
    );
    throw err;
  }
}

/**
 * Create a new SOP version
 */
export async function createSopVersion(
  sopId: string,
  content: string,
  userId: string
) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Creating new SOP version',
      { sopId }
    );
    
    // Get the latest version number
    const { data: versions, error: versionError } = await supabase
      .from('sop_versions')
      .select('version_number')
      .eq('sop_id', sopId)
      .order('version_number', { ascending: false })
      .limit(1);
      
    if (versionError) throw versionError;
    
    const newVersionNumber = versions && versions.length > 0 
      ? versions[0].version_number + 1 
      : 1;
    
    // Create new version
    const { data: newVersion, error: createError } = await supabase
      .from('sop_versions')
      .insert([{
        sop_id: sopId,
        version_number: newVersionNumber,
        content,
        created_by: userId
      }])
      .select()
      .single();

    if (createError) throw createError;
    
    // Update SOP updated_at timestamp
    const { error: updateError } = await supabase
      .from('sops')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sopId);

    if (updateError) throw updateError;
    
    return newVersion;
  } catch (err) {
    console.error('Error creating SOP version:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error creating SOP version',
      { error: err, sopId }
    );
    throw err;
  }
}

/**
 * Change SOP access level
 */
export async function changeSopAccessLevel(
  sopId: string,
  newAccessLevel: SopAccessLevel,
  newEntityId: string,
  reason?: string
) {
  try {
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.API_CALL,
      'Changing SOP access level',
      { sopId, newAccessLevel, newEntityId, reason }
    );
    
    const { error } = await supabase.rpc(
      'change_sop_access_level',
      {
        p_sop_id: sopId,
        p_new_access_level: newAccessLevel,
        p_new_entity_id: newEntityId,
        p_reason: reason || null
      }
    );

    if (error) throw error;
    
    return true;
  } catch (err) {
    console.error('Error changing SOP access level:', err);
    logDebugEvent(
      DebugLevel.ERROR,
      DebugEventType.API_CALL,
      'Error changing SOP access level',
      { error: err, sopId }
    );
    throw err;
  }
}