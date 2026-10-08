import { useEffect, useRef, useState } from 'react'
import Mockup, { geoDe } from './Mockup.jsx'
import { api, Button, Field, Input, Select, Alerta } from '../lib.jsx'

/*
  Camada: { id, tipo: 'imagem'|'texto'|'modelo', nome, src, natW, natH,
            x, y (centro, fracao da area 0..1), w, h (fracao da area), rot (0|90|180|270),
            texto?, fonte?, cor? }
*/
const MARGEM_CM = 0.5
const EXPORT_PX = 2400
const FONTES = [
  ['Plus Jakarta Sans', 'Moderna'], ['Fraunces', 'Serifada'], ['Arial Black', 'Impacto'],
  ['Courier New', 'Máquina'], ['Brush Script MT', 'Manuscrita'],
]

const uid = () => Math.random().toString(36).slice(2, 9)
const carregar = (src) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src })
const lerArquivo = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f) })

async function textoParaImagem(texto, fonte, cor) {
  await document.fonts?.ready
  const linhas = texto.split('\n')
  const tam = 200
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = `700 ${tam}px "${fonte}"`
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l || ' ').width))
  c.width = Math.ceil(larg + 40); c.height = Math.ceil(linhas.length * tam * 1.15 + 30)
  ctx.font = `700 ${tam}px "${fonte}"`; ctx.fillStyle = cor; ctx.textBaseline = 'top'; ctx.textAlign = 'center'
  linhas.forEach((l, i) => ctx.fillText(l, c.width / 2, 15 + i * tam * 1.15))
  return { src: c.toDataURL('image/png'), natW: c.width, natH: c.height }
}

function modeloParaImagem(m, proporcao) {
  const W = 1600, H = Math.round(W * proporcao)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')
  if (m.tipo === 'degrade') {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, m.cor1); g.addColorStop(1, m.cor2)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (m.tipo === 'listras') {
    ctx.fillStyle = m.cor2; ctx.fillRect(0, 0, W, H); ctx.fillStyle = m.cor1
    for (let x = 0; x < W; x += 160) ctx.fillRect(x, 0, 80, H)
  } else {
    ctx.fillStyle = m.cor2; ctx.fillRect(0, 0, W, H); ctx.fillStyle = m.cor1
    for (let y = 60, l = 0; y < H + 60; y += 130, l++) for (let x = l % 2 ? 125 : 60; x < W + 60; x += 130) { ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.fill() }
  }
  return { src: c.toDataURL('image/png'), natW: W, natH: H }
}

/** Gera o PNG de producao da area (ate 2400 px no maior lado). */
export async function exportarArea(camadas, cm) {
  const prop = cm[1] / cm[0]
  const W = prop > 1 ? Math.round(EXPORT_PX / prop) : EXPORT_PX
  const H = prop > 1 ? EXPORT_PX : Math.round(EXPORT_PX * prop)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')
  for (const l of camadas) {
    const img = await carregar(l.src)
    ctx.save()
    ctx.translate(l.x * W, l.y * H)
    ctx.rotate((l.rot * Math.PI) / 180)
    ctx.drawImage(img, (-l.w * W) / 2, (-l.h * H) / 2, l.w * W, l.h * H)
    ctx.restore()
  }
  return c.toDataURL('image/png')
}

export function dpiDe(l, cm) {
  const larguraCm = l.w * cm[0]
  return larguraCm > 0 ? Math.round(l.natW / (larguraCm / 2.54)) : 0
}

function foraDaMargem(l, cm) {
  const vira = l.rot % 180 !== 0
  const wf = vira ? (l.h * cm[1]) / cm[0] : l.w
  const hf = vira ? (l.w * cm[0]) / cm[1] : l.h
  const mx = MARGEM_CM / cm[0], my = MARGEM_CM / cm[1]
  return l.x - wf / 2 < mx - 0.001 || l.x + wf / 2 > 1 - mx + 0.001 || l.y - hf / 2 < my - 0.001 || l.y + hf / 2 > 1 - my + 0.001
}

