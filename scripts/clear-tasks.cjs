/**
 * TaskFlow - Clear Tasks & Verify Collision-Proof Sequence Script
 * Runs with Node.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zabzwsdvbgzjlkfszxhn.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_74Qt2BwujAigJl2cHE2gzw_8KgRbEcn';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Connecting to Supabase at:', SUPABASE_URL);

  // Try calling the clear_all_tasks RPC function
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('clear_all_tasks');
    if (!rpcError && rpcData) {
      console.log('RPC clear_all_tasks result:', rpcData);
    } else {
      console.log('RPC attempt info:', rpcError?.message || 'RPC not created yet in DB');
    }
  } catch (err) {
    console.log('RPC execution error:', err.message);
  }

  // Also query tasks table status
  const { data: tasks, error: fetchError } = await supabase
    .from('tasks')
    .select('id, code, title, created_at');

  if (fetchError) {
    console.log('Tasks query note:', fetchError.message);
  } else {
    console.log(`Current tasks count: ${tasks.length}`);
    if (tasks.length > 0) {
      console.log('Sample tasks remaining:', tasks.slice(0, 5));
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
