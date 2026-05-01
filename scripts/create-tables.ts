import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SQL = `
-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL DEFAULT 0,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  total_pages INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document chunks for RAG
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
`;

async function main() {
  console.log('Creating tables via Supabase REST SQL...');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });

  // If rpc doesn't work, try the SQL endpoint directly
  if (!res.ok) {
    console.log('RPC method failed, trying direct SQL endpoint...');

    const sqlRes = await fetch(`${SUPABASE_URL}/pg`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (!sqlRes.ok) {
      // Last resort: use the Management API SQL endpoint
      const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
      console.log(`Project ref: ${projectRef}`);
      console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
      console.log(`URL: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
      console.log('\n' + SQL);
      return;
    }

    const sqlData = await sqlRes.json();
    console.log('SQL result:', sqlData);
    return;
  }

  console.log('Tables created successfully!');
}

main().catch(console.error);
