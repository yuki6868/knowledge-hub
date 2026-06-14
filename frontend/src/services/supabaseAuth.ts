import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type AuthListener = (event: AuthChangeEvent, session: Session | null) => void

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase URL または anon key が設定されていません。')
  }

  return supabase
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()

  if (error) throw error
  return data.session
}

export function subscribeAuthState(listener: AuthListener): () => void {
  if (!supabase) return () => undefined

  const { data } = supabase.auth.onAuthStateChange(listener)
  return () => data.subscription.unsubscribe()
}

export async function signInWithGoogle(): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })

  if (error) throw error
}

export async function signInWithEmail(email: string, password: string): Promise<Session | null> {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error) throw error
  return data.session
}

export async function signUpWithEmail(email: string, password: string): Promise<Session | null> {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) throw error
  return data.session
}

export async function signOutFromSupabase(): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()

  if (error) throw error
}
