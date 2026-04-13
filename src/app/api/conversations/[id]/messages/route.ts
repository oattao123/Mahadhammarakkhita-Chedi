import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getConversation,
  getConversationMessages,
  addMessage,
  updateConversationTitle,
} from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const conversationId = parseInt(id);
  const conversation = await getConversation(conversationId);

  if (!conversation || conversation.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const messages = await getConversationMessages(conversationId);
  return NextResponse.json({ messages });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const conversationId = parseInt(id);
  const conversation = await getConversation(conversationId);

  if (!conversation || conversation.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { role, content, updateTitle } = await req.json();
  const message = await addMessage(conversationId, role, content);

  // Auto-update title from first user message
  if (updateTitle && role === 'user') {
    const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    await updateConversationTitle(conversationId, title);
  }

  return NextResponse.json({ message });
}
