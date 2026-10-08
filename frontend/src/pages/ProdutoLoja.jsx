import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Studio, { alternarArea, areasIniciais, exportarArea } from '../components/Studio.jsx'
import { api, brl, copiar, Alerta, Button, Card, Field, Input } from '../lib.jsx'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

export default function ProdutoLoja() {
  const { id, pid } = useParams()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [pix, setPix] = useState(null)
  const [erro, setErro] = useState('')
  const [modelo, setModelo] = useState(null)
  const [tamanho, setTamanho] = useState(null)
  const [cor, setCor] = useState(null)
  const [areasSel, setAreasSel] = useState([])
  const [camadas, setCamadas] = useState({})
  const [opcoes, setOpcoes] = useState({})
  const [qtd, setQtd] = useState(1)
  const [cot, setCot] = useState(null)
  const [erroCot, setErroCot] = useState('')
  const [etapa, setEtapa] = useState('personalizar')
  const [cli, setCli] = useState({ nome: '', email: '', telefone: '', cpf: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'SP' })
  const [frete, setFrete] = useState('')
  const [metodo, setMetodo] = useState('pix')
  const [comprovante, setComprovante] = useState(null)
  const [enviando, setEnviando] = useState('')
  const [copiado, setCopiado] = useState(false)
  const topo = useRef(null)

  useEffect(() => {
    api(`/api/lojas/${id}`).then((r) => {
      setD(r)
      const p = r.produtos.find((x) => x.id === pid)
      if (!p) return
      const m = p.config.modelos[0]
      setModelo(m.id); setTamanho(m.tamanhos[0])
      if (p.arte_fixa) {
        setAreasSel(Object.keys(p.arte_fixa.areas)); setCamadas(p.arte_fixa.areas)
        setCor(p.arte_fixa.cor || p.config.cores[0].id)
      } else {
        setAreasSel(areasIniciais(p.config.areas)); setCor(m.cor_fixa || p.config.cores[0].id)
      }
      const op = {}
      p.config.opcoes.forEach((o) => { op[o.id] = o.tipo === 'escolha' ? o.valores[0].id : false })
      setOpcoes(op)
    }).catch((e) => setErro(e.message))
    api('/api/public/config').then(setPix).catch(() => {})
  }, [id, pid])

  const p = d?.produtos.find((x) => x.id === pid)
  const mod = p?.config.modelos.find((m) => m.id === modelo)
  const corHex = p?.config.cores.find((c) => c.id === (mod?.cor_fixa || cor))?.hex

  // cotacao no servidor (preco, adicionais, desconto e frete)
  const cepLimpo = cli.cep.replace(/\D/g, '')
  useEffect(() => {
    if (!p || !modelo || !tamanho) return
    const t = setTimeout(() => {
      api(`/api/lojas/${id}/cotar`, { method: 'POST', body: { produto: pid, item: { modelo, tamanho, cor, areas: areasSel, opcoes, qtd }, cep: cepLimpo.length === 8 ? cepLimpo : null } })
        .then((r) => { setCot(r); setErroCot(''); if (r.fretes.length && !r.fretes.find((f) => f.id === frete)) setFrete(r.fretes[0].id) })
        .catch((e) => setErroCot(e.message))
    }, 250)
    return () => clearTimeout(t)
  }, [p, modelo, tamanho, cor, areasSel, opcoes, qtd, cepLimpo])

  const freteSel = cot?.fretes.find((f) => f.id === frete)
  const total = cot ? cot.subtotal - cot.desconto + (freteSel?.valor || 0) : 0
  const semArte = useMemo(() => p && !p.arte_fixa ? areasSel.filter((a) => !(camadas[a] || []).length) : [], [p, areasSel, camadas])

  if (erro) return <div className="grid min-h-screen place-items-center p-6 text-center"><Alerta tipo="erro">{erro}</Alerta></div>
  if (!d) return <div className="grid min-h-screen place-items-center text-muted">Carregando...</div>
  if (!d.disponivel) return <div className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">Loja indisponível</h1><Link className="mt-3 inline-block text-primary" to={`/s/${id}`}>Voltar</Link></div></div>
  if (!p) return <div className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">Produto não encontrado</h1><Link className="mt-3 inline-block text-primary" to={`/s/${id}`}>Voltar para a loja</Link></div></div>

  const { loja } = d
  const setC = (k) => (e) => setCli({ ...cli, [k]: e.target.value })

  async function finalizar(e) {
    e.preventDefault(); setErro('')
    if (metodo === 'pix' && !comprovante) return setErro('Anexe o comprovante do Pix para concluir o pedido.')
    if (comprovante && comprovante.size > 8 * 1024 * 1024) return setErro('O comprovante passa de 8 MB.')
    try {
      setEnviando('Gerando arquivos de impressão...')
      const artes = {}
      for (const a of areasSel) {
        const ls = camadas[a] || []
        if (ls.length) artes[a] = await exportarArea(ls, p.config.areas.find((x) => x.id === a).cm)
      }
      const leves = Object.fromEntries(Object.entries(camadas).filter(([k]) => areasSel.includes(k))
        .map(([k, ls]) => [k, ls.map(({ src, ...r }) => r)]))
      setEnviando('Enviando pedido...')
      const fd = new FormData()
      fd.append('dados', JSON.stringify({ produto: pid, item: { modelo, tamanho, cor, areas: areasSel, opcoes, qtd, camadas: leves }, cliente: cli, frete, metodo_pagamento: metodo, artes }))
      if (metodo === 'pix') fd.append('comprovante', comprovante)
      const r = await api(`/api/lojas/${id}/pedidos`, { method: 'POST', form: fd })
      if (r.checkout) nav(r.checkout)
      else nav(`/pedido/${r.pedido_id}?email=${encodeURIComponent(cli.email)}`)
    } catch (err) { setErro(err.message) } finally { setEnviando('') }
  }

  const vars = { '--sp': loja.cor_primaria }

  return (
    <div style={vars} className="min-h-screen bg-bg" ref={topo}>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to={`/s/${id}`} className="text-sm font-semibold text-muted hover:text-fg">← {loja.nome}</Link>
          {d.desconto && <span className="ml-auto rounded-full bg-warn-soft px-3 py-1 text-xs font-bold text-warn">{d.desconto.pct}% off · {d.desconto.mensagem}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">{p.categoria} · {p.metodo}</div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{p.nome}</h1>
            <p className="text-muted">{p.descricao}</p>
          </div>
          <div className="flex gap-2 text-sm font-semibold">
            {['personalizar', 'checkout'].map((e, i) => (
              <span key={e} className={`rounded-full px-3 py-1.5 ${etapa === e ? 'bg-[var(--sp)] text-white' : 'bg-surface text-muted border border-line'}`}>{i + 1}. {e === 'personalizar' ? (p.arte_fixa ? 'Escolher' : 'Personalizar') : 'Finalizar'}</span>
            ))}
          </div>
        </div>

        {etapa === 'personalizar' && (
          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <Card className="p-4 sm:p-5 min-w-0">
              <Studio produto={p} cor={corHex} areasSel={areasSel} camadas={camadas} setCamadas={setCamadas} travado={!!p.arte_fixa}
                onToggleArea={(a) => setAreasSel((s) => alternarArea(p.config.areas, s, a))}
                modelosArte={d.modelos_arte} precoArea={(a) => (p.arte_fixa ? 'incluso' : a.adicional ? `+ ${brl(a.adicional)}` : 'incluso')} />
            </Card>

            <div className="space-y-4">
              <Card className="p-5 space-y-4">
                {p.config.modelos.length > 1 && (
                  <div>
                    <div className="mb-2 text-sm font-bold">Modelo</div>
                    <div className="flex flex-wrap gap-2">
                      {p.config.modelos.map((m) => (
                        <button key={m.id} onClick={() => { setModelo(m.id); if (!m.tamanhos.includes(tamanho)) setTamanho(m.tamanhos[0]); if (m.cor_fixa) setCor(m.cor_fixa) }}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold ${modelo === m.id ? 'border-[var(--sp)] bg-[var(--sp)] text-white' : 'border-line bg-surface'}`}>
                          {m.nome}{m.acrescimo > 0 && <span className="ml-1 opacity-80">+{brl(m.acrescimo)}</span>}
                        </button>
                      ))}
                    </div>
                    {mod?.aviso && <Alerta tipo="warn" className="mt-2">{mod.aviso}</Alerta>}
                  </div>
                )}
                {mod && mod.tamanhos.length > 1 && (
                  <div>
                    <div className="mb-2 text-sm font-bold">Tamanho <span className="font-normal text-muted">· {mod.nome}</span></div>
                    <div className="flex flex-wrap gap-2">
                      {mod.tamanhos.map((t) => (
                        <button key={t} onClick={() => setTamanho(t)} className={`min-w-11 rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${tamanho === t ? 'border-[var(--sp)] bg-[var(--sp)] text-white' : 'border-line bg-surface'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {!mod?.cor_fixa && !p.arte_fixa && p.config.cores.length > 1 && (
                  <div>
                    <div className="mb-2 text-sm font-bold">Cor <span className="font-normal text-muted">· {p.config.cores.find((c) => c.id === cor)?.nome} · sem acréscimo</span></div>
                    <div className="flex flex-wrap gap-2">
                      {p.config.cores.map((c) => (
                        <button key={c.id} title={c.nome} aria-label={c.nome} onClick={() => setCor(c.id)}
                          className={`h-8 w-8 rounded-full border border-black/15 ${cor === c.id ? 'ring-2 ring-[var(--sp)] ring-offset-2 ring-offset-surface' : ''}`} style={{ background: c.hex }} />
                      ))}
                    </div>
                  </div>
                )}
                {p.config.opcoes.map((o) => (
                  <div key={o.id}>
                    <div className="mb-2 text-sm font-bold">{o.nome}</div>
                    {o.tipo === 'escolha' ? (
                      <div className="grid gap-2">
                        {o.valores.map((v) => (
                          <label key={v.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${opcoes[o.id] === v.id ? 'border-[var(--sp)]' : 'border-line'}`}>
                            <input type="radio" name={o.id} checked={opcoes[o.id] === v.id} onChange={() => setOpcoes({ ...opcoes, [o.id]: v.id })} /> {v.nome}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!opcoes[o.id]} onChange={(e) => setOpcoes({ ...opcoes, [o.id]: e.target.checked })} /> Incluir {o.nome.toLowerCase()} <span className="text-muted">+ {brl(o.adicional)}</span>
                      </label>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Quantidade</span>
                  <div className="flex items-center rounded-xl border border-line">
                    <button className="px-3 py-1.5 text-lg" onClick={() => setQtd(Math.max(1, qtd - 1))} aria-label="Diminuir">−</button>
                    <span className="w-8 text-center font-semibold tabular">{qtd}</span>
                    <button className="px-3 py-1.5 text-lg" onClick={() => setQtd(Math.min(50, qtd + 1))} aria-label="Aumentar">+</button>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                {cot ? (
                  <div className="space-y-1.5 text-sm tabular">
                    <div className="flex justify-between"><span className="text-muted">Unitário</span><span>{brl(cot.venda_unit)}</span></div>
                    {!p.arte_fixa && cot.adicionais.filter((a) => a.valor).map((a) => <div key={a.nome} className="flex justify-between text-xs text-muted"><span>· {a.nome}</span><span>+ {brl(a.valor)}</span></div>)}
                    {cot.dif_modelo > 0 && <div className="flex justify-between text-xs text-muted"><span>· Modelo {mod?.nome}</span><span>+ {brl(cot.dif_modelo)}</span></div>}
                    <div className="flex justify-between"><span className="text-muted">Subtotal ({cot.qtd}×)</span><span>{brl(cot.subtotal)}</span></div>
                    {cot.desconto > 0 && <div className="flex justify-between text-ok"><span>Desconto {cot.desconto_info.pct}%</span><span>− {brl(cot.desconto)}</span></div>}
                    <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold"><span>Total sem frete</span><span>{brl(cot.subtotal - cot.desconto)}</span></div>
                  </div>
                ) : <div className="text-sm text-muted">Calculando preço...</div>}
                {erroCot && <Alerta tipo="erro" className="mt-3">{erroCot}</Alerta>}
                {semArte.length > 0 && <Alerta tipo="warn" className="mt-3">Adicione uma arte em: {semArte.map((a) => p.config.areas.find((x) => x.id === a)?.nome).join(', ')}</Alerta>}
                <Button size="lg" className="mt-4 w-full !bg-[var(--sp)]" disabled={!cot || !!erroCot || semArte.length > 0}
                  onClick={() => { setEtapa('checkout'); topo.current?.scrollIntoView({ behavior: 'smooth' }) }}>Continuar para entrega e pagamento</Button>
              </Card>
            </div>
          </div>
        )}

        {etapa === 'checkout' && (
          <form onSubmit={finalizar} className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5 min-w-0">
              <Card className="p-5">
                <h2 className="text-lg font-bold">Seus dados</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Nome completo" className="sm:col-span-2"><Input id="c-nome" required value={cli.nome} onChange={setC('nome')} /></Field>
                  <Field label="E-mail"><Input id="c-email" type="email" required value={cli.email} onChange={setC('email')} /></Field>
                  <Field label="WhatsApp"><Input id="c-tel" required value={cli.telefone} onChange={setC('telefone')} placeholder="(11) 99999-0000" /></Field>
                  <Field label="CPF (opcional)"><Input id="c-cpf" value={cli.cpf} onChange={setC('cpf')} /></Field>
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="text-lg font-bold">Entrega</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-6">
                  <Field label="CEP" className="sm:col-span-2" hint="Frete calculado no servidor"><Input id="c-cep" required value={cli.cep} onChange={setC('cep')} placeholder="00000-000" /></Field>
                  <Field label="Endereço" className="sm:col-span-4"><Input id="c-end" required value={cli.endereco} onChange={setC('endereco')} /></Field>
                  <Field label="Número" className="sm:col-span-2"><Input id="c-num" required value={cli.numero} onChange={setC('numero')} /></Field>
                  <Field label="Complemento" className="sm:col-span-2"><Input id="c-comp" value={cli.complemento} onChange={setC('complemento')} /></Field>
                  <Field label="Bairro" className="sm:col-span-2"><Input id="c-bairro" value={cli.bairro} onChange={setC('bairro')} /></Field>
                  <Field label="Cidade" className="sm:col-span-4"><Input id="c-cidade" required value={cli.cidade} onChange={setC('cidade')} /></Field>
                  <Field label="UF" className="sm:col-span-2"><select id="c-uf" value={cli.uf} onChange={setC('uf')} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">{UFS.map((u) => <option key={u}>{u}</option>)}</select></Field>
                </div>
                {cot?.fretes.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {cot.fretes.map((f) => (
                      <label key={f.id} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm ${frete === f.id ? 'border-[var(--sp)] bg-surface-2' : 'border-line'}`}>
                        <span className="flex items-center gap-3"><input type="radio" name="frete" checked={frete === f.id} onChange={() => setFrete(f.id)} /><span><span className="font-semibold">{f.servico}</span><span className="block text-xs text-muted">{f.prazo}</span></span></span>
                        <span className="font-bold tabular">{brl(f.valor)}</span>
                      </label>
                    ))}
                    <span className="text-xs text-muted">Cotação simulada no POC. Origem da produção: CEP {pix?.cep_origem}.</span>
                  </div>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="text-lg font-bold">Pagamento</h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[['pix', 'Pix'], ['cartao', 'Cartão de crédito ou débito']].map(([k, n]) => (
                    <button type="button" key={k} onClick={() => setMetodo(k)} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${metodo === k ? 'border-[var(--sp)] bg-surface-2' : 'border-line'}`}>{n}</button>
                  ))}
                </div>
                {metodo === 'pix' ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-surface-2 p-4 text-sm">
                      <div className="text-xs font-semibold text-muted">Chave Pix (CNPJ)</div>
                      <div className="mt-0.5 flex items-center justify-between gap-2"><span className="font-bold tabular select-all">{pix?.pix_chave}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={async () => setCopiado(await copiar(pix?.pix_chave))}>{copiado ? 'Copiado' : 'Copiar'}</Button></div>
                      <div className="mt-2 text-xs text-muted">Razão social: <span className="font-semibold text-fg">{pix?.pix_razao}</span></div>
                      <div className="mt-1 text-xs text-muted">Valor: <span className="font-semibold text-fg tabular">{brl(total)}</span></div>
                    </div>
                    <Field label="Comprovante do Pix (obrigatório)" hint="Imagem ou PDF, até 8 MB. O pedido fica aguardando a confirmação da Mart Digital.">
                      <input id="comprovante" type="file" accept="image/*,application/pdf" onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                        className="block w-full rounded-xl border border-dashed border-line bg-surface p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:font-semibold file:text-primary" />
                    </Field>
                  </div>
                ) : (
                  <Alerta className="mt-4">Você será levado ao checkout seguro de cartão. No POC o pagamento é simulado em modo teste e nada é cobrado.</Alerta>
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-5 lg:sticky lg:top-4">
                <h2 className="font-bold">Resumo</h2>
                <div className="mt-2 text-sm text-muted">{p.nome} · {mod?.nome} · {tamanho}{!mod?.cor_fixa && ` · ${p.config.cores.find((c) => c.id === cor)?.nome}`} · {qtd}×</div>
                <div className="mt-1 text-xs text-muted">Áreas: {areasSel.map((a) => p.config.areas.find((x) => x.id === a)?.nome).join(', ')}</div>
                {cot && (
                  <div className="mt-4 space-y-1.5 text-sm tabular">
                    <div className="flex justify-between"><span className="text-muted">Produtos</span><span>{brl(cot.subtotal)}</span></div>
                    {cot.desconto > 0 && <div className="flex justify-between text-ok"><span>Desconto</span><span>− {brl(cot.desconto)}</span></div>}
                    <div className="flex justify-between"><span className="text-muted">Frete</span><span>{freteSel ? brl(freteSel.valor) : 'informe o CEP'}</span></div>
                    <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold"><span>Total</span><span>{brl(total)}</span></div>
                  </div>
                )}
                {erro && <Alerta tipo="erro" className="mt-3">{erro}</Alerta>}
                {enviando && <Alerta className="mt-3">{enviando}</Alerta>}
                <Button size="lg" className="mt-4 w-full !bg-[var(--sp)]" disabled={!!enviando || !freteSel}>{metodo === 'pix' ? 'Concluir pedido' : 'Ir para o pagamento'}</Button>
                <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => setEtapa('personalizar')}>Voltar e editar</Button>
              </Card>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
