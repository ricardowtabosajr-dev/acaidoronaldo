'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, Order, NeighborhoodFee, StoreSettings } from '@/lib/database';
import { MapPin, Phone, Check, Navigation, Package, Lock, RefreshCw, Clock } from 'lucide-react';
import styles from './page.module.css';

export default function Entregador() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodFee[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [fetchedOrders, fetchedFees] = await Promise.all([
        db.getOrders(),
        db.getNeighborhoodFees(),
      ]);
      setOrders(fetchedOrders);
      setNeighborhoods(fetchedFees);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const s = await db.getSettings();
      setSettings(s);
      const alreadyOk = typeof window !== 'undefined' && sessionStorage.getItem('entregador_ok') === '1';
      if (!s.delivery_pin || alreadyOk) setUnlocked(true);
      await loadData();
    }
    init();
  }, [loadData]);

  // Atualiza a fila a cada 15s
  useEffect(() => {
    if (!unlocked) return;
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [unlocked, loadData]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === (settings?.delivery_pin || '')) {
      setUnlocked(true);
      if (typeof window !== 'undefined') sessionStorage.setItem('entregador_ok', '1');
    } else {
      setPinError('PIN incorreto. Tente novamente.');
    }
  };

  const routeOrderOf = (order: Order): number => {
    const n = neighborhoods.find(x => x.id === order.delivery_neighborhood_id);
    return n?.route_order ?? Number.MAX_SAFE_INTEGER;
  };

  const neighborhoodName = (order: Order): string => {
    const n = neighborhoods.find(x => x.id === order.delivery_neighborhood_id);
    return n?.name || '';
  };

  // Entregas pendentes: status "delivering" (Despachadas pelo painel),
  // ordenadas por rota do bairro e, em empate, por horário do pedido.
  const deliveries = orders
    .filter(o => o.status === 'delivering')
    .sort((a, b) => {
      const ra = routeOrderOf(a);
      const rb = routeOrderOf(b);
      if (ra !== rb) return ra - rb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const markDelivered = async (id: string) => {
    if (!confirm('Confirmar a entrega deste pedido?')) return;
    const ok = await db.updateOrderStatus(id, 'delivered');
    if (ok) {
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, status: 'delivered' } : o)));
    } else {
      alert('Não foi possível dar baixa. Verifique a conexão.');
    }
  };

  const mapsUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const waUrl = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    const withCountry = clean.startsWith('55') ? clean : `55${clean}`;
    return `https://wa.me/${withCountry}`;
  };

  // --- Tela de PIN ---
  if (!unlocked) {
    return (
      <div className={styles.pinScreen}>
        <form onSubmit={handleUnlock} className={styles.pinCard}>
          <Lock size={40} className={styles.pinIcon} />
          <h1>Área do Entregador</h1>
          <p>Digite o PIN para ver as entregas.</p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
            className={styles.pinInput}
            placeholder="PIN"
            autoFocus
          />
          {pinError && <span className={styles.pinError}>{pinError}</span>}
          <button type="submit" className={styles.pinBtn}>Entrar</button>
        </form>
      </div>
    );
  }

  // --- Tela de entregas ---
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <h1>🛵 Entregas</h1>
          <span className={styles.count}>{deliveries.length} pendente(s)</span>
        </div>
        <button onClick={loadData} className={styles.refreshBtn} title="Atualizar">
          <RefreshCw size={20} />
        </button>
      </header>

      {isLoading ? (
        <div className={styles.empty}>Carregando entregas...</div>
      ) : deliveries.length === 0 ? (
        <div className={styles.empty}>
          <Package size={40} />
          <p>Nenhuma entrega pendente no momento. 🎉</p>
          <span>Os pedidos aparecem aqui quando forem despachados no painel.</span>
        </div>
      ) : (
        <div className={styles.list}>
          {deliveries.map((order, idx) => (
            <div key={order.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.seq}>{idx + 1}</span>
                <div className={styles.cardHeadInfo}>
                  <h3>{order.customer_name}</h3>
                  <span className={styles.time}>
                    <Clock size={12} /> {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {neighborhoodName(order) && <> · {neighborhoodName(order)}</>}
                  </span>
                </div>
                <span className={styles.total}>R$ {Number(order.total_price).toFixed(2)}</span>
              </div>

              <div className={styles.address}>
                <MapPin size={16} />
                <span>{order.delivery_address}</span>
              </div>

              <div className={styles.items}>
                {order.items?.map(item => (
                  <span key={item.id} className={styles.itemChip}>
                    {item.quantity}× Açaí {item.style} {item.size === 1.0 ? '1L' : '500ml'}
                  </span>
                ))}
              </div>

              <div className={styles.payRow}>
                {order.payment_status === 'paid'
                  ? <span className={styles.paid}>✓ Pago</span>
                  : <span className={styles.unpaid}>⚠ Receber: R$ {Number(order.total_price).toFixed(2)} ({order.payment_method === 'cash' ? 'Dinheiro' : order.payment_method === 'pix_delivery' ? 'PIX' : 'InfinitePay'})</span>}
              </div>

              <div className={styles.actions}>
                <a href={mapsUrl(order.delivery_address)} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnMaps}`}>
                  <Navigation size={16} /> Rota
                </a>
                <a href={waUrl(order.customer_phone)} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnWa}`}>
                  <Phone size={16} /> WhatsApp
                </a>
                <button onClick={() => markDelivered(order.id)} className={`${styles.btn} ${styles.btnDone}`}>
                  <Check size={16} /> Entreguei
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
