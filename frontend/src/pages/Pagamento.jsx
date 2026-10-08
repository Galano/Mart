import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, brl, Alerta, Badge, Button, Card, Field, Input, STATUS_PAG, STATUS_PEDIDO } from '../lib.jsx'

/** Checkout de cartao SIMULADO (no lugar do Stripe Checkout incorporado). */
export function Pagamento() {
  const { oid } = useParams()
  const nav = useNavigate()
  const [o, setO] = useState(null)
  const [erro, setErro] = useState('')
  const [pagando, setPagando] = useState(false)
  const [cartao, setCartao] = useState({ numero: '4242 4242 4242 4242', validade: '12/30', cvc: '123', nome: 'CLIENTE TESTE' })
  useEffect(() => { api(`/api/pagamentos/${oid}`).then(setO).catch((e) => setErro(e.message)) }, [oid])

  async function pagar(e) {
    e.preventDefault(); setPagando(true); setErro('')
    try {
      await api(`/api/pagamentos/simular-cartao/${oid}`, { method: 'POST' })
      nav(`/pedido/${oid}?pago=1`)
    } catch (err) { setErro(err.message) } finally { setPagando(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Pagamento com cartão</h1>
          <Badge cls="bg-warn-soft text-warn">Modo teste</Badge>
        </div>
        {o && <div className="mt-1 text-sm text-muted">Pedido #{o.id} · <span className="font-semibold text-fg tabular">{brl(o.total)}</span></div>}
        {o?.status_pagamento === 'confirmado' ? (
          <Alerta tipo="ok" className="mt-4">Este pedido já está pago. <Link to={`/s/${o.shop_id}`} className="underline">Voltar para a loja</Link></Alerta>
        ) : (
          <form onSubmit={pagar} className="mt-5 space-y-3">
            <Field label="Número do cartão"><Input id="cc-num" value={cartao.numero} onChange={(e) => setCartao({ ...cartao, numero: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Validade"><Input id="cc-val" value={cartao.validade} onChange={(e) => setCartao({ ...cartao, validade: e.target.value })} /></Field>
              <Field label="CVC"><Input id="cc-cvc" value={cartao.cvc} onChange={(e) => setCartao({ ...cartao, cvc: e.target.value })} /></Field>
            </div>
            <Field label="Nome no cartão"><Input id="cc-nome" value={cartao.nome} onChange={(e) => setCartao({ ...cartao, nome: e.target.value })} /></Field>
            {erro && <Alerta tipo="erro">{erro}</Alerta>}
            <Button size="lg" className="w-full" disabled={pagando || !o}>{pagando ? 'Processando...' : `Pagar ${o ? brl(o.total) : ''}`}</Button>
            <p className="text-center text-xs text-muted">Simulação do Stripe. A confirmação passa por um webhook com assinatura validada no servidor.</p>
          </form>
        )}
      </Card>
    </div>
  )
}

export function PedidoFeito() {
  const { oid } = useParams()
  const [sp] = useSearchParams()
  const [email, setEmail] = useState(sp.get('email') || '')
  const [o, setO] = useState(null)
  const [erro, setErro] = useState('')
  const [pg, setPg] = useState(null)

  useEffect(() => {
    api(`/api/pagamentos/${oid}`).then(setPg).catch(() => {})
    if (email) buscar()
  }, [oid])

  async function buscar(e) {
    e?.preventDefault()
    try { setO(await api(`/api/pedidos/${oid}/acompanhar?email=${encodeURIComponent(email)}`)); setErro('') } catch (err) { setErro(err.message) }
  }

  const pago = (o?.status_pagamento || pg?.status_pagamento) === 'confirmado'
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <Card className="w-full max-w-lg p-6 text-center">
        <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${pago ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">{pago ? <path d="M5 12l5 5L20 7" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}</svg>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Pedido #{oid} recebido</h1>
        <p className="mt-2 text-muted">{pago ? 'Pagamento confirmado. Seu pedido já entrou na fila de produção.' : 'Recebemos seu comprovante. Assim que a Mart Digital confirmar o Pix, seu pedido entra em produção.'}</p>
        {o ? (
          <div className="mt-6 rounded-xl bg-surface-2 p-4 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted">Produto</span><span className="font-semibold">{o.produto}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted">Total</span><span className="font-semibold tabular">{brl(o.total)}</span></div>
            <div className="mt-2 flex flex-wrap gap-2"><Badge cls={STATUS_PAG[o.status_pagamento][1]}>{STATUS_PAG[o.status_pagamento][0]}</Badge><Badge cls={STATUS_PEDIDO[o.status][1]}>{STATUS_PEDIDO[o.status][0]}</Badge></div>
            {o.rastreio && <div className="mt-2 text-xs">Rastreio: <span className="font-semibold select-all">{o.rastreio}</span></div>}
            <Link to={`/s/${o.shop_id}`} className="mt-4 block text-center font-semibold text-primary">Voltar para a loja</Link>
          </div>
        ) : (
          <form onSubmit={buscar} className="mt-6 flex gap-2 text-left">
            <Input id="acomp-email" type="email" required placeholder="Seu e-mail para acompanhar" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button>Acompanhar</Button>
          </form>
        )}
        {erro && <Alerta tipo="erro" className="mt-3">{erro}</Alerta>}
      </Card>
    </div>
  )
}
