import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Mockup from '../components/Mockup.jsx'
import { api, useAuth, Button, Card, Field, Input, Alerta, Logo, Tabs } from '../lib.jsx'

const PASSOS = [
  ['Crie sua loja', 'Nome, logo, cores e um dos quatro templates. Sua loja já abre como demonstração.'],
  ['Escolha produtos', 'Camisetas, canecas e copos do catálogo. Você define o preço e vê o lucro na hora.'],
  ['Venda e receba', 'O cliente personaliza no estúdio e paga. Nós produzimos, embalamos e enviamos.'],
]

function AuthBox() {
  const { entrar } = useAuth()
  const nav = useNavigate()
  const [modo, setModo] = useState('entrar')
  const [f, setF] = useState({ nome: '', email: '', senha: '', nome_loja: '' })
  const [msg, setMsg] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function enviar(e) {
    e.preventDefault(); setMsg(null); setCarregando(true)
    try {
      if (modo === 'entrar') {
        const u = await entrar(f.email, f.senha)
        nav(u.roles.includes('admin') ? '/admin' : '/painel')
      } else if (modo === 'criar') {
        const r = await api('/api/auth/cadastro', { method: 'POST', body: f })
        setMsg({ tipo: 'ok', texto: r.mensagem, link: r.link_confirmacao, rotulo: 'Abrir link de confirmação (simulado)' })
      } else {
        const r = await api('/api/auth/esqueci', { method: 'POST', body: { email: f.email } })
        setMsg({ tipo: 'ok', texto: r.mensagem, link: r.link, rotulo: 'Abrir link de redefinição (simulado)' })
      }
    } catch (err) { setMsg({ tipo: 'erro', texto: err.message }) } finally { setCarregando(false) }
  }

  return (
    <Card className="p-6 bg-frost backdrop-blur">
      <Tabs value={modo} onChange={(m) => { setModo(m); setMsg(null) }} tabs={[['entrar', 'Entrar'], ['criar', 'Criar loja'], ['esqueci', 'Esqueci a senha']]} />
      <form onSubmit={enviar} className="mt-5 space-y-3">
        {modo === 'criar' && <>
          <Field label="Seu nome"><Input id="nome" required value={f.nome} onChange={set('nome')} placeholder="Maria Silva" /></Field>
          <Field label="Nome da loja"><Input id="nome_loja" required value={f.nome_loja} onChange={set('nome_loja')} placeholder="Estampa da Maria" /></Field>
        </>}
        <Field label="E-mail"><Input id="email" type="email" required value={f.email} onChange={set('email')} placeholder="voce@email.com" /></Field>
        {modo !== 'esqueci' && <Field label="Senha"><Input id="senha" type="password" required minLength={6} value={f.senha} onChange={set('senha')} placeholder="mínimo 6 caracteres" /></Field>}
        {msg && (
          <Alerta tipo={msg.tipo}>
            {msg.texto}
            {msg.link && <div className="mt-1"><Link className="underline" to={msg.link}>{msg.rotulo}</Link></div>}
          </Alerta>
        )}
        <Button className="w-full" size="lg" disabled={carregando}>
          {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar minha loja grátis' : 'Enviar link'}
        </Button>
        {modo !== 'esqueci' && (
          <Button type="button" variant="ghost" className="w-full" onClick={() => api('/api/auth/google', { method: 'POST' }).catch((e) => setMsg({ tipo: 'warn', texto: e.message }))}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
            Continuar com Google
          </Button>
        )}
      </form>
      <div className="mt-5 rounded-xl border border-dashed border-line p-3 text-xs text-muted">
        <div className="font-semibold text-fg">Acessos de demonstração</div>
        <div className="mt-1 grid gap-0.5 tabular">
          <span>Admin: admin@martdigital.com.br · admin123</span>
          <span>Lojista: lojista@demo.com · demo123</span>
          <span>Lojista sem produtos: nova@demo.com · demo123</span>
        </div>
      </div>
    </Card>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [cor, setCor] = useState(0)
  const cores = ['#f8f8f6', '#1f2a44', '#c8102e', '#0f7a3a', '#e0287d']
  useEffect(() => { const t = setInterval(() => setCor((c) => (c + 1) % cores.length), 1800); return () => clearInterval(t) }, [])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-frost backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/s/estampa-viva" className="hidden sm:inline px-3 py-2 font-semibold text-muted hover:text-fg">Ver loja exemplo</Link>
            {user && <Link to={user.roles.includes('admin') ? '/admin' : '/painel'}><Button size="sm">Ir para o painel</Button></Link>}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1.1fr_420px] lg:py-16">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">Print-on-demand · produção em São Paulo</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Sua marca de produtos personalizados, sem estoque.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">Você monta a loja e define os preços. Quando o cliente compra, a Mart Digital produz e envia direto para ele. Seu lucro cai no painel.</p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {['camiseta', 'caneca', 'copo'].map((m, i) => (
              <Card key={m} className="p-3">
                <Mockup mockup={m} area={m === 'caneca' ? 'estampa' : 'frente'} cor={m === 'camiseta' ? cores[cor] : m === 'caneca' ? '#f8f8f6' : '#c9ccd1'} />
                <div className="mt-1 text-center text-xs font-semibold text-muted">{['Camisetas', 'Canecas', 'Copos térmicos'][i]}</div>
              </Card>
            ))}
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {PASSOS.map(([t, d], i) => (
              <li key={t}>
                <div className="text-xs font-bold text-primary">Passo {i + 1}</div>
                <div className="mt-1 font-bold">{t}</div>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:pt-6"><AuthBox /></div>
      </section>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">Mart Digital · POC para validação · dados de exemplo</footer>
    </div>
  )
}
