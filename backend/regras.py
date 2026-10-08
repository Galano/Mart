"""
Regras de negocio calculadas SEMPRE no servidor.
O navegador manda apenas escolhas (modelo, tamanho, cor, areas, opcoes, CEP);
precos, frete, desconto e ganho do lojista sao recalculados aqui.
"""
import json
import re
from datetime import datetime

from fastapi import HTTPException


def _r(v):
    return round(float(v) + 1e-9, 2)


# ---------------------------------------------------------------- preco do item

def calcular_item(produto: dict, item: dict, preco_venda: float, arte_fixa: dict | None) -> dict:
    """
    produto: linha de products com config decodificada
    item: {modelo, tamanho, cor, areas:[ids], opcoes:{id: valor}, qtd}
    preco_venda: preco do lojista (ou sugerido na loja demonstracao)
    Retorna precos unitarios de venda e custo, e o detalhamento.
    """
    cfg = produto["config"]
    if produto["custo"] is None or not produto["ativo"]:
        raise HTTPException(400, "Produto indisponível no momento")

    modelo = next((m for m in cfg["modelos"] if m["id"] == item.get("modelo")), None)
    if not modelo:
        raise HTTPException(400, "Escolha um modelo válido")
    if item.get("tamanho") not in modelo["tamanhos"]:
        raise HTTPException(400, f"Tamanho {item.get('tamanho')} não existe no modelo {modelo['nome']}")

    cores = {c["id"] for c in cfg["cores"]}
    cor = modelo.get("cor_fixa") or item.get("cor")
    if cor not in cores:
        raise HTTPException(400, "Escolha uma cor válida")

    # areas: arte fixa define as areas; senao vem do cliente
    areas_ids = list((arte_fixa or {}).get("areas", {}).keys()) if arte_fixa else list(item.get("areas") or [])
    areas_cfg = {a["id"]: a for a in cfg["areas"]}
    for a in cfg["areas"]:
        if a.get("obrigatoria") and a["id"] not in areas_ids:
            areas_ids.append(a["id"])
    invalidas = [a for a in areas_ids if a not in areas_cfg]
    if invalidas:
        raise HTTPException(400, f"Área inválida: {', '.join(invalidas)}")
    grupos = {}
    for a in areas_ids:
        g = areas_cfg[a].get("grupo")
        if g:
            if g in grupos:
                raise HTTPException(400, f"Escolha apenas uma opção de {g}")
            grupos[g] = a
    if not areas_ids:
        raise HTTPException(400, "Selecione pelo menos uma área de estampa")

    adicionais = []
    for a in areas_ids:
        adicionais.append({"nome": areas_cfg[a]["nome"], "valor": areas_cfg[a]["adicional"]})

    opcoes_in = item.get("opcoes") or {}
    for o in cfg.get("opcoes", []):
        v = opcoes_in.get(o["id"])
        if o["tipo"] == "escolha":
            val = next((x for x in o["valores"] if x["id"] == v), None)
            if not val:
                raise HTTPException(400, f"Escolha {o['nome'].lower()}")
            if val["adicional"]:
                adicionais.append({"nome": val["nome"], "valor": val["adicional"]})
        elif o["tipo"] == "bool" and v:
            adicionais.append({"nome": o["nome"], "valor": o["adicional"]})

    custo_base = produto["custo"]
    dif_modelo = _r((modelo.get("custo") or custo_base) - custo_base)   # caneca preta/magica +10
    soma_adic = _r(sum(a["valor"] for a in adicionais))
    custo_unit = _r(custo_base + dif_modelo + soma_adic)

    if arte_fixa:
        # arte fixa: preco do lojista ja inclui as estampas
        venda_unit = _r(preco_venda + dif_modelo)
    else:
        # personalizavel: adicionais repassados ao cliente pelo valor de custo
        venda_unit = _r(preco_venda + dif_modelo + soma_adic)

    qtd = int(item.get("qtd") or 1)
    if qtd < 1 or qtd > 50:
        raise HTTPException(400, "Quantidade entre 1 e 50")

    return {
        "modelo": modelo["nome"], "tamanho": item["tamanho"], "cor": cor, "areas": areas_ids,
        "adicionais": adicionais, "dif_modelo": dif_modelo, "qtd": qtd,
        "venda_unit": venda_unit, "custo_unit": custo_unit,
        "subtotal": _r(venda_unit * qtd), "custo_total": _r(custo_unit * qtd),
    }


