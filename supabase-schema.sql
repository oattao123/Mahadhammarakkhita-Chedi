-- =====================================================
-- Supabase Schema for Dhamma Sahāya
-- Run this in Supabase SQL Editor (https://supabase.com)
-- =====================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  google_id TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'สนทนาใหม่',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- 4. Documents table (user uploads + system dataset)
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL DEFAULT 0,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  total_pages INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Document chunks for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL DEFAULT 0,
  page_number INT,
  content TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_keywords ON document_chunks(keywords);

-- Note: user_id=0 is used for system/dataset documents (no FK to users table)
-- User-uploaded documents will have user_id matching users.id

-- Enable Row Level Security (optional — we use service_role key which bypasses RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
