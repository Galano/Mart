"""Banco SQLite do POC. Na versao final: Supabase/Postgres com RLS."""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / "mart.db"
UPLOADS = BASE / "uploads"


def carregar_env():
    """Leitor minimo de backend/.env (CHAVE=valor). Variaveis ja definidas no sistema tem prioridade."""
    import os
    f = BASE / ".env"
    if not f.exists():
        return
    for linha in f.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


carregar_env()
UPLOADS.mkdir(exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  email_confirmado INTEGER NOT NULL DEFAULT 0,
  token_confirmacao TEXT,
  token_reset TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',        -- pendente | aprovado | bloqueado
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- papeis em tabela separada (nunca em campo editavel pelo usuario)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,                              -- admin | lojista
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,                             -- slug usado em /s/<id>
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  nome TEXT NOT NULL,
  logo TEXT, banner TEXT,
  cor_primaria TEXT NOT NULL DEFAULT '#2563eb',
  cor_destaque TEXT NOT NULL DEFAULT '#f59e0b',
  template TEXT NOT NULL DEFAULT 'essencial',      -- essencial | vitrine | editorial | vibrante
  online INTEGER NOT NULL DEFAULT 1,
  descricao TEXT NOT NULL DEFAULT '',
  email_contato TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  whatsapp_fixo INTEGER NOT NULL DEFAULT 0,
  frase TEXT NOT NULL DEFAULT '',
  redes TEXT NOT NULL DEFAULT '{}',                -- {"instagram": "...", ...}
  instagram_fixo INTEGER NOT NULL DEFAULT 0,
  escassez TEXT NOT NULL DEFAULT '{}',             -- {"ativo":bool,"mensagem":..,"desconto":10,"ate":"2026-10-31T23:59"}
  mostrar_vendidos INTEGER NOT NULL DEFAULT 0,
  chave_pix TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  mockup TEXT NOT NULL,                            -- camiseta | moletom | oversized | caneca | copo | almofada
  metodo TEXT NOT NULL,                            -- DTF | Sublimacao | Laser/UV
  custo REAL,                                      -- custo Mart Digital (NULL = sem preco oficial)
  preco_sugerido REAL,
  ativo INTEGER NOT NULL DEFAULT 1,
  descricao TEXT NOT NULL DEFAULT '',
  aviso TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL                             -- JSON: modelos, cores, areas, opcoes
);

CREATE TABLE IF NOT EXISTS shop_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  preco_venda REAL NOT NULL,
  personalizavel INTEGER NOT NULL DEFAULT 1,
  arte_fixa TEXT,                                  -- JSON do estudio quando produto tem arte pronta
  preview TEXT,                                    -- PNG da arte fixa (uploads/)
  ativo INTEGER NOT NULL DEFAULT 1,
  vendidos INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  shop_product_id INTEGER REFERENCES shop_products(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  demo INTEGER NOT NULL DEFAULT 0,
  cliente TEXT NOT NULL,                           -- JSON nome, email, telefone, cpf, endereco
  item TEXT NOT NULL,                              -- JSON cor, modelo, tamanho, areas, opcoes, camadas, qtd
  subtotal REAL NOT NULL,
  desconto REAL NOT NULL DEFAULT 0,
  frete TEXT NOT NULL,                             -- JSON servico, valor, prazo
  total REAL NOT NULL,
  custo_total REAL NOT NULL,
  taxa_plataforma REAL NOT NULL,
  ganho_lojista REAL NOT NULL,
  metodo_pagamento TEXT NOT NULL,                  -- pix | cartao
  status_pagamento TEXT NOT NULL DEFAULT 'aguardando', -- aguardando | confirmado | recusado
  status TEXT NOT NULL DEFAULT 'novo',             -- novo | em_producao | enviado | entregue | cancelado
  comprovante TEXT,
  etiqueta TEXT,
  rastreio TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  pago_em TEXT,
  repassado_em TEXT
);

CREATE TABLE IF NOT EXISTS order_artworks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  area TEXT NOT NULL,
  arquivo TEXT NOT NULL,
  largura_px INTEGER, altura_px INTEGER
);

CREATE TABLE IF NOT EXISTS art_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,                              -- listras | bolinhas | degrade
  cor1 TEXT NOT NULL, cor2 TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS platform_settings (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
"""


def init_db():
    with conn() as c:
        c.executescript(SCHEMA)


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH, isolation_level=None, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    try:
        yield c
    finally:
        c.close()


def row(r, *json_cols):
    """sqlite Row -> dict, decodificando colunas JSON."""
    if r is None:
        return None
    d = dict(r)
    for k in json_cols:
        if d.get(k):
            d[k] = json.loads(d[k])
    return d


def setting(c, chave, padrao=None):
    r = c.execute("SELECT valor FROM platform_settings WHERE chave=?", (chave,)).fetchone()
    return r["valor"] if r else padrao


def set_setting(c, chave, valor):
    c.execute("INSERT OR REPLACE INTO platform_settings VALUES (?,?)", (chave, str(valor)))
