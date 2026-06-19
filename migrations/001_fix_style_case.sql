-- Migration: Corrigir CHECK constraint de style em order_items
-- Motivo: O frontend envia 'grosso'/'medio' (minúsculo), mas a constraint
--         original aceitava apenas 'Grosso'/'Medio' (capitalizado).
-- 
-- Como aplicar: Cole este SQL no SQL Editor do Supabase Dashboard
-- URL: https://supabase.com/dashboard/project/cbqrferohjnusleemntc/sql

-- 1. Atualizar registros existentes que possam ter o formato antigo
UPDATE order_items SET style = LOWER(style) WHERE style != LOWER(style);

-- 2. Remover a constraint antiga
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_style_check;

-- 3. Criar a nova constraint com valores em minúsculo
ALTER TABLE order_items ADD CONSTRAINT order_items_style_check 
  CHECK (style IN ('grosso', 'medio'));
