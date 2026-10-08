"""
Catalogo e dados de demonstracao.

Precos de CUSTO vem do briefing. O preco SUGERIDO nao foi informado: ele e calculado
pela configuracao 'markup_sugerido' (padrao 80%) e o admin pode editar produto a produto.
Produtos sem preco oficial (moletons, oversized, almofada) entram INATIVOS e sem preco.
"""
import json
import os
from datetime import datetime, timedelta

from db import conn, init_db, set_setting, setting
from auth import hash_senha

CORES_TEXTIL = [
    ("branca", "Branca", "#f8f8f6"), ("preta", "Preta", "#1d1d1f"),
    ("azul_marinho", "Azul marinho", "#1f2a44"), ("azul_royal", "Azul royal", "#2449a8"),
    ("roxo", "Roxo", "#5b2a86"), ("verde_bandeira", "Verde bandeira", "#0f7a3a"),
    ("verde_musgo", "Verde musgo", "#4b5320"), ("cinza_chumbo", "Cinza chumbo", "#3f4447"),
    ("cinza_mescla", "Cinza mescla", "#a7a9ac"), ("rosa_claro", "Rosa claro", "#f4c2cf"),
    ("rosa_pink", "Rosa pink", "#e0287d"), ("vermelho", "Vermelho", "#c8102e"),
]
CORES = [{"id": i, "nome": n, "hex": h} for i, n, h in CORES_TEXTIL]

MODELOS_TEXTIL = [
    {"id": "tradicional", "nome": "Tradicional", "tamanhos": ["P", "M", "G", "GG", "XG", "G1", "G2", "G3"]},
    {"id": "infantil", "nome": "Infantil", "tamanhos": ["2", "4", "6", "8", "10", "12", "14"]},
    {"id": "babylook", "nome": "Baby look", "tamanhos": ["P", "M", "G", "GG"]},
]

AREAS_TEXTIL = [
    {"id": "frente", "nome": "Frente / peito", "adicional": 5.0, "cm": [21, 29.7]},
    {"id": "costas_a4", "nome": "Costas A4", "adicional": 10.0, "cm": [21, 29.7], "grupo": "costas"},
    {"id": "costas_a3", "nome": "Costas A3", "adicional": 20.0, "cm": [29.7, 42], "grupo": "costas"},
    {"id": "manga_esq", "nome": "Manga esquerda", "adicional": 5.0, "cm": [10, 10]},
    {"id": "manga_dir", "nome": "Manga direita", "adicional": 5.0, "cm": [10, 10]},
    {"id": "etiqueta", "nome": "Etiqueta interna (gola)", "adicional": 2.5, "cm": [7, 5]},
]

CONFIG_TEXTIL = {"modelos": MODELOS_TEXTIL, "cores": CORES, "areas": AREAS_TEXTIL, "opcoes": []}