export default function Studio({ produto, cor, areasSel, onToggleArea, camadas, setCamadas, modelosArte = [], precoArea, travado = false }) {
  const areasCfg = produto.config.areas
  const [ativa, setAtiva] = useState(areasSel[0])
  const [selId, setSelId] = useState(null)
  const [texto, setTexto] = useState('Seu texto')
  const [fonte, setFonte] = useState(FONTES[0][0])
  const [corTexto, setCorTexto] = useState('#111827')
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')
  const [analise, setAnalise] = useState(null)
  const caixa = useRef(null)
  const arrasto = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { if (!areasSel.includes(ativa)) setAtiva(areasSel[0]) }, [areasSel, ativa])
  useEffect(() => { setAnalise(null) }, [ativa])
  // cor inicial do texto contrasta com a peca (texto escuro some em camiseta preta)
  useEffect(() => {
    const n = parseInt((cor || '#ffffff').slice(1), 16)
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
    setCorTexto(lum < 0.45 ? '#ffffff' : '#111827')
  }, [cor])

  const area = areasCfg.find((a) => a.id === ativa)
  const cm = area?.cm || [20, 20]
  const lista = camadas[ativa] || []
  const sel = lista.find((l) => l.id === selId)

  const setLista = (fn) => setCamadas((c) => ({ ...c, [ativa]: fn(c[ativa] || []) }))
  const atualizar = (id, patch) => setLista((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  function encaixar({ src, natW, natH }, largura = 0.7) {
    let w = largura
    let h = w * (cm[0] / cm[1]) * (natH / natW)
    if (h > 0.85) { const k = 0.85 / h; w *= k; h *= k }
    return { src, natW, natH, x: 0.5, y: 0.5, w, h, rot: 0 }
  }

  async function addImagem(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return setErro('Imagem maior que 15 MB')
    const src = await lerArquivo(f)
    const img = await carregar(src)
    const l = { id: uid(), tipo: 'imagem', nome: f.name, ...encaixar({ src, natW: img.naturalWidth, natH: img.naturalHeight }) }
    setLista((ls) => [...ls, l]); setSelId(l.id); setErro('')
  }

  async function addTexto() {
    if (!texto.trim()) return
    const r = await textoParaImagem(texto, fonte, corTexto)
    const l = { id: uid(), tipo: 'texto', nome: texto.split('\n')[0].slice(0, 24), texto, fonte, cor: corTexto, ...encaixar(r, 0.6) }
    setLista((ls) => [...ls, l]); setSelId(l.id)
  }

  async function editarTexto(patch) {
    const novo = { ...sel, ...patch }
    const r = await textoParaImagem(novo.texto, novo.fonte, novo.cor)
    const h = novo.w * (cm[0] / cm[1]) * (r.natH / r.natW)
    atualizar(sel.id, { ...patch, ...r, h, nome: novo.texto.split('\n')[0].slice(0, 24) })
  }

  function addModelo(m) {
    const r = modeloParaImagem(m, cm[1] / cm[0])
    const l = { id: uid(), tipo: 'modelo', nome: m.nome, ...r, x: 0.5, y: 0.5, w: 1, h: 1, rot: 0 }
    setLista((ls) => [l, ...ls]); setSelId(l.id)
  }

  async function montarEtiqueta() {
    const r = await textoParaImagem('SUA MARCA\nTam. M\n100% algodão', 'Plus Jakarta Sans', '#111827')
    const l = { id: uid(), tipo: 'texto', nome: 'Etiqueta', texto: 'SUA MARCA\nTam. M\n100% algodão', fonte: 'Plus Jakarta Sans', cor: '#111827', ...encaixar(r, 0.8) }
    setLista((ls) => [...ls, l]); setSelId(l.id)
  }

  async function removerFundo() {
    if (!sel) return
    setOcupado('Removendo fundo no servidor...'); setErro('')
    try {
      const blob = await (await fetch(sel.src)).blob()
      const fd = new FormData(); fd.append('arquivo', blob, 'arte.png')
      const out = await api('/api/estudio/remover-fundo', { method: 'POST', form: fd })
      const src = await lerArquivo(out)
      const img = await carregar(src)
      atualizar(sel.id, { src, natW: img.naturalWidth, natH: img.naturalHeight })
    } catch (e) { setErro(e.message) } finally { setOcupado('') }
  }

  async function analisar() {
    setOcupado('Analisando qualidade de impressão...')
    try {
      const r = await api('/api/estudio/analisar', {
        method: 'POST', body: {
          produto: produto.id, area: ativa, area_cm: cm,
          camadas: lista.map((l) => ({ tipo: l.tipo === 'texto' ? 'texto' : 'imagem', nome: l.nome, px_w: l.natW, px_h: l.natH, cm_w: l.w * cm[0], cm_h: l.h * cm[1], fora: foraDaMargem(l, cm) })),
        },
      })
      setAnalise(r)
    } catch (e) { setErro(e.message) } finally { setOcupado('') }
  }

  // ---------------------------------------------------------- arrastar / redimensionar
  function inicio(e, l, modo) {
    if (travado) return
    e.stopPropagation(); e.preventDefault()
    setSelId(l.id)
    const r = caixa.current.getBoundingClientRect()
    arrasto.current = { modo, id: l.id, sx: e.clientX, sy: e.clientY, l: { ...l }, rw: r.width, rh: r.height }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function mover(e) {
    const a = arrasto.current
    if (!a) return
    const dx = (e.clientX - a.sx) / a.rw, dy = (e.clientY - a.sy) / a.rh
    if (a.modo === 'mover') atualizar(a.id, { x: Math.min(1.2, Math.max(-0.2, a.l.x + dx)), y: Math.min(1.2, Math.max(-0.2, a.l.y + dy)) })
    else {
      const w = Math.max(0.05, a.l.w + dx * 2)
      atualizar(a.id, { w, h: (w * a.l.h) / a.l.w })
    }
  }
  const fim = () => { arrasto.current = null }

  const precoTotalAreas = areasSel.reduce((s, id) => s + (areasCfg.find((a) => a.id === id)?.adicional || 0), 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        {/* abas das areas marcadas */}
        <div className="mb-3 flex flex-wrap gap-2">
          {areasSel.map((id) => {
            const a = areasCfg.find((x) => x.id === id)
            const n = (camadas[id] || []).length
            return (
              <button key={id} onClick={() => { setAtiva(id); setSelId(null) }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${ativa === id ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-fg'}`}>
                {a?.nome} {n > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-primary-fg">{n}</span>}
              </button>
            )
          })}
        </div>

        <div className="rounded-2xl border border-line bg-gradient-to-b from-surface to-surface-2 p-4 sm:p-6" onPointerDown={() => setSelId(null)}>
          <div className="mx-auto max-w-[460px]">
            <Mockup mockup={produto.mockup} area={ativa} cor={cor}>
              <div ref={caixa} className="absolute inset-0" onPointerMove={mover} onPointerUp={fim} onPointerLeave={fim}>
                {/* corte exato */}
                <div className="absolute inset-0 overflow-hidden outline outline-1 outline-dashed outline-primary/50">
                  {lista.map((l) => (
                    <div key={l.id} className={`layer absolute ${selId === l.id && !travado ? 'sel' : ''} ${travado ? '' : 'cursor-move'}`}
                      style={{ left: `${(l.x - l.w / 2) * 100}%`, top: `${(l.y - l.h / 2) * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%`, transform: `rotate(${l.rot}deg)` }}
                      onPointerDown={(e) => inicio(e, l, 'mover')}>
                      <img src={l.src} alt={l.nome} draggable={false} className="h-full w-full pointer-events-none" />
                    </div>
                  ))}
                </div>
                {/* margem de seguranca */}
                <div className="pointer-events-none absolute border border-dashed border-red-500/80"
                  style={{ left: `${(MARGEM_CM / cm[0]) * 100}%`, right: `${(MARGEM_CM / cm[0]) * 100}%`, top: `${(MARGEM_CM / cm[1]) * 100}%`, bottom: `${(MARGEM_CM / cm[1]) * 100}%` }} />
                {/* alca do selecionado (fora do corte para ficar visivel) */}
                {sel && !travado && (
                  <div className="absolute pointer-events-none" style={{ left: `${(sel.x - sel.w / 2) * 100}%`, top: `${(sel.y - sel.h / 2) * 100}%`, width: `${sel.w * 100}%`, height: `${sel.h * 100}%`, transform: `rotate(${sel.rot}deg)` }}>
                    <div className="handle pointer-events-auto" onPointerDown={(e) => inicio(e, sel, 'redim')} title="Redimensionar" />
                  </div>
                )}
                {!lista.length && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-[11px] font-semibold text-muted/80 px-2">
                    {travado ? '' : 'Área de estampa'}
                  </div>
                )}
              </div>
            </Mockup>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="tabular">Área: {String(cm[0]).replace('.', ',')} × {String(cm[1]).replace('.', ',')} cm</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-0 w-4 border-t border-dashed border-red-500" /> margem de segurança</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-0 w-4 border-t border-dashed border-primary" /> corte</span>
          </div>
        </div>

        {produto.aviso && <Alerta tipo="warn" className="mt-3">{produto.aviso}</Alerta>}
      </div>

      {/* ferramentas */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-bold">Áreas de estampa</div>
          <div className="space-y-1.5">
            {areasCfg.map((a) => {
              const on = areasSel.includes(a.id)
              return (
                <label key={a.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${on ? 'border-primary bg-primary-soft' : 'border-line'} ${a.obrigatoria ? 'opacity-80' : 'cursor-pointer'}`}>
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={on} disabled={a.obrigatoria || travado} onChange={() => onToggleArea(a.id)} className="accent-[var(--primary)]" />
                    {a.nome}
                  </span>
                  <span className="text-xs font-semibold text-muted tabular">{precoArea ? precoArea(a) : ''}</span>
                </label>
              )
            })}
          </div>
          {precoArea && precoTotalAreas > 0 && <div className="mt-2 text-right text-xs font-semibold text-muted">Adicionais: <span className="text-fg tabular">{precoTotalAreas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>}
        </div>

        {!travado && <>
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            <div className="text-sm font-bold">Adicionar à {area?.nome}</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={addImagem} />
            <Button variant="soft" className="w-full" onClick={() => fileRef.current?.click()}>Anexar imagem</Button>
            <Field label="Texto">
              <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
            </Field>
            <div className="flex gap-2">
              <Select value={fonte} onChange={(e) => setFonte(e.target.value)}>{FONTES.map(([f, n]) => <option key={f} value={f}>{n}</option>)}</Select>
              <input type="color" value={corTexto} onChange={(e) => setCorTexto(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface" aria-label="Cor do texto" />
            </div>
            <Button variant="ghost" className="w-full" onClick={addTexto}>Adicionar texto</Button>
            {ativa === 'etiqueta' && <Button variant="ghost" className="w-full" onClick={montarEtiqueta}>Montar etiqueta (marca, tamanho, composição)</Button>}
            {modelosArte.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-semibold text-muted">Modelos Mart Digital</div>
                <div className="flex flex-wrap gap-2">
                  {modelosArte.map((m) => (
                    <button key={m.id} onClick={() => addModelo(m)} title={m.nome}
                      className="h-10 w-10 rounded-lg border border-line"
                      style={{ background: m.tipo === 'degrade' ? `linear-gradient(135deg, ${m.cor1}, ${m.cor2})` : m.tipo === 'listras' ? `repeating-linear-gradient(90deg, ${m.cor1} 0 6px, ${m.cor2} 6px 12px)` : `radial-gradient(${m.cor1} 30%, ${m.cor2} 32%) 0 0/10px 10px` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {sel && (
            <div className="rounded-2xl border border-primary/40 bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="truncate text-sm font-bold">{sel.nome}</div>
                <span className={`text-xs font-semibold tabular ${dpiDe(sel, cm) < 100 ? 'text-danger' : dpiDe(sel, cm) < 150 ? 'text-warn' : 'text-ok'}`}>≈ {dpiDe(sel, cm)} DPI</span>
              </div>
              <div className="text-xs text-muted tabular">{(sel.w * cm[0]).toFixed(1).replace('.', ',')} × {(sel.h * cm[1]).toFixed(1).replace('.', ',')} cm {foraDaMargem(sel, cm) && <span className="text-danger font-semibold"> · passa da margem</span>}</div>
              {sel.tipo === 'texto' && (
                <div className="space-y-2">
                  <textarea rows={2} value={sel.texto} onChange={(e) => editarTexto({ texto: e.target.value })} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Select value={sel.fonte} onChange={(e) => editarTexto({ fonte: e.target.value })}>{FONTES.map(([f, n]) => <option key={f} value={f}>{n}</option>)}</Select>
                    <input type="color" value={sel.cor} onChange={(e) => editarTexto({ cor: e.target.value })} className="h-10 w-12 shrink-0 rounded-lg border border-line" aria-label="Cor" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" onClick={() => atualizar(sel.id, { rot: (sel.rot + 90) % 360 })}>Girar 90°</Button>
                <Button size="sm" variant="ghost" onClick={() => atualizar(sel.id, { x: 0.5, y: 0.5 })}>Centralizar</Button>
                {sel.tipo === 'imagem' && <Button size="sm" variant="ghost" className="col-span-2" disabled={!!ocupado} onClick={removerFundo}>Remover fundo</Button>}
                <Button size="sm" variant="danger" className="col-span-2" onClick={() => { setLista((ls) => ls.filter((l) => l.id !== sel.id)); setSelId(null) }}>Excluir camada</Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
            <Button variant="ghost" className="w-full" disabled={!!ocupado} onClick={analisar}>Analisar qualidade de impressão</Button>
            {analise && (
              <div className={`rounded-xl p-3 text-sm ${analise.nota === 'otima' ? 'bg-ok-soft' : analise.nota === 'ruim' ? 'bg-danger-soft' : 'bg-warn-soft'}`}>
                <div className="font-bold">{analise.titulo}</div>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">{analise.recomendacoes.map((r, i) => <li key={i}>{r}</li>)}</ul>
                {analise.simulado && <div className="mt-2 text-[11px] opacity-70">Análise simulada no POC. Na versão final, IA no servidor.</div>}
              </div>
            )}
          </div>
        </>}
        {ocupado && <Alerta>{ocupado}</Alerta>}
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
      </div>
    </div>
  )
}

/** Regra de marcacao: areas do mesmo grupo (costas A4/A3) sao exclusivas. */
export function alternarArea(areasCfg, sel, id) {
  const a = areasCfg.find((x) => x.id === id)
  if (!a || a.obrigatoria) return sel
  if (sel.includes(id)) return sel.length > 1 ? sel.filter((x) => x !== id) : sel
  const semGrupo = a.grupo ? sel.filter((x) => areasCfg.find((y) => y.id === x)?.grupo !== a.grupo) : sel
  return [...semGrupo, id]
}

export function areasIniciais(areasCfg) {
  const obr = areasCfg.filter((a) => a.obrigatoria).map((a) => a.id)
  return obr.length ? obr : [areasCfg[0].id]
}
