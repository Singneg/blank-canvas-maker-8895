import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.LMB_SUPABASE_URL!,
  process.env.LMB_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIds() {
  const { data, error } = await supabase.from('services').select('user_id').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  console.log('User IDs in services table:', data.map(d => d.user_id));
}

checkIds();
