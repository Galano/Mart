"""
POC Mart Digital - plataforma de print-on-demand / dropshipping.
FastAPI + SQLite. Integracoes externas SIMULADAS: Stripe, SuperFrete, Lalamove,
envio de e-mail, login Google e IA de analise de impressao.
"""
import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import time
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image
from pydantic import BaseModel, Field

import regras
from auth import (criar_sessao, exigir_admin, exigir_lojista, has_role, hash_senha,
                  usuario_atual, verificar_senha)
from db import UPLOADS, conn, row, set_setting, setting
from seed import seed

app = FastAPI(title="POC Mart Digital")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET") or secrets.token_hex(16)   # sem .env: chave aleatoria por execucao
MAX_COMPROVANTE = 8 * 1024 * 1024
MAX_ARTE_PX = 2400


@app.on_event("startup")
def _startup():
    seed(force=False)


# ================================================================= utilidades

def slugify(txt: str) -> str:
    t = unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:40] or "loja"


def salvar_upload(dados: bytes, ext: str, prefixo: str) -> str:
    nome = f"{prefixo}_{int(time.time())}_{secrets.token_hex(4)}.{ext}"
    (UPLOADS / nome).write_bytes(dados)
    return nome


def salvar_data_url(data_url: str, prefixo: str) -> tuple[str, int, int]:
    m = re.match(r"data:image/(png|jpeg);base64,(.+)", data_url or "", re.S)
    if not m:
        raise HTTPException(400, "Arte inválida")
    raw = base64.b64decode(m.group(2))
    img = Image.open(io.BytesIO(raw))
    if max(img.size) > MAX_ARTE_PX:
        img.thumbnail((MAX_ARTE_PX, MAX_ARTE_PX))
        buf = io.BytesIO(); img.save(buf, "PNG"); raw = buf.getvalue()
    nome = salvar_upload(raw, "png", prefixo)
    return nome, img.size[0], img.size[1]


def shop_dict(r) -> dict:
    return row(r, "redes", "escassez")


def dono_status(c, shop_id) -> str:
    r = c.execute("SELECT u.status FROM shops s JOIN users u ON u.id=s.user_id WHERE s.id=?", (shop_id,)).fetchone()
    return r["status"] if r else "inexistente"


def config_publica(cfg: dict, custo_base: float) -> dict:
    """Remove custos internos. Adicionais de area/opcao sao repassados ao cliente, entao sao publicos."""
    return {
        "modelos": [{"id": m["id"], "nome": m["nome"], "tamanhos": m["tamanhos"],
                     "acrescimo": round((m.get("custo") or custo_base) - custo_base, 2),
                     "cor_fixa": m.get("cor_fixa"), "aviso": m.get("aviso", "")} for m in cfg["modelos"]],
        "cores": cfg["cores"], "areas": cfg["areas"], "opcoes": cfg.get("opcoes", []),
    }


# ================================================================= AUTH

class Cadastro(BaseModel):
    nome: str = Field(min_length=2)
    email: str = Field(min_length=5)
    senha: str = Field(min_length=6)
    nome_loja: str = Field(min_length=2)


class Login(BaseModel):
    email: str
    senha: str


@app.post("/api/auth/cadastro")
def cadastro(b: Cadastro):
    email = b.email.strip().lower()
    with conn() as c:
        if c.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "Já existe uma conta com este e-mail")
        token = secrets.token_urlsafe(16)
        cur = c.execute("INSERT INTO users (email,senha_hash,nome,token_confirmacao,status) VALUES (?,?,?,?, 'pendente')",
                        (email, hash_senha(b.senha), b.nome.strip(), token))
        uid = cur.lastrowid
        c.execute("INSERT INTO user_roles VALUES (?, 'lojista')", (uid,))
        slug, n = slugify(b.nome_loja), 1
        base = slug
        while c.execute("SELECT 1 FROM shops WHERE id=?", (slug,)).fetchone():
            n += 1; slug = f"{base}-{n}"
        c.execute("INSERT INTO shops (id,user_id,nome,email_contato) VALUES (?,?,?,?)", (slug, uid, b.nome_loja.strip(), email))
    # SIMULADO: na versao final o link vai por e-mail
    return {"ok": True, "simulado": True, "link_confirmacao": f"/confirmar/{token}",
            "mensagem": "Enviamos um link de confirmação para o seu e-mail."}


@app.get("/api/auth/confirmar/{token}")
def confirmar(token: str):
    with conn() as c:
        u = c.execute("SELECT id FROM users WHERE token_confirmacao=?", (token,)).fetchone()
        if not u:
            raise HTTPException(404, "Link de confirmação inválido ou já usado")
        c.execute("UPDATE users SET email_confirmado=1, token_confirmacao=NULL WHERE id=?", (u["id"],))
    return {"ok": True}


