import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './lib.jsx'
import Home from './pages/Home.jsx'
import { Confirmar, ResetPassword } from './pages/Conta.jsx'
import Painel from './pages/Painel.jsx'
import Admin from './pages/Admin.jsx'
import Loja from './pages/Loja.jsx'
import ProdutoLoja from './pages/ProdutoLoja.jsx'
import { Pagamento, PedidoFeito } from './pages/Pagamento.jsx'

function RedirLoja() { const { id } = useParams(); return <Navigate to={`/s/${id}`} replace /> }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/confirmar/:token" element={<Confirmar />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/painel" element={<Painel />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/s/:id" element={<Loja />} />
          <Route path="/s/:id/:pagina" element={<Loja />} />
          <Route path="/loja/:id" element={<RedirLoja />} />
          <Route path="/loja/:id/:pid" element={<ProdutoLoja />} />
          <Route path="/pagamento/:oid" element={<Pagamento />} />
          <Route path="/pedido/:oid" element={<PedidoFeito />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
