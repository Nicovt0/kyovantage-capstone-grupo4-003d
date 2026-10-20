import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : (typeof process !== 'undefined' ? process.env : {});
const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://mdnxxgmhbheavddjkrpt.supabase.co';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbnh4Z21oYmhlYXZkZGprcnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDE5OTksImV4cCI6MjEwMTg3Nzk5OX0.3Uu3gQEa7eUKh5ePUbUDQLLDnTjwe9VXvUan7muoWwA';

let client: SupabaseClient<any, 'public', any> | null = null;

export function createClient(): SupabaseClient<any, 'public', any> {
  if (!client) {
    client = createSupabaseClient<any, 'public', any>(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

