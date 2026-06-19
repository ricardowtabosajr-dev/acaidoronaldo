import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { db, NeighborhoodFee } from './database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const modelName = 'gemini-1.5-flash';

// Esta é a função que o Gemini vai "chamar" quando o cliente terminar o pedido.
const finishOrderDeclaration: FunctionDeclaration = {
  name: "finish_order",
  description: "Chame esta função APENAS quando o cliente já informou todos os dados obrigatórios para fechar o pedido de açaí (nome, estilo, tamanho, bairro de entrega, rua/endereço).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: {
        type: SchemaType.STRING,
        description: "Nome do cliente",
      },
      delivery_address: {
        type: SchemaType.STRING,
        description: "O endereço completo de entrega (rua, número, complemento). Não inclua o nome do bairro aqui.",
      },
      delivery_neighborhood_id: {
        type: SchemaType.STRING,
        description: "O ID numérico do bairro escolhido pelo cliente (baseado na lista fornecida).",
      },
      items: {
        type: SchemaType.ARRAY,
        description: "Lista de itens (açaís) que o cliente pediu.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            style: {
              type: SchemaType.STRING,
              format: "enum",
              description: "Estilo do açaí (grosso ou medio)",
              enum: ["grosso", "medio"]
            },
            size: {
              type: SchemaType.NUMBER,
              description: "Tamanho do açaí (1.0 para 1 Litro, 0.5 para 500ml)"
            },
            quantity: {
              type: SchemaType.INTEGER,
              description: "Quantidade deste exato item"
            }
          },
          required: ["style", "size", "quantity"]
        }
      }
    },
    required: ["customer_name", "delivery_address", "delivery_neighborhood_id", "items"]
  }
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
   * Processa uma mensagem do usuário mantendo o histórico
   */
  async processMessage(userMessage: string, history: {role: string, parts: {text: string}[]}[] = []) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ functionDeclarations: [finishOrderDeclaration] }],
        systemInstruction: await this.getSystemPrompt(),
      });

      const chat = model.startChat({
        history: history,
      });

      const result = await chat.sendMessage(userMessage);
      const response = result.response;
      
      const functionCalls = response.functionCalls();
      
      if (functionCalls && functionCalls.length > 0) {
        // A IA decidiu fechar o pedido!
        const call = functionCalls[0];
        if (call.name === 'finish_order') {
          return {
            type: 'finish_order',
            data: call.args
          };
        }
      }

      // Se não fechou pedido, apenas retorna o texto da resposta
      return {
        type: 'text',
        data: response.text()
      };

    } catch (err) {
      console.error("Erro no Gemini API:", err);
      return {
        type: 'text',
        data: "Ops, nosso sistema de IA está passando por uma instabilidade rápida. Poderia repetir a última mensagem? 💜"
      };
    }
  }
};
