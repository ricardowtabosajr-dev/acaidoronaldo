/**
 * Gerador de UUID seguro com fallback para contextos HTTP não-seguros.
 * 
 * crypto.randomUUID() só funciona em contextos "secure" (HTTPS ou localhost).
 * Quando acessamos via IP de rede local (ex: 192.168.x.x) em HTTP,
 * o navegador bloqueia essa API. Este fallback garante que funcione em qualquer ambiente.
 */
export function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Fallback se crypto.randomUUID lançar erro
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
