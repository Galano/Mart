import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Mockup from '../components/Mockup.jsx'
import { api, brl, publicoUrl } from '../lib.jsx'

const REDES = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', x: 'X',
}

function areaPadrao(p) {
  if (p.arte_fixa) return Object.keys(p.arte_fixa.areas)[0]
  return p.config.areas[0].id
}
function corPadrao(p) {
  if (p.arte_fixa?.cor) return p.config.cores.find((c) => c.id === p.arte_fixa.cor)?.hex
  return p.config.cores[0].hex
}

function Contador({ ate }) {
  const [agora, setAgora] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = Math.max(0, new Date(ate).getTime() - agora)
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60
  const p = (n) => String(n).padStart(2, '0')
  return <span className="tabular font-bold">{d > 0 && `${d}d `}{p(h)}:{p(m)}:{p(s)}</span>
}

function CardProduto({ p, loja, desconto, t }) {
  const preco = desconto ? p.preco * (1 - desconto.pct / 100) : p.preco
  const estilos = {
    essencial: 'rounded-2xl bg-white border border-black/5 shadow-sm',
    vitrine: 'rounded-3xl bg-white shadow-md',
    editorial: 'rounded-none bg-transparent border-t border-black/15 pt-4',
    vibrante: 'rounded-3xl bg-white shadow-lg ring-4 ring-[var(--sd)]/20',
  }[t]
  return (
    <Link to={`/loja/${loja.id}/${p.id}`} className={`group block overflow-hidden ${estilos}`}>
      <div className={`${t === 'editorial' ? 'bg-[#f2efe9]' : 'bg-gradient-to-b from-[#f6f7f9] to-[#eceff3]'} p-4 ${t === 'vitrine' ? 'sm:p-8' : ''}`}>
        <div className="mx-auto max-w-[260px] transition group-hover:scale-[1.03]">
          <Mockup mockup={p.mockup} area={areaPadrao(p)} cor={corPadrao(p)} arteSrc={publicoUrl(p.preview)} />
        </div>
      </div>
      <div className={t === 'editorial' ? 'pt-3' : 'p-4'}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-bold text-[#111827] ${t === 'editorial' ? 'font-serif text-xl' : ''} ${t === 'vibrante' ? 'uppercase tracking-wide' : ''}`}>{p.nome}</h3>
          {loja.mostrar_vendidos && p.vendidos > 0 && <span className="shrink-0 text-xs text-[#6b7280]">{p.vendidos} vendidos</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-[#6b7280]">{p.descricao}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="tabular">
            {desconto && <span className="mr-2 text-sm text-[#9ca3af] line-through">{brl(p.preco)}</span>}
            <span className="text-lg font-extrabold text-[#111827]">{p.personalizavel ? 'a partir de ' : ''}{brl(preco)}</span>
          </div>
          <span className="rounded-full bg-[var(--sp)] px-3 py-1.5 text-xs font-bold text-white">{p.personalizavel ? 'Personalizar' : 'Comprar'}</span>
        </div>
      </div>
    </Link>
  )
}

export default function Loja() {
  const { id, pagina = 'inicio' } = useParams()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { api(`/api/lojas/${id}`).then(setD).catch((e) => setErro(e.message)) }, [id])

  const filtrados = useMemo(() => (d?.produtos || []).filter((p) => (p.nome + p.categoria + p.descricao).toLowerCase().includes(q.toLowerCase())), [d, q])

  if (erro) return <div className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">Loja não encontrada</h1><p className="mt-2 text-muted">{erro}</p></div></div>
  if (!d) return <div className="grid min-h-screen place-items-center text-muted">Carregando loja...</div>

  const { loja } = d
  const t = loja.template
  const vars = { '--sp': loja.cor_primaria, '--sd': loja.cor_destaque, background: t === 'editorial' ? '#faf8f4' : '#ffffff', color: '#111827' }

  if (!d.disponivel) {
    return (
      <div style={vars} className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md">
          {loja.logo ? <img src={publicoUrl(loja.logo)} alt={loja.nome} className="mx-auto h-16 w-16 rounded-xl object-cover" /> : <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-[var(--sp)] text-2xl font-bold text-white">{loja.nome[0]}</div>}
          <h1 className="mt-4 text-2xl font-bold">{loja.nome}</h1>
          <p className="mt-2 text-[#6b7280]">{d.motivo === 'offline' ? 'A loja está temporariamente indisponível. Volte em breve.' : 'Esta loja está em aprovação pela Mart Digital.'}</p>
          {loja.email_contato && <p className="mt-4 text-sm text-[#6b7280]">Contato: {loja.email_contato}</p>}
        </div>
      </div>
    )
  }

  const temSobre = !!loja.descricao?.trim()
  const nav = [['inicio', 'Início'], ['produtos', 'Produtos'], ...(temSobre ? [['sobre', 'Sobre']] : []), ['contato', 'Contato']]
  const headerCls = {
    essencial: 'bg-white border-b border-black/5',
    vitrine: 'bg-white/90 backdrop-blur border-b border-black/5',
    editorial: 'bg-[#faf8f4] border-b border-black/15',
    vibrante: 'bg-gradient-to-r from-[var(--sp)] to-[var(--sd)] text-white',
  }[t]
  const linkCls = (on) => t === 'vibrante' ? `font-bold uppercase tracking-wide ${on ? 'underline underline-offset-4' : 'opacity-85'}` : `font-semibold ${on ? 'text-[var(--sp)]' : 'text-[#6b7280] hover:text-[#111827]'}`
  const grade = t === 'vitrine' ? 'sm:grid-cols-2' : t === 'editorial' ? 'sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10' : 'sm:grid-cols-2 lg:grid-cols-3'

  const Busca = (
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos" id="busca-loja"
      className={`w-full rounded-full border px-4 py-2 text-sm text-[#111827] sm:w-56 ${t === 'vibrante' ? 'border-white/40 bg-white/95' : 'border-black/10 bg-white'}`} />
  )

  return (
    <div style={vars} className={`min-h-screen ${t === 'editorial' ? 'font-sans' : ''}`}>
      {d.desconto && (
        <div className="bg-[var(--sd)] px-4 py-2 text-center text-sm font-semibold text-white">
          {d.desconto.mensagem}: {d.desconto.pct}% de desconto · termina em <Contador ate={d.desconto.ate} />
        </div>
      )}
      {d.demo && <div className="bg-[#111827] px-4 py-1.5 text-center text-xs font-semibold text-white">Loja demonstração · catálogo Mart Digital com preços sugeridos. Os pedidos funcionam normalmente.</div>}

      <header className={`sticky top-0 z-20 ${headerCls}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link to={`/s/${loja.id}`} className="flex items-center gap-2.5">
            {loja.logo ? <img src={publicoUrl(loja.logo)} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className={`grid h-9 w-9 place-items-center rounded-lg font-bold ${t === 'vibrante' ? 'bg-white text-[var(--sp)]' : 'bg-[var(--sp)] text-white'}`}>{loja.nome[0]}</span>}
            <span className={`text-lg font-extrabold ${t === 'editorial' ? 'font-serif' : ''}`}>{loja.nome}</span>
          </Link>
          <nav className="order-3 flex w-full gap-5 text-sm sm:order-none sm:w-auto">
            {nav.map(([k, n]) => <Link key={k} to={k === 'inicio' ? `/s/${loja.id}` : `/s/${loja.id}/${k}`} className={linkCls(pagina === k)}>{n}</Link>)}
          </nav>
          <div className="ml-auto">{Busca}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {pagina === 'inicio' && !q && (
          <section className={`mt-6 overflow-hidden ${t === 'editorial' ? 'border-b border-black/15 pb-10' : 'rounded-3xl'} relative`}
            style={t === 'editorial' ? {} : { background: loja.banner ? `center/cover url(${publicoUrl(loja.banner)})` : `linear-gradient(120deg, ${loja.cor_primaria}, ${loja.cor_destaque})` }}>
            <div className={t === 'editorial' ? 'grid gap-6 md:grid-cols-2 md:items-end' : `px-6 py-14 sm:px-12 ${t === 'vitrine' ? 'sm:py-24' : ''} ${loja.banner ? 'bg-black/35' : ''} text-white`}>
              <div>
                <h1 className={`${t === 'editorial' ? 'font-serif text-5xl leading-[1.05] text-[#111827]' : 'text-4xl font-extrabold sm:text-5xl'} ${t === 'vibrante' ? 'uppercase' : ''} max-w-2xl`}>{loja.frase || loja.nome}</h1>
                <p className={`mt-3 max-w-xl ${t === 'editorial' ? 'text-[#6b7280]' : 'text-white/90'}`}>{loja.descricao || 'Produtos personalizados feitos sob encomenda para você.'}</p>
                <Link to={`/s/${loja.id}/produtos`} className={`mt-6 inline-block rounded-full px-6 py-3 text-sm font-bold ${t === 'editorial' ? 'bg-[#111827] text-white' : 'bg-white text-[#111827]'}`}>Ver produtos</Link>
              </div>
              {t === 'editorial' && loja.banner && <img src={publicoUrl(loja.banner)} alt="" className="aspect-[4/3] w-full object-cover" />}
            </div>
          </section>
        )}

        {(pagina === 'inicio' || pagina === 'produtos' || q) && (
          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between">
              <h2 className={`text-2xl font-extrabold ${t === 'editorial' ? 'font-serif font-semibold' : ''} ${t === 'vibrante' ? 'uppercase' : ''}`}>{q ? `Resultados para “${q}”` : pagina === 'inicio' ? 'Destaques' : 'Todos os produtos'}</h2>
              <span className="text-sm text-[#6b7280]">{filtrados.length} produtos</span>
            </div>
            {filtrados.length ? (
              <div className={`grid gap-6 ${grade}`}>{(pagina === 'inicio' && !q ? filtrados.slice(0, 6) : filtrados).map((p) => <CardProduto key={p.id} p={p} loja={loja} desconto={d.desconto} t={t} />)}</div>
            ) : <p className="text-[#6b7280]">Nenhum produto encontrado.</p>}
          </section>
        )}

        {pagina === 'sobre' && temSobre && !q && (
          <section className="mx-auto mt-12 max-w-2xl">
            <h1 className={`text-3xl font-extrabold ${t === 'editorial' ? 'font-serif font-semibold' : ''}`}>Sobre a {loja.nome}</h1>
            <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-[#374151]">{loja.descricao}</p>
          </section>
        )}

        {pagina === 'contato' && !q && (
          <section className="mx-auto mt-12 max-w-2xl">
            <h1 className={`text-3xl font-extrabold ${t === 'editorial' ? 'font-serif font-semibold' : ''}`}>Contato</h1>
            <div className="mt-6 grid gap-3">
              {loja.email_contato && <div className="rounded-2xl border border-black/10 p-4"><div className="text-xs font-semibold text-[#6b7280]">E-mail</div><div className="font-semibold select-all">{loja.email_contato}</div></div>}
              {loja.whatsapp && <a href={`https://wa.me/55${loja.whatsapp}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-black/10 p-4"><div className="text-xs font-semibold text-[#6b7280]">WhatsApp</div><div className="font-semibold">{loja.whatsapp}</div></a>}
              {Object.entries(loja.redes || {}).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noreferrer" className="rounded-2xl border border-black/10 p-4"><div className="text-xs font-semibold text-[#6b7280]">{REDES[k]}</div><div className="truncate font-semibold">{v}</div></a>)}
              {!loja.email_contato && !loja.whatsapp && <p className="text-[#6b7280]">A loja ainda não cadastrou formas de contato.</p>}
            </div>
          </section>
        )}
      </main>

      <footer className={`${t === 'vibrante' ? 'bg-[var(--sp)] text-white' : 'border-t border-black/10'} `}>
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          <div>
            <div className={`text-lg font-extrabold ${t === 'editorial' ? 'font-serif' : ''}`}>{loja.nome}</div>
            {loja.frase && <p className="mt-1 text-sm opacity-75">{loja.frase}</p>}
          </div>
          <div className="text-sm opacity-80 space-y-1">
            {loja.email_contato && <div>{loja.email_contato}</div>}
            {loja.whatsapp && <div>WhatsApp {loja.whatsapp}</div>}
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            {Object.entries(loja.redes || {}).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noreferrer" className="opacity-80 hover:opacity-100">{REDES[k]}</a>)}
          </div>
        </div>
        <div className="pb-6 text-center text-xs opacity-60">Produzido e enviado por Mart Digital</div>
      </footer>

      <div className="fixed bottom-5 right-5 z-30 flex flex-col gap-3">
        {loja.instagram_fixo && loja.redes?.instagram && (
          <a href={loja.redes.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#515bd4] text-white shadow-lg">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
          </a>
        )}
        {loja.whatsapp_fixo && loja.whatsapp && (
          <a href={`https://wa.me/55${loja.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid h-12 w-12 place-items-center rounded-full bg-[#25d366] text-white shadow-lg">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" /></svg>
          </a>
        )}
      </div>
    </div>
  )
}
