'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, User, CreditCard, ShoppingBag, Send, AlertTriangle, Loader, CheckCircle } from 'lucide-react';
import { db, NeighborhoodFee, StoreSettings } from '@/lib/database';
import { infinitePay } from '@/lib/infinitepay';
import styles from './page.module.css';

interface CartItem {
  id: string;
  style: 'grosso' | 'medio';
  size: 0.5 | 1.0;
  quantity: number;
  price: number;
}

export default function Checkout() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodFee[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    default_delivery_fee: 6.0,
    whatsapp_number: '5581999999999',
    is_open: true
  });

  // Estado do Formulário
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'infinitepay' | 'pix_delivery' | 'cash'>('infinitepay');

  // Estado do Fluxo de Pagamento InfinitePay
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [payLink, setPayLink] = useState('');
  const [qrCodeText, setQrCodeText] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'paid' | 'failed'>('pending');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    const savedCart = sessionStorage.getItem('acai_cart');
    if (!savedCart || JSON.parse(savedCart).length === 0) {
      router.push('/');
      return;
    }
    setCart(JSON.parse(savedCart));

    async function loadData() {
      try {
        const [fees, storeSettings] = await Promise.all([
          db.getNeighborhoodFees(),
          db.getSettings()
        ]);
        setNeighborhoods(fees);
        setSettings(storeSettings);
      } catch (err) {
        console.error("Erro ao carregar dados do checkout:", err);
      }
    }
    loadData();
  }, [router]);

  // Taxa de entrega calculada
  const getDeliveryFee = (): number => {
    if (!selectedNeighborhoodId) return 0;
    const neighborhood = neighborhoods.find(n => n.id === selectedNeighborhoodId);
    return neighborhood ? neighborhood.delivery_fee : settings.default_delivery_fee;
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getGrandTotal = () => {
    return getCartTotal() + getDeliveryFee();
  };

  const getSelectedNeighborhoodName = () => {
    const neighborhood = neighborhoods.find(n => n.id === selectedNeighborhoodId);
    return neighborhood ? neighborhood.name : 'Não selecionado';
  };

  // Simular geração do Link/QR Code InfinitePay
  const triggerInfinitePay = async () => {
    if (!name || !phone || !address || !selectedNeighborhoodId) {
      alert('Por favor, preencha todas as informações de entrega antes de simular o pagamento.');
      return;
    }
    
    setIsGeneratingLink(true);
    setPaymentStatus('processing');
    try {
      const amount = getGrandTotal();
      const response = await infinitePay.generatePaymentLink(
        `temp_${Date.now()}`,
        amount,
        name
      );
      setPayLink(response.link_url);
      setQrCodeText(response.qr_code);

      // Inicia simulador de pagamento (webhook)
      infinitePay.simulateWebhookTrigger(response.transaction_id, (status) => {
        if (status === 'paid') {
          setPaymentStatus('paid');
        } else {
          setPaymentStatus('failed');
        }
      });
    } catch (e) {
      console.error(e);
      setPaymentStatus('failed');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Finalizar pedido e ir para WhatsApp
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !phone || !address || !selectedNeighborhoodId) {
      alert('Por favor, preencha todos os campos obrigatórios!');
      return;
    }

    if (paymentMethod === 'infinitepay' && paymentStatus !== 'paid') {
      alert('Por favor, efetue e confirme o pagamento da InfinitePay para prosseguir!');
      return;
    }

    setIsPlacingOrder(true);

    try {
      const deliveryFee = getDeliveryFee();
      const total = getGrandTotal();

      // Salva no Banco de Dados (Supabase ou LocalStorage)
      const order = await db.createOrder(
        {
          customer_name: name,
          customer_phone: phone,
          delivery_address: `${address} - Bairro: ${getSelectedNeighborhoodName()}`,
          delivery_neighborhood_id: selectedNeighborhoodId || null,
          delivery_fee: deliveryFee,
          payment_method: paymentMethod,
          total_price: total
        },
        cart.map(item => ({
          style: item.style,
          size: item.size,
          quantity: item.quantity,
          price: item.price
        }))
      );

      // Atualiza o status de pagamento real no banco
      if (paymentMethod === 'infinitepay' && paymentStatus === 'paid') {
        await db.updateOrderPaymentStatus(order.id, 'paid');
      }

      // Formatar Mensagem do WhatsApp
      const paymentLabel = 
        paymentMethod === 'infinitepay' ? 'InfinitePay (PIX/Cartão) - PAGO ✓' :
        paymentMethod === 'pix_delivery' ? 'PIX na Entrega' : 'Dinheiro na Entrega';

      const itemsText = cart.map(item => 
        `- ${item.quantity}x Açaí ${item.style === 'grosso' ? 'Grosso' : 'Médio'} ${item.size === 1.0 ? '1L' : '500ml'} (R$ ${(item.price * item.quantity).toFixed(2)})`
      ).join('\n');

      const message = `*NOVO PEDIDO - AÇAÍ DO RONALDO*
---------------------------------------
*Cliente:* ${name}
*Telefone:* ${phone}
*Endereço:* ${address}
*Bairro:* ${getSelectedNeighborhoodName()}
*Taxa de Entrega:* R$ ${deliveryFee.toFixed(2)}

*ITENS DO PEDIDO:*
${itemsText}

*Total a Pagar:* R$ ${total.toFixed(2)}
*Forma de Pagamento:* ${paymentLabel}
---------------------------------------
_Pedido gerado via sistema. Aguardando entrega!_`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}?text=${encodedMessage}`;

      // Limpa carrinho e envia
      sessionStorage.removeItem('acai_cart');
      
      // Redireciona
      window.location.href = whatsappUrl;

    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao salvar o pedido. Tente novamente.');
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={18} />
          Voltar ao Cardápio
        </Link>
      </header>

      {/* Main Form */}
      <main className={styles.main}>
        <div className={styles.checkoutFormSection}>
          
          {/* Alerta de Modo de Simulação Offline se não houver Supabase */}
          {db.isOffline() && (
            <div className={styles.offlineAlert}>
              <AlertTriangle size={20} style={{ flexShrink: 0, color: 'var(--gold-primary)' }} />
              <div>
                <strong>Modo Simulação Ativo:</strong> As chaves do Supabase não estão configuradas no arquivo `.env`. Os dados dos pedidos e configurações estão sendo mantidos temporariamente na memória do navegador (LocalStorage).
              </div>
            </div>
          )}

          <form onSubmit={handlePlaceOrder} className={styles.checkoutForm}>
            
            {/* Bloco 1: Informações do Cliente */}
            <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
              <h2>
                <User size={20} />
                Seus Dados
              </h2>
              <div className={styles.formGroup}>
                <label htmlFor="name">Seu Nome Completo *</label>
                <input 
                  type="text" 
                  id="name" 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className={styles.input} 
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="phone">Seu WhatsApp *</label>
                <input 
                  type="tel" 
                  id="phone" 
                  required 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  className={styles.input} 
                  placeholder="Ex: (81) 98888-8888"
                />
              </div>
            </div>

            {/* Bloco 2: Entrega */}
            <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
              <h2>
                <MapPin size={20} />
                Endereço de Entrega
              </h2>
              
              <div className={styles.formGroup}>
                <label htmlFor="neighborhood">Bairro / Região *</label>
                <select 
                  id="neighborhood" 
                  required 
                  value={selectedNeighborhoodId} 
                  onChange={(e) => setSelectedNeighborhoodId(e.target.value)} 
                  className={styles.select}
                >
                  <option value="">Selecione seu bairro...</option>
                  {neighborhoods.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.name} (Taxa: R$ {n.delivery_fee.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address">Endereço Completo *</label>
                <input 
                  type="text" 
                  id="address" 
                  required 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  className={styles.input} 
                  placeholder="Rua, número, complemento e ponto de referência"
                />
              </div>
            </div>

            {/* Bloco 3: Pagamento */}
            <div className={styles.card}>
              <h2>
                <CreditCard size={20} />
                Forma de Pagamento
              </h2>
              
              <div className={styles.paymentGrid}>
                <div 
                  className={`${styles.paymentOption} ${paymentMethod === 'infinitepay' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setPaymentMethod('infinitepay')}
                >
                  <CreditCard className={styles.paymentOptionIcon} size={24} />
                  <span>InfinitePay (PIX/Cartão)</span>
                </div>
                <div 
                  className={`${styles.paymentOption} ${paymentMethod === 'pix_delivery' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setPaymentMethod('pix_delivery')}
                >
                  <Send className={styles.paymentOptionIcon} size={24} />
                  <span>PIX na Entrega</span>
                </div>
                <div 
                  className={`${styles.paymentOption} ${paymentMethod === 'cash' ? styles.paymentOptionActive : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <ShoppingBag className={styles.paymentOptionIcon} size={24} />
                  <span>Dinheiro</span>
                </div>
              </div>

              {/* Simulador InfinitePay */}
              {paymentMethod === 'infinitepay' && (
                <div className={styles.simulator}>
                  <strong style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <CreditCard size={18} />
                    InfinitePay Checkout Integrado
                  </strong>
                  
                  {paymentStatus === 'pending' && (
                    <>
                      <p className={styles.simText}>Preencha os dados de entrega acima e clique no botão abaixo para simular o pagamento por PIX/Cartão.</p>
                      <button 
                        type="button" 
                        onClick={triggerInfinitePay}
                        style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', backgroundColor: 'var(--acai-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Gerar Pagamento (R$ {getGrandTotal().toFixed(2)})
                      </button>
                    </>
                  )}

                  {paymentStatus === 'processing' && (
                    <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader className="animate-spin" size={24} style={{ color: 'var(--acai-primary)' }} />
                      <span>Gerando QR Code Pix da InfinitePay...</span>
                    </div>
                  )}

                  {(paymentStatus === 'processing' || payLink) && paymentStatus !== 'paid' && paymentStatus !== 'failed' && (
                    <div style={{ width: '100%' }}>
                      <div className={styles.qrCodeContainer}>
                        {/* Mock de QR Code Pix usando SVG */}
                        <svg width="140" height="140" viewBox="0 0 100 100" style={{ display: 'block', margin: '0 auto' }}>
                          <rect width="100" height="100" fill="white"/>
                          <rect x="10" y="10" width="20" height="20" fill="black"/>
                          <rect x="15" y="15" width="10" height="10" fill="white"/>
                          <rect x="70" y="10" width="20" height="20" fill="black"/>
                          <rect x="75" y="15" width="10" height="10" fill="white"/>
                          <rect x="10" y="70" width="20" height="20" fill="black"/>
                          <rect x="15" y="75" width="10" height="10" fill="white"/>
                          {/* Random dot clusters */}
                          <rect x="35" y="10" width="5" height="15" fill="black"/>
                          <rect x="45" y="20" width="10" height="5" fill="black"/>
                          <rect x="60" y="30" width="5" height="10" fill="black"/>
                          <rect x="30" y="40" width="15" height="15" fill="black"/>
                          <rect x="50" y="50" width="20" height="20" fill="black"/>
                          <rect x="80" y="45" width="10" height="10" fill="black"/>
                          <rect x="35" y="80" width="15" height="5" fill="black"/>
                          <rect x="75" y="75" width="15" height="15" fill="black"/>
                        </svg>
                      </div>
                      <div className={styles.pixCopyPaste} title={qrCodeText}>
                        {qrCodeText || 'Gerando código Copia e Cola...'}
                      </div>
                      <a href={payLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--acai-primary)', textDecoration: 'underline', fontWeight: 600, display: 'block', marginBottom: '0.75rem' }}>
                        Ir para tela de Checkout InfinitePay
                      </a>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <Loader className="animate-spin" size={14} />
                        Simulando confirmação de pagamento... (Aguarde 6s)
                      </div>
                    </div>
                  )}

                  {paymentStatus === 'paid' && (
                    <div style={{ padding: '0.5rem 0', color: 'var(--green-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={32} />
                      <strong style={{ fontSize: '1.1rem' }}>Pagamento Confirmado!</strong>
                      <span style={{ fontSize: '0.85rem' }}>A InfinitePay aprovou a transação. O pedido pode ser enviado.</span>
                    </div>
                  )}

                  {paymentStatus === 'failed' && (
                    <div style={{ padding: '0.5rem 0', color: '#c62828' }}>
                      <strong>Falha na Transação.</strong>
                      <button 
                        type="button" 
                        onClick={triggerInfinitePay}
                        style={{ marginLeft: '1rem', padding: '0.3rem 0.8rem', backgroundColor: '#c62828', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </form>
        </div>

        {/* Resumo Lateral */}
        <div className={styles.summaryAside}>
          <div className={styles.summaryCard}>
            <h3>Resumo do Pedido</h3>
            
            <div className={styles.orderItems}>
              {cart.map(item => (
                <div key={item.id} className={styles.orderItem}>
                  <div>
                    <span className={styles.orderItemName}>
                      Açaí {item.style} ({item.size === 1.0 ? '1L' : '500ml'})
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Qtd: {item.quantity} x R$ {item.price.toFixed(2)}
                    </div>
                  </div>
                  <span className={styles.orderItemPrice}>
                    R$ {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.totalSummary}>
              <div className={styles.summaryLine}>
                <span>Itens:</span>
                <span>R$ {getCartTotal().toFixed(2)}</span>
              </div>
              <div className={styles.summaryLine}>
                <span>Entrega:</span>
                <span>
                  {selectedNeighborhoodId ? `R$ ${getDeliveryFee().toFixed(2)}` : 'Selecione o Bairro'}
                </span>
              </div>
              <div className={styles.summaryLine}>
                <span>Total:</span>
                <span>R$ {getGrandTotal().toFixed(2)}</span>
              </div>
            </div>

            <button 
              type="button" 
              onClick={handlePlaceOrder}
              disabled={
                isPlacingOrder || 
                !name || 
                !phone || 
                !address || 
                !selectedNeighborhoodId ||
                (paymentMethod === 'infinitepay' && paymentStatus !== 'paid')
              }
              className={styles.submitBtn}
            >
              {isPlacingOrder ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Processando...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Enviar Pedido no WhatsApp
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
