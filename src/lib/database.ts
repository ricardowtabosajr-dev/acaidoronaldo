import { createClient } from '@supabase/supabase-js';
import { generateUUID } from './utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey;

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Tipos do Banco de Dados
export interface NeighborhoodFee {
  id: string;
  name: string;
  delivery_fee: number;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  style: 'grosso' | 'medio';
  size: 0.5 | 1.0;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_neighborhood_id?: string | null;
  delivery_fee: number;
  status: 'pending' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method: 'infinitepay' | 'pix_delivery' | 'cash';
  total_price: number;
  created_at: string;
  items?: OrderItem[];
}

export interface Cost {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface StoreSettings {
  id?: string;
  default_delivery_fee: number;
  whatsapp_number: string;
  is_open: boolean;
}

// SIMULAÇÃO DE BANCO LOCAL (LOCALSTORAGE) PARA DESENVOLVIMENTO/HOMOLOGAÇÃO OFFLINE
const getLocalStorageData = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const setLocalStorageData = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};



// Dados padrão da Loja
const DEFAULT_FEES: NeighborhoodFee[] = [
  { id: '1', name: 'Centro', delivery_fee: 5.00 },
  { id: '2', name: 'Bairro Novo', delivery_fee: 7.00 },
  { id: '3', name: 'Planalto (Mais Distante)', delivery_fee: 12.00 },
];

const DEFAULT_SETTINGS: StoreSettings = {
  default_delivery_fee: 6.00,
  whatsapp_number: '5581999999999', // Coloque o número do Ronaldo
  is_open: true,
};

