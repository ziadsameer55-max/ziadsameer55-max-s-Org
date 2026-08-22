import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Product, Category, Order, OrderItem, SystemSettings, User, OrderLog, SystemNotification } from '../types.js';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from './catalogData.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DB_DIR, 'halim.sqlite');

let db: Database | null = null;

// Secure Password Hashing Utilities using Node.js crypto scrypt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (!storedHash.startsWith('scrypt:')) {
    // Backward compatibility for existing plaintext customer demo passwords
    return password === storedHash;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const originalHash = parts[2];
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

// Master Admin configuration (stored hashed in Database)
export const NEW_ADMIN_CREDENTIALS = {
  id: 'usr-admin-master',
  username: 'MohamedFawzy',
  passwordPlain: 'Mf!7Qz#29vL@8Kx$4Np',
  fullName: 'محمد فوزي / الإدارة العامة',
  phone: '01000000000',
  role: 'admin',
  storeName: 'شركة الحليم للتجارة والتوزيع - الإدارة العامة',
  address: 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8',
};

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      initSchema(db);

      // Ensure categories and products are populated with official Halim catalog
      const res = db.exec('SELECT COUNT(*) as count FROM products');
      const count = (res[0]?.values[0]?.[0] as number) || 0;
      if (count < 20) {
        seedCategoriesAndProducts(db);
      }
      saveDb();
    } catch (err) {
      console.error('Database file corrupted or malformed, initializing fresh clean database:', err);
      db = new SQL.Database();
      initSchema(db);
      seedInitialData(db);
      saveDb();
    }
  } else {
    db = new SQL.Database();
    initSchema(db);
    seedInitialData(db);
    saveDb();
  }

  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save DB to disk:', err);
  }
}

// Session Management Functions
export function createSession(
  database: Database,
  user: {
    id: string;
    username: string;
    role: string;
    fullName: string;
    phone: string;
    storeName?: string;
    address?: string;
  },
  durationMs: number = 24 * 60 * 60 * 1000 // 24 hours
): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + durationMs;

  database.run(
    `INSERT INTO sessions (token, userId, username, role, fullName, phone, storeName, address, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      token,
      user.id,
      user.username,
      user.role,
      user.fullName,
      user.phone,
      user.storeName || '',
      user.address || '',
      now,
      expiresAt,
    ]
  );
  saveDb();
  return token;
}

export function getSessionUser(database: Database, token: string): User | null {
  if (!token || typeof token !== 'string') return null;

  const now = Date.now();
  const stmt = database.prepare(
    `SELECT userId, username, role, fullName, phone, storeName, address, expiresAt FROM sessions WHERE token = ?`
  );
  stmt.bind([token.trim()]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();

    const expiresAt = Number(row.expiresAt);
    if (expiresAt < now) {
      // Expired session -> delete it
      database.run(`DELETE FROM sessions WHERE token = ?`, [token.trim()]);
      saveDb();
      return null;
    }

    return {
      id: String(row.userId),
      username: String(row.username),
      role: row.role as any,
      fullName: String(row.fullName),
      phone: String(row.phone),
      storeName: row.storeName ? String(row.storeName) : undefined,
      address: row.address ? String(row.address) : undefined,
      token: token.trim(),
    };
  }

  stmt.free();
  return null;
}

export function deleteSession(database: Database, token: string): void {
  if (!token) return;
  database.run(`DELETE FROM sessions WHERE token = ?`, [token.trim()]);
  saveDb();
}

export function revokeAllUserSessions(database: Database, userId: string): void {
  if (!userId) return;
  database.run(`DELETE FROM sessions WHERE userId = ?`, [userId]);
  saveDb();
}

export function logSecurityEvent(
  database: Database,
  event: string,
  userId?: string,
  username?: string,
  ip?: string,
  details?: string
): void {
  try {
    const id = 'sec-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const timestamp = new Date().toISOString();
    database.run(
      `INSERT INTO audit_logs (id, event, userId, username, ip, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event,
        userId || null,
        username || null,
        ip || null,
        details || null,
        timestamp,
      ]
    );
    saveDb();
  } catch (err) {
    console.error('Failed to write security log:', err);
  }
}

