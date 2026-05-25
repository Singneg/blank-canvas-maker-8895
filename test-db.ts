import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.LMB_SUPABASE_URL
const supabaseServiceKey = process.env.LMB_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
  console.log('Checking tables in public schema...')
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_tables_info', {}) // If exists, or just a raw query?
    // Supabase RPC needs to be defined. Let's try a direct query on a known table first.
  
  console.log('Trying to fetch from landing_settings...')
  const { data, error } = await supabase
    .from('landing_settings')
    .select('count', { count: 'exact', head: true })

  if (error) {
    console.error('Error fetching landing_settings:', error)
  } else {
    console.log('landing_settings exists and is accessible to service_role')
  }

  console.log('Trying to fetch from services...')
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id')
    .limit(1)

  if (servicesError) {
    console.error('Error fetching services:', servicesError)
  } else {
    console.log('services exists and is accessible to service_role')
  }
}

test()