// Funções da API de Dados
export const db = {
  isOffline: () => !isSupabaseConfigured,

  // --- NEIGHBORHOOD FEES ---
  async getNeighborhoodFees(): Promise<NeighborhoodFee[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('neighborhood_fees').select('*').order('name');
      if (!error && data) return data as NeighborhoodFee[];
    }
    return getLocalStorageData('acai_neighborhood_fees', DEFAULT_FEES);
  },

  async addNeighborhoodFee(name: string, delivery_fee: number): Promise<NeighborhoodFee> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('neighborhood_fees').insert([{ name, delivery_fee }]).select().single();
      if (!error && data) return data as NeighborhoodFee;
    }
    const current = getLocalStorageData('acai_neighborhood_fees', DEFAULT_FEES);
    const newFee = { id: generateUUID(), name, delivery_fee };
    setLocalStorageData('acai_neighborhood_fees', [...current, newFee]);
    return newFee;
  },

  async deleteNeighborhoodFee(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('neighborhood_fees').delete().eq('id', id);
      return !error;
    }
    const current = getLocalStorageData('acai_neighborhood_fees', DEFAULT_FEES);
    setLocalStorageData('acai_neighborhood_fees', current.filter(f => f.id !== id));
    return true;
  },

  // --- ORDERS ---
  async getOrders(): Promise<Order[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
      if (!error && data) {
        return (data as any[]).map(o => ({
          ...o,
          items: o.order_items
        })) as Order[];
      }
    }
    return getLocalStorageData('acai_orders', []);
  },

  async createOrder(orderInput: Omit<Order, 'id' | 'created_at' | 'status' | 'payment_status'>, items: Omit<OrderItem, 'id' | 'order_id'>[]): Promise<Order> {
    const orderId = generateUUID();
    const createdAt = new Date().toISOString();
    const fullOrder: Order = {
      ...orderInput,
      id: orderId,
      created_at: createdAt,
      status: 'pending',
      payment_status: orderInput.payment_method === 'infinitepay' ? 'pending' : 'pending',
      items: items.map(item => ({ ...item, id: generateUUID(), order_id: orderId }))
    };

    if (isSupabaseConfigured && supabase) {
      // 1. Inserir Pedido
      const { error: orderError } = await supabase.from('orders').insert([{
        id: orderId,
        customer_name: orderInput.customer_name,
        customer_phone: orderInput.customer_phone,
        delivery_address: orderInput.delivery_address,
        delivery_neighborhood_id: orderInput.delivery_neighborhood_id,
        delivery_fee: orderInput.delivery_fee,
        status: 'pending',
        payment_status: fullOrder.payment_status,
        payment_method: orderInput.payment_method,
        total_price: orderInput.total_price
      }]);

      if (!orderError) {
        // 2. Inserir Itens do Pedido
        const itemsToInsert = items.map(item => ({
          order_id: orderId,
          style: item.style,
          size: item.size,
          quantity: item.quantity,
          price: item.price
        }));
        await supabase.from('order_items').insert(itemsToInsert);
        return fullOrder;
      }
    }

    // Fallback LocalStorage
    const currentOrders = getLocalStorageData('acai_orders', [] as Order[]);
    setLocalStorageData('acai_orders', [fullOrder, ...currentOrders]);
    return fullOrder;
  },

  async updateOrderStatus(id: string, status: Order['status']): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      return !error;
    }
    const currentOrders = getLocalStorageData('acai_orders', [] as Order[]);
    const updated = currentOrders.map(o => o.id === id ? { ...o, status } : o);
    setLocalStorageData('acai_orders', updated);
    return true;
  },

  async updateOrderPaymentStatus(id: string, payment_status: Order['payment_status']): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('orders').update({ payment_status }).eq('id', id);
      return !error;
    }
    const currentOrders = getLocalStorageData('acai_orders', [] as Order[]);
    const updated = currentOrders.map(o => o.id === id ? { ...o, payment_status } : o);
    setLocalStorageData('acai_orders', updated);
    return true;
  },

  // --- COSTS ---
  async getCosts(): Promise<Cost[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('costs').select('*').order('date', { ascending: false });
      if (!error && data) return data as Cost[];
    }
    return getLocalStorageData('acai_costs', []);
  },

  async addCost(description: string, amount: number, date: string): Promise<Cost> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('costs').insert([{ description, amount, date }]).select().single();
      if (!error && data) return data as Cost;
    }
    const current = getLocalStorageData('acai_costs', [] as Cost[]);
    const newCost = { id: generateUUID(), description, amount, date };
    setLocalStorageData('acai_costs', [newCost, ...current]);
    return newCost;
  },

  async updateCost(id: string, description: string, amount: number, date: string): Promise<Cost | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('costs')
        .update({ description, amount, date })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as Cost;
      return null;
    }
    const current = getLocalStorageData('acai_costs', [] as Cost[]);
    const updated = current.map(c => (c.id === id ? { ...c, description, amount, date } : c));
    setLocalStorageData('acai_costs', updated);
    return updated.find(c => c.id === id) || null;
  },

  async deleteCost(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('costs').delete().eq('id', id);
      return !error;
    }
    const current = getLocalStorageData('acai_costs', [] as Cost[]);
    setLocalStorageData('acai_costs', current.filter(c => c.id !== id));
    return true;
  },

  // --- SETTINGS ---
  async getSettings(): Promise<StoreSettings> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('store_settings').select('*').limit(1);
      if (!error && data && data.length > 0) return data[0] as StoreSettings;
      
      // Se a tabela estiver vazia, tentar inserir o default
      const { data: insertedData } = await supabase.from('store_settings').insert([DEFAULT_SETTINGS]).select().single();
      if (insertedData) return insertedData as StoreSettings;
    }
    return getLocalStorageData('acai_store_settings', DEFAULT_SETTINGS);
  },

  async updateSettings(settings: StoreSettings): Promise<StoreSettings> {
    if (isSupabaseConfigured && supabase) {
      const current = await this.getSettings();
      if (current.id) {
        const { data, error } = await supabase.from('store_settings').update({
          default_delivery_fee: settings.default_delivery_fee,
          whatsapp_number: settings.whatsapp_number,
          is_open: settings.is_open
        }).eq('id', current.id).select().single();
        if (!error && data) return data as StoreSettings;
      }
    }
    setLocalStorageData('acai_store_settings', settings);
    return settings;
  },

  async getChatHistory(phone: string): Promise<any[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('chat_sessions')
        .select('history')
        .eq('phone', phone)
        .single();
      return data ? data.history : [];
    }
    return [];
  },

  async saveChatHistory(phone: string, history: any[]) {
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('chat_sessions')
        .upsert({ phone, history }, { onConflict: 'phone' });
    }
  }
};