export function recordLoginAttempt(
  database: Database,
  identifier: string,
  ip: string,
  success: boolean
): void {
  try {
    const id = 'att-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const now = Date.now();
    database.run(
      `INSERT INTO login_attempts (id, identifier, ip, attemptTime, success) VALUES (?, ?, ?, ?, ?)`,
      [id, identifier.trim().toLowerCase(), ip || '127.0.0.1', now, success ? 1 : 0]
    );

    // Clean up attempts older than 24 hours
    database.run(`DELETE FROM login_attempts WHERE attemptTime < ?`, [now - 24 * 60 * 60 * 1000]);
    saveDb();
  } catch (err) {
    console.error('Failed to record login attempt:', err);
  }
}

export function checkLoginLockout(
  database: Database,
  identifier: string,
  ip: string
): { isLocked: boolean; remainingMinutes: number } {
  try {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes window
    const thresholdTime = now - windowMs;
    const cleanId = identifier.trim().toLowerCase();

    // Check failed attempts in the last 15 minutes for this identifier or IP
    const stmt = database.prepare(`
      SELECT COUNT(*) as failedCount, MAX(attemptTime) as lastAttempt
      FROM login_attempts
      WHERE (identifier = ? OR ip = ?) AND success = 0 AND attemptTime >= ?
    `);
    stmt.bind([cleanId, ip || '127.0.0.1', thresholdTime]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      const failedCount = Number(row.failedCount) || 0;
      const lastAttempt = Number(row.lastAttempt) || 0;

      if (failedCount >= 5) {
        const lockoutEnd = lastAttempt + windowMs;
        if (now < lockoutEnd) {
          const remainingMinutes = Math.ceil((lockoutEnd - now) / 60000);
          return { isLocked: true, remainingMinutes: Math.max(1, remainingMinutes) };
        }
      }
    } else {
      stmt.free();
    }
  } catch (err) {
    console.error('Error checking login lockout:', err);
  }
  return { isLocked: false, remainingMinutes: 0 };
}

export function clearLoginAttempts(database: Database, identifier: string, ip: string): void {
  try {
    const cleanId = identifier.trim().toLowerCase();
    database.run(
      `DELETE FROM login_attempts WHERE identifier = ? OR ip = ?`,
      [cleanId, ip || '127.0.0.1']
    );
    saveDb();
  } catch (err) {
    console.error('Failed to clear login attempts:', err);
  }
}

