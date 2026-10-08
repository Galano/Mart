import { createContext, useContext, useEffect, useState } from 'react'

// ------------------------------------------------------------ API
const TOKEN_KEY = 'mart_token'
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {} }

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const tk = getToken()
  if (tk) headers.Authorization = `Bearer ${tk}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const r = await fetch(path, { method, headers, body: payload })
  if (!r.ok) {
    let msg = `Erro ${r.status}`
    try { const j = await r.json(); msg = typeof j.detail === 'string' ? j.detail : (j.detail?.[0]?.msg || msg) } catch {}
    throw new Error(msg)
  }
  const ct = r.headers.get('content-type') || ''
  return ct.includes('json') ? r.json() : r.blob()
}

export const arquivoUrl = (nome) => nome ? `/api/arquivos/${nome}?auth=${encodeURIComponent(getToken())}` : null
export const publicoUrl = (nome) => nome ? `/api/arquivos/${nome}` : null

// ------------------------------------------------------------ sessao
const AuthCtx = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  useEffect(() => {
    if (!getToken()) { setUser(null); return }
    api('/api/auth/me').then(setUser).catch(() => { setToken(''); setUser(null) })
  }, [])
  const entrar = async (email, senha) => {
    const r = await api('/api/auth/login', { method: 'POST', body: { email, senha } })
    setToken(r.token); setUser(r.usuario); return r.usuario
  }
  const sair = async () => { try { await api('/api/auth/logout', { method: 'POST' }) } catch {} setToken(''); setUser(null) }
  return <AuthCtx.Provider value={{ user, entrar, sair }}>{children}</AuthCtx.Provider>
}
export const useAuth = () => useContext(AuthCtx)

// ------------------------------------------------------------ formato
export const brl = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const dataBR = (s) => s ? new Date(s.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const STATUS_PEDIDO = {
  novo: ['Novo', 'bg-primary-soft text-primary'],
  em_producao: ['Em produção', 'bg-warn-soft text-warn'],
  enviado: ['Enviado', 'bg-primary-soft text-primary'],
  entregue: ['Entregue', 'bg-ok-soft text-ok'],
  cancelado: ['Cancelado', 'bg-danger-soft text-danger'],
}
export const STATUS_PAG = {
  aguardando: ['Aguardando confirmação', 'bg-warn-soft text-warn'],
  confirmado: ['Pago', 'bg-ok-soft text-ok'],
  recusado: ['Recusado', 'bg-danger-soft text-danger'],
}

// ------------------------------------------------------------ UI
export function Card({ className = '', children, ...p }) {
  return <div className={`bg-surface border border-line rounded-2xl shadow-frost ${className}`} {...p}>{children}</div>
}

export function Button({ variant = 'primary', size = 'md', className = '', ...p }) {
  const v = {
    primary: 'bg-primary text-primary-fg hover:brightness-110',
    ghost: 'bg-surface text-fg border border-line hover:bg-surface-2',
    danger: 'bg-surface text-danger border border-danger/40 hover:bg-danger-soft',
    ok: 'bg-ok text-white hover:brightness-110',
    soft: 'bg-primary-soft text-primary hover:brightness-95',
  }[variant]
  const s = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' }[size]
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s} ${className}`} {...p} />
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-xs font-semibold text-muted mb-1.5 tracking-wide">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted/70 focus:outline-2 focus:outline-primary'
export const Input = (p) => <input {...p} className={`${inputCls} ${p.className || ''}`} />
export const Textarea = (p) => <textarea rows={3} {...p} className={`${inputCls} ${p.className || ''}`} />
export const Select = ({ children, ...p }) => <select {...p} className={`${inputCls} ${p.className || ''}`}>{children}</select>

export function Badge({ cls = 'bg-surface-2 text-muted', children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-primary' : 'bg-line'}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 border border-line">
      {tabs.map(([id, nome]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition ${value === id ? 'bg-surface text-fg shadow-frost' : 'text-muted hover:text-fg'}`}>
          {nome}
        </button>
      ))}
    </div>
  )
}

export function Alerta({ tipo = 'info', children, className = '' }) {
  const c = { info: 'bg-primary-soft text-primary', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', erro: 'bg-danger-soft text-danger' }[tipo]
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium ${c} ${className}`}>{children}</div>
}

export function Stat({ label, valor, sub, destaque }) {
  return (
    <Card className={`p-4 ${destaque ? 'ring-2 ring-primary/30' : ''}`}>
      <div className="text-xs font-semibold text-muted tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular">{valor}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </Card>
  )
}

export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path d="M8 22V10l8 7 8-7v12" fill="none" stroke="var(--primary-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Mart Digital
    </span>
  )
}

export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true } catch { return false }
}
