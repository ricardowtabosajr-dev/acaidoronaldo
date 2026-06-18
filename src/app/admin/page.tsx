'use client';

import { useState, useEffect } from 'react';
import { db, Order, Cost } from '@/lib/database';
import { DollarSign, Droplet, TrendingUp, TrendingDown, ShoppingBag } from 'lucide-react';
import styles from './page.module.css';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedOrders, fetchedCosts] = await Promise.all([
          db.getOrders(),
          db.getCosts()
        ]);
        setOrders(fetchedOrders);
        setCosts(fetchedCosts);
      } catch (err) {
        console.error("Erro ao carregar dados do dashboard admin:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // FILTRAR PEDIDOS VÁLIDOS (ignora cancelados)
  const activeOrders = orders.filter(o => o.status !== 'cancelled');

  // 1. FATURAMENTO BRUTO
  const totalRevenue = activeOrders.reduce((sum, o) => sum + Number(o.total_price), 0);

  // 2. CUSTOS TOTAIS
  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0);

  // 3. LUCRO LÍQUIDO
  const netProfit = totalRevenue - totalCosts;

  // 4. VOLUME TOTAL VENDIDO (LITROS)
  const calculateTotalVolume = () => {
    let liters = 0;
    activeOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          liters += Number(item.size) * Number(item.quantity);
        });
      }
    });
    return liters;
  };

  const totalVolume = calculateTotalVolume();

  // Detalhamento de vendas
  const getBreakdown = () => {
    let grosso1L = 0;
    let grosso500ml = 0;
    let medio1L = 0;
    let medio500ml = 0;

    activeOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          if (item.style === 'grosso') {
            if (item.size === 1.0) grosso1L += item.quantity;
            else grosso500ml += item.quantity;
          } else if (item.style === 'medio') {
            if (item.size === 1.0) medio1L += item.quantity;
            else medio500ml += item.quantity;
          }
        });
      }
    });

    return { grosso1L, grosso500ml, medio1L, medio500ml };
  };

  const breakdown = getBreakdown();

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'preparing': return 'Batendo';
      case 'delivering': return 'Saiu p/ Entrega';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1>Visão Geral do Negócio</h1>
        <p>Acompanhe em tempo real faturamento, vendas e saúde financeira da loja.</p>
      </div>

      {isLoading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Carregando métricas financeiras...
        </div>
      ) : (
        <>
          {/* Grid de Métricas */}
          <div className={styles.metricsGrid}>
            
            {/* Card 1: Litros Vendidos */}
            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <h3>Volume Vendido</h3>
                <div className={styles.metricValue}>{totalVolume.toFixed(1)} L</div>
              </div>
              <div className={`${styles.metricIcon} ${styles.iconPurple}`}>
                <Droplet size={24} />
              </div>
            </div>

            {/* Card 2: Faturamento Bruto */}
            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <h3>Faturamento Bruto</h3>
                <div className={styles.metricValue}>R$ {totalRevenue.toFixed(2)}</div>
              </div>
              <div className={`${styles.metricIcon} ${styles.iconGreen}`}>
                <DollarSign size={24} />
              </div>
            </div>

            {/* Card 3: Custos Operacionais */}
            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <h3>Custos de Insumos</h3>
                <div className={styles.metricValue}>R$ {totalCosts.toFixed(2)}</div>
              </div>
              <div className={`${styles.metricIcon} ${styles.iconRed}`}>
                <TrendingDown size={24} />
              </div>
            </div>

            {/* Card 4: Lucro Líquido */}
            <div className={styles.metricCard}>
              <div className={styles.metricInfo}>
                <h3>Lucro Líquido</h3>
                <div className={styles.metricValue} style={{ color: netProfit >= 0 ? 'var(--green-primary)' : '#c62828' }}>
                  R$ {netProfit.toFixed(2)}
                </div>
              </div>
              <div className={`${styles.metricIcon} ${styles.iconGold}`}>
                <TrendingUp size={24} />
              </div>
            </div>

          </div>

          <div className={styles.row}>
            
            {/* Tabela de Pedidos Recentes */}
            <div className={styles.card}>
              <h2>Últimas Vendas</h2>
              <div className={styles.ordersTableContainer}>
                {orders.length === 0 ? (
                  <div className={styles.emptyState}>Nenhum pedido recebido ainda.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Data/Hora</th>
                        <th>Bairro</th>
                        <th>Itens</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 5).map(order => (
                        <tr key={order.id}>
                          <td style={{ fontWeight: 600 }}>{order.customer_name}</td>
                          <td>{new Date(order.created_at).toLocaleDateString('pt-BR')} {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            {order.delivery_neighborhood_id 
                              ? order.delivery_address.split('Bairro: ')[1] || 'Centro'
                              : 'Sem Bairro'}
                          </td>
                          <td>
                            {order.items?.map(i => `${i.quantity}x ${i.style === 'grosso' ? 'Grosso' : 'Médio'} ${i.size === 1.0 ? '1L' : '500ml'}`).join(', ')}
                          </td>
                          <td style={{ fontWeight: 700 }}>R$ {Number(order.total_price).toFixed(2)}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${styles['status_' + order.status]}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Resumo de Litros e Volumes */}
            <div className={styles.card}>
              <h2>Breakdown por Categoria</h2>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--acai-primary)', marginBottom: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>
                  AÇAÍ GROSSO
                </h3>
                <div className={styles.list}>
                  <div className={styles.listItem}>
                    <span className={styles.listItemName}>Garrafas de 1 Litro:</span>
                    <span className={styles.listItemValue}>{breakdown.grosso1L} un</span>
                  </div>
                  <div className={styles.listItem}>
                    <span className={styles.listItemName}>Potes de 500 ml:</span>
                    <span className={styles.listItemValue}>{breakdown.grosso500ml} un</span>
                  </div>
                  <div className={styles.listItem} style={{ backgroundColor: 'var(--acai-soft)' }}>
                    <span className={styles.listItemName}>Total Grosso em Litros:</span>
                    <span className={styles.listItemValue} style={{ color: 'var(--acai-primary)' }}>
                      {(breakdown.grosso1L * 1.0 + breakdown.grosso500ml * 0.5).toFixed(1)} L
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', marginBottom: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>
                  AÇAÍ MÉDIO
                </h3>
                <div className={styles.list}>
                  <div className={styles.listItem}>
                    <span className={styles.listItemName}>Garrafas de 1 Litro:</span>
                    <span className={styles.listItemValue}>{breakdown.medio1L} un</span>
                  </div>
                  <div className={styles.listItem}>
                    <span className={styles.listItemName}>Potes de 500 ml:</span>
                    <span className={styles.listItemValue}>{breakdown.medio500ml} un</span>
                  </div>
                  <div className={styles.listItem} style={{ backgroundColor: 'var(--gold-light)' }}>
                    <span className={styles.listItemName}>Total Médio em Litros:</span>
                    <span className={styles.listItemValue} style={{ color: 'var(--gold-primary)' }}>
                      {(breakdown.medio1L * 1.0 + breakdown.medio500ml * 0.5).toFixed(1)} L
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </>
      )}
    </div>
  );
}
