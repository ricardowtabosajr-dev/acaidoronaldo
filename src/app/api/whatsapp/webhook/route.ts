import { NextRequest, NextResponse } from 'next/server';
import { evolutionService } from '@/lib/evolution';
import { agentService } from '@/lib/agent';
import { db, OrderData, OrderItem } from '@/lib/database';
import { generatePaymentLink } from '@/lib/infinitepay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // A Evolution API manda eventos "messages.upsert" quando chega mensagem nova
    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ ok: true, reason: 'Ignorado (não é mensagem)' });
    }

    const messagePayload = body.data?.message;
    if (!messagePayload) {
      return NextResponse.json({ ok: true, reason: 'Sem payload de mensagem' });
    }

    // Apenas mensagens de texto simples ou extended text (ignoramos áudio por enquanto)
    const textMessage = messagePayload.message?.conversation || messagePayload.message?.extendedTextMessage?.text;
    const remoteJid = messagePayload.key?.remoteJid; // O número do WhatsApp (ex: 5581999999999@s.whatsapp.net)
    const fromMe = messagePayload.key?.fromMe; // Se fomos nós que mandamos, ignoramos

    if (fromMe || !textMessage || !remoteJid || remoteJid.includes('@g.us')) {
      // Ignorar grupos e mensagens próprias
      return NextResponse.json({ ok: true, reason: 'Ignorado (grupo, próprio ou não-texto)' });
    }

    const phoneNumber = remoteJid.split('@')[0];
    
    // Recuperar histórico do banco de dados (as últimas ~20 interações para contexto)
    let history = await db.getChatHistory(phoneNumber);
    
    // O Gemini espera o history no formato: { role: 'user' | 'model', parts: [{ text: '...' }] }
    
    // Processar a mensagem pelo agente (Gemini)
    const aiResult = await agentService.processMessage(textMessage, history);
    
    // Atualiza o histórico
    history.push({ role: 'user', parts: [{ text: textMessage }] });
    
    let responseText = "";

    if (aiResult.type === 'text') {
      responseText = aiResult.data;
      history.push({ role: 'model', parts: [{ text: responseText }] });
    } else if (aiResult.type === 'finish_order') {
      // O Gemini estruturou o pedido!
      const orderData = aiResult.data as any;
      
      // Criar o pedido no sistema
      // Primeiro calculamos o total e a taxa
      const settings = await db.getSettings();
      let deliveryFee = settings.default_delivery_fee;
      
      // Buscar taxa do bairro se existir
      if (orderData.delivery_neighborhood_id) {
        const neighborhoods = await db.getNeighborhoodFees();
        const found = neighborhoods.find(n => n.id === orderData.delivery_neighborhood_id);
        if (found) deliveryFee = found.delivery_fee;
      }
      
      // Calcular valor dos itens
      let itemsTotal = 0;
      const formattedItems: OrderItem[] = orderData.items.map((i: any) => {
        // Preço base
        let price = 0;
        if (i.style === 'Grosso' && i.size === 1.0) price = 28;
        if (i.style === 'Grosso' && i.size === 0.5) price = 15;
        if (i.style === 'Medio' && i.size === 1.0) price = 22;
        if (i.style === 'Medio' && i.size === 0.5) price = 12;
        
        itemsTotal += price * i.quantity;
        
        return {
          id: Math.random().toString(), // fake ID for item
          title: `Açaí ${i.style}`,
          size: i.size === 1.0 ? '1 Litro' : '500ml',
          price: price,
          quantity: i.quantity,
          image: '/acai.png'
        };
      });
      
      const newOrder: OrderData = {
        customer_name: orderData.customer_name,
        customer_phone: phoneNumber,
        customer_address: orderData.delivery_address,
        neighborhood_id: orderData.delivery_neighborhood_id,
        items: formattedItems,
        delivery_fee: deliveryFee,
        total_amount: itemsTotal + deliveryFee,
        payment_method: 'infinitepay',
        status: 'pending'
      };
      
      // Salvar pedido no DB
      const savedOrder = await db.addOrder(newOrder);
      
      // Gerar link de pagamento
      const paymentLink = await generatePaymentLink(newOrder.total_amount, savedOrder.id!);
      
      responseText = `✅ *Pedido Confirmado!* 🎉\n\n` +
                     `Olá ${orderData.customer_name}, seu pedido foi registrado no nosso sistema!\n` +
                     `Total a pagar (com entrega): *R$ ${(itemsTotal + deliveryFee).toFixed(2).replace('.', ',')}*\n\n` +
                     `Para começarmos a preparar seu açaí, faça o pagamento no link abaixo (Aceitamos PIX ou Cartão):\n` +
                     `👉 ${paymentLink}\n\n` +
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
