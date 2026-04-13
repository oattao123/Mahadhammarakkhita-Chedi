'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface UserInfo { id: number; name: string; email: string; role: string; }
interface ConversationItem { id: number; title: string; updated_at: string; }
interface DbMessage { role: string; content: string; }

const QUICK_PROMPTS = [
  { icon: '📜', text: 'สิกขาบทสำคัญที่พระนวกะควรรู้', label: 'พระวินัยเบื้องต้น' },
  { icon: '🧘', text: 'ขั้นตอนการเจริญสติปัฏฐาน 4 อย่างละเอียด', label: 'การเจริญสติปัฏฐาน' },
  { icon: '🎙️', text: 'แนวทางเทศนาอริยสัจ 4 ให้เข้าใจง่ายสำหรับคนรุ่นใหม่', label: 'แนวทางเทศนา' },
  { icon: '📖', text: 'สาระสำคัญของธัมมจักกัปปวัตตนสูตร', label: 'ปฐมเทศนา' },
];

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [editingConvId, setEditingConvId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transportRef = useRef(new DefaultChatTransport({
    api: '/api/chat',
    body: { conversationId: activeConvId },
  }));

  useEffect(() => {
    transportRef.current = new DefaultChatTransport({
      api: '/api/chat',
      body: { conversationId: activeConvId },
    });
  }, [activeConvId]);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: transportRef.current,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Auth check
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUser(d.user); })
      .finally(() => setAuthLoading(false));
  }, []);

  // Load conversations
  const loadConversations = useCallback(() => {
    if (!user) return;
    fetch('/api/conversations').then(r => r.json()).then(d => {
      if (d.conversations) setConversations(d.conversations);
    });
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (status === 'ready' && user && messages.length > 0) loadConversations();
  }, [status, user, messages.length, loadConversations]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleSuggestion = (text: string) => {
    if (isLoading) return;
    sendMessage({ text });
    setSidebarOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  const handleNewChat = () => {
    setMessages([]); setActiveConvId(null); setInput('');
  };

  const handleLoadConv = async (id: number) => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    const data = await res.json();
    if (data.messages) {
      setMessages(data.messages.map((m: DbMessage, i: number) => ({
        id: `db-${id}-${i}`, role: m.role, parts: [{ type: 'text', text: m.content }],
      })));
      setActiveConvId(id);
      setSidebarOpen(false);
    }
  };

  const handleRenameConv = async (id: number, newTitle: string) => {
    if (!newTitle.trim()) { setEditingConvId(null); return; }
    await fetch('/api/conversations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: newTitle.trim() }),
    });
    setEditingConvId(null);
    loadConversations();
  };

  const handleDeleteConv = async (id: number) => {
    await fetch('/api/conversations', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (activeConvId === id) handleNewChat();
    loadConversations();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null); setConversations([]); handleNewChat(); router.refresh();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--background)' }}>
        <div className="text-center animate-fade-in">
          <div className="text-5xl mb-3 animate-float">🪷</div>
          <p style={{ color: 'var(--foreground-muted)' }} className="text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* ===== SIDEBAR ===== */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'var(--sidebar-bg)' }}
      >
        {/* Sidebar top */}
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: 'var(--sidebar-hover)', color: 'var(--sidebar-text)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            สนทนาใหม่
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto sidebar-scroll px-2 py-2 space-y-0.5">
          {user ? (
            conversations.length > 0 ? (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className="group flex items-center rounded-lg transition-colors cursor-pointer"
                  style={{
                    background: activeConvId === conv.id ? 'var(--sidebar-active)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
                  onMouseLeave={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  {editingConvId === conv.id ? (
                    /* ===== Inline rename input ===== */
                    <form
                      className="flex-1 flex items-center gap-1 px-2 py-1.5"
                      onSubmit={e => { e.preventDefault(); handleRenameConv(conv.id, editingTitle); }}
                    >
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingConvId(null); }}
                        onBlur={() => handleRenameConv(conv.id, editingTitle)}
                        className="flex-1 bg-transparent text-sm px-2 py-1.5 rounded border outline-none min-w-0"
                        style={{ color: 'var(--sidebar-text)', borderColor: 'var(--gold)', background: 'var(--sidebar-hover)' }}
                      />
                      <button
                        type="submit"
                        className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                        style={{ color: 'var(--gold)' }}
                        title="บันทึก"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingConvId(null)}
                        className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                        style={{ color: 'var(--sidebar-text-muted)' }}
                        title="ยกเลิก"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </form>
                  ) : (
                    /* ===== Normal conversation row ===== */
                    <>
                      <button
                        onClick={() => handleLoadConv(conv.id)}
                        className="flex-1 text-left px-3 py-2.5 min-w-0"
                      >
                        <p className="text-sm truncate" style={{ color: 'var(--sidebar-text)' }}>{conv.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-text-muted)' }}>
                          {formatDate(conv.updated_at)}
                        </p>
                      </button>
                      {/* Rename button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingConvId(conv.id); setEditingTitle(conv.title); }}
                        className="w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: 'var(--sidebar-text-muted)' }}
                        title="แก้ไขชื่อ"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id); }}
                        className="w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mr-1 flex-shrink-0"
                        style={{ color: 'var(--sidebar-text-muted)' }}
                        title="ลบ"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-xs py-8" style={{ color: 'var(--sidebar-text-muted)' }}>
                ยังไม่มีประวัติการสนทนา
              </p>
            )
          ) : (
            <div className="text-center py-8 px-4">
              <p className="text-sm mb-3" style={{ color: 'var(--sidebar-text-muted)' }}>
                เข้าสู่ระบบเพื่อบันทึกประวัติ
              </p>
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--gold)', color: '#fff' }}
              >
                เข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>

        {/* Sidebar bottom - user */}
        <div className="p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          {user ? (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'var(--gold)', color: '#fff' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>{user.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--sidebar-text-muted)' }}>{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded flex items-center justify-center transition-opacity hover:opacity-100 opacity-60 flex-shrink-0"
                style={{ color: 'var(--sidebar-text-muted)' }}
                title="ออกจากระบบ"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--sidebar-hover)', color: 'var(--sidebar-text)' }}
            >
              เข้าสู่ระบบ / สมัครสมาชิก
            </button>
          )}
        </div>
      </aside>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in-fast"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== MAIN CHAT ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center gap-3 px-4 h-14 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-light)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--background-alt)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg">🪷</span>
            <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>ธรรมสหาย</h1>
            {isLoading && (
              <div className="flex items-center gap-1 ml-2">
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
              </div>
            )}
          </div>

          {!user && (
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 md:px-8">
            {messages.length === 0 ? (
              <WelcomeScreen onSuggestion={handleSuggestion} userName={user?.name} />
            ) : (
              <div className="py-6 space-y-6">
                {messages.map(msg => (
                  <MessageRow key={msg.id} message={msg} />
                ))}
                {status === 'submitted' && (
                  <div className="flex gap-4 animate-fade-in">
                    <Avatar role="assistant" />
                    <div className="pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 md:px-8 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <div
                className="flex items-end rounded-2xl transition-shadow"
                style={{
                  background: 'var(--background-alt)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ถามคำถามธรรมะ หรือค้นคว้าพระไตรปิฎก..."
                  rows={1}
                  className="flex-1 bg-transparent px-5 py-4 text-base resize-none focus:outline-none"
                  style={{
                    color: 'var(--foreground)',
                    minHeight: '52px',
                    maxHeight: '200px',
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="m-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 flex-shrink-0"
                  style={{
                    background: input.trim() && !isLoading ? 'var(--foreground)' : 'var(--border)',
                    color: input.trim() && !isLoading ? 'var(--background)' : 'var(--foreground-muted)',
                  }}
                >
                  {isLoading ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            <p className="text-center text-xs mt-2.5" style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
              ธรรมสหายเป็นเครื่องมือ AI อ้างอิงพระไตรปิฎก กรุณาตรวจสอบกับคัมภีร์ต้นฉบับ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== Sub-Components ==================== */

function Avatar({ role }: { role: string }) {
  if (role === 'user') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
        style={{ background: 'var(--gold-subtle)', color: 'var(--gold)' }}
      >
        🙏
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
      style={{ background: 'var(--gold)', color: '#fff' }}
    >
      🪷
    </div>
  );
}

function MessageRow({ message }: { message: { id: string; role: string; parts?: Array<{ type: string; text?: string }> } }) {
  const text = message.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '';
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 animate-fade-in ${isUser ? 'msg-user' : ''}`}>
      <Avatar role={message.role} />
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>
          {isUser ? 'คุณ' : 'ธรรมสหาย'}
        </p>
        <div className="msg-content">
          {isUser ? <p>{text}</p> : <RenderMarkdown text={text} />}
        </div>
      </div>
    </div>
  );
}

function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        if (line.startsWith('### ')) return <h3 key={i}>{inlineFmt(line.slice(4))}</h3>;
        if (line.startsWith('## ')) return <h2 key={i}>{inlineFmt(line.slice(3))}</h2>;
        if (line.startsWith('# ')) return <h1 key={i}>{inlineFmt(line.slice(2))}</h1>;
        if (line.startsWith('> ')) return <blockquote key={i}>{inlineFmt(line.slice(2))}</blockquote>;
        if (/^[-*] /.test(line)) {
          return <div key={i} className="flex items-start gap-2 mb-1"><span style={{color:'var(--gold)'}}>&#x2022;</span><span>{inlineFmt(line.slice(2))}</span></div>;
        }
        const numMatch = line.match(/^(\d+)\. (.*)$/);
        if (numMatch) {
          return <div key={i} className="flex items-start gap-2 mb-1"><span className="font-semibold min-w-[1.25rem]" style={{color:'var(--gold)'}}>{numMatch[1]}.</span><span>{inlineFmt(numMatch[2])}</span></div>;
        }
        return <p key={i}>{inlineFmt(line)}</p>;
      })}
    </>
  );
}

function inlineFmt(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

function WelcomeScreen({ onSuggestion, userName }: { onSuggestion: (t: string) => void; userName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in px-4">
      <div className="text-5xl mb-5 animate-float">🪷</div>
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
        {userName ? `นมัสการ ${userName}` : 'ธรรมสหาย'}
      </h2>
      <p className="text-base mb-10" style={{ color: 'var(--foreground-muted)' }}>
        ค้นคว้าพระไตรปิฎก พระวินัย พระสูตร พระอภิธรรม
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p.label}
            onClick={() => onSuggestion(p.text)}
            className="flex items-start gap-3 p-4 rounded-xl text-left transition-all hover:shadow-md active:scale-[0.98]"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--background)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--background-alt)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--background)'}
          >
            <span className="text-xl mt-0.5">{p.icon}</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{p.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{p.text}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
