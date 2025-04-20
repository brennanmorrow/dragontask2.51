# TaskMaster System Architecture Notes

## Overview
TaskMaster is a multi-tenant task management system with a hierarchical structure:
- Systems (top level)
- Agencies (belong to systems)
- Clients (belong to agencies)
- Users (can belong to any level)
- Tasks (belong to clients)

## User Roles
1. System Admin
   - Can manage all systems, agencies, clients, and users
   - Full access to everything in their system

2. Agency Admin
   - Can manage their agency settings
   - Can manage clients under their agency
   - Can manage users for their agency and clients

3. Client Admin
   - Can manage users within their client
   - Can manage tasks for their client

4. Client User
   - Can view and manage assigned tasks
   - Limited to their client's scope

## Database Structure

### Core Tables
1. `systems`
   - Primary container for agencies
   - Fields: id, name, created_at, updated_at

2. `agencies`
   - Belongs to a system
   - Fields: id, system_id, name, logo_url, colors, fonts, created_at, updated_at

3. `clients`
   - Belongs to an agency
   - Fields: id, agency_id, name, created_at, updated_at

4. `tasks`
   - Belongs to a client
   - Fields: id, client_id, agency_id, title, description, status, assigned_to, due_date, created_at, updated_at

5. `user_roles`
   - Manages user permissions and relationships
   - Fields: id, user_id, role, system_id, agency_id, client_id, created_at

### Key Features
1. Task Management
   - Kanban board interface
   - Drag-and-drop functionality
   - Task statuses: pending, in_progress, completed, cancelled
   - Task assignment and due dates

2. User Management
   - Role-based access control
   - User suspension capabilities
   - Email-based authentication

3. Agency Customization
   - Custom logos
   - Color schemes
   - Font selections

4. Client Management
   - Client-specific dashboards
   - Task tracking and statistics
   - User management within client scope

## Technical Stack
- Frontend: React with TypeScript
- UI: Tailwind CSS
- State Management: Zustand
- Database: Supabase
- Authentication: Supabase Auth
- Icons: Lucide React
- Drag & Drop: @dnd-kit
- Date Handling: date-fns

## Security Notes
- No RLS (Row Level Security) is used
- Access control is handled at the application level
- User roles determine data access and capabilities
- Each user can only access data within their scope

## Important Implementation Details
1. Navigation
   - Dynamic sidebar based on user role
   - Breadcrumb-style navigation
   - Context-aware header with agency/client info

2. Data Access
   - Hierarchical data fetching
   - Cached user roles and permissions
   - Optimistic updates for better UX

3. Task Board
   - Real-time updates
   - Drag-and-drop between columns
   - Rich task details with priority, assignment, due dates

4. Error Handling
   - Graceful error states
   - User-friendly error messages
   - Proper error boundaries

## Development Guidelines
1. File Structure
   - Components in `/src/components`
   - Pages in `/src/pages`
   - Utilities in `/src/lib`
   - Types shared across components

2. State Management
   - Zustand for global state
   - React state for component-level data
   - Props for component communication

3. Styling
   - Tailwind CSS for all styling
   - Consistent color scheme
   - Responsive design patterns

4. Data Fetching
   - Supabase client for all database operations
   - Proper error handling
   - Loading states for better UX