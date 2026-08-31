-- ============================================================================
-- HALIM TRADING & DISTRIBUTION - PRODUCTION POSTGRESQL SCHEMA (DDL)
-- High Performance, Data Integrity, Financial Accuracy & Strict Isolation
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0.1 ENUMS & DOMAIN TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'customer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('active', 'locked', 'hidden', 'archived', 'out_of_stock');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending',
        'reviewing',
        'confirmed',
        'processing',
        'ready',
        'out_for_delivery',
        'delivered',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'cheque', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('issued', 'partial', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('deal', 'discount', 'new_product', 'announcement', 'system', 'order');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('usr_' || encode(gen_random_bytes(12), 'hex')),
    username VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    status user_status NOT NULL DEFAULT 'active',
    store_name VARCHAR(150),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    CONSTRAINT chk_phone_valid CHECK (length(phone) >= 8)
);

-- ============================================================================
-- 2. CUSTOMERS TABLE (Strict 1-to-1 Relationship with Users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('cust_' || encode(gen_random_bytes(12), 'hex')),
    user_id VARCHAR(64) UNIQUE NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    shop_name VARCHAR(150),
    phone VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    icon VARCHAR(50),
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'hidden')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    category_id VARCHAR(64),
    category_name VARCHAR(100) NOT NULL,
    size VARCHAR(50),
    packaging VARCHAR(50),
    units_per_case INT NOT NULL DEFAULT 1 CHECK (units_per_case >= 1),
    unit_type VARCHAR(50) NOT NULL DEFAULT 'كرتونة',
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_alert_threshold INT NOT NULL DEFAULT 5 CHECK (stock_alert_threshold >= 0),
    min_qty INT NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
    max_qty INT CHECK (max_qty IS NULL OR max_qty >= min_qty),
    status product_status NOT NULL DEFAULT 'active',
    image_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================================================
-- 5. DEALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('deal_' || encode(gen_random_bytes(8), 'hex')),
    product_id VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    original_price NUMERIC(12, 2) NOT NULL CHECK (original_price >= 0),
    deal_price NUMERIC(12, 2) NOT NULL CHECK (deal_price >= 0 AND deal_price <= original_price),
    discount_percent NUMERIC(5, 2) GENERATED ALWAYS AS (
        CASE WHEN original_price > 0 THEN ROUND(((original_price - deal_price) / original_price) * 100, 2) ELSE 0 END
    ) STORED,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_deal_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_deal_dates CHECK (end_at IS NULL OR end_at >= start_at)
);

-- ============================================================================
-- 6. ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('ord_' || encode(gen_random_bytes(10), 'hex')),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_address TEXT,
    sales_rep VARCHAR(100) NOT NULL DEFAULT 'محمد فوزي',
    status order_status NOT NULL DEFAULT 'pending',
    items_count INT NOT NULL DEFAULT 0 CHECK (items_count >= 0),
    total_quantity INT NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0 AND paid_amount <= total),
    remaining_amount NUMERIC(12, 2) GENERATED ALWAYS AS (total - paid_amount) STORED,
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    notes TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- ============================================================================
-- 7. ORDER ITEMS TABLE (With Immutable Snapshots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('item_' || encode(gen_random_bytes(10), 'hex')),
    order_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64),
    deal_id VARCHAR(64),
    product_name_snapshot VARCHAR(200) NOT NULL,
    brand_snapshot VARCHAR(100),
    size_snapshot VARCHAR(50),
    packaging_snapshot VARCHAR(50),
    unit_price_snapshot NUMERIC(12, 2) NOT NULL CHECK (unit_price_snapshot >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_type_snapshot VARCHAR(50) NOT NULL DEFAULT 'كرتونة',
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    item_total NUMERIC(12, 2) NOT NULL CHECK (item_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_item_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL
);

-- ============================================================================
-- 8. INVOICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('inv_' || encode(gen_random_bytes(10), 'hex')),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id VARCHAR(64) UNIQUE,
    customer_id VARCHAR(64) NOT NULL,
    invoice_total NUMERIC(12, 2) NOT NULL CHECK (invoice_total >= 0),
    previous_debt NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (previous_debt >= 0),
    total_due NUMERIC(12, 2) NOT NULL CHECK (total_due >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0 AND paid_amount <= total_due),
    remaining_amount NUMERIC(12, 2) GENERATED ALWAYS AS (total_due - paid_amount) STORED,
    status invoice_status NOT NULL DEFAULT 'issued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT chk_total_due_calc CHECK (total_due = previous_debt + invoice_total)
);

-- ============================================================================
-- 9. PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('pay_' || encode(gen_random_bytes(10), 'hex')),
    customer_id VARCHAR(64) NOT NULL,
    order_id VARCHAR(64),
    invoice_id VARCHAR(64),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method payment_method NOT NULL DEFAULT 'cash',
    payment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    collected_by VARCHAR(100) NOT NULL DEFAULT 'محمد فوزي',
    created_by VARCHAR(64) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- ============================================================================
-- 10. SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('set_' || encode(gen_random_bytes(8), 'hex')),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 11. SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('sess_' || encode(gen_random_bytes(12), 'hex')),
    user_id VARCHAR(64) NOT NULL,
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 12. AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('aud_' || encode(gen_random_bytes(12), 'hex')),
    user_id VARCHAR(64),
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(64),
    metadata JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 13. LOGIN ATTEMPTS TABLE (Security & Brute-Force Rate Limiting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('att_' || encode(gen_random_bytes(10), 'hex')),
    identifier VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 14. PASSWORD RESETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('rst_' || encode(gen_random_bytes(10), 'hex')),
    user_id VARCHAR(64) NOT NULL,
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 15. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('notif_' || encode(gen_random_bytes(10), 'hex')),
    customer_id VARCHAR(64),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL DEFAULT 'system',
    related_product_id VARCHAR(64),
    related_deal_id VARCHAR(64),
    related_order_id VARCHAR(64),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_product FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_notif_deal FOREIGN KEY (related_deal_id) REFERENCES deals(id) ON DELETE SET NULL,
    CONSTRAINT fk_notif_order FOREIGN KEY (related_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ============================================================================
-- 16. INDEXES (Optimized for High Throughput & Fast Query Isolation)
-- ============================================================================

-- Users & Customers
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Orders & Order Items
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Invoices & Payments
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);

-- Products & Deals
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_is_active ON deals(is_active) WHERE is_active = true;

-- Sessions & Security
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ident ON login_attempts(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);

-- ============================================================================
-- 17. REAL-TIME CUSTOMER STATEMENT VIEW (Zero Drift Balance Calculation)
-- ============================================================================
CREATE OR REPLACE VIEW view_customer_balances AS
SELECT 
    c.id AS customer_id,
    c.customer_name,
    c.shop_name,
    c.phone,
    COALESCE(SUM(o.total) FILTER (WHERE o.status != 'cancelled'), 0) AS total_orders_amount,
    COALESCE(SUM(p.amount), 0) AS total_payments_amount,
    (COALESCE(SUM(o.total) FILTER (WHERE o.status != 'cancelled'), 0) - COALESCE(SUM(p.amount), 0)) AS current_debt
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
LEFT JOIN payments p ON c.id = p.customer_id
GROUP BY c.id, c.customer_name, c.shop_name, c.phone;
