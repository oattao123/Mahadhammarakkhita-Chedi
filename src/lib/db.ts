import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service_role key for server-side operations (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==================== User operations ====================

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  google_id: string | null;
  role: string;
  created_at: string;
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({ name, email, password_hash: passwordHash })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as User;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "no rows returned" — that's expected when user doesn't exist
    throw new Error(`Failed to get user: ${error.message}`);
  }
  return (data as User) ?? undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get user: ${error.message}`);
  }
  return (data as User) ?? undefined;
}

/** Find or create a user via Google OAuth. Links to existing account by email if found. */
export async function upsertGoogleUser(googleId: string, email: string, name: string): Promise<User> {
  // Check by google_id first
  const { data: byGoogleId } = await supabase
    .from('users')
    .select('*')
    .eq('google_id', googleId)
    .single();

  if (byGoogleId) return byGoogleId as User;

  // Check by email — link existing account
  const byEmail = await getUserByEmail(email);
  if (byEmail) {
    const { data, error } = await supabase
      .from('users')
      .update({ google_id: googleId })
      .eq('id', byEmail.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to link Google account: ${error.message}`);
    return data as User;
  }

  // Create new user (no password for OAuth-only accounts)
  const { data, error } = await supabase
    .from('users')
    .insert({ name, email, password_hash: '', google_id: googleId })
    .select()
    .single();

  if (error) throw new Error(`Failed to create Google user: ${error.message}`);
  return data as User;
}

// ==================== Conversation operations ====================

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function createConversation(userId: number, title: string = 'สนทนาใหม่'): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data as Conversation;
}

export async function getConversation(id: number): Promise<Conversation | undefined> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get conversation: ${error.message}`);
  }
  return (data as Conversation) ?? undefined;
}

export async function getUserConversations(userId: number): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to get conversations: ${error.message}`);
  return (data as Conversation[]) ?? [];
}

export async function updateConversationTitle(id: number, title: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
}

export async function deleteConversation(id: number, userId: number): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
}

// ==================== Message operations ====================

export interface Message {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  created_at: string;
}

export async function addMessage(conversationId: number, role: string, content: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single();

  if (error) throw new Error(`Failed to add message: ${error.message}`);

  // Update conversation timestamp
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as Message;
}

export async function getConversationMessages(conversationId: number): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get messages: ${error.message}`);
  return (data as Message[]) ?? [];
}

export default supabase;
