'use client';

import { useState, useEffect } from 'react';
import { db, Cost } from '@/lib/database';
import { Plus, Trash2, Calendar, FileText, DollarSign, AlertCircle, Pencil, Check, X } from 'lucide-react';
import styles from './page.module.css';

export default function AdminCustos() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Edição inline de uma despesa
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    async function loadCosts() {
      try {
        const fetched = await db.getCosts();
        setCosts(fetched);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    
    // Set default date as today
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    
    loadCosts();
  }, []);

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !amount || !date) {
      alert('Preencha todos os campos!');
      return;
    }

    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      alert('Custo inválido!');
      return;
    }

    try {
      const newCost = await db.addCost(description, value, date);
      setCosts(prev => [newCost, ...prev]);
      setDescription('');
      setAmount('');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar custo.');
    }
  };

  const handleDeleteCost = async (id: string) => {
    if (!confirm('Deseja realmente excluir este custo?')) return;

    const success = await db.deleteCost(id);
    if (success) {
      setCosts(prev => prev.filter(c => c.id !== id));
    }
  };

  const startEdit = (cost: Cost) => {
    setEditingId(cost.id);
    setEditDescription(cost.description);
    setEditAmount(String(cost.amount));
    // A data vem como YYYY-MM-DD (ou ISO); pega só a parte da data para o input.
    setEditDate(String(cost.date).split('T')[0]);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editDescription || !editAmount || !editDate) {
      alert('Preencha todos os campos!');
      return;
    }

    const value = parseFloat(editAmount);
    if (isNaN(value) || value <= 0) {
      alert('Custo inválido!');
      return;
    }

    const updated = await db.updateCost(id, editDescription, value, editDate);
    if (updated) {
      setCosts(prev => prev.map(c => (c.id === id ? updated : c)));
      setEditingId(null);
    } else {
      alert('Erro ao atualizar a despesa.');
    }
  };

  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div>
      <div className={styles.header}>
        <h1>Controle de Custos & Insumos</h1>
        <p>Registre todas as despesas operacionais da loja (compra de açaí bruto, recipientes, energia, etc.) para cálculo preciso de lucro líquido.</p>
      </div>

      <div className={styles.grid}>
        
        {/* Formulário de Adicionar Custo */}
        <div className={styles.card}>
          <h2>Novo Registro</h2>
          <form onSubmit={handleAddCost}>
            <div className={styles.formGroup}>
              <label htmlFor="description">Descrição / Insumo *</label>
              <input 
                type="text" 
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className={styles.input}
                placeholder="Ex: Compra de 50L de açaí bruto"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="amount">Valor (R$) *</label>
              <input 
                type="number" 
                step="0.01"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className={styles.input}
                placeholder="Ex: 350.00"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="date">Data da Despesa *</label>
              <input 
                type="date" 
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submitBtn}>
              <Plus size={18} />
              Registrar Despesa
            </button>
          </form>
        </div>

        {/* Listagem de Custos */}
        <div>
          <div className={styles.totalBanner}>
            <span>Custos Acumulados:</span>
            <span>R$ {totalCosts.toFixed(2)}</span>
          </div>

          <div className={styles.card}>
            <h2>Registros de Despesa</h2>
            
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                Carregando despesas...
              </div>
            ) : costs.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhum custo registrado até o momento.
              </div>
            ) : (
              <div className={styles.costsList}>
                {costs.map(cost => (
                  <div key={cost.id} className={styles.costItem}>
                    {editingId === cost.id ? (
                      /* Modo de edição inline */
                      <div className={styles.editRow}>
                        <div className={styles.editFields}>
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className={`${styles.input} ${styles.editDesc}`}
                            placeholder="Descrição"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className={`${styles.input} ${styles.editAmount}`}
                            placeholder="Valor"
                          />
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className={`${styles.input} ${styles.editDate}`}
                          />
                        </div>
                        <div className={styles.costRight}>
                          <button
                            onClick={() => handleSaveEdit(cost.id)}
                            className={styles.saveBtn}
                            title="Salvar"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className={styles.deleteBtn}
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Modo de exibição */
                      <>
                        <div className={styles.costInfo}>
                          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} style={{ color: 'var(--acai-primary)' }} />
                            {cost.description}
                          </h4>
                          <span className={styles.costDate}>
                            <Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                            {new Date(cost.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </span>
                        </div>

                        <div className={styles.costRight}>
                          <span className={styles.costAmount}>
                            - R$ {Number(cost.amount).toFixed(2)}
                          </span>
                          <button
                            onClick={() => startEdit(cost)}
                            className={styles.editBtn}
                            title="Editar despesa"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCost(cost.id)}
                            className={styles.deleteBtn}
                            title="Excluir despesa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
