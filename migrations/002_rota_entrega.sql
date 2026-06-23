-- Migration: Rota de entrega + PIN do entregador
-- Como aplicar: cole no SQL Editor do Supabase Dashboard
-- URL: https://supabase.com/dashboard/project/cbqrferohjnusleemntc/sql

-- 1. Ordem do bairro na rota de entrega (menor = entregue primeiro)
ALTER TABLE neighborhood_fees ADD COLUMN IF NOT EXISTS route_order INTEGER;

-- 2. PIN simples de acesso à tela do entregador
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS delivery_pin TEXT;
