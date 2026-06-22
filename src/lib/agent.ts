import { db } from './database';

/**
 * Agente de IA do WhatsApp via OpenRouter (API compatível com OpenAI).
 *
 * Configurar no .env.local:
 * OPENROUTER_API_KEY=sk-or-...   (chave da OpenRouter)
 * OPENROUTER_MODEL=openai/gpt-4o-mini   (opcional; modelo a usar)
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const modelName = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Ferramenta (function/tool no formato OpenAI) que a IA "chama" ao fechar o pedido.
const finishOrderTool = {
  type: 'function',
  function: {
    name: 'finish_order',
    description: "Chame esta função APENAS quando o cliente já informou todos os dados obrigatórios para fechar o pedido de açaí (nome, estilo, tamanho, bairro de entrega, rua/endereço).",
    parameters: {
      type: 'object',
      properties: {
        customer_name: {
          type: 'string',
          description: 'Nome do cliente',
        },
        delivery_address: {
          type: 'string',
          description: 'O endereço completo de entrega (rua, número, complemento). Não inclua o nome do bairro aqui.',
        },
        delivery_neighborhood_id: {
          type: 'string',
          description: 'O ID do bairro escolhido pelo cliente (baseado na lista fornecida).',
        },
        items: {
          type: 'array',
          description: 'Lista de itens (açaís) que o cliente pediu.',
          items: {
            type: 'object',
            properties: {
              style: {
                type: 'string',
                description: 'Estilo do açaí (grosso ou medio)',
                enum: ['grosso', 'medio'],
              },
              size: {
                type: 'number',
                description: 'Tamanho do açaí (1.0 para 1 Litro, 0.5 para 500ml)',
              },
              quantity: {
                type: 'integer',
                description: 'Quantidade deste exato item',
              },
            },
            required: ['style', 'size', 'quantity'],
          },
        },
      },
      required: ['customer_name', 'delivery_address', 'delivery_neighborhood_id', 'items'],
    },
  },
};

export const agentService = {

  async getSystemPrompt(): Promise<string> {
    const settings = await db.getSettings();
    const neighborhoods = await db.getNeighborhoodFees();

    let neighborhoodsText = `\nBAIRROS E TAXAS DE ENTREGA:\n`;
    if (neighborhoods.length === 0) {
      neighborhoodsText += `- Taxa única de entrega para toda a cidade: R$ ${settings.default_delivery_fee.toFixed(2)}\n`;
    } else {
      neighborhoodsText += `A taxa padrão é R$ ${settings.default_delivery_fee.toFixed(2)}, EXCETO para os bairros abaixo:\n`;
      neighborhoods.forEach(n => {
        neighborhoodsText += `- ID: ${n.id} | Bairro: ${n.name} | Taxa: R$ ${n.delivery_fee.toFixed(2)}\n`;
      });
    }

    return `Você é um assistente virtual amigável do "Açaí do Ronaldo". O seu objetivo é tirar pedidos de açaí natural batido na hora pelo WhatsApp.
Sempre seja educado, use emojis e fale de maneira calorosa.

SOBRE O NOSSO AÇAÍ:
- Trabalhamos exclusivamente com polpa pura de açaí batido (sem corantes, conservantes ou misturas gourmet).
- Temos dois estilos: "Grosso" e "Médio".
- Temos dois tamanhos: 1 Litro e 500ml.
- Preços: Açaí Grosso 1L (R$ 32,00), Grosso 500ml (R$ 18,00), Médio 1L (R$ 25,00), Médio 500ml (R$ 14,00).

${neighborhoodsText}

REGRAS DO ATENDIMENTO:
1. Saudação inicial: pergunte o nome do cliente.
2. Descubra o que ele quer pedir (estilo e tamanho).
3. Se ele não falar o bairro, pergunte qual é o bairro para informar a taxa de entrega.
4. Pergunte o endereço completo da rua e número.
5. Confirme o resumo do pedido com ele.
6. **MUITO IMPORTANTE:** Assim que você tiver TODAS as informações (nome, itens, bairro mapeado e endereço da rua), você NÃO deve apenas responder com texto. Você DEVE usar a ferramenta (function call) "finish_order" passando os dados estruturados.
7. Pagamento: Diga ao cliente que logo após confirmar o pedido, ele receberá um link da InfinitePay para pagamento rápido (PIX ou Cartão). Não tente gerar o link você mesmo, o sistema fará isso quando você invocar o "finish_order".

Mantenha as respostas curtas e diretas, afinal é WhatsApp.`;
  },

  /**
   * Processa uma mensagem do usuário mantendo o histórico.
   *
   * O histórico é recebido no formato { role: 'user' | 'model', parts: [{ text }] }
   * (mantido por compatibilidade com o webhook) e convertido para o formato
   * de mensagens da OpenAI/OpenRouter internamente.
   */
  async processMessage(userMessage: string, history: { role: string; parts: { text: string }[] }[] = []) {
    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY não configurada.');
      return {
        type: 'text',
        data: 'Ops, nosso sistema de IA está temporariamente indisponível. Tente novamente em instantes. 💜',
      };
    }

    try {
      const messages = [
        { role: 'system', content: await this.getSystemPrompt() },
        ...history.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts?.[0]?.text || '',
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          // Cabeçalhos opcionais recomendados pela OpenRouter
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Acai do Ronaldo',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          tools: [finishOrderTool],
          tool_choice: 'auto',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na OpenRouter:', response.status, errorText);
        return {
          type: 'text',
          data: 'Ops, nosso sistema de IA está passando por uma instabilidade rápida. Poderia repetir a última mensagem? 💜',
        };
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const call = toolCalls[0];
        if (call.function?.name === 'finish_order') {
          // Os argumentos vêm como string JSON no formato OpenAI.
          const args = typeof call.function.arguments === 'string'
            ? JSON.parse(call.function.arguments)
            : call.function.arguments;
          return { type: 'finish_order', data: args };
        }
      }

      return {
        type: 'text',
        data: choice?.message?.content || 'Desculpe, não entendi. Pode repetir? 💜',
      };

    } catch (err) {
      console.error('Erro no agente (OpenRouter):', err);
      return {
        type: 'text',
        data: 'Ops, nosso sistema de IA está passando por uma instabilidade rápida. Poderia repetir a última mensagem? 💜',
      };
    }
  }
};
