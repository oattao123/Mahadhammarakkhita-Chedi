'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useSpeech } from '@/hooks/useSpeech';
import type { TranslationKey } from '@/lib/translations';

// Types
interface UserInfo { id: number; name: string; email: string; role: string; }
interface ConversationItem { id: number; title: string; updated_at: string; }
interface DbMessage { role: string; content: string; }
interface DocumentItem { id: number; filename: string; file_type: string; total_pages: number | null; created_at: string; }

const QUICK_PROMPTS: { icon: string; labelKey: TranslationKey; textKey: TranslationKey }[] = [
  { icon: '📜', labelKey: 'prompt.vinaya', textKey: 'prompt.vinaya.text' },
  { icon: '🧘', labelKey: 'prompt.meditation', textKey: 'prompt.meditation.text' },
  { icon: '🎙️', labelKey: 'prompt.sermon', textKey: 'prompt.sermon.text' },
  { icon: '📖', labelKey: 'prompt.sutta', textKey: 'prompt.sutta.text' },
];

export default function Home() {
  const router = useRouter();
  const { locale, setLocale, t } = useLanguage();
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [editingConvId, setEditingConvId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [datasetCount, setDatasetCount] = useState<number | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep activeConvId and locale in refs so the transport closure always sees latest values
  const activeConvIdRef = useRef<number | null>(null);
  const localeRef = useRef(locale);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  // Ref to trigger conversation list refresh after AI finishes
  const loadConversationsRef = useRef<() => void>(() => {});

  const transportRef = useRef(new DefaultChatTransport({
    api: '/api/chat',
    body: () => ({ conversationId: activeConvIdRef.current, locale: localeRef.current }),
    fetch: async (url, init) => {
      const res = await fetch(url as string, init);
      const convId = res.headers.get('X-Conversation-Id');
      if (convId) {
        const id = parseInt(convId);
        setActiveConvId(id);
        activeConvIdRef.current = id;
      }
      return res;
    },
  }));

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

  // Keep ref in sync so the fetch closure can call it
  useEffect(() => { loadConversationsRef.current = loadConversations; }, [loadConversations]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Reload sidebar after each AI response completes
  useEffect(() => {
    if (status === 'ready' && user && messages.length > 0) loadConversations();
  }, [status, user, messages.length, loadConversations]);

  // Load documents
  const loadDocuments = useCallback(() => {
    if (!user) return;
    fetch('/api/documents').then(r => r.json()).then(d => {
      if (d.documents) setDocuments(d.documents);
    });
  }, [user]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Load dataset document count
  useEffect(() => {
    if (!user) return;
    fetch('/api/dataset/ingest').then(r => r.json()).then(d => {
      if (typeof d.datasetDocuments === 'number') setDatasetCount(d.datasetDocuments);
    }).catch(() => {});
  }, [user]);

  const handleIngestDataset = async () => {
    if (ingesting) return;
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch('/api/dataset/ingest', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIngestResult(`${t('dataset.done')} — ${data.processed} ${t('dataset.files')}`);
        setDatasetCount(prev => (prev ?? 0) + data.processed - data.skipped);
      } else {
        setIngestResult(t('dataset.error'));
      }
    } catch {
      setIngestResult(t('dataset.error'));
    } finally {
      setIngesting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      if (res.ok) {
        loadDocuments();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (id: number) => {
    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    loadDocuments();
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  }, [input]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedFile) || isLoading) return;

    let fileLabel = '';

    // Upload attached file first
    if (attachedFile && user) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', attachedFile);
        const res = await fetch('/api/documents', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          fileLabel = `[${attachedFile.name}] `;
          loadDocuments();
        }
      } finally {
        setUploading(false);
        setAttachedFile(null);
        if (chatFileInputRef.current) chatFileInputRef.current.value = '';
      }
    }

    const text = (fileLabel + input.trim()).trim();
    if (!text) return;
    sendMessage({ text });
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
          <p style={{ color: 'var(--foreground-muted)' }} className="text-sm">{t('app.loading')}</p>
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
            {t('sidebar.newChat')}
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
                        title={t('sidebar.save')}
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
                        title={t('sidebar.cancel')}
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
                          {formatDate(conv.updated_at, t, locale)}
                        </p>
                      </button>
                      {/* Rename button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingConvId(conv.id); setEditingTitle(conv.title); }}
                        className="w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: 'var(--sidebar-text-muted)' }}
                        title={t('sidebar.rename')}
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
                        title={t('sidebar.delete')}
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
                {t('sidebar.noHistory')}
              </p>
            )
          ) : (
            <div className="text-center py-8 px-4">
              <p className="text-sm mb-3" style={{ color: 'var(--sidebar-text-muted)' }}>
                {t('sidebar.loginPrompt')}
              </p>
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--gold)', color: '#fff' }}
              >
                {t('auth.login')}
              </button>
            </div>
          )}
        </div>

        {/* Documents section */}
        {user && (
          <div className="px-2 pb-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-text-muted)' }}>
                {t('doc.myDocuments')}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs px-2 py-1 rounded-md transition-colors"
                style={{ color: 'var(--gold)', background: 'var(--sidebar-hover)' }}
              >
                {uploading ? t('doc.uploading') : '+ ' + t('doc.upload')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {documents.length > 0 ? (
              <div className="space-y-0.5 max-h-32 overflow-y-auto sidebar-scroll">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ color: 'var(--sidebar-text)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="text-sm flex-shrink-0">
                      {doc.filename.endsWith('.pdf') ? '📄' : '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{doc.filename}</p>
                      {doc.total_pages && (
                        <p className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
                          {doc.total_pages} {t('doc.pages')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: 'var(--sidebar-text-muted)' }}
                      title={t('sidebar.delete')}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs py-2" style={{ color: 'var(--sidebar-text-muted)' }}>
                {t('doc.noDocuments')}
              </p>
            )}
            <p className="text-center text-xs mt-1 pb-1" style={{ color: 'var(--sidebar-text-muted)', opacity: 0.6 }}>
              {t('doc.supportedFormats')}
            </p>
          </div>
        )}

        {/* Dataset section */}
        {user && (
          <div className="px-2 pb-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
            <div className="flex items-center justify-between px-2 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📚</span>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-text-muted)' }}>
                  {t('dataset.title')}
                </p>
              </div>
              {datasetCount !== null && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: 'var(--sidebar-text-muted)', background: 'var(--sidebar-hover)' }}>
                  {datasetCount} {t('dataset.count')}
                </span>
              )}
            </div>
            <button
              onClick={handleIngestDataset}
              disabled={ingesting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ color: 'var(--gold)', background: 'var(--sidebar-hover)' }}
            >
              {ingesting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('dataset.ingesting')}
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {t('dataset.ingest')}
                </>
              )}
            </button>
            {ingestResult && (
              <p className="text-center text-xs mt-1.5 py-1" style={{ color: 'var(--gold)' }}>
                {ingestResult}
              </p>
            )}
          </div>
        )}

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
                title={t('auth.logout')}
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
              {t('auth.loginOrRegister')}
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
            <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('app.name')}</h1>
            {isLoading && (
              <div className="flex items-center gap-1 ml-2">
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: 'var(--gold)' }} />
              </div>
            )}
          </div>

          {/* Language switcher */}
          <button
            onClick={() => setLocale(locale === 'th' ? 'en' : 'th')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border"
            style={{ color: 'var(--gold)', borderColor: 'var(--gold)', background: 'transparent' }}
            title={locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
          >
            {t('lang.switch')}
          </button>

          {!user && (
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}
            >
              {t('auth.login')}
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
              {/* Attached file preview */}
              {attachedFile && (
                <div
                  className="flex items-center gap-2 px-4 py-2 mb-1 rounded-t-2xl text-sm"
                  style={{ background: 'var(--background-alt)', borderBottom: '1px solid var(--border-light)' }}
                >
                  <span>{attachedFile.name.endsWith('.pdf') ? '📄' : '📝'}</span>
                  <span className="truncate flex-1" style={{ color: 'var(--foreground)' }}>{attachedFile.name}</span>
                  <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {(attachedFile.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => { setAttachedFile(null); if (chatFileInputRef.current) chatFileInputRef.current.value = ''; }}
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ color: 'var(--foreground-muted)', background: 'var(--border-light)' }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div
                className="flex items-end rounded-2xl transition-shadow"
                style={{
                  background: 'var(--background-alt)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  ...(attachedFile ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}),
                }}
              >
                {/* Paperclip / attach file button */}
                <input
                  ref={chatFileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setAttachedFile(f);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={uploading || !user}
                  className="ml-2 mb-3 w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 flex-shrink-0"
                  style={{ color: 'var(--foreground-muted)' }}
                  title={user ? t('doc.upload') : t('doc.loginToUpload')}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.placeholder')}
                  rows={1}
                  className="flex-1 bg-transparent px-3 py-4 text-base resize-none focus:outline-none"
                  style={{
                    color: 'var(--foreground)',
                    minHeight: '52px',
                    maxHeight: '200px',
                  }}
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && !attachedFile) || isLoading || uploading}
                  className="m-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 flex-shrink-0"
                  style={{
                    background: (input.trim() || attachedFile) && !isLoading ? 'var(--foreground)' : 'var(--border)',
                    color: (input.trim() || attachedFile) && !isLoading ? 'var(--background)' : 'var(--foreground-muted)',
                  }}
                >
                  {isLoading || uploading ? (
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
              {t('app.disclaimer')}
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
  const { locale, t } = useLanguage();
  const text = message.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '';
  const isUser = message.role === 'user';
  const hasThai = /[\u0E00-\u0E7F]/.test(text);
  const speechLang = hasThai ? 'th-TH' : 'en-US';
  const { speak, stop, speaking, supported, rate, setRate } = useSpeech({ lang: speechLang, rate: 0.9 });
  const [showSpeed, setShowSpeed] = useState(false);
  const [paliReading, setPaliReading] = useState<string | null>(null);
  const [loadingPali, setLoadingPali] = useState(false);

  const handleSpeak = async () => {
    if (speaking) {
      stop();
      return;
    }

    // For Thai text, get Pali phonetic reading first
    if (hasThai && !paliReading) {
      setLoadingPali(true);
      try {
        const res = await fetch('/api/pali-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        const reading = data.thaiReading || text;
        setPaliReading(reading);
        speak(reading);
      } catch {
        // Fallback to raw text
        speak(text);
      } finally {
        setLoadingPali(false);
      }
    } else {
      speak(paliReading || text);
    }
  };

  const speedOptions = [0.6, 0.8, 0.9, 1.0, 1.2];

  return (
    <div className={`flex gap-4 animate-fade-in ${isUser ? 'msg-user' : ''}`}>
      <Avatar role={message.role} />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
            {isUser ? t('chat.you') : t('chat.assistant')}
          </p>
        </div>
        <div className="msg-content">
          {isUser ? <p>{text}</p> : <RenderMarkdown text={text} />}
        </div>

        {/* TTS controls — show for all messages with text */}
        {supported && text.trim().length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {/* Play / Stop button */}
            <button
              onClick={handleSpeak}
              disabled={loadingPali}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                color: speaking ? '#fff' : 'var(--gold)',
                background: speaking ? 'var(--gold)' : 'var(--gold-subtle)',
                border: `1px solid ${speaking ? 'var(--gold)' : 'transparent'}`,
              }}
              title={speaking ? t('pali.stop') : t('pali.speak')}
            >
              {loadingPali ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{t('pali.loading')}</span>
                </>
              ) : speaking ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1"/>
                    <rect x="14" y="4" width="4" height="16" rx="1"/>
                  </svg>
                  <span>{t('pali.stop')}</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5zM14 3.23v2.06a6.51 6.51 0 010 13.42v2.06A8.52 8.52 0 0022.5 12 8.52 8.52 0 0014 3.23z"/>
                  </svg>
                  <span>{t('pali.speak')}</span>
                </>
              )}
            </button>

            {/* Speed control toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSpeed(!showSpeed)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs transition-colors"
                style={{ color: 'var(--foreground-muted)', background: showSpeed ? 'var(--background-alt)' : 'transparent' }}
                title={t('pali.speed')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{rate}x</span>
              </button>
              {showSpeed && (
                <div
                  className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-xl shadow-lg z-10"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                >
                  {speedOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => { setRate(s); setShowSpeed(false); }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: rate === s ? 'var(--gold)' : 'transparent',
                        color: rate === s ? '#fff' : 'var(--foreground-muted)',
                      }}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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

function WelcomeScreen({ onSuggestion, userName }: { onSuggestion: (text: string) => void; userName?: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in px-4">
      <div className="text-5xl mb-5 animate-float">🪷</div>
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
        {userName ? `${t('welcome.greeting')} ${userName}` : t('welcome.defaultGreeting')}
      </h2>
      <p className="text-base mb-10" style={{ color: 'var(--foreground-muted)' }}>
        {t('welcome.subtitle')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p.labelKey}
            onClick={() => onSuggestion(t(p.textKey))}
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
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t(p.labelKey)}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{t(p.textKey)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string, t: (key: TranslationKey) => string, locale: string): string {
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return t('date.justNow');
  if (mins < 60) return `${mins} ${t('date.minutesAgo')}`;
  if (hrs < 24) return `${hrs} ${t('date.hoursAgo')}`;
  if (days < 7) return `${days} ${t('date.daysAgo')}`;
  return date.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });
}
