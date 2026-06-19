-- Tabelas para o SaaS Açaí do Ronaldo

-- 1. Tabela de Configurações da Loja
CREATE TABLE store_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  default_delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 6.00,
  whatsapp_number TEXT NOT NULL DEFAULT '5581999999999',
  is_open BOOLEAN NOT NULL DEFAULT true
);

-- Inserir configuração padrão inicial
INSERT INTO store_settings (default_delivery_fee, whatsapp_number, is_open) 
VALUES (6.00, '5581999999999', true);

-- 2. Tabela de Bairros e Taxas Especiais
CREATE TABLE neighborhood_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL
);

-- 3. Tabela de Pedidos
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_neighborhood_id UUID REFERENCES neighborhood_fees(id),
  delivery_fee DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'preparing', 'delivering', 'delivered', 'cancelled')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('infinitepay', 'pix_delivery', 'cash')),
  total_price DECIMAL(10, 2) NOT NULL
);

-- 4. Tabela de Itens do Pedido (Relacionamento 1 para N com orders)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  style TEXT NOT NULL CHECK (style IN ('grosso', 'medio')),
  size DECIMAL(4, 2) NOT NULL CHECK (size IN (1.0, 0.5)),
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL
);

-- 5. Tabela de Controle de Custos
CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL
);

-- 6. Tabela de Sessões de Chat do WhatsApp (memória de conversa do agente IA)
-- Usada por db.getChatHistory / db.saveChatHistory. O upsert usa onConflict: 'phone',
-- por isso 'phone' precisa ser PRIMARY KEY (ou UNIQUE).
CREATE TABLE chat_sessions (
  phone TEXT PRIMARY KEY,
  history JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Habilitar RLS (Row Level Security) - Para o escopo inicial (SaaS único do Ronaldo),
-- podemos deixar liberado para leitura e escrita pelo cliente anônimo (pois o front-end fará a gestão).
-- OBS: Para um ambiente em produção real, o ideal seria restringir o painel Admin com autenticação.
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for public on store_settings" ON store_settings FOR ALL USING (true);
CREATE POLICY "Allow all operations for public on neighborhood_fees" ON neighborhood_fees FOR ALL USING (true);
CREATE POLICY "Allow all operations for public on orders" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all operations for public on order_items" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow all operations for public on costs" ON costs FOR ALL USING (true);
CREATE POLICY "Allow all operations for public on chat_sessions" ON chat_sessions FOR ALL USING (true);
