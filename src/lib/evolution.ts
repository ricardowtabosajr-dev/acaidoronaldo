/**
 * Serviço de Integração com a Evolution API (WhatsApp)
 * 
 * Necessário configurar no .env.local:
 * EVOLUTION_API_URL=http://localhost:8080 (ou URL da sua VPS/Vercel)
 * EVOLUTION_API_KEY=sua_chave_global_aqui
 * EVOLUTION_INSTANCE_NAME=nome_da_instancia_criada
 */

export const evolutionService = {
  getApiUrl() {
    // Tenta pegar a URL removendo a barra no final, se houver
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
   * Envia uma mensagem de texto simples via WhatsApp
   */
  async sendText(number: string, text: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Evolution API não configurada. Mensagem não enviada:', { number, text });
      return false;
    }

    try {
      // Formata número (A Evolution API aceita números sem o + e com o DDI, ex: 5581999999999)
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
          delay: 1200, // Dá um pequeno delay humano na digitação
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na Evolution API:', response.status, errorText);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erro ao conectar com Evolution API:', err);
      return false;
    }
  }
};
