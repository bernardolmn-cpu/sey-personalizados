import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../integrations/supabase/client'

export type UserRole = 'customer' | 'admin'

type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  role: UserRole | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    let mounted = true

    async function loadRole(userId: string) {
      const { data, error } = await supabase!.from('profiles').select('role').eq('user_id', userId).maybeSingle()
      if (error) throw error
      if (mounted) setRole(data?.role === 'admin' ? 'admin' : 'customer')
    }

    async function initialize() {
      const { data, error } = await supabase!.auth.getSession()
      if (error) throw error
      if (!mounted) return
      setSession(data.session)
      if (data.session) await loadRole(data.session.user.id)
      if (mounted) setLoading(false)
    }

    void initialize().catch((error: unknown) => {
      console.error('Não foi possível inicializar a sessão.', error)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setRole(null)
        setLoading(false)
        return
      }
      setLoading(true)
      window.setTimeout(() => {
        void loadRole(nextSession.user.id)
          .catch((error: unknown) => {
            console.error('Não foi possível carregar as permissões da conta.', error)
            if (mounted) setRole(null)
          })
          .finally(() => { if (mounted) setLoading(false) })
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    role,
    signOut: async () => {
      if (!supabase) throw new Error('Configure o Supabase antes de encerrar uma sessão.')
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [loading, role, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa ser usado dentro de AuthProvider')
  return context
}