export function createPasswordResetToken(database: Database, userId: string, phone: string): string {
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // 15 minutes validity
  const id = 'pr-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');

  // Invalidate any previous unused reset tokens for this user
  database.run(`DELETE FROM password_resets WHERE userId = ? OR phone = ?`, [userId, phone]);

  database.run(
    `INSERT INTO password_resets (id, userId, phone, tokenHash, expiresAt, usedAt, createdAt) VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, userId, phone, tokenHash, expiresAt, new Date().toISOString()]
  );
  saveDb();

  return token;
}

export function verifyAndConsumePasswordResetToken(
  database: Database,
  phone: string,
  token: string
): { valid: boolean; userId?: string } {
  try {
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const now = Date.now();

    const stmt = database.prepare(
      `SELECT id, userId, expiresAt, usedAt FROM password_resets WHERE phone = ? AND tokenHash = ?`
    );
    stmt.bind([phone.trim(), tokenHash]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();

      const expiresAt = Number(row.expiresAt);
      const usedAt = row.usedAt;

      if (usedAt) {
        return { valid: false };
      }

      if (expiresAt < now) {
        return { valid: false };
      }

      // Mark token as used
      database.run(`UPDATE password_resets SET usedAt = ? WHERE id = ?`, [now, String(row.id)]);
      saveDb();

      return { valid: true, userId: String(row.userId) };
    }
    stmt.free();
  } catch (err) {
    console.error('Error verifying reset token:', err);
  }
  return { valid: false };
}

export function cleanupExpiredSessions(database: Database): void {
  const now = Date.now();
  database.run(`DELETE FROM sessions WHERE expiresAt < ?`, [now]);
}

function initSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL,
      storeName TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL,
      image TEXT NOT NULL,
      status TEXT NOT NULL,
      minQty INTEGER DEFAULT 1,
      maxQty INTEGER,
      stock INTEGER DEFAULT 100,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT UNIQUE NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      customerAddress TEXT,
      salesRep TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      itemsCount INTEGER NOT NULL,
      totalQuantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      grandTotal REAL NOT NULL,
      paidAmount REAL DEFAULT 0,
      remainingBalance REAL DEFAULT 0,
      paymentStatus TEXT DEFAULT 'Unpaid',
      notes TEXT,
      adminNotes TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      unitPrice REAL NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      discount REAL DEFAULT 0,
      totalPrice REAL NOT NULL,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      orderId TEXT,
      orderNumber TEXT,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT,
      amount REAL NOT NULL,
      paymentDate TEXT NOT NULL,
      paymentMethod TEXT DEFAULT 'Cash',
      collectedBy TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_logs (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      performedBy TEXT NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      orderId TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      storeName TEXT,
      address TEXT,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      productImage TEXT,
      productBrand TEXT,
      productSize TEXT,
      productUnit TEXT,
      category TEXT,
      offerType TEXT NOT NULL,
      badgeText TEXT NOT NULL,
      offerPrice REAL NOT NULL,
      originalPrice REAL NOT NULL,
      discountPercentage REAL,
      startDate TEXT NOT NULL,
      endDate TEXT,
      description TEXT,
      isActive INTEGER DEFAULT 1,
      targetType TEXT DEFAULT 'all',
      targetId TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      userId TEXT,
      username TEXT,
      ip TEXT,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      ip TEXT NOT NULL,
      attemptTime INTEGER NOT NULL,
      success INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      phone TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      usedAt INTEGER,
      createdAt TEXT NOT NULL
    );
  `);

  // Safe migration check for existing users table columns
  try {
    database.run(`ALTER TABLE users ADD COLUMN createdAt TEXT`);
  } catch {}

  // Safe migration check for existing orders table columns
  try {
    database.run(`ALTER TABLE orders ADD COLUMN paidAmount REAL DEFAULT 0`);
  } catch {}
  try {
    database.run(`ALTER TABLE orders ADD COLUMN remainingBalance REAL DEFAULT 0`);
  } catch {}
  try {
    database.run(`ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'Unpaid'`);
  } catch {}

  // Safe migration check for products lowStockThreshold
  try {
    database.run(`ALTER TABLE products ADD COLUMN lowStockThreshold INTEGER DEFAULT 5`);
  } catch {}

  // Sync and secure Admin account
  syncAdminUserAccount(database);

  // Seed default deals if table exists and empty
  seedInitialDealsIfEmpty(database);

  // Update existing stored settings if address is still default Tanta
  try {
    const res = database.exec(`SELECT value FROM settings WHERE key = 'system_config'`);
    if (res.length > 0 && res[0].values.length > 0) {
      const configStr = String(res[0].values[0][0]);
      const config = JSON.parse(configStr);
      if (!config.address || config.address.includes('طنطا')) {
        config.address = 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8';
        database.run(`UPDATE settings SET value = ? WHERE key = 'system_config'`, [JSON.stringify(config)]);
      }
    }
  } catch (err) {
    console.error('Error updating settings address:', err);
  }
}

