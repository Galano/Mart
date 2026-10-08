import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FragmentoLinha } from './Painel.jsx'
import {
  api, arquivoUrl, brl, dataBR, useAuth, Alerta, Badge, Button, Card, Field, Input, Logo, Select, Stat,
  STATUS_PAG, STATUS_PEDIDO, Tabs, Toggle,
} from '../lib.jsx'

export default function Admin() {
  const { user, sair } = useAuth()
  const [tab, setTab] = useState('visao')
  if (user === undefined) return <div className="grid min-h-screen place-items-center text-muted">Carregando...</div>
  if (!user) return <Navigate to="/" replace />
  if (!user.roles.includes('admin')) return <Navigate to="/painel" replace />
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-frost backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/"><Logo /></Link>
          <Badge cls="bg-primary-soft text-primary">Administrador</Badge>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={sair}>Sair</Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={tab} onChange={setTab} tabs={[['visao', 'Visão geral'], ['pedidos', 'Pedidos'], ['lojistas', 'Lojistas'], ['produtos', 'Produtos'], ['modelos', 'Modelos de arte'], ['config', 'Configurações']]} />
        <div className="mt-6">
          {tab === 'visao' && <Visao />}
          {tab === 'pedidos' && <Pedidos />}
          {tab === 'lojistas' && <Lojistas />}
          {tab === 'produtos' && <Produtos />}
          {tab === 'modelos' && <Modelos />}
          {tab === 'config' && <Config />}
        </div>
      </main>
    </div>
  )
}

