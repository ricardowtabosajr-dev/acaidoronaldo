'use client';

import { useState, useEffect } from 'react';
import { db, Order } from '@/lib/database';
import { 
  MapPin, 
  Phone, 
  Clock, 
  Check, 
  X, 
  Truck, 
  MessageSquare, 
  DollarSign, 
  AlertCircle,
  ThumbsUp
} from 'lucide-react';
import styles from './page.module.css';

type FilterType = 'all' | 'active' | 'pending' | 'delivered';

export default function AdminPedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterType>('active');
  const [isLoading, setIsLoading] = useState(true);

  // Carregar pedidos
  const loadOrders = async () => {
    try {
      const fetched = await db.getOrders();
      setOrders(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    
    // Polling opcional para simular tempo real (a cada 15 segundos)
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: Order['status']) => {
    const success = await db.updateOrderStatus(id, newStatus);
    if (success) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    }
  };

  const handleConfirmPayment = async (id: string) => {
    const success = await db.updateOrderPaymentStatus(id, 'paid');
    if (success) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_status: 'paid' } : o));
    }
  };

  // Envia mensagem direta para o WhatsApp do cliente informando o status
  const sendWhatsappNotification = (order: Order, type: 'preparing' | 'delivering' | 'delivered') => {
    let message = '';
    
    switch (type) {
      case 'preparing':
        message = `Olá, ${order.customer_name}! Ronaldo do Açaí aqui. 💜\n\nSeu pedido já foi recebido e a sua polpa de açaí já está sendo batida na hora! Em instantes sairá para entrega.`;
        break;
      case 'delivering':
        message = `Seu açaí saiu para entrega! 🛵\n\nO entregador já está a caminho do endereço:\n*${order.delivery_address}*.\n\n*Total a pagar:* R$ ${Number(order.total_price).toFixed(2)} (${order.payment_method === 'infinitepay' ? 'Pago via InfinitePay' : 'Pagamento na entrega'}).\n\n👇 *Quando receber seu açaí, clique no link abaixo para confirmar a entrega:*\n${window.location.origin}/confirmar-entrega/${order.id}`;
        break;
      case 'delivered':
        message = `Seu açaí foi entregue! 🎉\n\nEsperamos que goste do nosso açaí natural batido. Se puder, mande um feedback pra gente. Muito obrigado pela preferência e bom apetite! 💜`;
        break;
    }

    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    // Garante código de país
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // Filtrar lista de pedidos
  const getFilteredOrders = () => {
    switch (filter) {
      case 'active':
        return orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
      case 'pending':
        return orders.filter(o => o.status === 'pending');
      case 'delivered':
        return orders.filter(o => o.status === 'delivered');
      default:
        return orders;
    }
  };

  const filteredOrders = getFilteredOrders();

  const getPaymentMethodLabel = (method: Order['payment_method']) => {
    switch (method) {
      case 'infinitepay': return 'InfinitePay (PIX/Cartão)';
      case 'pix_delivery': return 'PIX na Entrega';
      case 'cash': return 'Dinheiro';
      default: return method;
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Gestão de Entregas & Logística</h1>
          <p>Gerencie o fluxo de preparação, despacho e envio de mensagens para o cliente.</p>
        </div>

        {/* Abas de Filtros */}
        <div className={styles.filterTabs}>
          <button 
            onClick={() => setFilter('active')} 
            className={`${styles.filterTab} ${filter === 'active' ? styles.filterTabActive : ''}`}
          >
            Ativos ({orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length})
          </button>
          <button 
            onClick={() => setFilter('pending')} 
            className={`${styles.filterTab} ${filter === 'pending' ? styles.filterTabActive : ''}`}
          >
            Pendentes ({orders.filter(o => o.status === 'pending').length})
          </button>
          <button 
            onClick={() => setFilter('delivered')} 
            className={`${styles.filterTab} ${filter === 'delivered' ? styles.filterTabActive : ''}`}
          >
            Entregues ({orders.filter(o => o.status === 'delivered').length})
          </button>
          <button 
            onClick={() => setFilter('all')} 
            className={`${styles.filterTab} ${filter === 'all' ? styles.filterTabActive : ''}`}
          >
            Todos ({orders.length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Carregando fila de entregas...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.emptyState}>
          Nenhum pedido encontrado nessa lista.
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredOrders.map(order => (
            <div key={order.id} className={styles.orderCard}>
              
              {/* Coluna 1: Metadados */}
              <div className={styles.orderMeta}>
                <h3>{order.customer_name}</h3>
                <div className={styles.orderDate}>
                  Realizado em: {new Date(order.created_at).toLocaleDateString('pt-BR')} às {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span className={`${styles.badge} ${styles['status_' + order.status]}`}>
                    {order.status === 'pending' && <Clock size={12} />}
                    {order.status === 'preparing' && <ThumbsUp size={12} />}
                    {order.status === 'delivering' && <Truck size={12} />}
                    {order.status === 'delivered' && <Check size={12} />}
                    {order.status === 'cancelled' && <X size={12} />}
                    {order.status === 'pending' ? 'Pendente' : 
                     order.status === 'preparing' ? 'Batendo/Preparando' : 
                     order.status === 'delivering' ? 'Em Rota de Entrega' : 
                     order.status === 'delivered' ? 'Entregue' : 'Cancelado'}
                  </span>

                  <span className={`${styles.badge} ${order.payment_status === 'paid' ? styles.status_delivered : styles.status_pending}`}>
                    <DollarSign size={12} />
                    {order.payment_status === 'paid' ? 'Pago' : 'Aguardando Pagamento'}
                  </span>
                </div>
              </div>

              {/* Coluna 2: Detalhes dos Itens e Endereço */}
              <div className={styles.orderDetails}>
                <div className={styles.addressBox}>
                  <MapPin size={16} />
                  <span>
                    <strong>Endereço:</strong> {order.delivery_address}
                  </span>
                </div>
                <div className={styles.addressBox}>
                  <Phone size={16} />
                  <span>
                    <strong>WhatsApp:</strong> {order.customer_phone}
                  </span>
                </div>
                
                <div className={styles.itemsList}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ITENS DO PEDIDO:
                  </strong>
                  {order.items?.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className={styles.itemName}>
                        Açaí {item.style} - {item.size === 1.0 ? '1 Litro' : '500 ml'}
                      </span>
                      <span>{item.quantity} un x R$ {Number(item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna 3: Preço e Ações */}
              <div className={styles.orderActions}>
                <div className={styles.priceBlock}>
                  <div className={styles.totalPrice}>R$ {Number(order.total_price).toFixed(2)}</div>
                  <div className={styles.paymentLabel}>
                    Meio: {getPaymentMethodLabel(order.payment_method)}
                  </div>
                </div>

                {/* Botões de Ações de Logística */}
                <div className={styles.actionButtons}>
                  
                  {/* Confirmação manual de pagamento se pendente (Dinheiro/PIX entrega) */}
                  {order.payment_status === 'pending' && (
                    <button 
                      onClick={() => handleConfirmPayment(order.id)}
                      className={`${styles.btn} ${styles.btnSuccess}`}
                      title="Confirmar recebimento do dinheiro/PIX"
                    >
                      <DollarSign size={14} />
                      Confirmar Pagamento
                    </button>
                  )}

                  {/* Fluxo de Transição de Status */}
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => {
                        handleUpdateStatus(order.id, 'preparing');
                        sendWhatsappNotification(order, 'preparing');
                      }}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                      <ThumbsUp size={14} />
                      Começar a Bater
                    </button>
                  )}

                  {order.status === 'preparing' && (
                    <button 
                      onClick={() => {
                        handleUpdateStatus(order.id, 'delivering');
                        sendWhatsappNotification(order, 'delivering');
                      }}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                      <Truck size={14} />
                      Despachar / Enviar
                    </button>
                  )}

                  {order.status === 'delivering' && (
                    <button 
                      onClick={() => {
                        handleUpdateStatus(order.id, 'delivered');
                        sendWhatsappNotification(order, 'delivered');
                      }}
                      className={`${styles.btn} ${styles.btnSuccess}`}
                    >
                      <Check size={14} />
                      Marcar como Entregue
                    </button>
                  )}

                  {/* Atalhos rápidos para WhatsApp manual */}
                  {order.status !== 'cancelled' && order.status !== 'delivered' && (
                    <div style={{ display: 'flex', gap: '0.25rem', width: '100%', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => sendWhatsappNotification(order, 'preparing')}
                        className={`${styles.btn} ${styles.btnWhatsapp}`}
                        title="Notificar preparação no WhatsApp"
                      >
                        <MessageSquare size={14} />
                        Batendo
                      </button>
                      <button 
                        onClick={() => sendWhatsappNotification(order, 'delivering')}
                        className={`${styles.btn} ${styles.btnWhatsapp}`}
                        title="Notificar envio no WhatsApp"
                      >
                        <Truck size={14} />
                        Rota
                      </button>
                    </div>
                  )}

                  {/* Cancelar Pedido */}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button 
                      onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                      className={`${styles.btn} ${styles.btnDanger}`}
                    >
                      <X size={14} />
                      Cancelar
                    </button>
                  )}

                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
