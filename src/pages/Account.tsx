import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, LogOut, Mail, PackageCheck, UserRound } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import Footer from '../components/Footer'
import Header from '../components/Header'
import AddressBook from '../components/AddressBook'
import { useAuth } from '../context/AuthContext'
import { requestPasswordReset, signIn, signUp, updatePassword } from '../services/auth'

type Mode = 'signin' | 'signup' | 'reset' | 'new-password'
type AccountValues = { name: string; email: string; password: string }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a solicitação. Tente novamente.'
}

export default function Account() {
  const { configured, session, role, signOut } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(params.get('senha') === 'definir' ? 'new-password' : 'signin')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const schema = useMemo(() => z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
  }).superRefine((values, context) => {
    if (mode === 'signup' && values.name.trim().length < 2) {
      context.addIssue({ code: 'custom', path: ['name'], message: 'Informe seu nome.' })
    }
    if (mode === 'signup' && values.name.length > 120) {
      context.addIssue({ code: 'custom', path: ['name'], message: 'O nome deve ter no máximo 120 caracteres.' })
    }
    if (mode !== 'new-password' && !z.email().safeParse(values.email).success) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'Informe um e-mail válido.' })
    }
    if ((mode === 'signin' || mode === 'signup' || mode === 'new-password') && values.password.length < 8) {
      context.addIssue({ code: 'custom', path: ['password'], message: 'A senha deve ter pelo menos 8 caracteres.' })
    }
  }), [mode])
  const form = useForm<AccountValues>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '' } })

  useEffect(() => {
    if (params.get('senha') === 'definir' && session) setMode('new-password')
  }, [params, session])

  useEffect(() => {
    if (session && mode === 'signin') {
      const returnTo = params.get('redirect')
      const target = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : role === 'admin' ? '/admin' : '/pedidos'
      navigate(target, { replace: true })
    }
  }, [mode, navigate, params, role, session])

  async function submit(values: AccountValues) {
    setFeedback('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(values.email, values.password)
        setFeedback('Acesso autorizado. Redirecionando…')
      } else if (mode === 'signup') {
        const result = await signUp(values.name, values.email, values.password)
        setFeedback(result.needsEmailConfirmation
          ? 'Cadastro recebido. Confirme o endereço pelo e-mail enviado para ativar sua conta.'
          : 'Conta criada com sucesso.')
      } else if (mode === 'reset') {
        await requestPasswordReset(values.email)
        setFeedback('Se existir uma conta para este endereço, enviaremos instruções para redefinir a senha.')
      } else {
        await updatePassword(values.password)
        setFeedback('Senha atualizada. Você já pode acessar sua conta.')
        setMode('signin')
        form.reset({ email: values.email, password: '', name: '' })
      }
    } catch (error) {
      setFeedback(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'signin' ? 'Que bom ter você de volta.' : mode === 'signup' ? 'Vamos nos conhecer?' : mode === 'reset' ? 'Vamos recuperar seu acesso.' : 'Escolha uma nova senha.'
  const description = mode === 'signin' ? 'Entre para acompanhar seus pedidos de cartonagem e papelaria.' : mode === 'signup' ? 'Crie sua conta para acompanhar seus pedidos.' : mode === 'reset' ? 'Informe seu e-mail cadastrado para receber as instruções.' : 'Sua nova senha deve ter pelo menos 8 caracteres.'
  const disabled = !configured || busy

  if (session && mode === 'signin') {
    const name = typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : 'cliente'
    return <><Header /><main className="account-page page-shell"><div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><span>Minha conta</span></div><div className="account-card"><span className="eyebrow">BEM-VINDO DE VOLTA</span><h1>Olá, {name}.</h1><p>Sua conta está conectada com segurança.</p><div className="account-session-actions"><Link className="button button-dark" to={role === 'admin' ? '/admin' : '/pedidos'}>{role === 'admin' ? 'Painel administrativo' : 'Meus pedidos'} <PackageCheck size={17} /></Link><button className="back-link" onClick={() => { void signOut().catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')) }}><LogOut size={15} /> Sair da conta</button>{feedback && <div className="form-feedback" role="alert">{feedback}</div>}</div></div><AddressBook defaultName={name} /></main><Footer /></>
  }

  return (
    <>
      <Header />
      <main className="account-page page-shell">
        <div className="breadcrumbs"><Link to="/">Início</Link><span>/</span><span>Minha conta</span></div>
        <div className="account-card">
          <span className="eyebrow">SUA VITRINE, DO SEU JEITO</span>
          <h1>{title}</h1>
          <p>{description}</p>
          {!configured && <div className="integration-alert" role="status"><strong>Autenticação não configurada.</strong><span>Preencha as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local e aplique a migration do Supabase. Nenhum dado será enviado enquanto isso.</span></div>}
          <form className="account-form" onSubmit={form.handleSubmit(submit)} noValidate>
            {mode === 'signup' && <label>Seu nome<span className="account-input"><UserRound size={17} /><input autoComplete="name" {...form.register('name')} placeholder="Como podemos chamar você?" /></span>{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}</label>}
            {mode !== 'new-password' && <label>E-mail<span className="account-input"><Mail size={17} /><input type="email" autoComplete="email" {...form.register('email')} placeholder="voce@email.com" /></span>{form.formState.errors.email && <small className="field-error">{form.formState.errors.email.message}</small>}</label>}
            {(mode === 'signin' || mode === 'signup' || mode === 'new-password') && <label>Senha<span className="account-input"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} {...form.register('password')} placeholder="Pelo menos 8 caracteres" /><button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}</label>}
            {feedback && <div className="form-feedback" role="status">{feedback}</div>}
            <button className="button button-dark account-submit" disabled={disabled}>{busy ? 'Aguarde…' : mode === 'signin' ? <>Entrar na minha conta <ArrowRight size={17} /></> : mode === 'signup' ? <>Criar minha conta <ArrowRight size={17} /></> : mode === 'reset' ? <>Enviar instruções <ArrowRight size={17} /></> : <>Atualizar senha <KeyRound size={17} /></>}</button>
          </form>
          {mode === 'signin' && <div className="account-links"><button onClick={() => { setFeedback(''); setMode('reset') }}>Esqueci minha senha</button><span>Ainda não tem conta? <button onClick={() => { setFeedback(''); setMode('signup') }}>Cadastre-se</button></span></div>}
          {mode !== 'signin' && <button className="back-link account-back" onClick={() => { setFeedback(''); setMode('signin') }}><ArrowLeft size={15} /> Voltar para entrar</button>}
        </div>
      </main>
      <Footer />
    </>
  )
}
