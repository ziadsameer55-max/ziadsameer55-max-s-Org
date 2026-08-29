-- ============================================================================
-- 🚀 POSTGRESQL PRODUCTION SCHEMA DEFINITION
-- 🏢 شركة الحليم للتجارة والتوزيع — B2B Wholesale Distribution Platform
-- ============================================================================

-- 1. EXTENSIONS & PREREQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to UTC for standardized accounting timestamps
SET timezone = 'UTC';

-- ============================================================================
-- 2. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. USERS TABLE (Core Authentication & System Accounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_phone UNIQUE (phone),
  CONSTRAINT chk_users_role CHECK (role IN ('admin', 'customer')),
  CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled'))
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. CUSTOMERS TABLE (B2B Merchant Profiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  shop_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_customers_user_id UNIQUE (user_id),
  CONSTRAINT uq_customers_phone UNIQUE (phone),
  CONSTRAINT chk_customers_status CHECK (status IN ('active', 'disabled'))
);

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. CATEGORIES TABLE (Product Classification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uq_categories_name UNIQUE (name),
  CONSTRAINT chk_categories_status CHECK (status IN ('active', 'disabled'))
);

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 6. PRODUCTS TABLE (Wholesale Catalog & Inventory)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255) NOT NULL,
  category_id UUID,
  size VARCHAR(100),
  packaging VARCHAR(100),
  units_per_case INT NOT NULL DEFAULT 1,
  price NUMERIC(12, 2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  stock_alert_threshold INT NOT NULL DEFAULT 5,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT chk_products_units_per_case CHECK (units_per_case > 0),
  CONSTRAINT chk_products_price CHECK (price >= 0),
  CONSTRAINT chk_products_stock CHECK (stock >= 0),
  CONSTRAINT chk_products_threshold CHECK (stock_alert_threshold >= 0),
  CONSTRAINT chk_products_status CHECK (status IN ('active', 'locked', 'hidden', 'archived'))
);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 7. DEALS TABLE (Promotions & Wholesale Discounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_price NUMERIC(12, 2) NOT NULL,
  deal_price NUMERIC(12, 2) NOT NULL,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_deals_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_deals_original_price CHECK (original_price >= 0),
  CONSTRAINT chk_deals_deal_price CHECK (deal_price >= 0),
  CONSTRAINT chk_deals_price_logic CHECK (deal_price <= original_price),
  CONSTRAINT chk_deals_discount_percent CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT chk_deals_date_range CHECK (end_at > start_at)
);

CREATE TRIGGER trg_deals_updated_at
BEFORE UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 8. ORDERS TABLE (Customer Orders & Lifecycle)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT uq_orders_order_number UNIQUE (order_number),
  CONSTRAINT chk_orders_status CHECK (status IN (
    'pending', 'reviewing', 'confirmed', 'processing',
    'ready', 'out_for_delivery', 'delivered', 'cancelled'
  )),
  CONSTRAINT chk_orders_subtotal CHECK (subtotal >= 0),
  CONSTRAINT chk_orders_discount CHECK (discount >= 0),
  CONSTRAINT chk_orders_total CHECK (total >= 0),
  CONSTRAINT chk_orders_paid_amount CHECK (paid_amount >= 0),
  CONSTRAINT chk_orders_remaining_amount CHECK (remaining_amount >= 0)
);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 9. ORDER ITEMS TABLE (Immutable Line-Item Price Snapshots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id UUID,
  product_name_snapshot VARCHAR(255) NOT NULL,
  brand_snapshot VARCHAR(255) NOT NULL,
  size_snapshot VARCHAR(100),
  packaging_snapshot VARCHAR(100),
  unit_price_snapshot NUMERIC(12, 2) NOT NULL,
  quantity INT NOT NULL,
  item_total NUMERIC(12, 2) NOT NULL,
  deal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
  CONSTRAINT chk_order_items_unit_price CHECK (unit_price_snapshot >= 0),
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_items_item_total CHECK (item_total >= 0)
);

-- ============================================================================
-- 10. PAYMENTS TABLE (Financial Collections & Receipts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  order_id UUID,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_admin FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  CONSTRAINT chk_payments_method CHECK (payment_method IN ('cash', 'bank_transfer', 'other'))
);

