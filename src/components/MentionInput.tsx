import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logDebugEvent, DebugLevel, DebugEventType } from '../lib/debugSystem';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
}

interface User {
  id: string;
  email: string;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Write a comment...',
  className = ''
}: MentionInputProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUsers();
    
    // Add click outside listener to close suggestions
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  async function fetchUsers() {
    try {
      logDebugEvent(
        DebugLevel.INFO,
        DebugEventType.API_CALL,
        'Fetching users for mention suggestions',
        {}
      );
      
      // Get unique users from user_roles table
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, email')
        .order('email');

      if (rolesError) {
        logDebugEvent(
          DebugLevel.ERROR,
          DebugEventType.API_CALL,
          'Error fetching users for mentions',
          { error: rolesError }
        );
        throw rolesError;
      }

      // Create unique user list
      const uniqueUsers = Array.from(
        new Map(userRoles.map(role => [role.user_id, { id: role.user_id, email: role.email }]))
      ).map(([_, user]) => user);

      setUsers(uniqueUsers);
      
      logDebugEvent(
        DebugLevel.SUCCESS,
        DebugEventType.API_CALL,
        'Users fetched for mention suggestions',
        { count: uniqueUsers.length }
      );
    } catch (err) {
      console.error('Error fetching users:', err);
      logDebugEvent(
        DebugLevel.ERROR,
        DebugEventType.API_CALL,
        'Error fetching users for mentions',
        { error: err }
      );
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check if we should show suggestions
    const lastAtSymbol = newValue.lastIndexOf('@', cursorPos);
    if (lastAtSymbol !== -1) {
      const textAfterAt = newValue.slice(lastAtSymbol + 1, cursorPos);
      const spaceAfterAt = textAfterAt.indexOf(' ');
      
      if (spaceAfterAt === -1) {
        setSuggestionFilter(textAfterAt.toLowerCase());
        setShowSuggestions(true);
        return;
      }
    }
    
    setShowSuggestions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Close suggestions on escape
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
    
    // Submit on enter (unless shift is pressed for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      return;
    }
    
    // Navigate suggestions with arrow keys
    if (showSuggestions && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
      e.preventDefault();
      
      // TODO: Add keyboard navigation for suggestions
      // This would require tracking the currently selected suggestion
    }
  }

  function insertMention(email: string) {
    const beforeCursor = value.slice(0, cursorPosition);
    const afterCursor = value.slice(cursorPosition);
    const lastAtSymbol = beforeCursor.lastIndexOf('@');
    
    const newValue = 
      beforeCursor.slice(0, lastAtSymbol) +
      `@${email} ` +
      afterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);

    // Focus back on input
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    logDebugEvent(
      DebugLevel.INFO,
      DebugEventType.USER_ACTION,
      'User inserted mention',
      { mentionedUser: email }
    );
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(suggestionFilter)
  );

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${className}`}
        rows={3}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredUsers.map(user => (
            <button
              key={user.id}
              onClick={() => insertMention(user.email)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {user.email}
            </button>
          ))}
        </div>
      )}
      
      {value.includes('@') && (
        <div className="mt-1 text-xs text-gray-500">
          Use @ to mention users. They will receive an email notification.
        </div>
      )}
    </div>
  );
}