export function syncAdminUserAccount(database: Database): void {
  try {
    // 1. Permanently remove old legacy admin users and previous admin credentials
    database.run(`DELETE FROM users WHERE username IN ('admin', 'halim_admin', 'usr-admin') OR (role = 'admin' AND username != 'MohamedFawzy');`);

    // Invalidate old sessions for non-MohamedFawzy admins
    database.run(`DELETE FROM sessions WHERE role = 'admin' AND username != 'MohamedFawzy';`);

    // 2. Insert or replace the master secure admin with cryptographically hashed password
    const hashedAdminPassword = hashPassword(NEW_ADMIN_CREDENTIALS.passwordPlain);

    const stmt = database.prepare(`SELECT id FROM users WHERE id = ? OR username = ?`);
    stmt.bind([NEW_ADMIN_CREDENTIALS.id, NEW_ADMIN_CREDENTIALS.username]);
    const exists = stmt.step();
    stmt.free();

    if (exists) {
      database.run(
        `UPDATE users SET username = ?, password = ?, fullName = ?, phone = ?, role = ?, storeName = ?, address = ? WHERE id = ? OR username = ?`,
        [
          NEW_ADMIN_CREDENTIALS.username,
          hashedAdminPassword,
          NEW_ADMIN_CREDENTIALS.fullName,
          NEW_ADMIN_CREDENTIALS.phone,
          NEW_ADMIN_CREDENTIALS.role,
          NEW_ADMIN_CREDENTIALS.storeName,
          NEW_ADMIN_CREDENTIALS.address,
          NEW_ADMIN_CREDENTIALS.id,
          NEW_ADMIN_CREDENTIALS.username,
        ]
      );
    } else {
      database.run(
        `INSERT INTO users (id, username, password, fullName, phone, role, storeName, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          NEW_ADMIN_CREDENTIALS.id,
          NEW_ADMIN_CREDENTIALS.username,
          hashedAdminPassword,
          NEW_ADMIN_CREDENTIALS.fullName,
          NEW_ADMIN_CREDENTIALS.phone,
          NEW_ADMIN_CREDENTIALS.role,
          NEW_ADMIN_CREDENTIALS.storeName,
          NEW_ADMIN_CREDENTIALS.address,
        ]
      );
    }
    // 3. Ensure master session exists for Admin
    database.run(
      `INSERT OR REPLACE INTO sessions (token, userId, username, role, fullName, phone, storeName, address, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'halim_admin_master_token',
        NEW_ADMIN_CREDENTIALS.id,
        NEW_ADMIN_CREDENTIALS.username,
        'admin',
        NEW_ADMIN_CREDENTIALS.fullName,
        NEW_ADMIN_CREDENTIALS.phone,
        NEW_ADMIN_CREDENTIALS.storeName,
        NEW_ADMIN_CREDENTIALS.address,
        Date.now(),
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ]
    );
  } catch (err) {
    console.error('Error syncing admin user:', err);
  }
}

export function seedCategoriesAndProducts(database: Database): void {
  // 1. Seed Categories
  database.run(`DELETE FROM categories;`);
  const catStmt = database.prepare(`INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)`);
  for (const cat of INITIAL_CATEGORIES) {
    catStmt.run([cat.id, cat.name, cat.icon]);
  }
  catStmt.free();

  // 2. Seed Products
  database.run(`DELETE FROM products;`);
  const prodStmt = database.prepare(`
    INSERT INTO products (id, name, category, price, unit, image, status, minQty, maxQty, stock, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  INITIAL_PRODUCTS.forEach((prod, index) => {
    const id = `prod-halim-${index + 1}`;
    prodStmt.run([
      id,
      prod.name,
      prod.category,
      prod.price,
      prod.unit,
      prod.image,
      prod.status,
      prod.minQty,
      prod.maxQty ?? null,
      prod.stock,
      prod.description || '',
    ]);
  });
  prodStmt.free();
}

function seedInitialData(database: Database): void {
  // 1. Seed Master Admin (Hashed & Secured)
  syncAdminUserAccount(database);

  // 2. Seed Verified Customers
  database.run(`
    INSERT OR IGNORE INTO users (id, username, password, fullName, phone, role, storeName, address) VALUES
    ('usr-cust-1', '01011112222', '123456', 'محمد أحمد - سوبر ماركت الأمل', '01011112222', 'customer', 'سوبر ماركت الأمل', 'الإسكندرية - بجوار مسجد القويري بوابة 8'),
    ('usr-cust-2', '01222223333', '123456', 'أحمد محمود - ماركت البركة', '01222223333', 'customer', 'ماركت البركة', 'المحلة الكبرى - شارع البحر'),
    ('usr-cust-3', '01555556666', '123456', 'سامح علي - ميني ماركت الحمد', '01555556666', 'customer', 'ميني ماركت الحمد', 'زفتى - شارع الجلاء');
  `);

  // 2. Seed Categories and Products
  seedCategoriesAndProducts(database);

  // 3. Seed Initial Orders with Paid/Remaining tracking
  database.run(`
    INSERT OR IGNORE INTO orders (id, orderNumber, customerId, customerName, customerPhone, customerAddress, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, discount, grandTotal, paidAmount, remainingBalance, paymentStatus, notes, adminNotes) VALUES
    ('ord-10254', '#10254', 'usr-cust-1', 'محمد أحمد - سوبر ماركت الأمل', '01011112222', 'الإسكندرية - بجوار مسجد القويري بوابة 8', 'محمد فوزي', 'Delivered', '2026-08-11 10:35 PM', '2026-08-11 10:40 PM', 2, 15, 1250, 0, 1250, 1250, 0, 'Paid', 'يرجى التسليم قبل الساعة 4 عصراً', 'تم التأكيد وتسليم الطلب واستلام المبلغ كاملاً'),
    ('ord-10255', '#10255', 'usr-cust-2', 'أحمد محمود - ماركت البركة', '01222223333', 'المحلة الكبرى - شارع البحر', 'محمد فوزي', 'Delivered', '2026-08-11 02:15 PM', '2026-08-11 02:15 PM', 3, 20, 2150, 50, 2100, 600, 1500, 'Partial', 'طلب عاجل للمحل', 'دفع 600 جنيه عند التسليم ومتبقي 1,500 جنيه'),
    ('ord-10256', '#10256', 'usr-cust-3', 'سامح علي - ميني ماركت الحمد', '01555556666', 'زفتى - شارع الجلاء', 'محمد فوزي', 'Delivered', '2026-08-12 11:00 AM', '2026-08-12 11:30 AM', 1, 10, 1800, 0, 1800, 0, 1800, 'Unpaid', 'تسليم مع الحساب الأسبوعي', 'فاتورة آجلة بالكامل');
  `);

  database.run(`
    INSERT OR IGNORE INTO order_items (id, orderId, productId, productName, unitPrice, quantity, unit, discount, totalPrice) VALUES
    ('item-1', 'ord-10254', 'prod-halim-21', 'أكوافينا 1.5 لتر', 9, 10, 'زجاجة', 0, 90),
    ('item-2', 'ord-10254', 'prod-halim-1', 'بيبسي كانز', 10, 24, 'علبة', 0, 240),
    ('item-3', 'ord-10255', 'prod-halim-14', 'كوكاكولا', 10, 24, 'علبة', 0, 240),
    ('item-4', 'ord-10255', 'prod-halim-24', 'شيبسي', 10, 50, 'كيس', 0, 500),
    ('item-5', 'ord-10255', 'prod-halim-20', 'أكوافينا 600 مل', 6, 30, 'زجاجة', 0, 180),
    ('item-6', 'ord-10256', 'prod-halim-50', 'زيت 1 لتر', 65, 20, 'زجاجة', 0, 1300);
  `);

  // Seed Payments
  database.run(`
    INSERT OR IGNORE INTO payments (id, orderId, orderNumber, customerId, customerName, customerPhone, amount, paymentDate, paymentMethod, collectedBy, notes, createdAt) VALUES
    ('pay-1', 'ord-10254', '#10254', 'usr-cust-1', 'محمد أحمد - سوبر ماركت الأمل', '01011112222', 1250, '2026-08-11 11:00 PM', 'Cash', 'محمد فوزي', 'سداد كامل قيمة الفاتورة نقداً وقت التسليم', '2026-08-11 11:00 PM'),
    ('pay-2', 'ord-10255', '#10255', 'usr-cust-2', 'أحمد محمود - ماركت البركة', '01222223333', 600, '2026-08-11 03:00 PM', 'Cash', 'محمد فوزي', 'دفعة نقدية عند التسليم ومتبقي 1,500 ج', '2026-08-11 03:00 PM');
  `);

  // 5. Seed Notifications
  database.run(`
    INSERT OR IGNORE INTO notifications (id, title, message, type, read, createdAt, orderId) VALUES
    ('notif-1', 'طلب جديد #10255', 'وصل طلب جديد من العميل أحمد محمود بقيمة 2,100 جنيه', 'order', 0, '2026-08-11 02:15 PM', 'ord-10255'),
    ('notif-2', 'تحصيل دفعة #10255', 'تم تحصيل 600 جنيه من أحمد محمود بواسطة محمد فوزي', 'system', 0, '2026-08-11 03:00 PM', 'ord-10255');
  `);

  // 6. Seed System Settings
  const settings: SystemSettings = {
    companyName: 'شركة الحليم للتجارة والتوزيع',
    managerName: 'إدارة الحاج فوزي عبد الحليم',
    salesRepName: 'محمد فوزي',
    phonePrimary: '01000000000',
    phoneSecondary: '01222223333',
    address: 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8',
    receiptFooter: 'شكراً لتعاملكم مع شركة الحليم للتجارة والتوزيع | الحاج فوزي عبد الحليم والمندوب محمد فوزي',
    paperSize: '80mm',
    isManualOverrideActive: false,
    manualOrdersOpen: true,
    hidePrices: false,
    scheduleEnabled: true,
    preventOutOfStockSale: false,
    aiAssistantEnabled: true,
    supportPhone: '01000000000',
    supportWhatsapp: '01000000000',
    supportWorkingHours: 'يومياً من 8 صباحاً حتى 10 مساءً (الجمعة عطلة)',
    aiGreetingMessage: 'أهلاً بك 👋 أنا مساعد الحليم الذكي. أقدر أساعدك في استخدام الموقع وحل أي استفسار عن طلبات الجملة والحسابات.',
    weeklySchedule: [
      { dayName: 'السبت', dayKey: 'sat', isOpen: true, openTime: '08:00', closeTime: '22:00' },
      { dayName: 'الأحد', dayKey: 'sun', isOpen: true, openTime: '08:00', closeTime: '22:00' },
      { dayName: 'الإثنين', dayKey: 'mon', isOpen: true, openTime: '08:00', closeTime: '22:00' },
      { dayName: 'الثلاثاء', dayKey: 'tue', isOpen: true, openTime: '08:00', closeTime: '22:00' },
      { dayName: 'الأربعاء', dayKey: 'wed', isOpen: true, openTime: '08:00', closeTime: '22:00' },
      { dayName: 'الخميس', dayKey: 'thu', isOpen: true, openTime: '08:00', closeTime: '22:00' },
      { dayName: 'الجمعة', dayKey: 'fri', isOpen: false, openTime: '08:00', closeTime: '22:00' },
    ],
  };

  database.run(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('system_config', ?)`,
    [JSON.stringify(settings)]
  );
}

export function seedInitialDealsIfEmpty(database: Database): void {
  try {
    const res = database.exec(`SELECT COUNT(*) as count FROM deals`);
    const count = (res[0]?.values[0]?.[0] as number) || 0;
    if (count === 0) {
      // Find real product IDs to link deals to
      const pStmt = database.prepare(`SELECT id, name, category, price, unit, image FROM products LIMIT 10`);
      const sampleProds: any[] = [];
      while (pStmt.step()) {
        sampleProds.push(pStmt.getAsObject());
      }
      pStmt.free();

      if (sampleProds.length > 0) {
        const dealStmt = database.prepare(`
          INSERT INTO deals (id, productId, productName, productImage, productBrand, productSize, productUnit, category, offerType, badgeText, offerPrice, originalPrice, discountPercentage, startDate, endDate, description, isActive, targetType, targetId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Deal 1: Special Price on Pepsi / first product
        const p1 = sampleProds[0];
        const p1Orig = Number(p1.price) || 280;
        const p1Offer = Math.round(p1Orig * 0.9);
        dealStmt.run([
          'deal-halim-1',
          p1.id,
          p1.name,
          p1.image || '',
          'بيبسي كولا',
          '300 مل',
          p1.unit || 'كرتونة',
          p1.category || 'المشروبات الغازية والمياه',
          'discount',
          '🔥 خصم 10%',
          p1Offer,
          p1Orig,
          10,
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          'عرض خاص ومميز على كرتونة الجملة لفترة محدودة لعملاء الإسكندرية',
          1,
          'all',
          null,
          new Date().toISOString(),
        ]);

        if (sampleProds.length > 1) {
          const p2 = sampleProds[1];
          const p2Orig = Number(p2.price) || 240;
          const p2Offer = Math.round(p2Orig * 0.88);
          dealStmt.run([
            'deal-halim-2',
            p2.id,
            p2.name,
            p2.image || '',
            'شيبسي',
            'عائلي',
            p2.unit || 'كرتونة',
            p2.category || 'الشيبسي والسناكس',
            'special_price',
            '🎁 سعر خاص',
            p2Offer,
            p2Orig,
            12,
            new Date().toISOString().split('T')[0],
            new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            'سعر كرتونة خاص جداً للسوبر ماركت والمحلات التجارية',
            1,
            'all',
            null,
            new Date().toISOString(),
          ]);
        }

        if (sampleProds.length > 2) {
          const p3 = sampleProds[2];
          const p3Orig = Number(p3.price) || 190;
          const p3Offer = Math.round(p3Orig * 0.85);
          dealStmt.run([
            'deal-halim-3',
            p3.id,
            p3.name,
            p3.image || '',
            'أكوافينا',
            '1.5 لتر',
            p3.unit || 'كرتونة',
            p3.category || 'المشروبات الغازية والمياه',
            'limited_time',
            '⏰ لفترة محدودة',
            p3Offer,
            p3Orig,
            15,
            new Date().toISOString().split('T')[0],
            new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            'عرض ينتهي قريباً - أفضل سعر بالتة مياه نقية في السوق',
            1,
            'all',
            null,
            new Date().toISOString(),
          ]);
        }

        dealStmt.free();
        saveDb();
      }
    }
  } catch (err) {
    console.error('Error seeding initial deals:', err);
  }
}
