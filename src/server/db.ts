import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { Product, Category, Order, OrderItem, SystemSettings, User, OrderLog, SystemNotification } from '../types.js';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from './catalogData.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DB_DIR, 'halim.sqlite');

let db: Database | null = null;

// Secure Password Hashing Utilities using Argon2id
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB memory
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  // 1. Argon2id / Argon2 hash verification
  if (storedHash.startsWith('$argon2')) {
    try {
      return await argon2.verify(storedHash, password);
    } catch {
      return false;
    }
  }

  // 2. Scrypt and PBKDF2 backward compatibility
  if (storedHash.startsWith('scrypt:') || storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const scheme = parts[0];
    const salt = parts[1];
    const originalHash = parts[2];
    
    if (scheme === 'scrypt') {
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
    } else if (scheme === 'pbkdf2') {
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
    }
  }

  // 3. Plaintext legacy fallback
  return password === storedHash;
}

// Password Validation Policy
// Minimum 6 characters (Letters only, numbers only, letters+numbers, uppercase/lowercase allowed)
export function validateStrongPassword(password: string): { valid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'يرجى إدخال كلمة المرور' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'كلمة المرور يجب ألا تقل عن 6 خانات.' };
  }

  return { valid: true };
}

// Master Admin configuration (stored hashed in Database)
const INITIAL_ADMIN_CONFIG = {
  id: 'usr-admin-master',
  username: 'mohamed.fawzy',
  passwordPlain: process.env.ADMIN_INITIAL_PASSWORD || 'Hamo2000#$',
  fullName: 'Mohamed Fawzy',
  phone: '+201280304043',
  role: 'admin',
  storeName: 'شركة الحليم للتجارة والتوزيع - الإدارة العامة (Owner / Master Admin)',
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
      await initSchema(db);

      // Ensure categories are populated if empty
      const catRes = db.exec('SELECT COUNT(*) as count FROM categories');
      const catCount = (catRes[0]?.values[0]?.[0] as number) || 0;
      if (catCount === 0) {
        seedCategories(db);
      }
      await syncAdminUserAccount(db);
      saveDb();
    } catch (err) {
      console.error('Database file corrupted or malformed, initializing fresh clean database:', err);
      db = new SQL.Database();
      await initSchema(db);
      await seedInitialData(db);
      saveDb();
    }
  } else {
    db = new SQL.Database();
    await initSchema(db);
    await seedInitialData(db);
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
    `SELECT s.userId, s.username, s.role, s.fullName, s.phone, s.storeName, s.address, s.expiresAt, u.status 
     FROM sessions s 
     LEFT JOIN users u ON s.userId = u.id 
     WHERE s.token = ?`
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

    if (row.status === 'disabled') {
      // Disabled user -> revoke session
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
      status: (row.status as any) || 'active',
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
    const cleanId = identifier ? identifier.trim().toLowerCase() : '';
    const cleanIp = ip || '127.0.0.1';

    // 1. Account-specific lockout: 5 failed attempts on the same phone/username locks that account
    if (cleanId) {
      const stmt = database.prepare(`
        SELECT COUNT(*) as failedCount, MAX(attemptTime) as lastAttempt
        FROM login_attempts
        WHERE identifier = ? AND success = 0 AND attemptTime >= ?
      `);
      stmt.bind([cleanId, thresholdTime]);

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
    }

    // 2. IP-wide brute force lockout: 30 failed attempts from external non-loopback IP
    const isLoopback = cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost';
    if (!isLoopback) {
      const ipStmt = database.prepare(`
        SELECT COUNT(*) as failedCount, MAX(attemptTime) as lastAttempt
        FROM login_attempts
        WHERE ip = ? AND success = 0 AND attemptTime >= ?
      `);
      ipStmt.bind([cleanIp, thresholdTime]);

      if (ipStmt.step()) {
        const row = ipStmt.getAsObject();
        ipStmt.free();
        const failedCount = Number(row.failedCount) || 0;
        const lastAttempt = Number(row.lastAttempt) || 0;

        if (failedCount >= 30) {
          const lockoutEnd = lastAttempt + windowMs;
          if (now < lockoutEnd) {
            const remainingMinutes = Math.ceil((lockoutEnd - now) / 60000);
            return { isLocked: true, remainingMinutes: Math.max(1, remainingMinutes) };
          }
        }
      } else {
        ipStmt.free();
      }
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

export async function cleanupExpiredSessions(database: Database): Promise<void> {
  const now = Date.now();
  database.run(`DELETE FROM sessions WHERE expiresAt < ?`, [now]);
}

export async function initSchema(database: Database): Promise<void> {
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

    CREATE TABLE IF NOT EXISTS information (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      targetType TEXT DEFAULT 'all',
      targetId TEXT,
      targetName TEXT,
      productId TEXT,
      productName TEXT,
      productImage TEXT,
      productUnit TEXT,
      oldPrice REAL,
      newPrice REAL,
      priceChangePercentage REAL,
      status TEXT DEFAULT 'published',
      publishedAt TEXT NOT NULL,
      expiresAt TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS information_reads (
      id TEXT PRIMARY KEY,
      informationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      readAt TEXT NOT NULL,
      UNIQUE(informationId, userId)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customerId ON orders(customerId);
    CREATE INDEX IF NOT EXISTS idx_orders_customerPhone ON orders(customerPhone);
    CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
    CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);
    CREATE INDEX IF NOT EXISTS idx_order_items_productId ON order_items(productId);
    CREATE INDEX IF NOT EXISTS idx_payments_orderId ON payments(orderId);
    CREATE INDEX IF NOT EXISTS idx_payments_customerId ON payments(customerId);
    CREATE INDEX IF NOT EXISTS idx_deals_productId ON deals(productId);
    CREATE INDEX IF NOT EXISTS idx_deals_isActive ON deals(isActive);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ident ON login_attempts(identifier, attemptTime);
  `);

  // Safe migration check for existing users table columns
  try {
    database.run(`ALTER TABLE users ADD COLUMN createdAt TEXT`);
  } catch {}
  try {
    database.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
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
  await syncAdminUserAccount(database);

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

  // Seed sample initial information if none exists
  try {
    const infoCount = database.exec(`SELECT COUNT(*) FROM information`);
    const count = (infoCount[0]?.values[0]?.[0] as number) || 0;
    if (count === 0) {
      const now = new Date().toISOString();
      const stmt = database.prepare(`
        INSERT INTO information (
          id, title, content, type, priority, targetType, targetId, targetName,
          productId, productName, productImage, productUnit, oldPrice, newPrice, priceChangePercentage,
          status, publishedAt, expiresAt, createdBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        'info-welcome-1',
        'مرحباً بكم في منصة شركة الحليم للتجارة والتوزيع 🌟',
        'يسر إدارة شركة الحليم للتجارة والتوزيع ومندوب المبيعات محمد فوزي الترحيب بكم في منصة طلبات الجملة المباشرة. يمكنكم تصفح أحدث عروض وأسعار المواد الغذائية والكانز والمشروبات وإرسال طلباتكم الفورية ومتابعة مديونياتكم بكل سهولة وشفافية.',
        'general',
        'high',
        'all',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'published',
        now,
        null,
        'إدارة شركة الحليم',
        now,
        now,
      ]);

      stmt.run([
        'info-delivery-2',
        'مواعيد التوصيل وخطوط السير في محافظة الإسكندرية 🚚',
        'نحيط عملاءنا الكرام علماً بأن التوصيل يتم بصورة يومية لكافة مناطق الإسكندرية. نرجو تسجيل طلبياتكم قبل الساعة 2 ظهراً لضمان التحميل مع دوريات اليوم نفسه. للتواصل المباشر مع المندوب محمد فوزي: 01000000000.',
        'policy',
        'normal',
        'all',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'published',
        now,
        null,
        'إدارة التوزيع',
        now,
        now,
      ]);

      stmt.free();
      saveDb();
    }
  } catch (err) {
    console.error('Error seeding initial information:', err);
  }
}

export async function syncAdminUserAccount(database: Database): Promise<void> {
  try {
    // 1. Permanently remove old legacy admin users and previous admin credentials
    database.run(`DELETE FROM users WHERE username IN ('admin', 'halim_admin', 'usr-admin', 'MohamedFawzy') OR (role = 'admin' AND username != 'mohamed.fawzy');`);

    // Invalidate old sessions for non-mohamed.fawzy admins
    database.run(`DELETE FROM sessions WHERE role = 'admin' AND username != 'mohamed.fawzy';`);

    // 2. Insert or replace the master secure admin with cryptographically hashed password (Argon2id)
    const hashedAdminPassword = await hashPassword(INITIAL_ADMIN_CONFIG.passwordPlain);

    const stmt = database.prepare(`SELECT id FROM users WHERE id = ? OR username = ?`);
    stmt.bind([INITIAL_ADMIN_CONFIG.id, INITIAL_ADMIN_CONFIG.username]);
    const exists = stmt.step();
    stmt.free();

    if (exists) {
      database.run(
        `UPDATE users SET username = ?, password = ?, fullName = ?, phone = ?, role = ?, storeName = ?, address = ? WHERE id = ? OR username = ?`,
        [
          INITIAL_ADMIN_CONFIG.username,
          hashedAdminPassword,
          INITIAL_ADMIN_CONFIG.fullName,
          INITIAL_ADMIN_CONFIG.phone,
          INITIAL_ADMIN_CONFIG.role,
          INITIAL_ADMIN_CONFIG.storeName,
          INITIAL_ADMIN_CONFIG.address,
          INITIAL_ADMIN_CONFIG.id,
          INITIAL_ADMIN_CONFIG.username,
        ]
      );
    } else {
      database.run(
        `INSERT INTO users (id, username, password, fullName, phone, role, storeName, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          INITIAL_ADMIN_CONFIG.id,
          INITIAL_ADMIN_CONFIG.username,
          hashedAdminPassword,
          INITIAL_ADMIN_CONFIG.fullName,
          INITIAL_ADMIN_CONFIG.phone,
          INITIAL_ADMIN_CONFIG.role,
          INITIAL_ADMIN_CONFIG.storeName,
          INITIAL_ADMIN_CONFIG.address,
        ]
      );
    }
  } catch (err) {
    console.error('Error syncing admin user:', err);
  }
}

export function seedCategories(database: Database): void {
  // 1. Seed Categories if empty
  database.run(`DELETE FROM categories;`);
  const catStmt = database.prepare(`INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)`);
  for (const cat of INITIAL_CATEGORIES) {
    catStmt.run([cat.id, cat.name, cat.icon]);
  }
  catStmt.free();
}

export function seedCategoriesAndProducts(database: Database): void {
  // 1. Seed Categories
  seedCategories(database);

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

async function seedInitialData(database: Database): Promise<void> {
  // 1. Seed Master Admin (Hashed & Secured with Argon2id)
  await syncAdminUserAccount(database);

  // Seed standard/sample customer accounts if they don't exist
  try {
    const demoPassword = process.env.DEMO_CUSTOMER_PASSWORD || 'Customer2026!#';
    const hashedDemoPassword = await hashPassword(demoPassword);
    const demoCustomers = [
      {
        id: 'usr-cust-nour-1',
        username: '01011112222',
        password: hashedDemoPassword,
        fullName: 'أحمد محمود (سوبر ماركت النور)',
        phone: '01011112222',
        role: 'customer',
        storeName: 'سوبر ماركت النور',
        address: 'العجمي - الهانوفيل - شارع مسجد القويري',
      },
      {
        id: 'usr-cust-ekhlas-2',
        username: '01234567890',
        password: hashedDemoPassword,
        fullName: 'محمد علي (سوبر ماركت الإخلاص)',
        phone: '01234567890',
        role: 'customer',
        storeName: 'سوبر ماركت الإخلاص',
        address: 'سيدي بشر - شارع خالد بن الوليد',
      },
    ];

    for (const cust of demoCustomers) {
      const checkStmt = database.prepare('SELECT id FROM users WHERE phone = ? OR username = ?');
      checkStmt.bind([cust.phone, cust.username]);
      const exists = checkStmt.step();
      checkStmt.free();

      if (!exists) {
        database.run(
          `INSERT INTO users (id, username, password, fullName, phone, role, storeName, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [cust.id, cust.username, cust.password, cust.fullName, cust.phone, cust.role, cust.storeName, cust.address]
        );
      }
    }
  } catch (err) {
    console.error('Error seeding demo customers:', err);
  }

  // 2. Seed Official Categories
  seedCategories(database);

  // 3. Seed Official System Settings
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
