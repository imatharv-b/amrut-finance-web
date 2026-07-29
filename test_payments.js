import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env')))

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data: payments } = await supabase.from('payments').select('id, amount, date, season_id, party_id').order('date', { ascending: false }).limit(20)
  console.log("Recent payments:", payments)
  
  const { data: season } = await supabase.from('seasons').select('*').limit(2)
  console.log("Seasons:", season)
}
test()