@app.post("/api/auth/login")
def login(b: Login):
    with conn() as c:
        u = c.execute("SELECT * FROM users WHERE email=?", (b.email.strip().lower(),)).fetchone()
    if not u or not verificar_senha(b.senha, u["senha_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos")
    if not u["email_confirmado"]:
        raise HTTPException(403, "Confirme seu e-mail antes de entrar")
    if u["status"] == "bloqueado":
        raise HTTPException(403, "Conta bloqueada. Fale com a Mart Digital.")
    token = criar_sessao(u["id"])
    return {"token": token, "usuario": usuario_atual(f"Bearer {token}")}


@app.post("/api/auth/google")
def login_google():
    raise HTTPException(501, "Login com Google é simulado no POC. Use e-mail e senha.")


@app.get("/api/auth/me")
def me(u=Depends(usuario_atual)):
    return u


@app.post("/api/auth/logout")
def logout(u=Depends(usuario_atual)):
    with conn() as c:
        c.execute("DELETE FROM sessions WHERE token=?", (u["token"],))
    return {"ok": True}


class Esqueci(BaseModel):
    email: str


@app.post("/api/auth/esqueci")
def esqueci(b: Esqueci):
    token = secrets.token_urlsafe(16)
    with conn() as c:
        c.execute("UPDATE users SET token_reset=? WHERE email=?", (token, b.email.strip().lower()))
        existe = c.execute("SELECT changes() n").fetchone()["n"]
    resp = {"ok": True, "mensagem": "Se o e-mail existir, enviamos um link para redefinir a senha."}
    if existe:
        resp.update({"simulado": True, "link": f"/reset-password?token={token}"})
    return resp


class Reset(BaseModel):
    token: str
    senha: str = Field(min_length=6)


@app.post("/api/auth/reset")
def reset_senha(b: Reset):
    with conn() as c:
        u = c.execute("SELECT id FROM users WHERE token_reset=?", (b.token,)).fetchone()
        if not u:
            raise HTTPException(400, "Link inválido ou expirado")
        c.execute("UPDATE users SET senha_hash=?, token_reset=NULL WHERE id=?", (hash_senha(b.senha), u["id"]))
        c.execute("DELETE FROM sessions WHERE user_id=?", (u["id"],))
    return {"ok": True}


# ================================================================= PUBLICO: loja

@app.get("/api/public/config")
def public_config():
    with conn() as c:
        return {"pix_chave": setting(c, "pix_chave"), "pix_razao": setting(c, "pix_razao"),
                "cep_origem": setting(c, "cep_origem")}


def produtos_da_loja(c, shop_id: str, incluir_inativos=False) -> tuple[list[dict], bool]:
    """Retorna (produtos publicos, demo). Loja sem produtos abre como demonstracao."""
    sps = c.execute("""SELECT sp.*, p.config, p.mockup, p.custo, p.ativo AS p_ativo, p.aviso, p.metodo
                       FROM shop_products sp JOIN products p ON p.id=sp.product_id
                       WHERE sp.shop_id=? ORDER BY sp.id""", (shop_id,)).fetchall()
    publicados = [s for s in sps if s["ativo"] and s["p_ativo"] and (s["personalizavel"] or s["arte_fixa"])]
    if not sps:
        cat = c.execute("SELECT * FROM products WHERE ativo=1 AND custo IS NOT NULL ORDER BY categoria, nome").fetchall()
        return [{
            "id": f"demo-{p['id']}", "nome": p["nome"], "descricao": p["descricao"], "categoria": p["categoria"],
            "preco": p["preco_sugerido"], "mockup": p["mockup"], "personalizavel": True, "arte_fixa": None,
            "preview": None, "vendidos": 0, "aviso": p["aviso"], "metodo": p["metodo"],
            "config": config_publica(json.loads(p["config"]), p["custo"]),
        } for p in cat], True
    lista = publicados if not incluir_inativos else sps
    return [{
        "id": f"sp-{s['id']}", "nome": s["nome"], "descricao": s["descricao"], "categoria": s["categoria"],
        "preco": s["preco_venda"], "mockup": s["mockup"], "personalizavel": bool(s["personalizavel"]),
        "arte_fixa": json.loads(s["arte_fixa"]) if s["arte_fixa"] else None,
        "preview": s["preview"], "vendidos": s["vendidos"], "aviso": s["aviso"], "metodo": s["metodo"],
        "config": config_publica(json.loads(s["config"]), s["custo"]),
    } for s in lista], False


@app.get("/api/lojas/{shop_id}")
def loja_publica(shop_id: str):
    with conn() as c:
        s = c.execute("SELECT * FROM shops WHERE id=?", (shop_id,)).fetchone()
        if not s:
            raise HTTPException(404, "Loja não encontrada")
        shop = shop_dict(s)
        status_dono = dono_status(c, shop_id)
        produtos, demo = produtos_da_loja(c, shop_id)
        modelos = [dict(r) for r in c.execute("SELECT * FROM art_templates WHERE ativo=1")]
    disponivel = bool(shop["online"]) and status_dono == "aprovado"
    motivo = None if disponivel else ("offline" if status_dono == "aprovado" else "aprovacao")
    publico = {k: shop[k] for k in ("id", "nome", "logo", "banner", "cor_primaria", "cor_destaque", "template",
                                    "descricao", "email_contato", "whatsapp", "whatsapp_fixo", "frase", "redes",
                                    "instagram_fixo", "mostrar_vendidos")}
    return {"loja": publico, "disponivel": disponivel, "motivo": motivo, "demo": demo,
            "desconto": regras.desconto_ativo(shop), "escassez": shop["escassez"] if shop["escassez"].get("ativo") else None,
            "produtos": produtos if disponivel else [], "modelos_arte": modelos}


def resolver_produto(c, shop_id: str, pid: str):
    """Revalida no servidor: loja, dono aprovado, online, produto ativo e publicado."""
    s = c.execute("SELECT * FROM shops WHERE id=?", (shop_id,)).fetchone()
    if not s:
        raise HTTPException(404, "Loja não encontrada")
    shop = shop_dict(s)
    if dono_status(c, shop_id) != "aprovado":
        raise HTTPException(403, "Loja em aprovação")
    if not shop["online"]:
        raise HTTPException(403, "Loja indisponível no momento")
    tem_produtos = c.execute("SELECT COUNT(*) n FROM shop_products WHERE shop_id=?", (shop_id,)).fetchone()["n"]
    if pid.startswith("demo-"):
        if tem_produtos:
            raise HTTPException(404, "Produto não encontrado")
        p = c.execute("SELECT * FROM products WHERE id=?", (pid[5:],)).fetchone()
        if not p:
            raise HTTPException(404, "Produto não encontrado")
        produto = regras.carregar_produto(p)
        return shop, produto, None, produto["preco_sugerido"], None
    if not pid.startswith("sp-"):
        raise HTTPException(404, "Produto não encontrado")
    sp = c.execute("SELECT * FROM shop_products WHERE id=? AND shop_id=?", (int(pid[3:]), shop_id)).fetchone()
    if not sp or not sp["ativo"] or not (sp["personalizavel"] or sp["arte_fixa"]):
        raise HTTPException(404, "Produto não encontrado")
    produto = regras.carregar_produto(c.execute("SELECT * FROM products WHERE id=?", (sp["product_id"],)).fetchone())
    arte = json.loads(sp["arte_fixa"]) if sp["arte_fixa"] else None
    return shop, produto, dict(sp), sp["preco_venda"], arte


class Cotacao(BaseModel):
    produto: str
    item: dict
    cep: str | None = None


@app.post("/api/lojas/{shop_id}/cotar")
def cotar(shop_id: str, b: Cotacao):
    with conn() as c:
        shop, produto, sp, preco, arte = resolver_produto(c, shop_id, b.produto)
        taxa = float(setting(c, "taxa_plataforma", "0"))
    calc = regras.calcular_item(produto, b.item, preco, arte)
    fretes = regras.cotar_frete(b.cep, calc["qtd"]) if b.cep else []
    d = regras.desconto_ativo(shop)
    desconto = round(calc["subtotal"] * d["pct"] / 100, 2) if d else 0
    return {"venda_unit": calc["venda_unit"], "subtotal": calc["subtotal"], "desconto": desconto,
            "adicionais": calc["adicionais"], "dif_modelo": calc["dif_modelo"], "qtd": calc["qtd"],
            "fretes": fretes, "desconto_info": d}


@app.post("/api/lojas/{shop_id}/pedidos")
async def criar_pedido(shop_id: str, dados: str = Form(...), comprovante: UploadFile | None = File(None)):
    """Pedido criado no servidor: revalida loja, produto, preco, adicionais, desconto e frete."""
    try:
        d = json.loads(dados)
    except json.JSONDecodeError:
        raise HTTPException(400, "Dados inválidos")
    cli = d.get("cliente") or {}
    for campo in ("nome", "email", "telefone", "cep", "endereco", "numero", "cidade", "uf"):
        if not str(cli.get(campo) or "").strip():
            raise HTTPException(400, f"Preencha o campo {campo}")
    metodo = d.get("metodo_pagamento")
    if metodo not in ("pix", "cartao"):
        raise HTTPException(400, "Escolha a forma de pagamento")

    comp_nome = None
    if metodo == "pix":
        if not comprovante:
            raise HTTPException(400, "Anexe o comprovante do Pix para concluir o pedido")
        raw = await comprovante.read()
        if len(raw) > MAX_COMPROVANTE:
            raise HTTPException(400, "Comprovante maior que 8 MB")
        ct = (comprovante.content_type or "").lower()
        ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf"}.get(ct)
        if not ext:
            raise HTTPException(400, "Comprovante deve ser imagem ou PDF")
        comp_nome = salvar_upload(raw, ext, "comprovante")

    with conn() as c:
        shop, produto, sp, preco, arte = resolver_produto(c, shop_id, d.get("produto", ""))
        taxa_pct = float(setting(c, "taxa_plataforma", "0"))
        item = d.get("item") or {}
        calc = regras.calcular_item(produto, item, preco, arte)
        frete = regras.escolher_frete(cli["cep"], calc["qtd"], d.get("frete", ""))
        tot = regras.fechar_pedido(calc, shop, frete, taxa_pct)

        artes = d.get("artes") or {}
        camadas = arte["areas"] if arte else (item.get("camadas") or {})
        if not arte:
            vazias = [a for a in calc["areas"] if not (camadas.get(a) or [])]
            if vazias:
                nomes = {x["id"]: x["nome"] for x in produto["config"]["areas"]}
                raise HTTPException(400, "Adicione uma arte em: " + ", ".join(nomes[a] for a in vazias))

        item_salvo = {**calc, "opcoes": item.get("opcoes") or {}, "camadas": camadas, "produto_nome": produto["nome"],
                      "nome_loja_produto": sp["nome"] if sp else produto["nome"], "mockup": produto["mockup"]}
        c.execute("BEGIN IMMEDIATE")
        cur = c.execute("""INSERT INTO orders (shop_id,shop_product_id,product_id,demo,cliente,item,subtotal,desconto,frete,
                           total,custo_total,taxa_plataforma,ganho_lojista,metodo_pagamento,comprovante)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (shop_id, sp["id"] if sp else None, produto["id"], 0 if sp else 1,
                         json.dumps(cli, ensure_ascii=False), json.dumps(item_salvo, ensure_ascii=False),
                         tot["subtotal"], tot["desconto"], json.dumps(frete, ensure_ascii=False), tot["total"],
                         tot["custo_total"], tot["taxa_plataforma"], tot["ganho_lojista"], metodo, comp_nome))
        oid = cur.lastrowid
        fontes = {a: artes.get(a) for a in calc["areas"]}
        for area, data_url in fontes.items():
            if data_url:
                nome, w, h = salvar_data_url(data_url, f"arte_{oid}_{area}")
                c.execute("INSERT INTO order_artworks (order_id,area,arquivo,largura_px,altura_px) VALUES (?,?,?,?,?)",
                          (oid, area, nome, w, h))
        c.execute("COMMIT")

    resp = {"pedido_id": oid, "total": tot["total"], "status_pagamento": "aguardando"}
    if metodo == "cartao":
        resp["checkout"] = f"/pagamento/{oid}"   # SIMULADO: Stripe Checkout incorporado
    return resp


@app.get("/api/pedidos/{oid}/acompanhar")
def acompanhar(oid: int, email: str):
    with conn() as c:
        o = c.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone()
    if not o or json.loads(o["cliente"])["email"].lower() != email.strip().lower():
        raise HTTPException(404, "Pedido não encontrado")
    item = json.loads(o["item"])
    return {"id": o["id"], "shop_id": o["shop_id"], "total": o["total"], "metodo": o["metodo_pagamento"],
            "status_pagamento": o["status_pagamento"], "status": o["status"], "rastreio": o["rastreio"],
            "produto": item["nome_loja_produto"], "criado_em": o["criado_em"]}


# ================================================================= STRIPE (SIMULADO)

def _assinar(payload: bytes, ts: str) -> str:
    return hmac.new(STRIPE_WEBHOOK_SECRET.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()


def confirmar_pagamento(c, oid: int):
    o = c.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone()
    if not o or o["status_pagamento"] == "confirmado":
        return
    c.execute("UPDATE orders SET status_pagamento='confirmado', pago_em=datetime('now','localtime') WHERE id=?", (oid,))
    if o["shop_product_id"]:
        c.execute("UPDATE shop_products SET vendidos=vendidos+? WHERE id=?",
                  (json.loads(o["item"])["qtd"], o["shop_product_id"]))


def processar_evento_stripe(payload: bytes, sig: str):
    """Valida a assinatura antes de confiar no evento (como o webhook real do Stripe)."""
    partes = dict(p.split("=", 1) for p in sig.split(",") if "=" in p)
    if not partes.get("t") or not hmac.compare_digest(_assinar(payload, partes["t"]), partes.get("v1", "")):
        raise HTTPException(400, "Assinatura inválida")
    ev = json.loads(payload)
    if ev.get("type") == "checkout.session.completed":
        with conn() as c:
            confirmar_pagamento(c, int(ev["data"]["object"]["metadata"]["pedido_id"]))


@app.post("/api/webhooks/stripe")
async def stripe_webhook(req: Request):
    processar_evento_stripe(await req.body(), req.headers.get("stripe-signature", ""))
    return {"recebido": True}


@app.post("/api/pagamentos/simular-cartao/{oid}")
def simular_cartao(oid: int):
    """Botao 'Pagar' do checkout simulado: gera o evento assinado e passa pela mesma validacao do webhook."""
    with conn() as c:
        o = c.execute("SELECT metodo_pagamento, total FROM orders WHERE id=?", (oid,)).fetchone()
    if not o or o["metodo_pagamento"] != "cartao":
        raise HTTPException(404, "Pedido não encontrado")
    payload = json.dumps({"type": "checkout.session.completed",
                          "data": {"object": {"metadata": {"pedido_id": str(oid)}, "amount_total": int(o["total"] * 100)}}}).encode()
    ts = str(int(time.time()))
    processar_evento_stripe(payload, f"t={ts},v1={_assinar(payload, ts)}")
    return {"ok": True}


@app.get("/api/pagamentos/{oid}")
def ver_pagamento(oid: int):
    with conn() as c:
        o = c.execute("SELECT id,total,metodo_pagamento,status_pagamento,shop_id FROM orders WHERE id=?", (oid,)).fetchone()
    if not o:
        raise HTTPException(404)
    return dict(o)


# ================================================================= ESTUDIO

@app.get("/api/modelos-arte")
def modelos_arte():
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM art_templates WHERE ativo=1")]


@app.post("/api/estudio/remover-fundo")
async def remover_fundo(arquivo: UploadFile = File(...)):
    """
    Remocao de fundo no servidor. POC: preenchimento a partir das bordas por similaridade de cor
    (bom para fundo liso). Versao final: modelo de segmentacao (rembg / API dedicada).
    """
    raw = await arquivo.read()
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(400, "Imagem maior que 15 MB")
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        raise HTTPException(400, "Arquivo não é uma imagem")
    img.thumbnail((MAX_ARTE_PX, MAX_ARTE_PX))
    w, h = img.size
    px = img.load()
    cantos = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    ref = tuple(sum(c[i] for c in cantos) // 4 for i in range(3))
    tol = 42 ** 2 * 3

    def parecido(p):
        return sum((p[i] - ref[i]) ** 2 for i in range(3)) <= tol

    visto = bytearray(w * h)
    pilha = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while pilha:
        x, y = pilha.pop()
        i = y * w + x
        if visto[i]:
            continue
        visto[i] = 1
        p = px[x, y]
        if p[3] and parecido(p):
            px[x, y] = (p[0], p[1], p[2], 0)
            if x > 0: pilha.append((x - 1, y))
            if x < w - 1: pilha.append((x + 1, y))
            if y > 0: pilha.append((x, y - 1))
            if y < h - 1: pilha.append((x, y + 1))
    buf = io.BytesIO(); img.save(buf, "PNG")
    return Response(buf.getvalue(), media_type="image/png")


class Analise(BaseModel):
    produto: str
    area: str
    area_cm: list[float]
    camadas: list[dict]   # {tipo, nome, px_w, px_h, cm_w, cm_h, fora}


@app.post("/api/estudio/analisar")
def analisar(b: Analise):
    """
    SIMULADO. Versao final: IA via AI Gateway no servidor, credencial privada.
    Aqui: regras de pre-impressao (DPI, margem, tamanho) com resposta em portugues.
    """
    if not b.camadas:
        return {"nota": "sem_arte", "titulo": "Nenhuma arte nesta área",
                "recomendacoes": ["Adicione uma imagem ou texto para analisarmos a impressão."]}
    recs, nota = [], "otima"
    for cm in b.camadas:
        if cm.get("tipo") == "imagem" and cm.get("cm_w"):
            dpi = cm["px_w"] / (cm["cm_w"] / 2.54)
            if dpi < 100:
                nota = "ruim"
                recs.append(f"“{cm.get('nome', 'imagem')}” está com cerca de {dpi:.0f} DPI. Vai sair pixelada. "
                            f"Reduza para no máximo {cm['px_w'] / 150 * 2.54:.1f} cm de largura ou envie um arquivo maior.")
            elif dpi < 150:
                nota = "media" if nota == "otima" else nota
                recs.append(f"“{cm.get('nome', 'imagem')}” tem cerca de {dpi:.0f} DPI. Aceitável, mas o ideal é 150 a 300 DPI.")
            else:
                recs.append(f"“{cm.get('nome', 'imagem')}” tem boa resolução ({dpi:.0f} DPI).")
        if cm.get("fora"):
            nota = "media" if nota == "otima" else nota
            recs.append(f"“{cm.get('nome', 'camada')}” passa da margem vermelha e pode ser cortada na impressão.")
        if cm.get("tipo") == "texto" and cm.get("cm_h") and cm["cm_h"] < 0.4:
            nota = "media" if nota == "otima" else nota
            recs.append(f"O texto “{cm.get('nome', '')}” está muito pequeno. Use pelo menos 4 mm de altura.")
    titulos = {"otima": "Pronto para imprimir", "media": "Dá para imprimir, com ajustes", "ruim": "Qualidade insuficiente"}
    return {"nota": nota, "titulo": titulos[nota], "recomendacoes": recs, "simulado": True}


# ================================================================= ARQUIVOS PRIVADOS

@app.get("/api/arquivos/{nome}")
def arquivo(nome: str, auth: str = ""):
    """Artes e comprovantes sao privados: exige sessao de admin ou do lojista dono (token via ?auth=)."""
    if "/" in nome or ".." in nome or "\\" in nome:
        raise HTTPException(400)
    publico = nome.startswith(("logo_", "banner_", "preview_"))
    if not publico:
        u = usuario_atual(f"Bearer {auth}")
        if "admin" not in u["roles"]:
            with conn() as c:
                ok = c.execute("""SELECT 1 FROM order_artworks a JOIN orders o ON o.id=a.order_id
                                  WHERE a.arquivo=? AND o.shop_id=?""", (nome, u["shop_id"])).fetchone()
            if not ok:
                raise HTTPException(403, "Sem acesso a este arquivo")
    f = UPLOADS / nome
    if not f.exists():
        raise HTTPException(404)
    return FileResponse(f)


# ================================================================= PAINEL DO LOJISTA

def ganhos_de(c, shop_id: str) -> dict:
    dias = int(setting(c, "dias_liberacao", "7"))
    agora = datetime.now()
    disp = prev = repassado = 0.0
    itens = []
    for o in c.execute("""SELECT id, ganho_lojista, pago_em, status, status_pagamento, repassado_em, criado_em, total
                          FROM orders WHERE shop_id=? ORDER BY id DESC""", (shop_id,)):
        if o["status_pagamento"] != "confirmado" or o["status"] == "cancelado":
            continue
        libera = datetime.fromisoformat(o["pago_em"]) + timedelta(days=dias)
        if o["repassado_em"]:
            situacao = "repassado"; repassado += o["ganho_lojista"]
        elif libera <= agora:
            situacao = "disponivel"; disp += o["ganho_lojista"]
        else:
            situacao = "previsto"; prev += o["ganho_lojista"]
        itens.append({"pedido": o["id"], "valor": o["ganho_lojista"], "situacao": situacao,
                      "libera_em": libera.strftime("%Y-%m-%d %H:%M"), "repassado_em": o["repassado_em"]})
    return {"disponivel": round(disp, 2), "previsto": round(prev, 2), "repassado": round(repassado, 2),
            "dias_liberacao": dias, "itens": itens}


@app.get("/api/painel/resumo")
def painel_resumo(u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    with conn() as c:
        shop = shop_dict(c.execute("SELECT * FROM shops WHERE id=?", (shop_id,)).fetchone())
        st = c.execute("""SELECT COUNT(*) pedidos,
                           COALESCE(SUM(CASE WHEN status_pagamento='confirmado' AND status!='cancelado' THEN total END),0) vendas,
                           SUM(status_pagamento='aguardando') aguardando
                          FROM orders WHERE shop_id=?""", (shop_id,)).fetchone()
        nprod = c.execute("SELECT COUNT(*) n FROM shop_products WHERE shop_id=?", (shop_id,)).fetchone()["n"]
        g = ganhos_de(c, shop_id)
    return {"loja": shop, "status_conta": u["status"], "demo": nprod == 0, "produtos": nprod,
            "pedidos": st["pedidos"], "vendas": round(st["vendas"], 2), "aguardando": st["aguardando"] or 0,
            "ganhos": {k: g[k] for k in ("disponivel", "previsto", "repassado")}}


class LojaConfig(BaseModel):
    nome: str = Field(min_length=2)
    cor_primaria: str
    cor_destaque: str
    template: str
    online: bool
    descricao: str = ""
    email_contato: str = ""
    whatsapp: str = ""
    whatsapp_fixo: bool = False
    frase: str = ""
    redes: dict = {}
    instagram_fixo: bool = False
    escassez: dict = {}
    mostrar_vendidos: bool = False
    chave_pix: str = ""


@app.put("/api/painel/loja")
def salvar_loja(b: LojaConfig, u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    if b.template not in ("essencial", "vitrine", "editorial", "vibrante"):
        raise HTTPException(400, "Template inválido")
    hexre = re.compile(r"^#[0-9a-fA-F]{6}$")
    if not hexre.match(b.cor_primaria) or not hexre.match(b.cor_destaque):
        raise HTTPException(400, "Cor inválida")
    redes = {k: v.strip() for k, v in b.redes.items() if k in ("facebook", "tiktok", "youtube", "x", "instagram") and v.strip()}
    esc = b.escassez or {}
    esc = {"ativo": bool(esc.get("ativo")), "mensagem": str(esc.get("mensagem", ""))[:80],
           "desconto": max(0, min(float(esc.get("desconto") or 0), 50)), "ate": str(esc.get("ate", ""))}
    with conn() as c:
        c.execute("""UPDATE shops SET nome=?,cor_primaria=?,cor_destaque=?,template=?,online=?,descricao=?,email_contato=?,
                     whatsapp=?,whatsapp_fixo=?,frase=?,redes=?,instagram_fixo=?,escassez=?,mostrar_vendidos=?,chave_pix=?
                     WHERE id=?""",
                  (b.nome, b.cor_primaria, b.cor_destaque, b.template, int(b.online), b.descricao, b.email_contato,
                   re.sub(r"\D", "", b.whatsapp), int(b.whatsapp_fixo), b.frase, json.dumps(redes), int(b.instagram_fixo),
                   json.dumps(esc), int(b.mostrar_vendidos), b.chave_pix, shop_id))
    return {"ok": True}


@app.post("/api/painel/loja/upload/{campo}")
async def upload_loja(campo: str, arquivo: UploadFile = File(...), u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    if campo not in ("logo", "banner"):
        raise HTTPException(400)
    raw = await arquivo.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(400, "Imagem maior que 5 MB")
    try:
        img = Image.open(io.BytesIO(raw)); img.verify()
    except Exception:
        raise HTTPException(400, "Envie uma imagem PNG, JPG ou WEBP")
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    img.thumbnail((600, 600) if campo == "logo" else (1800, 700))
    buf = io.BytesIO(); img.save(buf, "PNG")
    nome = salvar_upload(buf.getvalue(), "png", campo)
    with conn() as c:
        c.execute(f"UPDATE shops SET {campo}=? WHERE id=?", (nome, shop_id))
    return {"arquivo": nome}


@app.get("/api/painel/catalogo")
def catalogo(q: str = "", u=Depends(usuario_atual)):
    exigir_lojista(u)
    with conn() as c:
        taxa = float(setting(c, "taxa_plataforma", "0"))
        rs = c.execute("""SELECT * FROM products WHERE ativo=1 AND custo IS NOT NULL
                          AND (nome LIKE ? OR categoria LIKE ?) ORDER BY categoria, nome""", (f"%{q}%", f"%{q}%")).fetchall()
    return {"taxa_plataforma": taxa, "produtos": [regras.carregar_produto(r) for r in rs]}


class LucroReq(BaseModel):
    product_id: str
    preco_venda: float
    areas: list[str] = []


@app.post("/api/painel/lucro")
def calc_lucro(b: LucroReq, u=Depends(usuario_atual)):
    exigir_lojista(u)
    with conn() as c:
        p = c.execute("SELECT * FROM products WHERE id=?", (b.product_id,)).fetchone()
        taxa = float(setting(c, "taxa_plataforma", "0"))
    if not p:
        raise HTTPException(404)
    return regras.lucro_previsto(regras.carregar_produto(p), b.preco_venda, b.areas, taxa)


class ProdutoLoja(BaseModel):
    product_id: str
    nome: str = Field(min_length=2)
    descricao: str = ""
    categoria: str = ""
    preco_venda: float = Field(gt=0)
    personalizavel: bool = True
    arte_fixa: dict | None = None   # {"areas": {area_id: [camadas]}, "cor":..., "previews": {area: dataURL}}
    preview: str | None = None      # dataURL do mockup com a arte
    ativo: bool = True


def _validar_produto_loja(c, b: ProdutoLoja):
    p = c.execute("SELECT * FROM products WHERE id=?", (b.product_id,)).fetchone()
    if not p or not p["ativo"] or p["custo"] is None:
        raise HTTPException(400, "Produto do catálogo indisponível")
    if not b.personalizavel and not (b.arte_fixa and b.arte_fixa.get("areas")):
        raise HTTPException(400, "Para publicar, habilite a personalização ou monte uma arte fixa no estúdio")
    prod = regras.carregar_produto(p)
    areas = list((b.arte_fixa or {}).get("areas", {}).keys()) if not b.personalizavel else []
    luc = regras.lucro_previsto(prod, b.preco_venda, areas, float(setting(c, "taxa_plataforma", "0")))
    if luc["lucro"] < 0:
        raise HTTPException(400, f"Preço abaixo do custo (R$ {luc['custo']:.2f}). Aumente o preço de venda.")
    return prod


@app.get("/api/painel/produtos")
def meus_produtos(u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    with conn() as c:
        taxa = float(setting(c, "taxa_plataforma", "0"))
        rs = c.execute("""SELECT sp.*, p.nome AS base_nome, p.custo, p.preco_sugerido, p.mockup, p.config, p.ativo AS p_ativo
                          FROM shop_products sp JOIN products p ON p.id=sp.product_id WHERE sp.shop_id=? ORDER BY sp.id DESC""",
                       (shop_id,)).fetchall()
    out = []
    for r in rs:
        d = dict(r)
        arte = json.loads(d["arte_fixa"]) if d["arte_fixa"] else None
        prod = {"custo": d["custo"], "config": json.loads(d.pop("config"))}
        d["arte_fixa"] = arte
        d["lucro"] = regras.lucro_previsto(prod, d["preco_venda"], list(arte["areas"].keys()) if arte and not d["personalizavel"] else [], taxa)
        out.append(d)
    return out


@app.post("/api/painel/produtos")
def criar_produto_loja(b: ProdutoLoja, u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    with conn() as c:
        _validar_produto_loja(c, b)
        preview = salvar_data_url(b.preview, "preview")[0] if b.preview else None
        cur = c.execute("""INSERT INTO shop_products (shop_id,product_id,nome,descricao,categoria,preco_venda,personalizavel,
                           arte_fixa,preview,ativo) VALUES (?,?,?,?,?,?,?,?,?,?)""",
                        (shop_id, b.product_id, b.nome, b.descricao, b.categoria, b.preco_venda, int(b.personalizavel),
                         json.dumps(b.arte_fixa, ensure_ascii=False) if (b.arte_fixa and not b.personalizavel) else None,
                         preview, int(b.ativo)))
    return {"id": cur.lastrowid}


@app.put("/api/painel/produtos/{spid}")
def editar_produto_loja(spid: int, b: ProdutoLoja, u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    with conn() as c:
        atual = c.execute("SELECT * FROM shop_products WHERE id=? AND shop_id=?", (spid, shop_id)).fetchone()
        if not atual:
            raise HTTPException(404)
        _validar_produto_loja(c, b)
        preview = salvar_data_url(b.preview, "preview")[0] if b.preview else atual["preview"]
        c.execute("""UPDATE shop_products SET nome=?,descricao=?,categoria=?,preco_venda=?,personalizavel=?,arte_fixa=?,
                     preview=?,ativo=? WHERE id=?""",
                  (b.nome, b.descricao, b.categoria, b.preco_venda, int(b.personalizavel),
                   json.dumps(b.arte_fixa, ensure_ascii=False) if (b.arte_fixa and not b.personalizavel) else None,
                   preview, int(b.ativo), spid))
    return {"ok": True}


@app.delete("/api/painel/produtos/{spid}")
def remover_produto_loja(spid: int, u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    with conn() as c:
        if c.execute("SELECT 1 FROM orders WHERE shop_product_id=?", (spid,)).fetchone():
            c.execute("UPDATE shop_products SET ativo=0 WHERE id=? AND shop_id=?", (spid, shop_id))
            return {"ok": True, "arquivado": True}
        c.execute("DELETE FROM shop_products WHERE id=? AND shop_id=?", (spid, shop_id))
    return {"ok": True}


def pedido_dict(o, artes=None, incluir_custos=False) -> dict:
    d = row(o, "cliente", "item", "frete")
    if not incluir_custos:
        d.pop("custo_total", None)
    d["artes"] = artes or []
    return d


@app.get("/api/painel/pedidos")
def pedidos_lojista(u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    with conn() as c:
        os_ = c.execute("SELECT * FROM orders WHERE shop_id=? ORDER BY id DESC", (shop_id,)).fetchall()
        artes = {}
        for a in c.execute("""SELECT a.* FROM order_artworks a JOIN orders o ON o.id=a.order_id WHERE o.shop_id=?""", (shop_id,)):
            artes.setdefault(a["order_id"], []).append(dict(a))
    lista = []
    for o in os_:
        d = pedido_dict(o, artes.get(o["id"]), incluir_custos=True)
        d.pop("comprovante", None)
        lista.append(d)
    return lista


@app.get("/api/painel/ganhos")
def painel_ganhos(u=Depends(usuario_atual)):
    shop_id = exigir_lojista(u)
    with conn() as c:
        return ganhos_de(c, shop_id)


# ================================================================= ADMIN

def _admin(u=Depends(usuario_atual)):
    exigir_admin(u)
    return u


@app.get("/api/admin/resumo")
def admin_resumo(u=Depends(_admin)):
    with conn() as c:
        tot = c.execute("""SELECT COUNT(*) pedidos,
              COALESCE(SUM(CASE WHEN status_pagamento='confirmado' AND status!='cancelado' THEN total END),0) faturamento,
              COALESCE(SUM(CASE WHEN status_pagamento='confirmado' AND status!='cancelado' THEN custo_total END),0) custo,
              COALESCE(SUM(CASE WHEN status_pagamento='confirmado' AND status!='cancelado' THEN taxa_plataforma END),0) taxas,
              COALESCE(SUM(CASE WHEN status_pagamento='confirmado' AND status!='cancelado' THEN ganho_lojista END),0) repasses,
              SUM(status_pagamento='aguardando') aguardando,
              SUM(status_pagamento='confirmado' AND status IN ('novo','em_producao')) producao
            FROM orders""").fetchone()
        por_loja = [dict(r) for r in c.execute("""
            SELECT s.id, s.nome, COUNT(o.id) pedidos,
                   COALESCE(SUM(CASE WHEN o.status_pagamento='confirmado' AND o.status!='cancelado' THEN o.total END),0) faturamento,
                   COALESCE(SUM(CASE WHEN o.status_pagamento='confirmado' AND o.status!='cancelado' THEN o.ganho_lojista END),0) ganho
            FROM shops s LEFT JOIN orders o ON o.shop_id=s.id GROUP BY s.id ORDER BY faturamento DESC""")]
        lojistas = c.execute("SELECT status, COUNT(*) n FROM users u JOIN user_roles r ON r.user_id=u.id AND r.role='lojista' GROUP BY status").fetchall()
    return {**{k: (tot[k] or 0) for k in tot.keys()}, "por_loja": por_loja,
            "lojistas": {r["status"]: r["n"] for r in lojistas}}


@app.get("/api/admin/lojistas")
def admin_lojistas(u=Depends(_admin)):
    with conn() as c:
        rs = c.execute("""SELECT u.id, u.nome, u.email, u.status, u.email_confirmado, u.criado_em, s.id AS shop_id, s.nome AS loja,
                                 s.online, (SELECT COUNT(*) FROM shop_products sp WHERE sp.shop_id=s.id) produtos,
                                 (SELECT COUNT(*) FROM orders o WHERE o.shop_id=s.id) pedidos
                          FROM users u JOIN user_roles r ON r.user_id=u.id AND r.role='lojista'
                          LEFT JOIN shops s ON s.user_id=u.id ORDER BY u.id DESC""").fetchall()
    return [dict(r) for r in rs]


class StatusReq(BaseModel):
    status: str


@app.post("/api/admin/lojistas/{uid}/status")
def admin_status_lojista(uid: int, b: StatusReq, u=Depends(_admin)):
    if b.status not in ("aprovado", "bloqueado", "pendente"):
        raise HTTPException(400)
    with conn() as c:
        if has_role(c, uid, "admin"):
            raise HTTPException(400, "Não é possível alterar um administrador")
        c.execute("UPDATE users SET status=? WHERE id=?", (b.status, uid))
        if b.status == "bloqueado":
            c.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
    return {"ok": True}


@app.get("/api/admin/produtos")
def admin_produtos(u=Depends(_admin)):
    with conn() as c:
        return [regras.carregar_produto(r) for r in c.execute("SELECT * FROM products ORDER BY ativo DESC, categoria, nome")]


class ProdutoAdmin(BaseModel):
    nome: str
    categoria: str
    metodo: str
    custo: float | None = None
    preco_sugerido: float | None = None
    ativo: bool
    descricao: str = ""
    aviso: str = ""
    config: dict | None = None


@app.put("/api/admin/produtos/{pid}")
def admin_editar_produto(pid: str, b: ProdutoAdmin, u=Depends(_admin)):
    if b.ativo and (b.custo is None or b.custo <= 0 or b.preco_sugerido is None):
        raise HTTPException(400, "Produto só pode ser ativado com custo e preço sugerido definidos")
    if b.custo and b.preco_sugerido and b.preco_sugerido < b.custo:
        raise HTTPException(400, "Preço sugerido menor que o custo")
    with conn() as c:
        atual = c.execute("SELECT config FROM products WHERE id=?", (pid,)).fetchone()
        if not atual:
            raise HTTPException(404)
        cfg = b.config if b.config else json.loads(atual["config"])
        c.execute("""UPDATE products SET nome=?,categoria=?,metodo=?,custo=?,preco_sugerido=?,ativo=?,descricao=?,aviso=?,config=?
                     WHERE id=?""", (b.nome, b.categoria, b.metodo, b.custo, b.preco_sugerido, int(b.ativo), b.descricao,
                                     b.aviso, json.dumps(cfg, ensure_ascii=False), pid))
    return {"ok": True}


class NovoProduto(ProdutoAdmin):
    mockup: str
    copiar_de: str = "camiseta"


@app.post("/api/admin/produtos")
def admin_criar_produto(b: NovoProduto, u=Depends(_admin)):
    with conn() as c:
        base = c.execute("SELECT config FROM products WHERE id=?", (b.copiar_de,)).fetchone()
        if not base:
            raise HTTPException(400, "Modelo base inválido")
        pid, n = slugify(b.nome), 1
        while c.execute("SELECT 1 FROM products WHERE id=?", (pid,)).fetchone():
            n += 1; pid = f"{slugify(b.nome)}-{n}"
        ativo = int(b.ativo and b.custo is not None and b.preco_sugerido is not None)
        c.execute("""INSERT INTO products (id,nome,categoria,mockup,metodo,custo,preco_sugerido,ativo,descricao,aviso,config)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                  (pid, b.nome, b.categoria, b.mockup, b.metodo, b.custo, b.preco_sugerido, ativo, b.descricao, b.aviso, base["config"]))
    return {"id": pid}


@app.get("/api/admin/pedidos")
def admin_pedidos(loja: str = "", status: str = "", pagamento: str = "", u=Depends(_admin)):
    sql = "SELECT o.*, s.nome AS loja_nome FROM orders o JOIN shops s ON s.id=o.shop_id WHERE 1=1"
    params = []
    if loja:
        sql += " AND o.shop_id=?"; params.append(loja)
    if status:
        sql += " AND o.status=?"; params.append(status)
    if pagamento:
        sql += " AND o.status_pagamento=?"; params.append(pagamento)
    with conn() as c:
        os_ = c.execute(sql + " ORDER BY o.id DESC", params).fetchall()
        artes = {}
        for a in c.execute("SELECT * FROM order_artworks"):
            artes.setdefault(a["order_id"], []).append(dict(a))
    return [{**pedido_dict(o, artes.get(o["id"]), incluir_custos=True), "loja_nome": o["loja_nome"]} for o in os_]


class AcaoPagamento(BaseModel):
    acao: str   # confirmar | recusar


@app.post("/api/admin/pedidos/{oid}/pagamento")
def admin_pagamento(oid: int, b: AcaoPagamento, u=Depends(_admin)):
    with conn() as c:
        o = c.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone()
        if not o:
            raise HTTPException(404)
        if b.acao == "confirmar":
            confirmar_pagamento(c, oid)
        elif b.acao == "recusar":
            c.execute("UPDATE orders SET status_pagamento='recusado', status='cancelado' WHERE id=?", (oid,))
        else:
            raise HTTPException(400)
    return {"ok": True}


@app.post("/api/admin/pedidos/{oid}/status")
def admin_status_pedido(oid: int, b: StatusReq, u=Depends(_admin)):
    if b.status not in ("novo", "em_producao", "enviado", "entregue", "cancelado"):
        raise HTTPException(400)
    with conn() as c:
        o = c.execute("SELECT status_pagamento FROM orders WHERE id=?", (oid,)).fetchone()
        if not o:
            raise HTTPException(404)
        if b.status in ("em_producao", "enviado", "entregue") and o["status_pagamento"] != "confirmado":
            raise HTTPException(400, "Confirme o pagamento antes de produzir ou enviar")
        c.execute("UPDATE orders SET status=? WHERE id=?", (b.status, oid))
    return {"ok": True}


@app.post("/api/admin/pedidos/{oid}/etiqueta")
def admin_etiqueta(oid: int, u=Depends(_admin)):
    """SIMULADO: na versao final cria a etiqueta na SuperFrete/Lalamove pelo servidor."""
    with conn() as c:
        o = c.execute("SELECT frete, status_pagamento FROM orders WHERE id=?", (oid,)).fetchone()
        if not o:
            raise HTTPException(404)
        if o["status_pagamento"] != "confirmado":
            raise HTTPException(400, "Pagamento ainda não confirmado")
        frete = json.loads(o["frete"])
        cod = ("LM" + secrets.token_hex(4).upper()) if frete["id"] == "lalamove" else \
              ("QB" if frete["id"] == "pac" else "SX") + f"{secrets.randbelow(10**9):09d}BR"
        c.execute("UPDATE orders SET etiqueta=?, rastreio=? WHERE id=?", (f"etiqueta_{oid}.pdf", cod, oid))
    return {"rastreio": cod, "simulado": True}


@app.post("/api/admin/pedidos/{oid}/repasse")
def admin_repasse(oid: int, u=Depends(_admin)):
    with conn() as c:
        g = c.execute("SELECT pago_em, status_pagamento, status FROM orders WHERE id=?", (oid,)).fetchone()
        dias = int(setting(c, "dias_liberacao", "7"))
        if not g or g["status_pagamento"] != "confirmado" or g["status"] == "cancelado":
            raise HTTPException(400, "Pedido sem saldo")
        if datetime.fromisoformat(g["pago_em"]) + timedelta(days=dias) > datetime.now():
            raise HTTPException(400, f"Saldo só libera {dias} dias após a confirmação do pagamento")
        c.execute("UPDATE orders SET repassado_em=datetime('now','localtime') WHERE id=?", (oid,))
    return {"ok": True}


@app.post("/api/admin/pedidos/{oid}/avancar-dias")
def admin_avancar(oid: int, u=Depends(_admin)):
    """Ferramenta do POC: antecipa 7 dias a data de pagamento para demonstrar a liberacao do saldo."""
    with conn() as c:
        c.execute("UPDATE orders SET pago_em=datetime(pago_em,'-7 days') WHERE id=? AND pago_em IS NOT NULL", (oid,))
    return {"ok": True}


@app.get("/api/admin/config")
def admin_config(u=Depends(_admin)):
    with conn() as c:
        return {k: setting(c, k) for k in ("taxa_plataforma", "markup_sugerido", "dias_liberacao", "pix_chave", "pix_razao", "cep_origem")}


class ConfigReq(BaseModel):
    taxa_plataforma: float = Field(ge=0, le=50)
    markup_sugerido: float = Field(ge=0, le=500)


@app.put("/api/admin/config")
def admin_salvar_config(b: ConfigReq, u=Depends(_admin)):
    with conn() as c:
        set_setting(c, "taxa_plataforma", b.taxa_plataforma)
        set_setting(c, "markup_sugerido", b.markup_sugerido)
    return {"ok": True}


class ModeloArte(BaseModel):
    nome: str = Field(min_length=2)
    tipo: str
    cor1: str
    cor2: str


@app.get("/api/admin/modelos-arte")
def admin_modelos(u=Depends(_admin)):
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM art_templates ORDER BY id DESC")]


@app.post("/api/admin/modelos-arte")
def admin_criar_modelo(b: ModeloArte, u=Depends(_admin)):
    if b.tipo not in ("listras", "bolinhas", "degrade"):
        raise HTTPException(400, "Tipo inválido")
    with conn() as c:
        c.execute("INSERT INTO art_templates (nome,tipo,cor1,cor2) VALUES (?,?,?,?)", (b.nome, b.tipo, b.cor1, b.cor2))
    return {"ok": True}


@app.delete("/api/admin/modelos-arte/{mid}")
def admin_remover_modelo(mid: int, u=Depends(_admin)):
    with conn() as c:
        c.execute("DELETE FROM art_templates WHERE id=?", (mid,))
    return {"ok": True}


@app.post("/api/admin/reset-demo")
def admin_reset(u=Depends(_admin)):
    seed(force=True)
    return {"ok": True}


# ================================================================= FRONTEND (build do React)

_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@app.get("/{caminho:path}", include_in_schema=False)
def spa(caminho: str):
    """Serve o build do React. Rotas do app (/painel, /s/x...) devolvem index.html."""
    if caminho.startswith("api/"):
        raise HTTPException(404)
    alvo = (_DIST / caminho).resolve()
    if caminho and alvo.is_file() and _DIST in alvo.parents:
        # arquivos com hash no nome podem ficar em cache para sempre
        return FileResponse(alvo, headers={"Cache-Control": "public, max-age=31536000, immutable"})
    if caminho.startswith("assets/"):
        # asset de um build antigo: 404 (nunca devolver index.html no lugar de um .js)
        raise HTTPException(404)
    idx = _DIST / "index.html"
    if idx.exists():
        # index.html nunca em cache, para sempre apontar para o build atual
        return FileResponse(idx, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return Response("Frontend ainda não foi gerado. Rode: cd frontend && npm run build", media_type="text/plain")
