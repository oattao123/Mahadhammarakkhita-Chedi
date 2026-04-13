import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { retrieveContext } from '@/lib/rag';
import { preFilter, buildSystemPrompt } from '@/lib/ethical-filter';
import { getSession } from '@/lib/auth';
import { addMessage, getConversation, createConversation, updateConversationTitle } from '@/lib/db';

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSession();

  const { messages, conversationId }: { messages: UIMessage[]; conversationId?: number } = await req.json();
  const lastMessage = messages[messages.length - 1];

  // Extract user text from the last message
  const userText = lastMessage.parts
    ?.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join(' ') || '';

  // Save user message to DB if logged in
  let activeConversationId = conversationId;
  if (user) {
    if (!activeConversationId) {
      // Create new conversation
      const conv = await createConversation(user.id, userText.slice(0, 50) + (userText.length > 50 ? '...' : ''));
      activeConversationId = conv.id;
    } else {
      // Verify ownership
      const conv = await getConversation(activeConversationId);
      if (!conv || conv.user_id !== user.id) {
        activeConversationId = undefined;
      } else if (conv.title === 'สนทนาใหม่') {
        await updateConversationTitle(activeConversationId, userText.slice(0, 50) + (userText.length > 50 ? '...' : ''));
      }
    }
    if (activeConversationId) {
      await addMessage(activeConversationId, 'user', userText);
    }
  }

  // Pre-filter for crisis situations and ethical checks
  const filterResult = preFilter(userText);

  // If crisis situation, return immediate response with conversationId
  if (filterResult.isCrisis && filterResult.crisisResponse) {
    if (user && activeConversationId) {
      await addMessage(activeConversationId, 'assistant', filterResult.crisisResponse);
    }
    const crisisStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `0:${JSON.stringify(filterResult.crisisResponse)}\n`
          )
        );
        controller.close();
      },
    });

    return new Response(crisisStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Conversation-Id': String(activeConversationId || ''),
      },
    });
  }

  // RAG: Retrieve relevant Tipitaka context
  const ragResult = retrieveContext(userText);

  // Build system prompt with RAG context and ethical guidelines
  let systemPrompt = buildSystemPrompt(ragResult.context);

  if (filterResult.needsDisclaimer && filterResult.disclaimer) {
    systemPrompt += `\n\n⚠️ หมายเหตุพิเศษ: ${filterResult.disclaimer}\nกรุณาชี้แจงข้อนี้ในคำตอบด้วย`;
  }

  if (ragResult.sources.length > 0) {
    systemPrompt += `\n\nแหล่งอ้างอิงที่พบ: ${ragResult.sources.map(s => `${s.title} (${s.source})`).join(', ')}
กรุณาอ้างอิงแหล่งที่มาเหล่านี้ในคำตอบ`;
  }

  const result = streamText({
    model: openrouter('anthropic/claude-sonnet-4.5'),
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content || (m.parts ? m.parts.map((p: any) => p.text).join('') : '') || '',
    })),
    async onFinish({ text }) {
      // Save assistant response to DB
      if (user && activeConversationId) {
        await addMessage(activeConversationId, 'assistant', text);
      }
    },
  });

  const response = result.toUIMessageStreamResponse();

  // Attach conversationId header so frontend can track it
  if (activeConversationId) {
    response.headers.set('X-Conversation-Id', String(activeConversationId));
  }

  return response;
}
