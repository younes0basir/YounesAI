export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at?: string;
}

export interface Task {
  id: string;
  user_id?: string;
  title: string;
  notes?: string | null;
  status?: string | null;
  priority?: number | null;
  urgency?: number | null;
  due_at?: string | null;
  completed_at?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  location?: string | null;
  created_at?: string;
}

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m?: number | null;
}

export interface AgentStep {
  id: string;
  agent: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export interface AgentChatResult {
  success?: boolean;
  response?: string;
  message?: string;
  agents?: string[];
  sessionId: string;
  error?: string;
  image?: string;
  transcription?: string;
  entities?: unknown;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  snippet?: string | null;
}

export interface Email {
  id: string;
  subject?: string | null;
  from_address?: string | null;
  from_name?: string | null;
  snippet?: string | null;
  body?: string | null;
  received_at?: string | null;
  category?: string | null;
  confidence?: number | null;
  account_email?: string | null;
  is_read?: boolean | null;
}

export interface EmailApproval {
  id: string;
  action: string;
  status?: string;
  email_ids?: string[];
  payload?: Record<string, unknown> | null;
  created_at?: string;
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string | null;
  remind_at?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface AppNotification {
  id: string;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  type?: string | null;
  read_at?: string | null;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  intent?: string | null;
  entities?: string | Record<string, unknown> | null;
  created_at?: string;
}

export interface ImageResult {
  image: string;
  prompt?: string;
  [key: string]: unknown;
}
