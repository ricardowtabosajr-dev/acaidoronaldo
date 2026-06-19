# Conectar o WhatsApp via Evolution Go

A Evolution Go é um servidor **separado** que conversa com o WhatsApp. Esta app
(Açaí do Ronaldo) fala com ela por HTTP para **enviar** mensagens, e recebe as
mensagens de volta pelo **webhook** `/api/whatsapp/webhook`.

Para funcionar nos dois sentidos, os dois lados precisam se enxergar na rede:

| Cenário | Evolution Go | App Next.js | Quando usar |
|---|---|---|---|
| **A) Tudo local** | Docker em `localhost:8080` | `localhost:3000` | Testar agora no seu PC |
| **B) Tudo público** | VPS com URL pública | Vercel | Produção 24/7 |

> ⚠️ **Não misture** Evolution local com app na Vercel: a Vercel não alcança o
> `localhost` do seu PC, então o envio de mensagens falharia.

---

## Variáveis de ambiente (ambos os cenários)

No `.env.local` (local) ou nas Environment Variables da Vercel (produção):

```env
EVOLUTION_API_URL=http://localhost:8080        # ou https://evo.seudominio.com
EVOLUTION_API_KEY=sua-global-api-key-da-evolution
EVOLUTION_INSTANCE_NAME=acai-bot
NEXT_PUBLIC_SITE_URL=http://localhost:3000     # ou https://acai-do-ronaldo.vercel.app
```

- `EVOLUTION_API_KEY` é a **GLOBAL_API_KEY** definida no `.env` da própria Evolution Go.
- `NEXT_PUBLIC_SITE_URL` é a URL pela qual a Evolution Go vai chamar o webhook desta app.

Reinicie o servidor (`npm run dev`) depois de editar o `.env.local`.

---

## Cenário A — Rodar a Evolution Go local com Docker

1. **Instale o Docker Desktop** (Windows): https://www.docker.com/products/docker-desktop/
   (requer WSL2; pode pedir reboot).

2. **Suba a Evolution Go.** Exemplo com Docker (ajuste a imagem conforme o repositório
   oficial `evolution-foundation/evolution-go`):

   ```bash
   docker run -d --name evolution-go -p 8080:8080 \
     -e GLOBAL_API_KEY=minha-chave-secreta \
     <imagem-da-evolution-go>
   ```

   > A imagem/compose exata sai do README do repositório da Evolution Go. O que
   > importa: expor a porta `8080` e definir a `GLOBAL_API_KEY`.

3. No `.env.local`, descomente e preencha:
   ```env
   EVOLUTION_API_URL=http://localhost:8080
   EVOLUTION_API_KEY=minha-chave-secreta
   EVOLUTION_INSTANCE_NAME=acai-bot
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. Reinicie a app e siga **"Conectar e parear"** abaixo.

---

## Cenário B — Evolution Go numa VPS (produção)

1. Numa VPS (Ubuntu, etc.), suba a Evolution Go com Docker e exponha por HTTPS
   (atrás de um Nginx/Caddy com domínio, ex.: `https://evo.seudominio.com`).
2. Na **Vercel**, em Project → Settings → Environment Variables, defina as 4
   variáveis acima usando a URL pública da VPS e `NEXT_PUBLIC_SITE_URL` da Vercel.
3. Faça redeploy e siga **"Conectar e parear"** abaixo.

---

## Conectar e parear (ambos os cenários)

1. Acesse no navegador:
   ```
   {SUA_URL}/api/whatsapp/connect
   ```
   (ex.: `http://localhost:3000/api/whatsapp/connect`)

   Esse endpoint, numa só chamada:
   - cria a instância (`EVOLUTION_INSTANCE_NAME`) se ainda não existir;
   - configura o webhook para `{NEXT_PUBLIC_SITE_URL}/api/whatsapp/webhook`;
   - exibe o **QR Code**.

2. No celular do Ronaldo: WhatsApp → **Aparelhos conectados** →
   **Conectar um aparelho** → escaneie o QR (ou use o código de pareamento).
   O QR expira em ~1 min; recarregue a página para gerar outro.

3. Pronto. Mande uma mensagem para o número conectado e o agente responde.

---

## Verificação rápida

- **Status do endpoint:** se aparecer "Evolution Go não configurada", as variáveis
  não foram lidas (esqueceu de descomentar ou reiniciar o servidor).
- **Recebimento:** os logs do servidor mostram o processamento ao chegar mensagem.
- **Envio:** se o `sendText` falhar, confira no log o status HTTP retornado pela
  Evolution Go (geralmente URL/instância/apikey errada, ou app não alcança a Evolution).