-- ============================================================================
-- 11. INVOICES TABLE (Accounting Invoices & Rolling Debt Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL,
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  invoice_total NUMERIC(12, 2) NOT NULL,
  previous_debt NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_due NUMERIC(12, 2) NOT NULL,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_invoices_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT uq_invoices_invoice_number UNIQUE (invoice_number),
  CONSTRAINT uq_invoices_order_id UNIQUE (order_id),
  CONSTRAINT chk_invoices_invoice_total CHECK (invoice_total >= 0),
  CONSTRAINT chk_invoices_paid_amount CHECK (paid_amount >= 0)
);

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 12. SETTINGS TABLE (Dynamic Store & Operational Configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_settings_key UNIQUE (key)
);

CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 13. SESSIONS TABLE (Stateful Token Authorization with Revocation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash)
);

-- ============================================================================
-- 14. AUDIT LOGS TABLE (Comprehensive System Security & Action Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100),
  target_id VARCHAR(100),
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 15. LOGIN ATTEMPTS TABLE (Brute-Force & Credential Stuffing Shield)
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 16. PASSWORD RESETS TABLE (One-Time Secure Account Recovery)
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_password_resets_token_hash UNIQUE (token_hash)
);

-- ============================================================================
-- 17. NOTIFICATIONS / INFORMATION TABLE (Announcements & Alerts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID, -- NULL = Broadcast to all customers
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'announcement',
  related_product_id UUID,
  related_deal_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign Keys & Constraints
  CONSTRAINT fk_notifications_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_product FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_deal FOREIGN KEY (related_deal_id) REFERENCES deals(id) ON DELETE SET NULL,
  CONSTRAINT chk_notifications_type CHECK (type IN ('deal', 'discount', 'new_product', 'announcement', 'system'))
);

CREATE TABLE IF NOT EXISTS customer_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cnr_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_cnr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_user_notification_read UNIQUE (notification_id, user_id)
);

-- ============================================================================
-- 18. HIGH-PERFORMANCE B-TREE INDEXES
-- ============================================================================
-- Users
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Categories & Products
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);

-- Deals
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_active_window ON deals(is_active, start_at, end_at);

-- Orders & Items
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_deal_id ON order_items(deal_id);

-- Payments & Invoices
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Sessions & Security
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cnr_lookup ON customer_notification_reads(user_id, notification_id);

-- ============================================================================
-- 19. ANALYTICAL & FINANCIAL REAL-TIME VIEWS
-- ============================================================================

-- Real-time dynamic Customer Statement & Debt Balance calculation
CREATE OR REPLACE VIEW v_customer_balances AS
WITH customer_order_totals AS (
  SELECT 
    customer_id,
    COALESCE(SUM(total), 0) AS total_ordered_amount,
    COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS active_orders_amount
  FROM orders
  GROUP BY customer_id
),
customer_payments AS (
  SELECT 
    customer_id,
    COALESCE(SUM(amount), 0) AS total_paid_amount
  FROM payments
  GROUP BY customer_id
)
SELECT 
  c.id AS customer_id,
  c.customer_name,
  c.shop_name,
  c.phone,
  c.address,
  c.status,
  COALESCE(ot.active_orders_amount, 0) AS total_invoiced,
  COALESCE(p.total_paid_amount, 0) AS total_collected,
  (COALESCE(ot.active_orders_amount, 0) - COALESCE(p.total_paid_amount, 0)) AS current_debt_balance
FROM customers c
LEFT JOIN customer_order_totals ot ON c.id = ot.customer_id
LEFT JOIN customer_payments p ON c.id = p.customer_id;

-- Real-time Active Deals with Product details
CREATE OR REPLACE VIEW v_active_deals AS
SELECT 
  d.id AS deal_id,
  d.product_id,
  p.name AS product_name,
  p.brand AS product_brand,
  p.size AS product_size,
  p.packaging AS product_packaging,
  p.units_per_case,
  d.title AS deal_title,
  d.description AS deal_description,
  d.original_price,
  d.deal_price,
  d.discount_percent,
  p.stock AS available_stock,
  p.image_url,
  d.start_at,
  d.end_at
FROM deals d
JOIN products p ON d.product_id = p.id
WHERE d.is_active = TRUE 
  AND NOW() BETWEEN d.start_at AND d.end_at
  AND p.status = 'active';
