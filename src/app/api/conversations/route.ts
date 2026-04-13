import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getUserConversations,
  createConversation,
  deleteConversation,
  getConversation,
  updateConversationTitle,
} from '@/lib/db';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversations = getUserConversations(user.id);
  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title } = await req.json();
  const conversation = createConversation(user.id, title || 'สนทนาใหม่');
  return NextResponse.json({ conversation });
}

export async function PATCH(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title } = await req.json();
  if (!id || !title?.trim()) {
    return NextResponse.json({ error: 'Missing id or title' }, { status: 400 });
  }

  const conv = getConversation(id);
  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  updateConversationTitle(id, title.trim());
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  deleteConversation(id, user.id);
  return NextResponse.json({ success: true });
}
