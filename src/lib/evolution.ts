/**
 * Serviço de Integração com a Evolution Go (WhatsApp)
 *
 * Repositório: https://github.com/EvolutionAPI/evolution-go
 *
 * IMPORTANTE: a Evolution Go tem uma API diferente da Evolution API clássica:
 * - A instância é identificada pelo header `apikey` (= token da instância),
 *   e NÃO por um path /{instanceName}.
 * - Envio de texto: POST /send/text  { number, text, delay }
 * - Criar instância: POST /instance/create  { name, token }
 * - Conectar/QR: POST /instance/connect  { webhookUrl, subscribe } + GET /instance/qr
 * - Status: GET /instance/status -> { Connected, LoggedIn, Name }
 *
 * Configurar no .env.local:
 * EVOLUTION_API_URL=http://localhost:8080 (ou URL da sua VPS)
 * EVOLUTION_API_KEY=token_da_instancia (use o mesmo valor no token ao criar a instância)
 * EVOLUTION_INSTANCE_NAME=acai-bot
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
   * Cria a instância na Evolution Go (idempotente: se já existir, apenas segue).
   * O `token` da instância é definido como a própria EVOLUTION_API_KEY, para que
   * a mesma chave sirva tanto para criar quanto para operar a instância.
   */
  async createInstance(instanceName?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Evolution Go não configurada.');
      return false;
    }

    const name = instanceName || this.getInstanceName();

    try {
      const response = await fetch(`${this.getApiUrl()}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': this.getApiKey() },
        body: JSON.stringify({ name, token: this.getApiKey() })
      });

      if (!response.ok) {
        // 4xx aqui normalmente significa "instância já existe" — não é fatal.
        const errorText = await response.text();
        console.warn('createInstance (provavelmente já existe):', response.status, errorText);
        return false;
      }

      console.log(`✅ Instância "${name}" criada na Evolution Go.`);
      return true;
    } catch (err) {
      console.error('Erro ao criar instância Evolution Go:', err);
      return false;
    }
  },

  /**
   * Envia uma mensagem de texto via WhatsApp.
   * Endpoint Evolution Go: POST /send/text  { number, text, delay }
   * A instância é identificada pelo header `apikey` (token da instância).
   */
  async sendText(number: string, text: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Evolution Go não configurada. Mensagem não enviada para', number);
      return false;
    }

    try {
      // Número com DDI, somente dígitos (ex: 5581999999999)
      const cleanNumber = number.replace(/\D/g, '');

      const response = await fetch(`${this.getApiUrl()}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': this.getApiKey() },
        body: JSON.stringify({ number: cleanNumber, text, delay: 1200 })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro ao enviar texto (Evolution Go):', response.status, errorText);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erro ao conectar com Evolution Go:', err);
      return false;
    }
  },

  /**
   * Status da conexão da instância.
   * GET /instance/status -> { Connected, LoggedIn, Name }
   * LoggedIn = true significa que o WhatsApp está pareado.
   */
  async getStatus(): Promise<{ Connected: boolean; LoggedIn: boolean; Name: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      const response = await fetch(`${this.getApiUrl()}/instance/status`, {
        headers: { 'apikey': this.getApiKey() }
      });
      if (!response.ok) return null;
      const json = await response.json();
      return json.data || null;
    } catch (err) {
      console.error('Erro ao obter status da Evolution Go:', err);
      return null;
    }
  },

  /**
   * Obtém o QR Code para parear o WhatsApp.
   * GET /instance/qr -> { data: { Qrcode (data URL), Code (string de pareamento) } }
   */
  async getQrCode(): Promise<{ base64?: string; code?: string } | null> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Evolution Go não configurada.');
      return null;
    }

    try {
      const response = await fetch(`${this.getApiUrl()}/instance/qr`, {
        headers: { 'apikey': this.getApiKey() }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro ao obter QR Code:', response.status, errorText);
        return null;
      }

      const json = await response.json();
      const data = json.data || {};
      return { base64: data.Qrcode, code: data.Code };
    } catch (err) {
      console.error('Erro ao obter QR Code:', err);
      return null;
    }
  },

  /**
   * Orquestra a conexão: cria a instância (se necessário), inicia a conexão
   * apontando o webhook para a app e retorna o QR Code para escanear.
   */
  async connect(siteUrl: string): Promise<{
    ok: boolean;
    webhookUrl: string;
    qr: { base64?: string; code?: string } | null;
  }> {
    const cleanSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const webhookUrl = `${cleanSiteUrl}/api/whatsapp/webhook`;

    // 1. Garante que a instância existe (idempotente).
    await this.createInstance();

    // 2. Inicia a conexão e registra o webhook + eventos de mensagem.
    let connectOk = false;
    try {
      const response = await fetch(`${this.getApiUrl()}/instance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': this.getApiKey() },
        body: JSON.stringify({ webhookUrl, subscribe: ['MESSAGE'], immediate: true })
      });
      connectOk = response.ok;
      if (!response.ok) {
        console.error('Erro no /instance/connect:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Erro ao conectar instância:', err);
    }

    // 3. Busca o QR Code para o pareamento.
    const qr = await this.getQrCode();

    return { ok: connectOk && Boolean(qr), webhookUrl, qr };
  }
};
