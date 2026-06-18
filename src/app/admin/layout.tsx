'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, DollarSign, Settings, Home, ShieldAlert } from 'lucide-react';
import styles from './layout.module.css';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const menuItems = [
    {
      name: 'Resumo / Dashboard',
      path: '/admin',
      icon: <LayoutDashboard size={18} />
    },
    {
      name: 'Gestão de Pedidos',
      path: '/admin/pedidos',
      icon: <ClipboardList size={18} />
    },
    {
      name: 'Controle de Custos',
      path: '/admin/custos',
      icon: <DollarSign size={18} />
    },
    {
      name: 'Configurações',
      path: '/admin/config',
      icon: <Settings size={18} />
    }
  ];

  return (
    <div className={styles.container}>
      {/* Sidebar de Navegação */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logoText}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} style={{ color: 'var(--acai-primary)' }} />
              Painel Admin
            </span>
          </div>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.backHome}>
          <Link href="/" className={styles.navLink}>
            <Home size={18} />
            <span>Voltar ao Site</span>
          </Link>
        </div>
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
