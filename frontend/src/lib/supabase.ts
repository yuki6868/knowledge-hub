import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const normalizeEnvValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const supabaseUrl = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = normalizeEnvValue(
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

const isPlaceholder = (value: string) =>
  value.includes('YOUR_PROJECT_ID') || value.includes('YOUR_SUPABASE') || value.includes('ここに')

const hasSupabaseUrl = Boolean(supabaseUrl)
const hasSupabaseAnonKey = Boolean(supabaseAnonKey)
const usesLegacyAnonKey = Boolean(normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY))
const usesPublishableKey = Boolean(normalizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY))

export const isSupabaseConfigured = Boolean(
  hasSupabaseUrl && hasSupabaseAnonKey && !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey),
)

export const supabaseConfigDebug = {
  hasUrl: hasSupabaseUrl,
  hasKey: hasSupabaseAnonKey,
  usesLegacyAnonKey,
  usesPublishableKey,
  isConfigured: isSupabaseConfigured,
  mode: import.meta.env.MODE,
  envSourceHint: 'frontend/.env.local',
}

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
