/**
 * Serviço de Integração com a Evolution Go (WhatsApp)
 * 
 * Baseado no repositório: https://github.com/evolution-foundation/evolution-go
 * 
 * Configurar no .env.local:
 * EVOLUTION_API_URL=http://localhost:8080 (ou URL da sua VPS)
 * EVOLUTION_API_KEY=sua_global_api_key (GLOBAL_API_KEY do .env da Evolution Go)
 * EVOLUTION_INSTANCE_NAME=nome_da_instancia_criada
 */

export const evolutionService = {
  getApiUrl() {
    const url = process.env.EVOLUTION_API_URL || '';
    return url.endsWith('/') ? url.slice(0, -1) : url;
  },

  getApiKey() {
    return process.env.EVOLUTION_API_KEY || '';
  },

  getInstanceName() {
    return process.env.EVOLUTION_INSTANCE_NAME || 'acai-bot';
  },

  isConfigured() {
    return Boolean(this.getApiUrl() && this.getApiKey());
  },

  /**
   * Cria uma instância na Evolution Go (caso ainda não exista).
   * Após criar, acesse GET /instance/connect/{instanceName} para obter o QR Code.
   */
  async createInstance(instanceName?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Evolution Go não configurada.');
      return false;
    }

    const name = instanceName || this.getInstanceName();

    try {
      const endpoint = `${this.getApiUrl()}/instance/create`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.getApiKey()
        },
        body: JSON.stringify({
          instanceName: name,
          qrcode: true,
          // Configurar webhook para receber mensagens
          webhook: {
            url: process.env.NEXT_PUBLIC_SITE_URL 
              ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/webhook`
              : '',
            events: ['MESSAGES_UPSERT'],
            byEvents: false,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro ao criar instância Evolution Go:', response.status, errorText);
        return false;
      }

      console.log(`✅ Instância "${name}" criada na Evolution Go.`);
      return true;
    } catch (err) {
      console.error('Erro ao conectar com Evolution Go:', err);
      return false;
    }
  },

  /**
   * Envia uma mensagem de texto simples via WhatsApp
   * 
   * Endpoint Evolution Go: POST /message/sendText/{instanceName}
   * Header de autenticação: apikey
   */
  async sendText(number: string, text: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Evolution Go não configurada. Mensagem não enviada:', { number, text });
      return false;
    }

    try {
      // Formata número (Evolution Go aceita números sem o + e com DDI, ex: 5581999999999)
      const cleanNumber = number.replace(/\D/g, '');

      const endpoint = `${this.getApiUrl()}/message/sendText/${this.getInstanceName()}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.getApiKey()
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: text,
          delay: 1200, // Delay humano na digitação
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na Evolution Go:', response.status, errorText);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erro ao conectar com Evolution Go:', err);
      return false;
    }
  },

  /**
   * Configura o webhook da instância para receber mensagens
   * 
   * Endpoint: POST /webhook/set/{instanceName}
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Evolution Go não configurada.');
      return false;
    }

    try {
      const endpoint = `${this.getApiUrl()}/webhook/set/${this.getInstanceName()}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.getApiKey()
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: ['MESSAGES_UPSERT'],
          enabled: true,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro ao configurar webhook:', response.status, errorText);
        return false;
      }

      console.log(`✅ Webhook configurado: ${webhookUrl}`);
      return true;
    } catch (err) {
      console.error('Erro ao configurar webhook:', err);
      return false;
    }
  }
};
