import { NextRequest, NextResponse } from 'next/server';
import { evolutionService } from '@/lib/evolution';

/**
 * Endpoint de conexão do WhatsApp (uso do dono da loja).
 *
 * Acesse no navegador: GET /api/whatsapp/connect
 * Ele cria a instância na Evolution Go, configura o webhook apontando para
 * esta app e mostra o QR Code para escanear com o WhatsApp do Ronaldo.
 */
export async function GET(req: NextRequest) {
  if (!evolutionService.isConfigured()) {
    return htmlPage(
      'Evolution Go não configurada',
      `<p>Defina <code>EVOLUTION_API_URL</code> e <code>EVOLUTION_API_KEY</code> no <code>.env.local</code> (e reinicie o servidor) antes de conectar.</p>`
    );
  }

  // Usa NEXT_PUBLIC_SITE_URL se definido; senão, deriva da própria requisição.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  const { ok, webhookUrl, qr } = await evolutionService.connect(siteUrl);

  if (!qr) {
    return htmlPage(
      'Falha ao gerar o QR Code',
      `<p>Não foi possível obter o QR Code da Evolution Go. Verifique se o servidor está no ar e se a instância <code>${evolutionService.getInstanceName()}</code> está acessível.</p>
       <p>Webhook que tentamos configurar: <code>${webhookUrl}</code></p>`
    );
  }

  // qr.base64 normalmente já vem como data URL (data:image/png;base64,....)
  const imgSrc = qr.base64?.startsWith('data:')
    ? qr.base64
    : qr.base64
    ? `data:image/png;base64,${qr.base64}`
    : '';

  const body = `
    <p>Webhook configurado: <code>${webhookUrl}</code> ${ok ? '✅' : '⚠️'}</p>
    <p>Abra o WhatsApp do Ronaldo → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e escaneie:</p>
    ${imgSrc ? `<img src="${imgSrc}" alt="QR Code" style="width:280px;height:280px;border:1px solid #ddd;border-radius:8px" />` : ''}
    ${qr.code ? `<p style="color:#999;font-size:11px;word-break:break-all">Código: ${qr.code}</p>` : ''}
    <p style="color:#666">O QR Code expira em ~1 minuto. Recarregue esta página para gerar um novo.</p>
  `;

  return htmlPage('Conectar WhatsApp', body);
}

function htmlPage(title: string, body: string): NextResponse {
  const html = `<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} — Açaí do Ronaldo</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;text-align:center">
<h1 style="color:#6b21a8">${title}</h1>
${body}
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
