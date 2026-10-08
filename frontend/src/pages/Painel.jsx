import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Mockup from '../components/Mockup.jsx'
import Studio, { alternarArea, areasIniciais, exportarArea } from '../components/Studio.jsx'
import {
  api, arquivoUrl, brl, copiar, dataBR, publicoUrl, useAuth, Alerta, Badge, Button, Card, Field, Input, Logo,
  Select, Stat, STATUS_PAG, STATUS_PEDIDO, Tabs, Textarea, Toggle,
} from '../lib.jsx'

const TEMPLATES = [
  ['essencial', 'Essencial', 'Limpo, grade de produtos'],
  ['vitrine', 'Vitrine', 'Banner grande, cards amplos'],
  ['editorial', 'Editorial', 'Serifado, estilo revista'],
  ['vibrante', 'Vibrante', 'Cores fortes, degradê'],
]

export default function Painel() {
  const { user, sair } = useAuth()
  const [tab, setTab] = useState('visao')
  const [resumo, setResumo] = useState(null)
  const recarregar = () => api('/api/painel/resumo').then(setResumo).catch(() => {})
  useEffect(() => { if (user && user.roles.includes('lojista')) recarregar() }, [user, tab])

  if (user === undefined) return <div className="grid min-h-screen place-items-center text-muted">Carregando...</div>
  if (!user) return <Navigate to="/" replace />
  if (user.roles.includes('admin')) return <Navigate to="/admin" replace />

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-frost backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/"><Logo /></Link>
          <span className="hidden text-sm text-muted sm:inline">· {resumo?.loja.nome}</span>
          <div className="ml-auto flex items-center gap-2">
            {resumo && <a href={`/s/${resumo.loja.id}`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost">Ver loja</Button></a>}
            <Button size="sm" variant="ghost" onClick={sair}>Sair</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Tabs value={tab} onChange={setTab} tabs={[['visao', 'Visão geral'], ['loja', 'Minha loja'], ['produtos', 'Produtos'], ['pedidos', 'Pedidos'], ['ganhos', 'Ganhos']]} />
        <div className="mt-6">
          {!resumo ? <p className="text-muted">Carregando...</p> : <>
            {tab === 'visao' && <Visao r={resumo} irPara={setTab} />}
            {tab === 'loja' && <MinhaLoja r={resumo} onSalvo={recarregar} />}
            {tab === 'produtos' && <Produtos />}
            {tab === 'pedidos' && <Pedidos />}
            {tab === 'ganhos' && <Ganhos />}
          </>}
        </div>
      </main>
    </div>
  )
}

// ------------------------------------------------------------ visao geral
function Visao({ r, irPara }) {
  const link = `${window.location.origin}/s/${r.loja.id}`
  const [ok, setOk] = useState(false)
  return (
    <div className="space-y-5">
      {r.status_conta === 'pendente' && <Alerta tipo="warn">Sua conta está em aprovação pela Mart Digital. Você já pode montar a loja, mas ela só recebe pedidos depois de aprovada.</Alerta>}
      {r.demo && <Alerta>Sua loja ainda não tem produtos e abre como <b>demonstração</b>, com o catálogo da Mart Digital pelos preços sugeridos. Já dá para divulgar e receber pedidos. <button className="underline font-semibold" onClick={() => irPara('produtos')}>Escolher produtos</button></Alerta>}
      {!r.loja.online && <Alerta tipo="erro">Sua loja está offline. Clientes veem uma página de indisponível e não conseguem comprar.</Alerta>}
      <Card className="p-5">
        <div className="text-sm font-bold">Link da sua loja</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-semibold select-all">{link}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={async () => { setOk(await copiar(link)); setTimeout(() => setOk(false), 1500) }}>{ok ? 'Copiado' : 'Copiar'}</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Conheça minha loja ${r.loja.nome}: ${link}`)}`} target="_blank" rel="noreferrer"><Button variant="ok">WhatsApp</Button></a>
            <a href={`/s/${r.loja.id}`} target="_blank" rel="noreferrer"><Button>Ver loja</Button></a>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Vendas confirmadas" valor={brl(r.vendas)} />
        <Stat label="Pedidos" valor={r.pedidos} sub={r.aguardando ? `${r.aguardando} aguardando pagamento` : 'nenhum aguardando'} />
        <Stat label="Ganho disponível" valor={brl(r.ganhos.disponivel)} destaque />
        <Stat label="Ganho previsto" valor={brl(r.ganhos.previsto)} sub="libera 7 dias após o pagamento" />
      </div>
    </div>
  )
}

// ------------------------------------------------------------ minha loja
function MinhaLoja({ r, onSalvo }) {
  const [f, setF] = useState(() => ({ ...r.loja, redes: { facebook: '', tiktok: '', youtube: '', x: '', instagram: '', ...r.loja.redes }, escassez: { ativo: false, mensagem: '', desconto: 10, ate: '', ...r.loja.escassez }, online: !!r.loja.online, whatsapp_fixo: !!r.loja.whatsapp_fixo, instagram_fixo: !!r.loja.instagram_fixo, mostrar_vendidos: !!r.loja.mostrar_vendidos }))
  const [msg, setMsg] = useState(null)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const logoRef = useRef(), bannerRef = useRef()

  async function upload(campo, e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    const fd = new FormData(); fd.append('arquivo', file)
    try { const r2 = await api(`/api/painel/loja/upload/${campo}`, { method: 'POST', form: fd }); set(campo, r2.arquivo) } catch (err) { setMsg({ tipo: 'erro', texto: err.message }) }
  }
  async function salvar() {
    setMsg(null)
    try { await api('/api/painel/loja', { method: 'PUT', body: f }); setMsg({ tipo: 'ok', texto: 'Loja salva.' }); onSalvo() } catch (err) { setMsg({ tipo: 'erro', texto: err.message }) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5 space-y-4">
        <h2 className="font-bold">Identidade</h2>
        <Field label="Nome da loja"><Input id="l-nome" value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted">Logo</div>
            <button onClick={() => logoRef.current.click()} className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2 text-xs text-muted">
              {f.logo ? <img src={publicoUrl(f.logo)} alt="Logo" className="h-full w-full object-cover" /> : 'Enviar'}
            </button>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload('logo', e)} />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted">Banner</div>
            <button onClick={() => bannerRef.current.click()} className="grid h-24 w-full place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2 text-xs text-muted">
              {f.banner ? <img src={publicoUrl(f.banner)} alt="Banner" className="h-full w-full object-cover" /> : 'Enviar'}
            </button>
            <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload('banner', e)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cor primária"><div className="flex gap-2"><input type="color" value={f.cor_primaria} onChange={(e) => set('cor_primaria', e.target.value)} className="h-10 w-12 rounded-lg border border-line" aria-label="Cor primária" /><Input value={f.cor_primaria} onChange={(e) => set('cor_primaria', e.target.value)} /></div></Field>
          <Field label="Cor de destaque"><div className="flex gap-2"><input type="color" value={f.cor_destaque} onChange={(e) => set('cor_destaque', e.target.value)} className="h-10 w-12 rounded-lg border border-line" aria-label="Cor de destaque" /><Input value={f.cor_destaque} onChange={(e) => set('cor_destaque', e.target.value)} /></div></Field>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted">Template</div>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(([id, nome, desc]) => (
              <button key={id} onClick={() => set('template', id)} className={`rounded-xl border p-2 text-left ${f.template === id ? 'border-primary ring-2 ring-primary/25' : 'border-line'}`}>
                <div className="h-14 overflow-hidden rounded-lg" style={{ background: id === 'vibrante' ? `linear-gradient(120deg, ${f.cor_primaria}, ${f.cor_destaque})` : id === 'editorial' ? '#faf8f4' : '#fff', border: '1px solid rgba(0,0,0,.06)' }}>
                  <div className={`m-1.5 h-2 w-10 rounded ${id === 'vibrante' ? 'bg-white/90' : ''}`} style={id !== 'vibrante' ? { background: f.cor_primaria } : {}} />
                  <div className={`mx-1.5 grid gap-1 ${id === 'vitrine' ? 'grid-cols-2' : 'grid-cols-3'}`}>{[0, 1, 2].slice(0, id === 'vitrine' ? 2 : 3).map((i) => <div key={i} className="h-6 rounded bg-black/10" />)}</div>
                </div>
                <div className={`mt-1.5 text-sm font-bold ${id === 'editorial' ? 'font-serif' : ''}`}>{nome}</div>
                <div className="text-xs text-muted">{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
          <div><div className="text-sm font-bold">Loja {f.online ? 'online' : 'offline'}</div><div className="text-xs text-muted">Offline mostra página de indisponível e bloqueia pedidos</div></div>
          <Toggle checked={f.online} onChange={(v) => set('online', v)} />
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="p-5 space-y-3">
          <h2 className="font-bold">Sobre e rodapé</h2>
          <Field label="Descrição da loja" hint="A aba Sobre só aparece na loja quando há texto aqui"><Textarea id="l-desc" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></Field>
          <Field label="Frase de efeito"><Input id="l-frase" value={f.frase} onChange={(e) => set('frase', e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-mail de contato"><Input id="l-email" value={f.email_contato} onChange={(e) => set('email_contato', e.target.value)} /></Field>
            <Field label="WhatsApp"><Input id="l-wpp" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="11999990000" /></Field>
          </div>
          <Toggle checked={f.whatsapp_fixo} onChange={(v) => set('whatsapp_fixo', v)} label="Fixar atalho do WhatsApp na loja" />
        </Card>
        <Card className="p-5 space-y-3">
          <h2 className="font-bold">Redes sociais</h2>
          {['instagram', 'facebook', 'tiktok', 'youtube', 'x'].map((k) => (
            <Field key={k} label={{ instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', x: 'X' }[k]}>
              <Input id={`l-${k}`} value={f.redes[k]} onChange={(e) => set('redes', { ...f.redes, [k]: e.target.value })} placeholder="https://" />
            </Field>
          ))}
          <Toggle checked={f.instagram_fixo} onChange={(v) => set('instagram_fixo', v)} label="Fixar botão do Instagram" />
        </Card>
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-bold">Contador de escassez</h2><Toggle checked={f.escassez.ativo} onChange={(v) => set('escassez', { ...f.escassez, ativo: v })} /></div>
          {f.escassez.ativo && <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Mensagem" className="sm:col-span-3"><Input id="l-esc-msg" value={f.escassez.mensagem} onChange={(e) => set('escassez', { ...f.escassez, mensagem: e.target.value })} /></Field>
            <Field label="Desconto %" hint="Aplicado no servidor, máx. 50%"><Input id="l-esc-pct" type="number" min="0" max="50" value={f.escassez.desconto} onChange={(e) => set('escassez', { ...f.escassez, desconto: e.target.value })} /></Field>
            <Field label="Termina em" className="sm:col-span-2"><Input id="l-esc-ate" type="datetime-local" value={f.escassez.ate} onChange={(e) => set('escassez', { ...f.escassez, ate: e.target.value })} /></Field>
          </div>}
          <div className="border-t border-line pt-3"><Toggle checked={f.mostrar_vendidos} onChange={(v) => set('mostrar_vendidos', v)} label="Mostrar quantidade vendida nos produtos" /></div>
          <Field label="Chave Pix para repasses"><Input id="l-pix" value={f.chave_pix} onChange={(e) => set('chave_pix', e.target.value)} /></Field>
        </Card>
        {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
        <Button size="lg" className="w-full" onClick={salvar}>Salvar loja</Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ produtos
function Produtos() {
  const [lista, setLista] = useState(null)
  const [editando, setEditando] = useState(null)   // null | 'novo' | produto
  const carregar = () => api('/api/painel/produtos').then(setLista)
  useEffect(() => { carregar() }, [])

  if (editando) return <EditorProduto atual={editando === 'novo' ? null : editando} onFechar={() => { setEditando(null); carregar() }} />
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Meus produtos</h2>
        <Button onClick={() => setEditando('novo')}>Montar minha loja: adicionar produto</Button>
      </div>
      {lista?.length === 0 && <Alerta>Nenhum produto ainda. Sua loja está no modo demonstração.</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista?.map((p) => {
          const area = p.arte_fixa ? Object.keys(p.arte_fixa.areas)[0] : undefined
          return (
            <Card key={p.id} className="overflow-hidden">
              <div className="bg-surface-2 p-4"><div className="mx-auto max-w-[180px]"><Mockup mockup={p.mockup} area={area} cor={p.arte_fixa?.corHex || '#f8f8f6'} arteSrc={publicoUrl(p.preview)} /></div></div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2"><div className="font-bold">{p.nome}</div><Badge cls={p.ativo ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'}>{p.ativo ? 'Publicado' : 'Pausado'}</Badge></div>
                <div className="text-xs text-muted">{p.base_nome} · {p.personalizavel ? 'Personalizável' : 'Arte fixa'}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs tabular">
                  <div className="rounded-lg bg-surface-2 p-2"><div className="text-muted">Custo</div><div className="font-bold">{brl(p.lucro.custo)}</div></div>
                  <div className="rounded-lg bg-surface-2 p-2"><div className="text-muted">Venda</div><div className="font-bold">{brl(p.preco_venda)}</div></div>
                  <div className="rounded-lg bg-ok-soft p-2 text-ok"><div>Lucro</div><div className="font-bold">{brl(p.lucro.lucro)}</div></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditando(p)}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={async () => { await api(`/api/painel/produtos/${p.id}`, { method: 'DELETE' }); carregar() }}>Remover</Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function EditorProduto({ atual, onFechar }) {
  const [cat, setCat] = useState(null)
  const [q, setQ] = useState('')
  const [base, setBase] = useState(null)
  const [f, setF] = useState(null)
  const [areasSel, setAreasSel] = useState([])
  const [camadas, setCamadas] = useState({})
  const [lucro, setLucro] = useState(null)
  const [msg, setMsg] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [modelos, setModelos] = useState([])

  useEffect(() => { api(`/api/painel/catalogo?q=${encodeURIComponent(q)}`).then(setCat) }, [q])
  useEffect(() => { api('/api/modelos-arte').then(setModelos).catch(() => {}) }, [])
  useEffect(() => {
    if (!atual || !cat || base) return
    const b = cat.produtos.find((p) => p.id === atual.product_id)
    if (b) escolher(b, atual)
  }, [cat])

  function escolher(b, a = null) {
    setBase(b)
    setF({ nome: a?.nome || b.nome, descricao: a?.descricao || b.descricao, categoria: a?.categoria || b.categoria, preco_venda: a?.preco_venda || b.preco_sugerido, personalizavel: a ? !!a.personalizavel : true, ativo: a ? !!a.ativo : true, cor: a?.arte_fixa?.cor || b.config.cores[0].id })
    if (a?.arte_fixa) { setAreasSel(Object.keys(a.arte_fixa.areas)); setCamadas(a.arte_fixa.areas) } else { setAreasSel(areasIniciais(b.config.areas)); setCamadas({}) }
  }

  const areasLucro = f && !f.personalizavel ? areasSel : []
  useEffect(() => {
    if (!base || !f?.preco_venda) return
    const t = setTimeout(() => api('/api/painel/lucro', { method: 'POST', body: { product_id: base.id, preco_venda: Number(f.preco_venda), areas: areasLucro } }).then(setLucro).catch(() => {}), 200)
    return () => clearTimeout(t)
  }, [base, f?.preco_venda, f?.personalizavel, areasSel.join()])

  async function salvar() {
    setMsg(null); setSalvando(true)
    try {
      let arte_fixa = null, preview = null
      if (!f.personalizavel) {
        const usadas = areasSel.filter((a) => (camadas[a] || []).length)
        if (!usadas.length) throw new Error('Monte a arte no estúdio antes de publicar um produto com arte fixa.')
        const areas = Object.fromEntries(usadas.map((a) => [a, camadas[a]]))
        preview = await exportarArea(camadas[usadas[0]], base.config.areas.find((x) => x.id === usadas[0]).cm)
        arte_fixa = { areas, cor: f.cor, corHex: base.config.cores.find((c) => c.id === f.cor)?.hex }
      }
      const body = { product_id: base.id, nome: f.nome, descricao: f.descricao, categoria: f.categoria, preco_venda: Number(f.preco_venda), personalizavel: f.personalizavel, ativo: f.ativo, arte_fixa, preview }
      if (atual) await api(`/api/painel/produtos/${atual.id}`, { method: 'PUT', body })
      else await api('/api/painel/produtos', { method: 'POST', body })
      onFechar()
    } catch (err) { setMsg(err.message) } finally { setSalvando(false) }
  }

  if (!base) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={onFechar}>← Voltar</Button>
          <h2 className="text-lg font-bold">Escolha um produto do catálogo</h2>
          <Input id="busca-cat" className="ml-auto max-w-xs" placeholder="Buscar no catálogo" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cat?.produtos.map((p) => (
            <button key={p.id} onClick={() => escolher(p)} className="text-left">
              <Card className="overflow-hidden transition hover:ring-2 hover:ring-primary/30">
                <div className="bg-surface-2 p-4"><div className="mx-auto max-w-[170px]"><Mockup mockup={p.mockup} area={p.config.areas[0].id} cor={p.config.cores[0].hex} /></div></div>
                <div className="p-4">
                  <div className="text-xs font-semibold text-muted">{p.categoria} · {p.metodo}</div>
                  <div className="font-bold">{p.nome}</div>
                  <div className="mt-2 flex justify-between text-sm tabular"><span className="text-muted">Custo <b className="text-fg">{brl(p.custo)}</b></span><span className="text-muted">Sugerido <b className="text-fg">{brl(p.preco_sugerido)}</b></span></div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const corHex = base.config.cores.find((c) => c.id === f.cor)?.hex
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => (atual ? onFechar() : setBase(null))}>← Voltar</Button>
        <h2 className="text-lg font-bold">{atual ? 'Editar produto' : 'Novo produto'} · {base.nome}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5 min-w-0">
          <Card className="p-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome na loja"><Input id="p-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
              <Field label="Categoria"><Input id="p-cat" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} /></Field>
            </div>
            <Field label="Descrição"><Textarea id="p-desc" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
            <div className="text-xs text-muted">Método de produção: <b className="text-fg">{base.metodo}</b></div>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-bold">Como o cliente compra</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button onClick={() => setF({ ...f, personalizavel: true })} className={`rounded-xl border p-3 text-left ${f.personalizavel ? 'border-primary bg-primary-soft' : 'border-line'}`}>
                <div className="font-semibold">Estúdio habilitado</div><div className="text-xs text-muted">O cliente cria a própria arte. Adicionais de estampa são repassados a ele.</div>
              </button>
              <button onClick={() => setF({ ...f, personalizavel: false })} className={`rounded-xl border p-3 text-left ${!f.personalizavel ? 'border-primary bg-primary-soft' : 'border-line'}`}>
                <div className="font-semibold">Arte fixa</div><div className="text-xs text-muted">Você monta a arte e publica pronto. O cliente só escolhe modelo e tamanho.</div>
              </button>
            </div>
            {f.personalizavel && (
              <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
                <div className="font-semibold">Adicionais cobrados do cliente</div>
                <ul className="mt-1 grid gap-0.5 text-xs text-muted sm:grid-cols-2">
                  {base.config.areas.map((a) => <li key={a.id}>{a.nome}: {a.adicional ? brl(a.adicional) : 'incluso'}</li>)}
                  {base.config.opcoes.flatMap((o) => o.tipo === 'bool' ? [<li key={o.id}>{o.nome}: {brl(o.adicional)}</li>] : [])}
                </ul>
              </div>
            )}
          </Card>
          {!f.personalizavel && (
            <Card className="p-4 sm:p-5">
              {base.config.cores.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold mr-1">Cor da peça</span>
                  {base.config.cores.map((c) => <button key={c.id} title={c.nome} aria-label={c.nome} onClick={() => setF({ ...f, cor: c.id })} className={`h-7 w-7 rounded-full border border-black/15 ${f.cor === c.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}`} style={{ background: c.hex }} />)}
                </div>
              )}
              <Studio produto={base} cor={corHex} areasSel={areasSel} onToggleArea={(a) => setAreasSel((s) => alternarArea(base.config.areas, s, a))}
                camadas={camadas} setCamadas={setCamadas} modelosArte={modelos} precoArea={(a) => (a.adicional ? `custo + ${brl(a.adicional)}` : 'incluso')} />
            </Card>
          )}
        </div>
        <div>
          <Card className="p-5 space-y-3 lg:sticky lg:top-20">
            <div className="grid grid-cols-2 gap-2 text-sm tabular">
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-xs text-muted">Custo Mart Digital</div><div className="font-bold">{brl(lucro?.custo ?? base.custo)}</div></div>
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-xs text-muted">Preço sugerido</div><div className="font-bold">{brl(base.preco_sugerido)}</div></div>
            </div>
            <Field label="Seu preço de venda (R$)"><Input id="p-preco" type="number" step="0.01" min="0" value={f.preco_venda} onChange={(e) => setF({ ...f, preco_venda: e.target.value })} /></Field>
            {lucro && (
              <div className={`rounded-xl p-3 ${lucro.lucro >= 0 ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'}`}>
                <div className="text-xs font-semibold">Lucro previsto por unidade</div>
                <div className="text-2xl font-extrabold tabular">{brl(lucro.lucro)}</div>
                <div className="text-xs opacity-80 tabular">venda − custo {brl(lucro.custo)}{lucro.taxa > 0 && ` − taxa ${brl(lucro.taxa)}`}</div>
              </div>
            )}
            <Toggle checked={f.ativo} onChange={(v) => setF({ ...f, ativo: v })} label="Publicar na loja" />
            {msg && <Alerta tipo="erro">{msg}</Alerta>}
            <Button size="lg" className="w-full" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar produto'}</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ pedidos
export function DetalhePedido({ o, admin = false }) {
  const it = o.item
  return (
    <div className="grid gap-4 bg-surface-2 p-4 text-sm md:grid-cols-3">
      <div>
        <div className="text-xs font-bold text-muted">Item</div>
        <div className="font-semibold">{it.nome_loja_produto}</div>
        <div className="text-muted">{it.modelo} · {it.tamanho} · cor {it.cor} · {it.qtd}×</div>
        <div className="mt-1 text-xs text-muted">{it.adicionais.map((a) => `${a.nome}${a.valor ? ` (${brl(a.valor)})` : ''}`).join(' · ')}</div>
        {Object.entries(it.opcoes || {}).length > 0 && <div className="text-xs text-muted">Opções: {Object.entries(it.opcoes).map(([k, v]) => `${k}: ${v === true ? 'sim' : v === false ? 'não' : v}`).join(' · ')}</div>}
        {Object.entries(it.camadas || {}).map(([a, ls]) => <div key={a} className="text-xs text-muted">{a}: {ls.length} camada(s) {ls.map((l) => l.texto ? `“${l.texto.replace(/\n/g, ' ')}”` : '').filter(Boolean).join(', ')}</div>)}
      </div>
      <div>
        <div className="text-xs font-bold text-muted">Cliente e entrega</div>
        <div className="font-semibold">{o.cliente.nome}</div>
        {admin && <div className="text-muted">{o.cliente.email} · {o.cliente.telefone}</div>}
        <div className="text-muted">{o.cliente.endereco}, {o.cliente.numero} {o.cliente.complemento} · {o.cliente.cidade}/{o.cliente.uf} · {o.cliente.cep}</div>
        <div className="mt-1 text-muted">{o.frete.servico} · {brl(o.frete.valor)} · {o.frete.prazo}</div>
        {o.rastreio && <div className="mt-1">Rastreio: <b className="select-all">{o.rastreio}</b></div>}
      </div>
      <div>
        <div className="text-xs font-bold text-muted">Artes de produção</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {o.artes.map((a) => (
            <a key={a.id} href={arquivoUrl(a.arquivo)} target="_blank" rel="noreferrer" download className="block w-20 text-center">
              <img src={arquivoUrl(a.arquivo)} alt={a.area} className="h-20 w-20 rounded-lg border border-line bg-[conic-gradient(#eee_25%,#fff_0_50%,#eee_0_75%,#fff_0)] bg-[length:12px_12px] object-contain" />
              <span className="text-[11px] text-muted">{a.area} · {a.largura_px}px</span>
            </a>
          ))}
          {!o.artes.length && <span className="text-muted">sem arquivos</span>}
        </div>
      </div>
    </div>
  )
}

function Pedidos() {
  const [lista, setLista] = useState(null)
  const [aberto, setAberto] = useState(null)
  useEffect(() => { api('/api/painel/pedidos').then(setLista) }, [])
  if (!lista) return <p className="text-muted">Carregando...</p>
  if (!lista.length) return <Alerta>Nenhum pedido ainda. Compartilhe o link da sua loja.</Alerta>
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted"><tr>{['#', 'Data', 'Produto', 'Cliente', 'Total', 'Seu ganho', 'Pagamento', 'Status', 'Rastreio'].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {lista.map((o) => (
              <FragmentoLinha key={o.id} aberto={aberto === o.id} onClick={() => setAberto(aberto === o.id ? null : o.id)} o={o}
                celulas={[`#${o.id}`, dataBR(o.criado_em), o.item.nome_loja_produto, o.cliente.nome, brl(o.total), <b className="text-ok">{brl(o.ganho_lojista)}</b>,
                  <Badge cls={STATUS_PAG[o.status_pagamento][1]}>{STATUS_PAG[o.status_pagamento][0]}</Badge>, <Badge cls={STATUS_PEDIDO[o.status][1]}>{STATUS_PEDIDO[o.status][0]}</Badge>, o.rastreio || '—']} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function FragmentoLinha({ o, celulas, aberto, onClick, admin, colSpan = 9 }) {
  return <>
    <tr onClick={onClick} className="cursor-pointer border-t border-line hover:bg-surface-2">{celulas.map((c, i) => <td key={i} className="px-4 py-3 whitespace-nowrap tabular">{c}</td>)}</tr>
    {aberto && <tr><td colSpan={colSpan}><DetalhePedido o={o} admin={admin} /></td></tr>}
  </>
}

// ------------------------------------------------------------ ganhos
function Ganhos() {
  const [g, setG] = useState(null)
  useEffect(() => { api('/api/painel/ganhos').then(setG) }, [])
  if (!g) return <p className="text-muted">Carregando...</p>
  const SIT = { disponivel: ['Disponível', 'bg-ok-soft text-ok'], previsto: ['Previsto', 'bg-warn-soft text-warn'], repassado: ['Repassado', 'bg-surface-2 text-muted'] }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Disponível para repasse" valor={brl(g.disponivel)} destaque />
        <Stat label="Previsto" valor={brl(g.previsto)} sub={`libera ${g.dias_liberacao} dias após o pagamento`} />
        <Stat label="Já repassado" valor={brl(g.repassado)} />
      </div>
      <Alerta>Ganho = venda − custo Mart Digital − taxa da plataforma. Calculado no servidor quando o pedido é criado. Repasse manual por Pix. Pedidos cancelados não geram saldo.</Alerta>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Libera em</th></tr></thead>
          <tbody>
            {g.itens.map((i) => <tr key={i.pedido} className="border-t border-line"><td className="px-4 py-3">#{i.pedido}</td><td className="px-4 py-3 font-semibold tabular">{brl(i.valor)}</td><td className="px-4 py-3"><Badge cls={SIT[i.situacao][1]}>{SIT[i.situacao][0]}</Badge></td><td className="px-4 py-3 tabular">{dataBR(i.libera_em)}</td></tr>)}
            {!g.itens.length && <tr><td colSpan="4" className="px-4 py-6 text-center text-muted">Nenhum ganho ainda. Ganhos aparecem quando o pagamento é confirmado.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
