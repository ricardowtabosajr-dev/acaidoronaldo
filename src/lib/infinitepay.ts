/**
 * Utilitário de Integração com InfinitePay
 * 
 * Esse arquivo centraliza as chamadas de API ou geração de links de pagamento da InfinitePay.
 * A InfinitePay permite criar links de pagamento rápidos e integrados com PIX e Cartão.
 */

import { generateUUID } from './utils';

export interface InfinitePayPaymentLinkResponse {
  link_url: string;
  qr_code: string;
  transaction_id: string;
}

export const infinitePay = {
  /**
   * Gera um link de pagamento simulado da InfinitePay
   * Na API real da InfinitePay, você faria um POST para: https://api.infinitepay.io/v1/payment_links
   * Passando a API Key do lojista no Authorization header.
   */
  async generatePaymentLink(
    orderId: string, 
    amount: number, 
    customerName: string
  ): Promise<InfinitePayPaymentLinkResponse> {
    // Simula tempo de resposta de rede
    await new Promise((resolve) => setTimeout(resolve, 800));

    // ID de transação fictício (usa generateUUID seguro)
    const transactionId = `inf_${generateUUID().split('-')[0]}`;
    
    // Link simulado (ou link direto do perfil se for estático)
    const formattedAmount = amount.toFixed(2);
    const linkUrl = `https://pay.infinitepay.io/acai-do-ronaldo/${formattedAmount}?metadata=${orderId}`;

    // Simulando um QR Code de teste (Pix copia e cola)
    const qrCode = `00020101021226850014br.gov.bcb.pix2563pay.infinitepay.io/acai-do-ronaldo/${orderId}5204000053039865405${formattedAmount}5802BR5915Acai do Ronaldo6009Recife62070503***6304`;

    return {
      link_url: linkUrl,
      qr_code: qrCode,
      transaction_id: transactionId,
    };
  },

  /**
   * Simula a webhook de confirmação de pagamento da InfinitePay.
   * Em produção, a InfinitePay faz um POST para o webhook cadastrado na Vercel,
   * que atualiza a ordem correspondente no Supabase.
   */
  simulateWebhookTrigger(orderId: string, callback: (status: 'paid' | 'failed') => void) {
    // Dispara a confirmação após 5 segundos simulando que o cliente pagou na tela
    const timer = setTimeout(() => {
      // 95% de chance de sucesso no pagamento simulado
      const success = Math.random() < 0.95;
      callback(success ? 'paid' : 'failed');
    }, 6000);

    return () => clearTimeout(timer);
  }
};
