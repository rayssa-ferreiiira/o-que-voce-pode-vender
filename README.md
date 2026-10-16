# O que você pode vender?

App da Trama (Rayssa Ferreira): conversa investigativa com a Ray (Claude) que termina no Mapa de Possibilidades.

## Variáveis na Vercel
- `ANTHROPIC_API_KEY`: chave do console.anthropic.com
- `DATABASE_URL`: preenchida ao ligar o Postgres (Neon) no projeto
- `ADMIN_SENHA`: senha do /admin

## Rotas
- `/c/CODIGO`: link de acesso enviado na compra
- `/`: conversa
- `/mapa/:id`: Mapa (o link funciona como chave)
- `/meus-mapas`: busca por email
- `/admin`: configuração, custos e conversas
