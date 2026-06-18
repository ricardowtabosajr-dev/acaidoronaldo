'use client';

import { useState, useEffect } from 'react';
import { db, StoreSettings, NeighborhoodFee } from '@/lib/database';
import { Settings, MapPin, Plus, Trash2, Save, AlertCircle, Info } from 'lucide-react';
import styles from './page.module.css';

export default function AdminConfig() {
  const [settings, setSettings] = useState<StoreSettings>({
    default_delivery_fee: 6.00,
    whatsapp_number: '5581999999999',
    is_open: true
  });
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodFee[]>([]);
  
  // Inputs da Configuração Geral
  const [defaultFee, setDefaultFee] = useState('6.00');
  const [whatsapp, setWhatsapp] = useState('5581999999999');
  const [shopOpen, setShopOpen] = useState(true);

  // Inputs de Novo Bairro
  const [newBairroName, setNewBairroName] = useState('');
  const [newBairroFee, setNewBairroFee] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    async function loadConfigData() {
      try {
        const fetchedSettings = await db.getSettings();
        const fetchedFees = await db.getNeighborhoodFees();
        
        setSettings(fetchedSettings);
        setNeighborhoods(fetchedFees);

        setDefaultFee(fetchedSettings.default_delivery_fee.toString());
        setWhatsapp(fetchedSettings.whatsapp_number);
        setShopOpen(fetchedSettings.is_open);
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfigData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');

    const feeVal = parseFloat(defaultFee);
    if (isNaN(feeVal) || feeVal < 0) {
      alert('Taxa padrão inválida.');
      setIsSaving(false);
      return;
    }

    try {
      const updated = await db.updateSettings({
        id: settings.id,
        default_delivery_fee: feeVal,
        whatsapp_number: whatsapp,
        is_open: shopOpen
      });
      setSettings(updated);
      setSaveMessage('Configurações gerais salvas com sucesso!');
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBairroName || !newBairroFee) {
      alert('Preencha os dados do bairro!');
      return;
    }

    const feeVal = parseFloat(newBairroFee);
    if (isNaN(feeVal) || feeVal < 0) {
      alert('Taxa inválida!');
      return;
    }

    if (neighborhoods.some(n => n.name.toLowerCase() === newBairroName.toLowerCase())) {
      alert('Este bairro já está cadastrado!');
      return;
    }

    try {
      const added = await db.addNeighborhoodFee(newBairroName, feeVal);
      setNeighborhoods(prev => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBairroName('');
      setNewBairroFee('');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar bairro.');
    }
  };

  const handleDeleteNeighborhood = async (id: string) => {
    if (!confirm('Deseja realmente remover a taxa especial deste bairro? (Ele passará a cobrar a taxa padrão)')) return;

    const success = await db.deleteNeighborhoodFee(id);
    if (success) {
      setNeighborhoods(prev => prev.filter(n => n.id !== id));
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1>Configurações do Sistema</h1>
        <p>Ajuste os dados de contato do WhatsApp, status de funcionamento do catálogo e taxas de frete por bairro.</p>
      </div>

      {db.isOffline() && (
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'var(--gold-light)', borderRadius: '8px', marginBottom: '1.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', border: '1px solid rgba(212, 154, 21, 0.2)' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, color: 'var(--gold-primary)', marginTop: '0.1rem' }} />
          <div>
            <strong>Modo Simulação Local Ativo</strong> — O Supabase não está conectado. Todos os dados são salvos temporariamente no navegador (localStorage). Após conectar as variáveis de ambiente do Supabase no <code>.env.local</code>, os dados serão persistidos no banco.
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Carregando configurações...
        </div>
      ) : (
        <div className={styles.grid}>
          
          {/* Configurações Gerais */}
          <div>
            <div className={styles.card}>
              <h2>
                <Settings size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--acai-primary)' }} />
                Geral
              </h2>
              
              <form onSubmit={handleSaveSettings}>
                {/* Toggle Loja Aberta/Fechada */}
                <div className={styles.toggleContainer}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleLabelTitle}>Catálogo Online</span>
                    <span className={styles.toggleLabelSub}>Permitir pedidos pelo site</span>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={shopOpen} 
                      onChange={(e) => setShopOpen(e.target.checked)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="whatsapp">WhatsApp p/ Pedidos (com DDD) *</label>
                  <input 
                    type="text" 
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    required
                    className={styles.input}
                    placeholder="Ex: 5581999999999"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <Info size={12} />
                    Insira com o código do país (55 para Brasil) e DDD, apenas números.
                  </span>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="defaultFee">Taxa de Entrega Padrão (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    id="defaultFee"
                    value={defaultFee}
                    onChange={(e) => setDefaultFee(e.target.value)}
                    required
                    className={styles.input}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <Info size={12} />
                    Usada para bairros que não possuem taxa cadastrada individualmente.
                  </span>
                </div>

                {saveMessage && (
                  <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--green-light)', borderRadius: '8px', marginBottom: '1.25rem', color: 'var(--green-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{saveMessage}</span>
                  </div>
                )}

                <button type="submit" disabled={isSaving} className={styles.saveBtn}>
                  <Save size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>
            </div>
          </div>

          {/* Taxas por Bairro */}
          <div className={styles.card}>
            <h2>
              <MapPin size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--acai-primary)' }} />
              Taxas de Frete por Bairro
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Adicione exceções de taxas de entrega para bairros mais distantes. Clientes poderão selecionar estes bairros na tela de checkout para atualização dinâmica do valor do frete.
            </p>

            {/* Formulário Inline de Cadastro */}
            <form onSubmit={handleAddNeighborhood} className={styles.inlineForm}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label htmlFor="bairroName" style={{ fontSize: '0.8rem' }}>Nome do Bairro</label>
                <input 
                  type="text" 
                  id="bairroName"
                  value={newBairroName}
                  onChange={(e) => setNewBairroName(e.target.value)}
                  placeholder="Ex: Planalto"
                  required
                  className={styles.input}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label htmlFor="bairroFee" style={{ fontSize: '0.8rem' }}>Taxa (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  id="bairroFee"
                  value={newBairroFee}
                  onChange={(e) => setNewBairroFee(e.target.value)}
                  placeholder="Ex: 12.00"
                  required
                  className={styles.input}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                />
              </div>

              <button type="submit" className={styles.addBtn} title="Adicionar bairro">
                <Plus size={16} />
                Add
              </button>
            </form>

            {/* Listagem */}
            {neighborhoods.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhum bairro cadastrado. Todos usarão a taxa padrão.
              </div>
            ) : (
              <div className={styles.list}>
                {neighborhoods.map(neighborhood => (
                  <div key={neighborhood.id} className={styles.listItem}>
                    <span className={styles.listItemName}>{neighborhood.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className={styles.listItemFee}>
                        R$ {Number(neighborhood.delivery_fee).toFixed(2)}
                      </span>
                      <button 
                        onClick={() => handleDeleteNeighborhood(neighborhood.id)}
                        className={styles.deleteBtn}
                        title="Remover bairro"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
