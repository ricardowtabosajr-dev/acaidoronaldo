import { NextRequest, NextResponse } from 'next/server';
import { evolutionService } from '@/lib/evolution';
import { agentService } from '@/lib/agent';
import { db } from '@/lib/database';
import { infinitePay } from '@/lib/infinitepay';

// Preços reais do cardápio (devem estar sincronizados com page.tsx e agent.ts)
const PRICES: Record<string, Record<number, number>> = {
  grosso: { 0.5: 18.00, 1.0: 32.00 },
  medio: { 0.5: 14.00, 1.0: 25.00 }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // A Evolution Go manda eventos "Message" quando chega mensagem nova
    if (body.event !== 'Message') {
      return NextResponse.json({ ok: true, reason: 'Ignorado (não é mensagem)' });
    }

    const info = body.data?.Info;
    const message = body.data?.Message;
    if (!info || !message) {
      return NextResponse.json({ ok: true, reason: 'Sem payload de mensagem' });
    }

    // Texto simples (conversation) ou texto estendido (extendedTextMessage)
    const textMessage = message.conversation || message.extendedTextMessage?.text;
    const senderJid = info.Sender as string | undefined; // ex: 559181095800@s.whatsapp.net
    const fromMe = info.IsFromMe; // mensagens enviadas por nós, ignoramos
    const isGroup = info.IsGroup;

    if (fromMe || isGroup || !textMessage || !senderJid) {
      // Ignorar grupos, mensagens próprias e não-texto
      return NextResponse.json({ ok: true, reason: 'Ignorado (grupo, próprio ou não-texto)' });
    }

    // Remove o domínio e um eventual sufixo de dispositivo (ex: "5591...:55@s.whatsapp.net")
    const phoneNumber = senderJid.split('@')[0].split(':')[0];
    
    // Recuperar histórico do banco de dados (as últimas ~20 interações para contexto)
    let history = await db.getChatHistory(phoneNumber);
    
    // O Gemini espera o history no formato: { role: 'user' | 'model', parts: [{ text: '...' }] }
    
    // Processar a mensagem pelo agente (Gemini)
    const aiResult = await agentService.processMessage(textMessage, history);
    
    // Atualiza o histórico
    history.push({ role: 'user', parts: [{ text: textMessage }] });
    
    let responseText = "";

    if (aiResult.type === 'text') {
      responseText = aiResult.data as string;
      history.push({ role: 'model', parts: [{ text: responseText }] });
    } else if (aiResult.type === 'finish_order') {
      // O Gemini estruturou o pedido!
      const orderData = aiResult.data as any;
      
      // Buscar configurações e taxa de entrega
      const settings = await db.getSettings();
      let deliveryFee = settings.default_delivery_fee;
      
      // Buscar taxa do bairro se existir
      let neighborhoodName = 'Não informado';
      if (orderData.delivery_neighborhood_id) {
        const neighborhoods = await db.getNeighborhoodFees();
        const found = neighborhoods.find(n => n.id === orderData.delivery_neighborhood_id);
        if (found) {
          deliveryFee = found.delivery_fee;
          neighborhoodName = found.name;
        }
      }
      
      // Calcular valor dos itens e formatar para o formato que db.createOrder espera
      let itemsTotal = 0;
      const formattedItems = orderData.items.map((i: any) => {
        // Normaliza o estilo para minúsculo (o Gemini pode mandar "Grosso" ou "Medio")
        const styleNormalized = i.style.toLowerCase() as 'grosso' | 'medio';
        const size = Number(i.size) as 0.5 | 1.0;
        const price = PRICES[styleNormalized]?.[size] || 0;
        
        itemsTotal += price * i.quantity;
        
        return {
          style: styleNormalized,
          size: size,
          quantity: i.quantity,
          price: price
        };
      });

      const totalPrice = itemsTotal + deliveryFee;
      
      // Salvar pedido no DB usando a API correta (db.createOrder)
      const savedOrder = await db.createOrder(
        {
          customer_name: orderData.customer_name,
          customer_phone: phoneNumber,
          delivery_address: `${orderData.delivery_address} - Bairro: ${neighborhoodName}`,
          delivery_neighborhood_id: orderData.delivery_neighborhood_id || null,
          delivery_fee: deliveryFee,
          payment_method: 'infinitepay',
          total_price: totalPrice
        },
        formattedItems
      );
      
      // Gerar link de pagamento simulado
      const paymentResponse = await infinitePay.generatePaymentLink(
        savedOrder.id,
        totalPrice,
        orderData.customer_name
      );
      
      responseText = `✅ *Pedido Confirmado!* 🎉\n\n` +
                     `Olá ${orderData.customer_name}, seu pedido foi registrado no nosso sistema!\n` +
                     `Total a pagar (com entrega): *R$ ${totalPrice.toFixed(2).replace('.', ',')}*\n\n` +
                     `Para começarmos a preparar seu açaí, faça o pagamento no link abaixo (Aceitamos PIX ou Cartão):\n` +
                     `👉 ${paymentResponse.link_url}\n\n` +
                     `Muito obrigado pela preferência! 💜`;
                     
      history.push({ role: 'model', parts: [{ text: "O pedido foi finalizado. Eu enviei o link de pagamento." }] });
    }

    // Salva o histórico atualizado de volta no banco (limitado a 40 interações para não estourar payload)
    if (history.length > 40) history = history.slice(-40);
    await db.saveChatHistory(phoneNumber, history);

    // Enviar a resposta via Evolution API
    await evolutionService.sendText(phoneNumber, responseText);

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("Webhook WhatsApp Error:", err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