def lucro_previsto(produto: dict, preco_venda: float, areas_fixas: list[str] | None, taxa_pct: float) -> dict:
    """Usado no painel do lojista ao criar produto."""
    cfg = produto["config"]
    custo = produto["custo"] or 0
    if areas_fixas:
        areas = {a["id"]: a for a in cfg["areas"]}
        custo += sum(areas[a]["adicional"] for a in areas_fixas if a in areas)
    taxa = _r(preco_venda * taxa_pct / 100)
    return {"custo": _r(custo), "taxa": taxa, "lucro": _r(preco_venda - custo - taxa)}


# ---------------------------------------------------------------- escassez

def desconto_ativo(shop: dict) -> dict | None:
    e = shop.get("escassez") or {}
    if not e.get("ativo") or not e.get("ate"):
        return None
    try:
        ate = datetime.fromisoformat(e["ate"])
    except ValueError:
        return None
    if datetime.now() > ate:
        return None
    pct = max(0.0, min(float(e.get("desconto") or 0), 50.0))  # trava em 50%
    return {"pct": pct, "mensagem": e.get("mensagem") or "Oferta por tempo limitado", "ate": e["ate"]}


# ---------------------------------------------------------------- frete (SIMULADO)

def _cep(c: str) -> int:
    d = re.sub(r"\D", "", c or "")
    if len(d) != 8:
        raise HTTPException(400, "CEP inválido")
    return int(d)


def cotar_frete(cep_destino: str, qtd_itens: int) -> list[dict]:
    """
    SIMULADO. Na versao final: SuperFrete (PAC/SEDEX) e Lalamove, chamados so no servidor
    com credenciais privadas. Origem da producao: CEP 03025-030.
    """
    cep = _cep(cep_destino)
    regiao = cep // 10_000_000           # primeiro digito do CEP
    peso_extra = max(0, qtd_itens - 1)
    tabela = {0: (18.9, 3), 1: (21.9, 4), 2: (27.9, 6), 3: (29.9, 6), 4: (34.9, 8),
              5: (36.9, 9), 6: (42.9, 10), 7: (38.9, 8), 8: (31.9, 6), 9: (33.9, 7)}
    base, prazo = tabela[regiao]
    opcoes = [
        {"id": "pac", "servico": "Correios PAC", "valor": _r(base + 3.5 * peso_extra), "prazo": f"{prazo} a {prazo + 3} dias úteis"},
        {"id": "sedex", "servico": "Correios SEDEX", "valor": _r(base * 1.7 + 5 * peso_extra), "prazo": f"{max(1, prazo // 2)} a {max(2, prazo // 2 + 1)} dias úteis"},
    ]
    capital_sp = 1_000_000 <= cep <= 5_999_999 or 8_000_000 <= cep <= 8_499_999
    if capital_sp:
        dist = abs(cep - 3_025_030) / 1_000_000   # aproximacao pela distancia numerica do CEP
        opcoes.append({"id": "lalamove", "servico": "Lalamove (motoboy)", "valor": _r(16.9 + 4.5 * dist),
                       "prazo": "Hoje, após a produção"})
    return opcoes


def escolher_frete(cep: str, qtd: int, servico: str) -> dict:
    op = next((o for o in cotar_frete(cep, qtd) if o["id"] == servico), None)
    if not op:
        raise HTTPException(400, "Opção de frete indisponível para este CEP")
    return op


# ---------------------------------------------------------------- pedido completo

def fechar_pedido(item_calc: dict, shop: dict, frete: dict, taxa_pct: float) -> dict:
    d = desconto_ativo(shop)
    desconto = _r(item_calc["subtotal"] * d["pct"] / 100) if d else 0.0
    base_venda = _r(item_calc["subtotal"] - desconto)
    taxa = _r(base_venda * taxa_pct / 100)
    ganho = _r(base_venda - item_calc["custo_total"] - taxa)
    return {
        "subtotal": item_calc["subtotal"], "desconto": desconto, "frete": frete,
        "total": _r(base_venda + frete["valor"]), "custo_total": item_calc["custo_total"],
        "taxa_plataforma": taxa, "ganho_lojista": max(ganho, 0.0),
        "desconto_info": d,
    }


def carregar_produto(r) -> dict:
    d = dict(r)
    d["config"] = json.loads(d["config"])
    return d
