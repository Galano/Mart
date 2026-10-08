"""Autenticacao simples por token (POC). Na versao final: Supabase Auth."""
import hashlib
import hmac
import secrets

from fastapi import Header, HTTPException

from db import conn


def hash_senha(senha: str) -> str:
    salt = secrets.token_hex(8)
    h = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${h}"


def verificar_senha(senha: str, armazenado: str) -> bool:
    salt, h = armazenado.split("$", 1)
    calc = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt.encode(), 120_000).hex()
    return hmac.compare_digest(calc, h)


def criar_sessao(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with conn() as c:
        c.execute("INSERT INTO sessions (token,user_id) VALUES (?,?)", (token, user_id))
    return token


def has_role(c, user_id: int, role: str) -> bool:
    """Equivalente da funcao has_role (security definer) do Supabase."""
    return c.execute("SELECT 1 FROM user_roles WHERE user_id=? AND role=?", (user_id, role)).fetchone() is not None


def usuario_atual(authorization: str = Header(default="")) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Faça login para continuar")
    with conn() as c:
        u = c.execute("""SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?""",
                      (token,)).fetchone()
        if not u:
            raise HTTPException(401, "Sessão expirada. Entre novamente.")
        roles = [r["role"] for r in c.execute("SELECT role FROM user_roles WHERE user_id=?", (u["id"],))]
        shop = c.execute("SELECT id FROM shops WHERE user_id=?", (u["id"],)).fetchone()
    return {"id": u["id"], "email": u["email"], "nome": u["nome"], "status": u["status"],
            "roles": roles, "shop_id": shop["id"] if shop else None, "token": token}


def exigir_admin(u: dict):
    if "admin" not in u["roles"]:
        raise HTTPException(403, "Acesso restrito ao administrador")


def exigir_lojista(u: dict) -> str:
    if "lojista" not in u["roles"] or not u["shop_id"]:
        raise HTTPException(403, "Acesso restrito a lojistas")
    if u["status"] == "bloqueado":
        raise HTTPException(403, "Sua conta está bloqueada. Fale com a Mart Digital.")
    return u["shop_id"]
