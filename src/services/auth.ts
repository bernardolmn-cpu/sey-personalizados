import { supabase } from '../integrations/supabase/client'

function requireSupabase() {
  if (!supabase) throw new Error('Autenticação indisponível. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  return supabase
}

export async function signIn(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })
  if (error) throw error
  return { needsEmailConfirmation: !data.session }
}

export async function requestPasswordReset(email: string) {
  const url = `${window.location.origin}${import.meta.env.BASE_URL}conta?senha=definir`
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: url })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password })
  if (error) throw error
}
