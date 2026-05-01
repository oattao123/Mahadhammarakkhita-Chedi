import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Check if table exists
  const { data: d1, error: e1 } = await supabase.from('documents').select('*').limit(1);
  console.log('Table check - data:', d1, 'error:', e1?.message);

  // Count all docs
  const { count, error: e2 } = await supabase.from('documents').select('*', { count: 'exact', head: true });
  console.log('All docs count:', count, 'error:', e2?.message);

  // Count system docs
  const { count: sysCount, error: e3 } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('user_id', 0);
  console.log('System docs count:', sysCount, 'error:', e3?.message);

  // Try insert test
  const { data: ins, error: e4 } = await supabase.from('documents').insert({ user_id: 0, filename: '__test__', file_type: 'test' }).select().single();
  console.log('Insert test:', ins?.id, 'error:', e4?.message);

  // Clean up test
  if (ins?.id) {
    await supabase.from('documents').delete().eq('id', ins.id);
    console.log('Cleaned up test doc');
  }
}

main().catch(console.error);