function Visao() {
  const [r, setR] = useState(null)
  useEffect(() => { api('/api/admin/resumo').then(setR) }, [])
  if (!r) return <p className="text-muted">Carregando...</p>
  const margem = r.faturamento - r.custo - r.repasses
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Faturamento confirmado" valor={brl(r.faturamento)} sub="valor cheio recebido pela Mart Digital" destaque />
        <Stat label="Custo de produção" valor={brl(r.custo)} />
        <Stat label="Repasses a lojistas" valor={brl(r.repasses)} />
        <Stat label="Taxas da plataforma" valor={brl(r.taxas)} />
        <Stat label="Pedidos" valor={r.pedidos} />
        <Stat label="Aguardando pagamento" valor={r.aguardando} />
        <Stat label="Na fila de produção" valor={r.producao} />
        <Stat label="Lojistas" valor={Object.values(r.lojistas).reduce((a, b) => a + b, 0)} sub={`${r.lojistas.pendente || 0} pendentes · ${r.lojistas.bloqueado || 0} bloqueados`} />
      </div>
      <div className="text-xs text-muted">Frete incluso no faturamento. Resultado bruto (faturamento − custo − repasses): <b className="text-fg tabular">{brl(margem)}</b></div>
      <Card className="overflow-hidden">
        <div className="px-5 pt-4 font-bold">Relatório por loja</div>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="px-5 py-3">Loja</th><th className="px-5 py-3">Pedidos</th><th className="px-5 py-3">Faturamento</th><th className="px-5 py-3">Ganho do lojista</th><th /></tr></thead>
            <tbody>{r.por_loja.map((l) => <tr key={l.id} className="border-t border-line"><td className="px-5 py-3 font-semibold">{l.nome}</td><td className="px-5 py-3 tabular">{l.pedidos}</td><td className="px-5 py-3 tabular">{brl(l.faturamento)}</td><td className="px-5 py-3 tabular">{brl(l.ganho)}</td><td className="px-5 py-3"><a className="text-primary font-semibold" href={`/s/${l.id}`} target="_blank" rel="noreferrer">ver loja</a></td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Pedidos() {
  const [filtro, setFiltro] = useState({ loja: '', status: '', pagamento: '' })
  const [lista, setLista] = useState(null)
  const [lojas, setLojas] = useState([])
  const [aberto, setAberto] = useState(null)
  const [msg, setMsg] = useState(null)
  const carregar = () => api(`/api/admin/pedidos?loja=${filtro.loja}&status=${filtro.status}&pagamento=${filtro.pagamento}`).then(setLista)
  useEffect(() => { carregar() }, [filtro])
  useEffect(() => { api('/api/admin/resumo').then((r) => setLojas(r.por_loja)) }, [])

  async function acao(fn, ok) {
    setMsg(null)
    try { const r = await fn(); setMsg({ tipo: 'ok', texto: typeof ok === 'function' ? ok(r) : ok }); carregar() } catch (e) { setMsg({ tipo: 'erro', texto: e.message }) }
  }
  const post = (url, body) => api(url, { method: 'POST', body })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select className="max-w-52" value={filtro.loja} onChange={(e) => setFiltro({ ...filtro, loja: e.target.value })}><option value="">Todas as lojas</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</Select>
        <Select className="max-w-52" value={filtro.pagamento} onChange={(e) => setFiltro({ ...filtro, pagamento: e.target.value })}><option value="">Todo pagamento</option>{Object.entries(STATUS_PAG).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</Select>
        <Select className="max-w-52" value={filtro.status} onChange={(e) => setFiltro({ ...filtro, status: e.target.value })}><option value="">Todo status</option>{Object.entries(STATUS_PEDIDO).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</Select>
      </div>
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      {!lista ? <p className="text-muted">Carregando...</p> : !lista.length ? <Alerta>Nenhum pedido com esses filtros.</Alerta> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted"><tr>{['#', 'Data', 'Loja', 'Produto', 'Total', 'Custo', 'Lojista', 'Pagamento', 'Status', 'Ações'].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {lista.map((o) => (
                  <FragmentoLinha key={o.id} o={o} admin colSpan={10} aberto={aberto === o.id} onClick={() => setAberto(aberto === o.id ? null : o.id)}
                    celulas={[
                      <span>#{o.id}{o.demo ? <Badge cls="ml-1 bg-surface-2 text-muted">demo</Badge> : null}</span>, dataBR(o.criado_em), o.loja_nome, o.item.nome_loja_produto,
                      brl(o.total), brl(o.custo_total), brl(o.ganho_lojista),
                      <span className="flex items-center gap-1.5"><Badge cls={STATUS_PAG[o.status_pagamento][1]}>{STATUS_PAG[o.status_pagamento][0]}</Badge><span className="text-xs text-muted">{o.metodo_pagamento}</span></span>,
                      <Badge cls={STATUS_PEDIDO[o.status][1]}>{STATUS_PEDIDO[o.status][0]}</Badge>,
                      <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {o.comprovante && <a href={arquivoUrl(o.comprovante)} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost">Comprovante</Button></a>}
                        {o.status_pagamento === 'aguardando' && <>
                          <Button size="sm" variant="ok" onClick={() => acao(() => post(`/api/admin/pedidos/${o.id}/pagamento`, { acao: 'confirmar' }), `Pagamento do pedido #${o.id} confirmado`)}>Aceitar</Button>
                          <Button size="sm" variant="danger" onClick={() => acao(() => post(`/api/admin/pedidos/${o.id}/pagamento`, { acao: 'recusar' }), `Pedido #${o.id} recusado e cancelado`)}>Recusar</Button>
                        </>}
                        {o.status_pagamento === 'confirmado' && <>
                          <Select className="!w-36 !py-1.5" value={o.status} onChange={(e) => acao(() => post(`/api/admin/pedidos/${o.id}/status`, { status: e.target.value }), 'Status atualizado')}>
                            {Object.entries(STATUS_PEDIDO).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
                          </Select>
                          {!o.rastreio && <Button size="sm" variant="ghost" onClick={() => acao(() => post(`/api/admin/pedidos/${o.id}/etiqueta`), (r) => `Etiqueta gerada (simulada): ${r.rastreio}`)}>Etiqueta</Button>}
                          {o.status !== 'cancelado' && !o.repassado_em && <Button size="sm" variant="ghost" onClick={() => acao(() => post(`/api/admin/pedidos/${o.id}/repasse`), 'Repasse marcado como pago')}>Repasse pago</Button>}
                          {!o.repassado_em && <Button size="sm" variant="soft" title="Ferramenta do POC" onClick={() => acao(() => post(`/api/admin/pedidos/${o.id}/avancar-dias`), 'Pagamento antecipado em 7 dias (POC)')}>+7 dias</Button>}
                        </>}
                      </div>,
                    ]} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function Lojistas() {
  const [lista, setLista] = useState(null)
  const carregar = () => api('/api/admin/lojistas').then(setLista)
  useEffect(() => { carregar() }, [])
  const mudar = async (id, status) => { await api(`/api/admin/lojistas/${id}/status`, { method: 'POST', body: { status } }); carregar() }
  const COR = { aprovado: 'bg-ok-soft text-ok', pendente: 'bg-warn-soft text-warn', bloqueado: 'bg-danger-soft text-danger' }
  if (!lista) return <p className="text-muted">Carregando...</p>
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted"><tr>{['Lojista', 'Loja', 'E-mail confirmado', 'Produtos', 'Pedidos', 'Situação', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3"><div className="font-semibold">{u.nome}</div><div className="text-xs text-muted">{u.email}</div></td>
                <td className="px-4 py-3">{u.shop_id ? <a href={`/s/${u.shop_id}`} target="_blank" rel="noreferrer" className="font-semibold text-primary">{u.loja}</a> : '—'} {!u.online && <Badge>offline</Badge>}</td>
                <td className="px-4 py-3">{u.email_confirmado ? 'Sim' : 'Não'}</td>
                <td className="px-4 py-3 tabular">{u.produtos || <span className="text-muted">demo</span>}</td>
                <td className="px-4 py-3 tabular">{u.pedidos}</td>
                <td className="px-4 py-3"><Badge cls={COR[u.status]}>{u.status}</Badge></td>
                <td className="px-4 py-3"><div className="flex gap-1.5">
                  {u.status !== 'aprovado' && <Button size="sm" variant="ok" onClick={() => mudar(u.id, 'aprovado')}>Aprovar</Button>}
                  {u.status !== 'bloqueado' && <Button size="sm" variant="danger" onClick={() => mudar(u.id, 'bloqueado')}>Bloquear</Button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Produtos() {
  const [lista, setLista] = useState(null)
  const [edit, setEdit] = useState({})
  const [msg, setMsg] = useState(null)
  const [novo, setNovo] = useState(null)
  const carregar = () => api('/api/admin/produtos').then((l) => { setLista(l); setEdit(Object.fromEntries(l.map((p) => [p.id, { ...p }]))) })
  useEffect(() => { carregar() }, [])

  async function salvar(id) {
    const p = edit[id]
    setMsg(null)
    try {
      await api(`/api/admin/produtos/${id}`, { method: 'PUT', body: { nome: p.nome, categoria: p.categoria, metodo: p.metodo, custo: p.custo === '' || p.custo === null ? null : Number(p.custo), preco_sugerido: p.preco_sugerido === '' || p.preco_sugerido === null ? null : Number(p.preco_sugerido), ativo: !!p.ativo, descricao: p.descricao, aviso: p.aviso } })
      setMsg({ tipo: 'ok', texto: `${p.nome} salvo` }); carregar()
    } catch (e) { setMsg({ tipo: 'erro', texto: e.message }) }
  }
  async function criar(e) {
    e.preventDefault()
    try { await api('/api/admin/produtos', { method: 'POST', body: { ...novo, custo: novo.custo ? Number(novo.custo) : null, preco_sugerido: novo.preco_sugerido ? Number(novo.preco_sugerido) : null } }); setNovo(null); carregar() } catch (err) { setMsg({ tipo: 'erro', texto: err.message }) }
  }
  const set = (id, k, v) => setEdit((e) => ({ ...e, [id]: { ...e[id], [k]: v } }))
  if (!lista) return <p className="text-muted">Carregando...</p>
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Alerta className="flex-1">Produtos sem preço oficial ficam inativos. O sistema não inventa valores: defina custo e preço sugerido para ativar.</Alerta>
        <Button onClick={() => setNovo({ nome: '', categoria: 'Camisetas', metodo: 'DTF', mockup: 'camiseta', copiar_de: 'camiseta', custo: '', preco_sugerido: '', ativo: false, descricao: '' })}>Novo produto</Button>
      </div>
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      {novo && (
        <Card className="p-5">
          <form onSubmit={criar} className="grid gap-3 sm:grid-cols-3">
            <Field label="Nome"><Input id="n-nome" required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Field>
            <Field label="Categoria"><Input id="n-cat" value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} /></Field>
            <Field label="Método"><Input id="n-met" value={novo.metodo} onChange={(e) => setNovo({ ...novo, metodo: e.target.value })} /></Field>
            <Field label="Mockup"><Select value={novo.mockup} onChange={(e) => setNovo({ ...novo, mockup: e.target.value, copiar_de: { camiseta: 'camiseta', moletom: 'moletom_canguru', caneca: 'caneca', copo: 'copo', almofada: 'almofada' }[e.target.value] })}>{['camiseta', 'moletom', 'caneca', 'copo', 'almofada'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Custo (R$)" hint="vazio = sem preço oficial"><Input id="n-custo" type="number" step="0.01" value={novo.custo} onChange={(e) => setNovo({ ...novo, custo: e.target.value })} /></Field>
            <Field label="Preço sugerido (R$)"><Input id="n-sug" type="number" step="0.01" value={novo.preco_sugerido} onChange={(e) => setNovo({ ...novo, preco_sugerido: e.target.value })} /></Field>
            <div className="sm:col-span-3 flex items-center gap-3"><Toggle checked={novo.ativo} onChange={(v) => setNovo({ ...novo, ativo: v })} label="Ativo" /><span className="text-xs text-muted">Variantes e áreas são copiadas do modelo base do mockup escolhido.</span>
              <div className="ml-auto flex gap-2"><Button type="button" variant="ghost" onClick={() => setNovo(null)}>Cancelar</Button><Button>Criar</Button></div></div>
          </form>
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted"><tr>{['Produto', 'Categoria', 'Variantes', 'Áreas e adicionais', 'Custo', 'Sugerido', 'Ativo', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {lista.map((p) => {
                const e = edit[p.id] || p
                return (
                  <tr key={p.id} className="border-t border-line align-top">
                    <td className="px-4 py-3"><div className="font-semibold">{p.nome}</div><div className="text-xs text-muted">{p.metodo} · {p.mockup}</div></td>
                    <td className="px-4 py-3">{p.categoria}</td>
                    <td className="px-4 py-3 text-xs text-muted max-w-56">{p.config.modelos.map((m) => `${m.nome}: ${m.tamanhos.join(', ')}${m.custo && m.custo !== p.custo ? ` (${brl(m.custo)})` : ''}`).join(' · ')}<div>{p.config.cores.length} cores</div></td>
                    <td className="px-4 py-3 text-xs text-muted max-w-64">{p.config.areas.map((a) => `${a.nome} ${a.cm.join('×')}cm ${a.adicional ? brl(a.adicional) : ''}`).join(' · ')}{p.config.opcoes.map((o) => o.tipo === 'bool' ? ` · ${o.nome} ${brl(o.adicional)}` : '').join('')}</td>
                    <td className="px-4 py-3"><Input className="!w-24 !py-1.5" type="number" step="0.01" value={e.custo ?? ''} onChange={(ev) => set(p.id, 'custo', ev.target.value)} placeholder="—" /></td>
                    <td className="px-4 py-3"><Input className="!w-24 !py-1.5" type="number" step="0.01" value={e.preco_sugerido ?? ''} onChange={(ev) => set(p.id, 'preco_sugerido', ev.target.value)} placeholder="—" /></td>
                    <td className="px-4 py-3"><Toggle checked={!!e.ativo} onChange={(v) => set(p.id, 'ativo', v)} /></td>
                    <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => salvar(p.id)}>Salvar</Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Modelos() {
  const [lista, setLista] = useState([])
  const [f, setF] = useState({ nome: '', tipo: 'listras', cor1: '#2f5bea', cor2: '#ffffff' })
  const carregar = () => api('/api/admin/modelos-arte').then(setLista)
  useEffect(() => { carregar() }, [])
  const fundo = (m) => m.tipo === 'degrade' ? `linear-gradient(135deg, ${m.cor1}, ${m.cor2})` : m.tipo === 'listras' ? `repeating-linear-gradient(90deg, ${m.cor1} 0 14px, ${m.cor2} 14px 28px)` : `radial-gradient(${m.cor1} 30%, ${m.cor2} 32%) 0 0/22px 22px`
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <Card className="p-5 space-y-3">
        <h2 className="font-bold">Novo modelo de arte</h2>
        <div className="h-28 rounded-xl border border-line" style={{ background: fundo(f) }} />
        <Field label="Nome"><Input id="m-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
        <Field label="Tipo"><Select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="listras">Listras</option><option value="bolinhas">Bolinhas</option><option value="degrade">Degradê</option></Select></Field>
        <div className="flex gap-3"><Field label="Cor 1"><input type="color" value={f.cor1} onChange={(e) => setF({ ...f, cor1: e.target.value })} className="h-10 w-16 rounded-lg border border-line" /></Field><Field label="Cor 2"><input type="color" value={f.cor2} onChange={(e) => setF({ ...f, cor2: e.target.value })} className="h-10 w-16 rounded-lg border border-line" /></Field></div>
        <Button className="w-full" disabled={f.nome.length < 2} onClick={async () => { await api('/api/admin/modelos-arte', { method: 'POST', body: f }); setF({ ...f, nome: '' }); carregar() }}>Criar modelo</Button>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((m) => (
          <Card key={m.id} className="overflow-hidden">
            <div className="h-32" style={{ background: fundo(m) }} />
            <div className="flex items-center justify-between p-4"><div><div className="font-semibold">{m.nome}</div><div className="text-xs text-muted">{m.tipo} · disponível no estúdio</div></div>
              <Button size="sm" variant="danger" onClick={async () => { await api(`/api/admin/modelos-arte/${m.id}`, { method: 'DELETE' }); carregar() }}>Excluir</Button></div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Config() {
  const [c, setC] = useState(null)
  const [msg, setMsg] = useState(null)
  const [confirmaReset, setConfirmaReset] = useState(false)
  useEffect(() => { api('/api/admin/config').then(setC) }, [])
  if (!c) return <p className="text-muted">Carregando...</p>
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5 space-y-3">
        <h2 className="font-bold">Plataforma</h2>
        <Field label="Taxa da plataforma (%)" hint="Descontada do ganho do lojista em pedidos novos. Padrão 0%."><Input id="cfg-taxa" type="number" step="0.1" min="0" max="50" value={c.taxa_plataforma} onChange={(e) => setC({ ...c, taxa_plataforma: e.target.value })} /></Field>
        <Field label="Markup do preço sugerido (%)" hint="Usado só para produtos sem preço sugerido informado."><Input id="cfg-markup" type="number" step="1" min="0" value={c.markup_sugerido} onChange={(e) => setC({ ...c, markup_sugerido: e.target.value })} /></Field>
        {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
        <Button onClick={async () => { try { await api('/api/admin/config', { method: 'PUT', body: { taxa_plataforma: Number(c.taxa_plataforma), markup_sugerido: Number(c.markup_sugerido) } }); setMsg({ tipo: 'ok', texto: 'Configurações salvas' }) } catch (e) { setMsg({ tipo: 'erro', texto: e.message }) } }}>Salvar</Button>
      </Card>
      <Card className="p-5 space-y-2 text-sm">
        <h2 className="font-bold">Dados fixos</h2>
        <div><span className="text-muted">Chave Pix (CNPJ):</span> <b className="tabular">{c.pix_chave}</b></div>
        <div><span className="text-muted">Razão social:</span> <b>{c.pix_razao}</b></div>
        <div><span className="text-muted">CEP de origem da produção:</span> <b className="tabular">{c.cep_origem}</b></div>
        <div><span className="text-muted">Liberação do saldo:</span> <b>{c.dias_liberacao} dias após confirmação</b></div>
        <div className="border-t border-line pt-4">
          <div className="font-bold">Dados de demonstração</div>
          <p className="text-xs text-muted">Apaga pedidos, lojas criadas e uploads, e recria os dados de exemplo.</p>
          {!confirmaReset ? <Button variant="danger" size="sm" className="mt-2" onClick={() => setConfirmaReset(true)}>Restaurar demonstração</Button> : (
            <div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { await api('/api/admin/reset-demo', { method: 'POST' }); window.location.href = '/' }}>Confirmar: apagar tudo</Button><Button size="sm" variant="ghost" onClick={() => setConfirmaReset(false)}>Cancelar</Button></div>
          )}
        </div>
      </Card>
    </div>
  )
}
