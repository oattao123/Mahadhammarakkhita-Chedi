import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { retrieveContext, retrieveContextWithDocuments } from '@/lib/rag';
import { preFilter, buildSystemPrompt } from '@/lib/ethical-filter';
import { getSession } from '@/lib/auth';
import { addMessage, getConversation, createConversation, updateConversationTitle } from '@/lib/db';

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSession();

  const { messages, conversationId, locale }: { messages: UIMessage[]; conversationId?: number; locale?: string } = await req.json();
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

  // RAG: Retrieve relevant context (Tipitaka + user documents if logged in)
  const ragResult = user
    ? await retrieveContextWithDocuments(userText, user.id)
    : retrieveContext(userText);

  // Build system prompt with RAG context and ethical guidelines
  let systemPrompt = buildSystemPrompt(ragResult.context);

  // Language instruction — always respond in the user's selected language
  if (locale === 'en') {
    systemPrompt += '\n\nIMPORTANT: The user interface is set to English. You MUST respond entirely in English, including all Dhamma explanations, Pali term translations, and source citations. Do not switch to Thai.';
  } else {
    systemPrompt += '\n\nสำคัญ: ผู้ใช้เลือกภาษาไทย กรุณาตอบเป็นภาษาไทยทั้งหมด รวมถึงคำอธิบายธรรมะ การแปลศัพท์บาลี และการอ้างอิงแหล่งที่มา';
  }

  if (filterResult.needsDisclaimer && filterResult.disclaimer) {
    systemPrompt += locale === 'en'
      ? `\n\n⚠️ Special note: ${filterResult.disclaimer}\nPlease clarify this in your response.`
      : `\n\n⚠️ หมายเหตุพิเศษ: ${filterResult.disclaimer}\nกรุณาชี้แจงข้อนี้ในคำตอบด้วย`;
  }

  if (ragResult.sources.length > 0) {
    systemPrompt += locale === 'en'
      ? `\n\nSources found: ${ragResult.sources.map(s => `${s.title} (${s.source})`).join(', ')}\nPlease reference these sources in your answer.`
      : `\n\nแหล่งอ้างอิงที่พบ: ${ragResult.sources.map(s => `${s.title} (${s.source})`).join(', ')}\nกรุณาอ้างอิงแหล่งที่มาเหล่านี้ในคำตอบ`;
  }

  // Add uploaded document source citations
  if (ragResult.documentSources.length > 0) {
    const docRefs = ragResult.documentSources.map(d => {
      const page = d.pageNumber ? (locale === 'en' ? `page ${d.pageNumber}` : `หน้า ${d.pageNumber}`) : '';
      return `"${d.filename}"${page ? ` (${page})` : ''}`;
    });
    systemPrompt += locale === 'en'
      ? `\n\nThe following user-uploaded documents are relevant:\n${docRefs.join('\n')}\nWhen citing information from these documents, always mention the filename and page number (if available) in your answer, e.g. "According to [filename], page X..."`
      : `\n\nเอกสารที่ผู้ใช้อัปโหลดที่เกี่ยวข้อง:\n${docRefs.join('\n')}\nเมื่ออ้างอิงข้อมูลจากเอกสารเหล่านี้ ให้ระบุชื่อไฟล์และหมายเลขหน้า (ถ้ามี) ในคำตอบเสมอ เช่น "จากไฟล์ [ชื่อไฟล์] หน้า X..."`;
  }

  const result = streamText({
    model: openrouter('anthropic/claude-sonnet-4.5'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
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
