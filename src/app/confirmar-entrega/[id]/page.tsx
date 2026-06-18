'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db, Order } from '@/lib/database';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import styles from './page.module.css';

export default function ConfirmarEntrega() {
  const params = useParams();
  const id = params.id as string;
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_delivered'>('loading');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function loadAndConfirm() {
      if (!id) {
        setStatus('error');
        return;
      }

      try {
        const orders = await db.getOrders();
        const foundOrder = orders.find(o => o.id === id);

        if (!foundOrder) {
          setStatus('error');
          return;
        }

        setOrder(foundOrder);

        if (foundOrder.status === 'delivered') {
          setStatus('already_delivered');
          return;
        }

        const success = await db.updateOrderStatus(id, 'delivered');
        
        if (success) {
          setStatus('success');
        } else {
          setStatus('error');
        }
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }

    loadAndConfirm();
  }, [id]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {status === 'loading' && (
          <>
            <Loader2 className={styles.spinner} size={48} />
            <h2>Confirmando sua entrega...</h2>
            <p>Aguarde um momento.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className={styles.successIcon} size={64} />
            <h2>Entrega Confirmada! 🎉</h2>
            <p>Obrigado, {order?.customer_name?.split(' ')[0]}! Esperamos que você goste muito do nosso açaí natural batido na hora.</p>
            <p className={styles.feedbackMsg}>Bom apetite! 💜</p>
          </>
        )}

        {status === 'already_delivered' && (
          <>
            <CheckCircle className={styles.successIcon} size={64} />
            <h2>Açaí já foi entregue!</h2>
            <p>Este pedido já consta como entregue no nosso sistema. Obrigado pela preferência!</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className={styles.errorIcon} size={64} />
            <h2>Ops! Algo deu errado.</h2>
            <p>Não conseguimos confirmar a entrega automaticamente. Por favor, avise o entregador ou mande uma mensagem no nosso WhatsApp.</p>
          </>
        )}
      </div>
    </div>
  );
}
