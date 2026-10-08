import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, Alerta, Button, Card, Field, Input, Logo } from '../lib.jsx'

function Moldura({ children }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-block"><Logo /></Link>
        <Card className="p-6">{children}</Card>
      </div>
    </div>
  )
}

export function Confirmar() {
  const { token } = useParams()
  const [estado, setEstado] = useState('carregando')
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/api/auth/confirmar/${token}`).then(() => setEstado('ok')).catch((e) => { setErro(e.message); setEstado('erro') }) }, [token])
  return (
    <Moldura>
      <h1 className="text-xl font-bold">Confirmação de e-mail</h1>
      {estado === 'carregando' && <p className="mt-3 text-muted">Confirmando...</p>}
      {estado === 'ok' && <>
        <Alerta tipo="ok" className="mt-4">E-mail confirmado. Sua conta aguarda aprovação da Mart Digital, mas você já pode entrar e montar a loja.</Alerta>
        <Link to="/"><Button className="mt-4 w-full">Entrar</Button></Link>
      </>}
      {estado === 'erro' && <Alerta tipo="erro" className="mt-4">{erro}</Alerta>}
    </Moldura>
  )
}

export function ResetPassword() {
  const [sp] = useSearchParams()
  const [senha, setSenha] = useState('')
  const [estado, setEstado] = useState(null)
  async function enviar(e) {
    e.preventDefault()
    try { await api('/api/auth/reset', { method: 'POST', body: { token: sp.get('token') || '', senha } }); setEstado({ tipo: 'ok', texto: 'Senha alterada. Entre com a nova senha.' }) }
    catch (err) { setEstado({ tipo: 'erro', texto: err.message }) }
  }
  return (
    <Moldura>
      <h1 className="text-xl font-bold">Nova senha</h1>
      <form onSubmit={enviar} className="mt-4 space-y-3">
        <Field label="Nova senha"><Input id="nova-senha" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
        {estado && <Alerta tipo={estado.tipo}>{estado.texto}</Alerta>}
        <Button className="w-full">Salvar senha</Button>
        {estado?.tipo === 'ok' && <Link to="/" className="block text-center text-sm font-semibold text-primary">Ir para o login</Link>}
      </form>
    </Moldura>
  )
}