PRODUTOS = [
    {
        "id": "camiseta", "nome": "Camiseta branca lisa", "categoria": "Camisetas", "mockup": "camiseta",
        "metodo": "DTF", "custo": 30.0, "ativo": 1,
        "descricao": "Camiseta 100% algodão. Estampas cobradas por área.",
        "config": CONFIG_TEXTIL,
    },
    {
        "id": "caneca", "nome": "Caneca de porcelana", "categoria": "Canecas", "mockup": "caneca",
        "metodo": "Sublimação", "custo": 25.0, "ativo": 1,
        "descricao": "Caneca de porcelana 325 ml com estampa ao redor.",
        "aviso": "A caneca mágica é preta e revela a estampa quando recebe líquido quente.",
        "config": {
            "modelos": [
                {"id": "branca", "nome": "Branca", "tamanhos": ["325 ml"], "custo": 25.0, "cor_fixa": "branca"},
                {"id": "preta", "nome": "Preta", "tamanhos": ["325 ml"], "custo": 35.0, "cor_fixa": "preta"},
                {"id": "magica", "nome": "Mágica", "tamanhos": ["325 ml"], "custo": 35.0, "cor_fixa": "preta",
                 "aviso": "Caneca mágica: preta por fora, a estampa aparece com líquido quente."},
            ],
            "cores": [{"id": "branca", "nome": "Branca", "hex": "#f8f8f6"}, {"id": "preta", "nome": "Preta", "hex": "#1d1d1f"}],
            "areas": [{"id": "estampa", "nome": "Estampa ao redor", "adicional": 0.0, "cm": [20, 9], "obrigatoria": True}],
            "opcoes": [],
        },
    },
    {
        "id": "copo", "nome": "Copo térmico 473 ml", "categoria": "Copos", "mockup": "copo",
        "metodo": "Laser / UV", "custo": 25.0, "ativo": 1,
        "descricao": "Copo térmico inox 473 ml. Área de estampagem 10 × 5 cm.",
        "config": {
            "modelos": [{"id": "padrao", "nome": "473 ml", "tamanhos": ["473 ml"]}],
            "cores": [{"id": "inox", "nome": "Inox", "hex": "#c9ccd1"}, {"id": "preto", "nome": "Preto", "hex": "#26272b"},
                      {"id": "branco", "nome": "Branco", "hex": "#f3f3f1"}],
            # frente +10, atras +5, frente e tras +15: a soma ja reproduz a tabela
            "areas": [{"id": "frente", "nome": "Frente", "adicional": 10.0, "cm": [10, 5]},
                      {"id": "atras", "nome": "Atrás", "adicional": 5.0, "cm": [10, 5]}],
            "opcoes": [
                {"id": "tecnica", "nome": "Técnica", "tipo": "escolha", "valores": [
                    {"id": "laser", "nome": "Gravação laser (prateado)", "adicional": 0.0},
                    {"id": "uv", "nome": "UV colorido", "adicional": 0.0}]},
                {"id": "abridor", "nome": "Abridor", "tipo": "bool", "adicional": 2.5},
            ],
        },
    },
    {"id": "moletom_canguru", "nome": "Moletom canguru", "categoria": "Moletons", "mockup": "moletom",
     "metodo": "DTF", "custo": None, "ativo": 0, "descricao": "Sem preço oficial. Defina no painel para ativar.",
     "config": CONFIG_TEXTIL},
    {"id": "moletom_careca", "nome": "Moletom gola careca", "categoria": "Moletons", "mockup": "moletom",
     "metodo": "DTF", "custo": None, "ativo": 0, "descricao": "Sem preço oficial. Defina no painel para ativar.",
     "config": CONFIG_TEXTIL},
    {"id": "oversized", "nome": "Camiseta oversized streetwear", "categoria": "Camisetas", "mockup": "camiseta",
     "metodo": "DTF", "custo": None, "ativo": 0, "descricao": "Sem preço oficial. Defina no painel para ativar.",
     "config": CONFIG_TEXTIL},
    {"id": "almofada", "nome": "Almofada 40 × 40", "categoria": "Decoração", "mockup": "almofada",
     "metodo": "Sublimação", "custo": None, "ativo": 0, "descricao": "Sem preço oficial. Defina no painel para ativar.",
     "config": {"modelos": [{"id": "padrao", "nome": "40 × 40 cm", "tamanhos": ["40 × 40"]}],
                "cores": [{"id": "branca", "nome": "Branca", "hex": "#f8f8f6"}],
                "areas": [{"id": "frente", "nome": "Frente", "adicional": 0.0, "cm": [38, 38], "obrigatoria": True}],
                "opcoes": []}},
]


