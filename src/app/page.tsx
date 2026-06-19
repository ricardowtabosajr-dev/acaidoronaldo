'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, HelpCircle, Clock, Check, AlertCircle, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { db, StoreSettings } from '@/lib/database';
import styles from './page.module.css';

interface CartItem {
  id: string;
  style: 'grosso' | 'medio';
  size: 0.5 | 1.0;
  quantity: number;
  price: number;
}

export default function Catalog() {
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings>({
    default_delivery_fee: 6.0,
    whatsapp_number: '5581999999999',
    is_open: true
  });
  
  // Lista de itens no carrinho
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados locais para seleção de tamanho dos produtos
  const [grossoSize, setGrossoSize] = useState<0.5 | 1.0>(1.0);
  const [medioSize, setMedioSize] = useState<0.5 | 1.0>(1.0);

  // Tabela de Preços do Açaí do Ronaldo
  const PRICES = {
    grosso: { 0.5: 18.00, 1.0: 32.00 },
    medio: { 0.5: 14.00, 1.0: 25.00 }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const storeSettings = await db.getSettings();
        setSettings(storeSettings);
      } catch (err) {
        console.error("Erro ao carregar configurações da loja:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();

    // Carrega carrinho existente do sessionStorage
    const savedCart = sessionStorage.getItem('acai_cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Salva carrinho toda vez que sofrer alterações
  const saveCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    sessionStorage.setItem('acai_cart', JSON.stringify(updatedCart));
  };

  const addToCart = (style: 'grosso' | 'medio', size: 0.5 | 1.0) => {
    const price = PRICES[style][size];
    const existingIndex = cart.findIndex(item => item.style === style && item.size === size);

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      saveCart(updated);
    } else {
      const newItem: CartItem = {
        id: `${style}-${size}`,
        style,
        size,
        quantity: 1,
        price
      };
      saveCart([...cart, newItem]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    const updated = cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[];
    saveCart(updated);
  };

  const removeFromCart = (id: string) => {
    const updated = cart.filter(item => item.id !== id);
    saveCart(updated);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getLitersCount = () => {
    return cart.reduce((sum, item) => sum + (item.size * item.quantity), 0);
  };

  const handleGoToCheckout = () => {
    if (cart.length === 0) return;
    router.push('/checkout');
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <ShoppingBag size={20} />
          </div>
          <span className={styles.brandName}>Açaí do Ronaldo</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div className={`${styles.statusBadge} ${settings.is_open ? styles.statusOpen : styles.statusClosed}`}>
            <Clock size={14} />
            <span>{settings.is_open ? 'Aberto para Pedidos' : 'Fechado no Momento'}</span>
          </div>

          <Link href="/admin" className={styles.adminLink}>
            Painel Admin
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--acai-light)', letterSpacing: '0.1em' }}>
            100% Puro & Batido na Hora
          </span>
          <h1>O Verdadeiro Sabor do <span>Açaí Natural</span></h1>
          <p>
            Trabalhamos exclusivamente com polpa pura de açaí batido. Sem conservantes, sem corantes e sem aditivos gourmets. O açaí tradicional como ele deve ser!
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
              <Check size={18} style={{ color: 'var(--green-primary)' }} />
              Açaí Grosso e Médio
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
              <Check size={18} style={{ color: 'var(--green-primary)' }} />
              Embalagens de 500ml e 1L
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
              <Check size={18} style={{ color: 'var(--green-primary)' }} />
              Entrega Rápida
            </div>
          </div>
        </div>

        <div className={styles.heroImageContainer}>
          <div className={styles.heroImageWrapper}>
            <Image
              src="/acai.png"
              alt="Polpa de Açaí Natural do Ronaldo"
              fill
              priority
              className={styles.heroImage}
            />
          </div>
        </div>
      </section>

      {/* Main Grid: Products & Cart */}
      <main className={styles.main}>
        
        {/* Products Section */}
        <section className={styles.productsSection}>
          <h2>Opções de Polpa de Açaí</h2>
          
          <div className={styles.productsGrid}>
            
            {/* CARD 1: Açaí Grosso */}
            <div className={styles.productCard}>
              <div>
                <span className={`${styles.productBadge} ${styles.badgeGrosso}`}>Grosso (Mais Concentrado)</span>
                <h3>Açaí Grosso</h3>
                <p className={styles.productDescription}>
                  Polpa de açaí com máxima concentração do fruto. Rico, encorpado e extremamente cremoso. Ideal para quem busca energia máxima e o sabor puro e denso do fruto.
                </p>
              </div>

              <div>
                <div className={styles.sizeSelector}>
                  <span className={styles.sizeSelectorLabel}>Escolha o Tamanho:</span>
                  <div className={styles.sizeButtons}>
                    <button 
                      type="button" 
                      onClick={() => setGrossoSize(0.5)}
                      className={`${styles.sizeButton} ${grossoSize === 0.5 ? styles.sizeButtonActive : ''}`}
                    >
                      500 ml
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setGrossoSize(1.0)}
                      className={`${styles.sizeButton} ${grossoSize === 1.0 ? styles.sizeButtonActive : ''}`}
                    >
                      1 Litro
                    </button>
                  </div>
                </div>

                <div className={styles.priceRow}>
                  <div>
                    <span className={styles.priceLabel}>Valor</span>
                    <div className={styles.priceValue}>R$ {PRICES.grosso[grossoSize].toFixed(2)}</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => addToCart('grosso', grossoSize)}
                    disabled={!settings.is_open}
                    className={styles.addButton}
                  >
                    <ShoppingCart size={18} />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 2: Açaí Médio */}
            <div className={styles.productCard}>
              <div>
                <span className={`${styles.productBadge} ${styles.badgeMedio}`}>Médio (Tradicional)</span>
                <h3>Açaí Médio</h3>
                <p className={styles.productDescription}>
                  Polpa de açaí batido na consistência tradicional. Muito equilibrado, ideal para o consumo diário e para misturar como preferir. Textura suave e super refrescante.
                </p>
              </div>

              <div>
                <div className={styles.sizeSelector}>
                  <span className={styles.sizeSelectorLabel}>Escolha o Tamanho:</span>
                  <div className={styles.sizeButtons}>
                    <button 
                      type="button" 
                      onClick={() => setMedioSize(0.5)}
                      className={`${styles.sizeButton} ${medioSize === 0.5 ? styles.sizeButtonActive : ''}`}
                    >
                      500 ml
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setMedioSize(1.0)}
                      className={`${styles.sizeButton} ${medioSize === 1.0 ? styles.sizeButtonActive : ''}`}
                    >
                      1 Litro
                    </button>
                  </div>
                </div>

                <div className={styles.priceRow}>
                  <div>
                    <span className={styles.priceLabel}>Valor</span>
                    <div className={styles.priceValue}>R$ {PRICES.medio[medioSize].toFixed(2)}</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => addToCart('medio', medioSize)}
                    disabled={!settings.is_open}
                    className={styles.addButton}
                  >
                    <ShoppingCart size={18} />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Cart Panel */}
        <aside className={styles.cartPanel}>
          <h2>
            <ShoppingCart size={20} />
            Meu Carrinho
          </h2>

          {cart.length === 0 ? (
            <div className={styles.cartEmpty}>
              <ShoppingBag className={styles.cartEmptyIcon} />
              <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>Seu carrinho está vazio</p>
              <p style={{ fontSize: '0.85rem' }}>Selecione um açaí ao lado para iniciar seu pedido.</p>
            </div>
          ) : (
            <>
              <div className={styles.cartItemsList}>
                {cart.map(item => (
                  <div key={item.id} className={styles.cartItem}>
                    <div className={styles.cartItemInfo}>
                      <h4 style={{ textTransform: 'capitalize' }}>
                        Açaí {item.style}
                      </h4>
                      <span className={styles.cartItemDetails}>
                        Recipiente: {item.size === 1.0 ? '1 Litro' : '500 ml'}
                      </span>
                      
                      <div className={styles.cartItemQtyControls}>
                        <button type="button" onClick={() => updateQuantity(item.id, -1)} className={styles.qtyButton}>-</button>
                        <span className={styles.qtyValue}>{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, 1)} className={styles.qtyButton}>+</button>
                      </div>
                    </div>

                    <div className={styles.cartItemRight}>
                      <span className={styles.cartItemPrice}>
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => removeFromCart(item.id)}
                        className={styles.removeButton}
                        title="Remover item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.cartSummary}>
                <div className={styles.summaryRow}>
                  <span>Litros de Açaí:</span>
                  <span style={{ fontWeight: 600 }}>{getLitersCount().toFixed(1)} L</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>R$ {getCartTotal().toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Total do Açaí:</span>
                  <span>R$ {getCartTotal().toFixed(2)}</span>
                </div>
              </div>

              {!settings.is_open && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#ffebee', borderRadius: '8px', marginBottom: '1rem', color: '#c62828', fontSize: '0.85rem' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>A loja está fechada. Você pode visualizar o cardápio, mas pedidos não estão disponíveis.</span>
                </div>
              )}

              <button 
                type="button" 
                onClick={handleGoToCheckout}
                disabled={!settings.is_open}
                className={styles.checkoutButton}
              >
                <span>Finalizar Pedido</span>
                <ArrowRight size={18} />
              </button>
            </>
          )}
        </aside>

      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerCol}>
            <h3 style={{ fontFamily: 'var(--font-outfit)' }}>Açaí do Ronaldo</h3>
            <p>O melhor e mais puro açaí natural batido da região. Experimente a diferença de uma polpa verdadeira e fresca, direto para a sua mesa.</p>
          </div>
          <div className={styles.footerCol}>
            <h3>Como Funciona</h3>
            <ul>
              <li>1. Escolha a espessura (Grosso ou Médio)</li>
              <li>2. Escolha o volume (500ml ou 1 Litro)</li>
              <li>3. Informe seu endereço no Checkout</li>
              <li>4. Faça o pagamento seguro com InfinitePay (PIX/Cartão)</li>
              <li>5. Receba no WhatsApp e acompanhe a entrega!</li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h3>Horário de Funcionamento</h3>
            <ul>
              <li>Segunda a Sábado: 11:00 às 20:00</li>
              <li>Domingo: 12:00 às 18:00</li>
              <li>Telefone: +55 (81) 99999-9999</li>
            </ul>
          </div>
        </div>

        <div className={styles.footerCopyright}>
          <span>© {new Date().getFullYear()} Açaí do Ronaldo. Todos os direitos reservados.</span>
          <span>Desenvolvido com carinho para os amantes de Açaí Natural.</span>
        </div>
      </footer>
    </div>
  );
}
