# POC – Mart Digital

Plataforma de print-on-demand / dropshipping: lojistas criam lojas, clientes personalizam e compram, a Mart Digital produz e envia.

Backend FastAPI + SQLite · Frontend React 19 + Vite + Tailwind v4 · Um único servidor na porta 8100 serve site e API.

## Rodar

Depois de clonar o repositório, crie a configuração local a partir do exemplo e preencha os dados do recebedor do Pix:

```
copy backend\.env.example backend\.env
```

O `.env`, o banco `mart.db`, os uploads e o build do frontend não vão para o git. O banco é criado sozinho com os dados de demonstração na primeira execução.

```
cd frontend
npm install
npm run build
cd ..\backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8100
```

O frontend já está compilado em `frontend/dist`. Se alterar o frontend:

```
cd frontend
npm install
npm run build
```

Abra http://localhost:8100. Para desenvolver com recarga: `npm run dev` (porta 5174, proxy para 8100).

Link público temporário (Cloudflare, sem conta):

```
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8100
```

## Acessos de demonstração

| Papel | E-mail | Senha |
|---|---|---|
| Admin | admin@martdigital.com.br | admin123 |
| Lojista com produtos | lojista@demo.com | demo123 |
| Lojista sem produtos (loja demonstração) | nova@demo.com | demo123 |
| Lojista pendente de aprovação | pendente@demo.com | demo123 |

Lojas: `/s/estampa-viva` (template Vitrine, escassez ativa) e `/s/rafa-store` (Vibrante, modo demonstração).

## O que está implementado

- **Rotas:** `/`, `/painel`, `/admin`, `/s/<id>`, `/loja/<id>/<produto>`, `/reset-password`.
- **Contas:** cadastro com confirmação de e-mail, login, recuperação de senha, papéis em tabela separada, aprovação e bloqueio de lojistas.
- **Catálogo com os preços do briefing:** camiseta, adicionais por área, canecas branca, preta e mágica, e copo térmico com posições, técnica e abridor. Tamanhos são restritos por modelo.
- **Estúdio:** mockups em camadas que mudam de cor. Camadas de imagem e texto com arrastar, redimensionar, girar 90° e excluir. Medidas reais, corte, margem vermelha, DPI estimado e arte de gola. Remoção de fundo no servidor, análise de impressão, modelos de arte do admin e exportação em até 2400 px.
- **Lojista:** configuração completa da loja com logo, banner, cores, 4 templates, online/offline, rodapé, redes, escassez, vendidos e chave Pix. Criação de produto com custo, sugerido e lucro previsto, personalizável ou com arte fixa. Pedidos e ganhos com liberação em 7 dias.
- **Loja pública:** Início, Produtos, Sobre (só com descrição) e Contato, com busca. Loja demonstração quando não há produtos. Custos nunca aparecem.
- **Checkout:** frete cotado no servidor, Pix com comprovante obrigatório de até 8 MB, e cartão com webhook de assinatura validada.
- **Admin:** relatório, pedidos com filtros, aceitar ou recusar Pix, status de produção, etiqueta, repasse, download de artes e comprovantes. Também lojistas, produtos, modelos de arte, taxa da plataforma e restauração da demonstração.
- **Regras no servidor:** preço, adicionais, áreas exclusivas, desconto de escassez (máximo 50%), frete, taxa e ganho do lojista. Loja aprovada e online, produto ativo e publicado.

## Simulado no POC

| Item | No POC | Na versão final |
|---|---|---|
| Banco e autenticação | SQLite + sessão própria | Supabase com RLS e GRANTs |
| E-mail de confirmação e senha | link exibido na tela | envio real |
| Login Google | botão informativo | OAuth Google |
| Cartão | checkout simulado + webhook assinado | Stripe Checkout incorporado |
| Frete | tabela por região do CEP | SuperFrete/Correios e Lalamove |
| Etiqueta | código de rastreio fictício | etiqueta real |
| Remoção de fundo | preenchimento por cor das bordas | modelo de segmentação |
| Análise de impressão | regras de DPI e margem | IA via AI Gateway |
| Mockups | SVG vetorial | fotos reais em camadas |
| Ferramenta "+7 dias" no admin | antecipa a liberação do saldo | não existe |

## Premissas

- Os valores do briefing foram tratados como **custo Mart Digital**.
- O **preço sugerido** não foi informado. Ele usa um markup configurável no admin, com padrão de 80%, e pode ser editado produto a produto.
- Em produto **personalizável**, os adicionais de estampa são repassados ao cliente pelo valor de custo, e o lucro do lojista é preço de venda menos custo base.
- Em produto com **arte fixa**, o preço do lojista já inclui as estampas.
- Moletons, oversized e almofada entram **inativos e sem preço** até o admin definir os valores.
- O desconto de escassez sai da margem do lojista.