def seed(force=False):
    init_db()
    with conn() as c:
        if c.execute("SELECT COUNT(*) n FROM products").fetchone()["n"] and not force:
            return False
        for t in ("order_artworks", "orders", "shop_products", "shops", "sessions", "user_roles", "users",
                  "products", "art_templates", "platform_settings"):
            c.execute(f"DELETE FROM {t}")

        set_setting(c, "taxa_plataforma", "0")       # % sobre a venda, padrao 0
        set_setting(c, "markup_sugerido", "80")      # % para preco sugerido quando nao informado
        set_setting(c, "dias_liberacao", "7")
        set_setting(c, "cep_origem", os.getenv("CEP_ORIGEM", "03025-030"))
        # dados reais do recebedor ficam no backend/.env (fora do git)
        set_setting(c, "pix_chave", os.getenv("PIX_CHAVE", "00.000.000/0000-00"))
        set_setting(c, "pix_razao", os.getenv("PIX_RAZAO", "RAZAO SOCIAL DE EXEMPLO"))
        markup = float(setting(c, "markup_sugerido")) / 100

        for p in PRODUTOS:
            sug = round(p["custo"] * (1 + markup), 2) if p["custo"] else None
            c.execute("""INSERT INTO products (id,nome,categoria,mockup,metodo,custo,preco_sugerido,ativo,descricao,aviso,config)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                      (p["id"], p["nome"], p["categoria"], p["mockup"], p["metodo"], p["custo"], sug, p["ativo"],
                       p.get("descricao", ""), p.get("aviso", ""), json.dumps(p["config"], ensure_ascii=False)))

        for nome, tipo, c1, c2 in [("Listras clássicas", "listras", "#1f2a44", "#f8f8f6"),
                                   ("Bolinhas retrô", "bolinhas", "#e0287d", "#fff4f8"),
                                   ("Degradê pôr do sol", "degrade", "#f59e0b", "#c8102e")]:
            c.execute("INSERT INTO art_templates (nome,tipo,cor1,cor2) VALUES (?,?,?,?)", (nome, tipo, c1, c2))

        def novo_user(email, senha, nome, role, status="aprovado"):
            cur = c.execute("INSERT INTO users (email,senha_hash,nome,email_confirmado,status) VALUES (?,?,?,1,?)",
                            (email, hash_senha(senha), nome, status))
            c.execute("INSERT INTO user_roles VALUES (?,?)", (cur.lastrowid, role))
            return cur.lastrowid

        novo_user("admin@martdigital.com.br", "admin123", "Admin Mart Digital", "admin")
        u1 = novo_user("lojista@demo.com", "demo123", "Carla Souza", "lojista")
        u2 = novo_user("nova@demo.com", "demo123", "Rafael Lima", "lojista")
        novo_user("pendente@demo.com", "demo123", "Lojista Pendente", "lojista", status="pendente")

        ate = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%dT23:59")
        c.execute("""INSERT INTO shops (id,user_id,nome,cor_primaria,cor_destaque,template,descricao,email_contato,
                     whatsapp,whatsapp_fixo,frase,redes,instagram_fixo,escassez,mostrar_vendidos)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  ("estampa-viva", u1, "Estampa Viva", "#0f766e", "#f59e0b", "vitrine",
                   "Camisetas e canecas com arte autoral, feitas sob encomenda em São Paulo.",
                   "contato@estampaviva.com.br", "11999990000", 1, "Arte que veste você.",
                   json.dumps({"instagram": "https://instagram.com/estampaviva", "tiktok": "https://tiktok.com/@estampaviva"}),
                   1, json.dumps({"ativo": True, "mensagem": "Semana do cliente", "desconto": 10, "ate": ate}), 1))
        c.execute("""INSERT INTO shops (id,user_id,nome,cor_primaria,cor_destaque,template,descricao)
                     VALUES (?,?,?,?,?,?,?)""",
                  ("rafa-store", u2, "Rafa Store", "#7c3aed", "#ec4899", "vibrante", ""))

        sps = [
            ("camiseta", "Camiseta Personalizada", "Monte a sua com foto, frase ou logo.", "Camisetas", 59.90, 1),
            ("caneca", "Caneca do Seu Jeito", "Caneca com a sua arte, perfeita para presente.", "Canecas", 49.90, 1),
            ("copo", "Copo Térmico Gravado", "Gravação a laser com nome ou logo.", "Copos", 69.90, 1),
        ]
        for pid, nome, desc, cat, preco, pers in sps:
            c.execute("""INSERT INTO shop_products (shop_id,product_id,nome,descricao,categoria,preco_venda,personalizavel,vendidos)
                         VALUES (?,?,?,?,?,?,?,?)""", ("estampa-viva", pid, nome, desc, cat, preco, pers, 3))
    return True


if __name__ == "__main__":
    seed(force=True)
    print("seed ok")
