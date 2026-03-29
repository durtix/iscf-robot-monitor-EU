import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://eglasirhoxnnfdsgcwog.supabase.co"
const SUPABASE_KEY = "sb_publishable_9ay0iLkAoTEnCYRdsVm9tQ_Uv5YHvl1"

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)