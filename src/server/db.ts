import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { Product, Category, Order, OrderItem, SystemSettings, User, OrderLog, SystemNotification } from '../types.js';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from './catalogData.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.resolve(DB_DIR, 'backups');
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

// Database Backup Utility
export function createDatabaseBackup(): string | null {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.resolve(BACKUP_DIR, `halim_backup_${timestamp}.sqlite`);
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`[Database Backup] Created secure backup at: ${backupFile}`);
    return backupFile;
  } catch (err) {
    console.error('[Database Backup] Failed to create backup:', err);
    return null;
  }
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      // Create backup before migration
      createDatabaseBackup();

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
      await syncCustomersTable(db);
      await syncInvoicesTable(db);
      saveDb();
    } catch (err) {
      console.error('Database file corrupted or malformed, initializing fresh clean database:', err);
      db = new SQL.Database();
      await initSchema(db);
      await seedInitialData(db);
      await syncCustomersTable(db);
      await syncInvoicesTable(db);
      saveDb();
    }
  } else {
    db = new SQL.Database();
    await initSchema(db);
    await seedInitialData(db);
    await syncCustomersTable(db);
    await syncInvoicesTable(db);
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
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const expiresAt = now + durationMs;

  database.run(
    `INSERT INTO sessions (token, id, userId, tokenHash, username, role, fullName, phone, storeName, address, ipAddress, userAgent, createdAt, expiresAt, lastUsedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      token,
      'sess_' + token.substring(0, 12),
      user.id,
      tokenHash,
      user.username,
      user.role,
      user.fullName,
      user.phone,
      user.storeName || '',
      user.address || '',
      '',
      '',
      now,
      expiresAt,
      now,
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

    // Update lastUsedAt
    try {
      database.run(`UPDATE sessions SET lastUsedAt = ? WHERE token = ?`, [now, token.trim()]);
    } catch {}

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
      `INSERT INTO audit_logs (id, event, action, userId, username, ip, ipAddress, details, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event,
        event,
        userId || null,
        username || null,
        ip || null,
        ip || null,
        details || null,
        timestamp,
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
    const nowIso = new Date().toISOString();
    database.run(
      `INSERT INTO login_attempts (id, identifier, ip, ipAddress, attemptTime, success, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, identifier.trim().toLowerCase(), ip || '127.0.0.1', ip || '127.0.0.1', now, success ? 1 : 0, nowIso]
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

// -------------------------------------------------------------
// COMPLETE PRODUCTION SCHEMA INITIALIZATION & SAFE MIGRATIONS
// -------------------------------------------------------------
export async function initSchema(database: Database): Promise<void> {
  // 1. USERS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('admin', 'customer')),
      storeName TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      createdAt TEXT,
      updatedAt TEXT,
      lastLoginAt TEXT
    );
  `);

  // 2. CUSTOMERS TABLE (1-to-1 Relationship with Users)
  database.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      customerName TEXT NOT NULL,
      shopName TEXT,
      phone TEXT UNIQUE NOT NULL,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. CATEGORIES TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      imageUrl TEXT,
      icon TEXT,
      sortOrder INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'hidden')),
      createdAt TEXT,
      updatedAt TEXT
    );
  `);

  // 4. PRODUCTS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT NOT NULL,
      categoryId TEXT,
      size TEXT,
      packaging TEXT,
      unitsPerCase INTEGER DEFAULT 1,
      unitType TEXT DEFAULT 'كرتونة',
      price REAL NOT NULL CHECK(price >= 0),
      stock INTEGER DEFAULT 100 CHECK(stock >= 0),
      stockAlertThreshold INTEGER DEFAULT 5,
      lowStockThreshold INTEGER DEFAULT 5,
      minQty INTEGER DEFAULT 1 CHECK(minQty >= 1),
      maxQty INTEGER,
      unit TEXT NOT NULL,
      image TEXT NOT NULL,
      imageUrl TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'locked', 'hidden', 'archived', 'out_of_stock')),
      description TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
  `);

  // 5. DEALS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      productName TEXT,
      productImage TEXT,
      productBrand TEXT,
      productSize TEXT,
      productUnit TEXT,
      category TEXT,
      title TEXT,
      description TEXT,
      offerType TEXT NOT NULL DEFAULT 'discount',
      badgeText TEXT NOT NULL,
      offerPrice REAL NOT NULL CHECK(offerPrice >= 0),
      dealPrice REAL,
      originalPrice REAL NOT NULL CHECK(originalPrice >= 0),
      discountPercentage REAL DEFAULT 0 CHECK(discountPercentage >= 0),
      discountPercent REAL DEFAULT 0,
      startDate TEXT NOT NULL,
      endDate TEXT,
      startAt TEXT,
      endAt TEXT,
      isActive INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      targetType TEXT DEFAULT 'all',
      targetId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // 6. ORDERS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT UNIQUE NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      customerAddress TEXT,
      salesRep TEXT NOT NULL DEFAULT 'محمد فوزي',
      status TEXT NOT NULL CHECK(status IN ('pending', 'reviewing', 'confirmed', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'completed', 'Pending', 'Processing', 'Delivered', 'Cancelled')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      itemsCount INTEGER NOT NULL,
      totalQuantity INTEGER NOT NULL,
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      discount REAL DEFAULT 0 CHECK(discount >= 0),
      grandTotal REAL NOT NULL CHECK(grandTotal >= 0),
      total REAL,
      paidAmount REAL DEFAULT 0 CHECK(paidAmount >= 0),
      remainingBalance REAL DEFAULT 0,
      remainingAmount REAL DEFAULT 0,
      paymentStatus TEXT DEFAULT 'Unpaid' CHECK(paymentStatus IN ('Unpaid', 'Partial', 'Paid', 'unpaid', 'partial', 'paid')),
      notes TEXT,
      adminNotes TEXT
    );
  `);

  // 7. ORDER ITEMS TABLE (With Immutable Snapshots)
  database.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      productNameSnapshot TEXT,
      brandSnapshot TEXT,
      sizeSnapshot TEXT,
      packagingSnapshot TEXT,
      unitPrice REAL NOT NULL CHECK(unitPrice >= 0),
      unitPriceSnapshot REAL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit TEXT NOT NULL,
      discount REAL DEFAULT 0 CHECK(discount >= 0),
      totalPrice REAL NOT NULL CHECK(totalPrice >= 0),
      itemTotal REAL,
      dealId TEXT,
      createdAt TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // 8. INVOICES TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE NOT NULL,
      orderId TEXT UNIQUE,
      customerId TEXT NOT NULL,
      invoiceTotal REAL NOT NULL CHECK(invoiceTotal >= 0),
      previousDebt REAL DEFAULT 0,
      totalDue REAL NOT NULL,
      paidAmount REAL DEFAULT 0 CHECK(paidAmount >= 0),
      remainingAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'issued',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE SET NULL
    );
  `);

  // 9. PAYMENTS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      orderId TEXT,
      orderNumber TEXT,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT,
      invoiceId TEXT,
      amount REAL NOT NULL CHECK(amount > 0),
      paymentDate TEXT NOT NULL,
      paymentMethod TEXT DEFAULT 'Cash',
      collectedBy TEXT NOT NULL,
      createdBy TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  // 10. SETTINGS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT
    );
  `);

  // 11. SESSIONS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      id TEXT,
      userId TEXT NOT NULL,
      tokenHash TEXT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      storeName TEXT,
      address TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL,
      revokedAt INTEGER,
      lastUsedAt INTEGER,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 12. AUDIT LOGS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      action TEXT,
      userId TEXT,
      username TEXT,
      targetType TEXT,
      targetId TEXT,
      metadata TEXT,
      ip TEXT,
      ipAddress TEXT,
      details TEXT,
      timestamp TEXT NOT NULL,
      createdAt TEXT
    );
  `);

  // 13. LOGIN ATTEMPTS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      ip TEXT NOT NULL,
      ipAddress TEXT,
      attemptTime INTEGER NOT NULL,
      success INTEGER NOT NULL,
      createdAt TEXT
    );
  `);

  // 14. PASSWORD RESETS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      phone TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      usedAt INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 15. NOTIFICATIONS TABLE
  database.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      customerId TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      relatedProductId TEXT,
      relatedDealId TEXT,
      read INTEGER DEFAULT 0,
      isRead INTEGER DEFAULT 0,
      orderId TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  // 16. INFORMATION & READ TRACKING
  database.run(`
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
  `);

  // SAFE COLUMN MIGRATIONS FIRST (Ensures zero data loss across upgrades and columns exist before indexes)
  const safeAddColumn = (table: string, columnDef: string) => {
    try {
      database.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch {}
  };

  // users columns
  safeAddColumn('users', 'createdAt TEXT');
  safeAddColumn('users', 'updatedAt TEXT');
  safeAddColumn('users', 'lastLoginAt TEXT');
  safeAddColumn('users', "status TEXT DEFAULT 'active'");

  // products columns
  safeAddColumn('products', 'categoryId TEXT');
  safeAddColumn('products', 'brand TEXT');
  safeAddColumn('products', 'size TEXT');
  safeAddColumn('products', 'packaging TEXT');
  safeAddColumn('products', 'unitsPerCase INTEGER DEFAULT 1');
  safeAddColumn('products', "unitType TEXT DEFAULT 'كرتونة'");
  safeAddColumn('products', 'stockAlertThreshold INTEGER DEFAULT 5');
  safeAddColumn('products', 'lowStockThreshold INTEGER DEFAULT 5');
  safeAddColumn('products', 'imageUrl TEXT');
  safeAddColumn('products', 'createdAt TEXT');
  safeAddColumn('products', 'updatedAt TEXT');

  // deals columns
  safeAddColumn('deals', 'title TEXT');
  safeAddColumn('deals', 'dealPrice REAL');
  safeAddColumn('deals', 'discountPercent REAL');
  safeAddColumn('deals', 'startAt TEXT');
  safeAddColumn('deals', 'endAt TEXT');
  safeAddColumn('deals', 'is_active INTEGER DEFAULT 1');
  safeAddColumn('deals', 'updatedAt TEXT');

  // orders columns
  safeAddColumn('orders', 'total REAL');
  safeAddColumn('orders', 'paidAmount REAL DEFAULT 0');
  safeAddColumn('orders', 'remainingBalance REAL DEFAULT 0');
  safeAddColumn('orders', 'remainingAmount REAL DEFAULT 0');
  safeAddColumn('orders', "paymentStatus TEXT DEFAULT 'Unpaid'");

  // order_items columns
  safeAddColumn('order_items', 'productNameSnapshot TEXT');
  safeAddColumn('order_items', 'brandSnapshot TEXT');
  safeAddColumn('order_items', 'sizeSnapshot TEXT');
  safeAddColumn('order_items', 'packagingSnapshot TEXT');
  safeAddColumn('order_items', 'unitPriceSnapshot REAL');
  safeAddColumn('order_items', 'itemTotal REAL');
  safeAddColumn('order_items', 'dealId TEXT');
  safeAddColumn('order_items', 'createdAt TEXT');

  // payments columns
  safeAddColumn('payments', 'invoiceId TEXT');
  safeAddColumn('payments', 'createdBy TEXT');

  // settings columns
  safeAddColumn('settings', 'updatedAt TEXT');

  // audit_logs columns
  safeAddColumn('audit_logs', 'action TEXT');
  safeAddColumn('audit_logs', 'targetType TEXT');
  safeAddColumn('audit_logs', 'targetId TEXT');
  safeAddColumn('audit_logs', 'metadata TEXT');
  safeAddColumn('audit_logs', 'ipAddress TEXT');
  safeAddColumn('audit_logs', 'createdAt TEXT');

  // 17. PERFORMANCE & CONSTRAINT INDEXES (Created safely after all columns are added)
  const safeCreateIndex = (indexSql: string) => {
    try {
      database.run(indexSql);
    } catch (e) {
      // Ignore if index already exists or on optional column
    }
  };

  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_customers_userId ON customers(userId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_orders_customerId ON orders(customerId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_orders_customerPhone ON orders(customerPhone);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_orders_orderNumber ON orders(orderNumber);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_order_items_productId ON order_items(productId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_invoices_orderId ON invoices(orderId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_invoices_invoiceNumber ON invoices(invoiceNumber);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_payments_customerId ON payments(customerId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_payments_orderId ON payments(orderId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_payments_invoiceId ON payments(invoiceId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_payments_createdAt ON payments(createdAt);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_payments_paymentDate ON payments(paymentDate);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_deals_productId ON deals(productId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_deals_isActive ON deals(isActive);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_login_attempts_ident ON login_attempts(identifier, attemptTime);`);
  safeCreateIndex(`CREATE INDEX IF NOT EXISTS idx_notifications_customerId ON notifications(customerId);`);

  // Sync Admin account
  await syncAdminUserAccount(database);
}

// Synchronize all existing customer users into customers table
export async function syncCustomersTable(database: Database): Promise<void> {
  try {
    const res = database.exec(`SELECT id, fullName, storeName, phone, address, status, createdAt FROM users WHERE role = 'customer'`);
    if (res.length > 0 && res[0].values) {
      const nowIso = new Date().toISOString();
      for (const row of res[0].values) {
        const userId = String(row[0]);
        const customerName = String(row[1] || 'عميل');
        const shopName = row[2] ? String(row[2]) : 'محل تجاري';
        const phone = String(row[3] || '');
        const address = row[4] ? String(row[4]) : 'الإسكندرية';
        const status = row[5] === 'disabled' ? 'disabled' : 'active';
        const createdAt = row[6] ? String(row[6]) : nowIso;

        const check = database.prepare('SELECT id FROM customers WHERE userId = ? OR phone = ?');
        check.bind([userId, phone]);
        const exists = check.step();
        check.free();

        if (!exists) {
          const custId = 'cust_' + userId.replace(/[^a-zA-Z0-9_-]/g, '_');
          database.run(
            `INSERT INTO customers (id, userId, customerName, shopName, phone, address, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [custId, userId, customerName, shopName, phone, address, status, createdAt, nowIso]
          );
        } else {
          database.run(
            `UPDATE customers SET customerName = ?, shopName = ?, address = ?, status = ?, updatedAt = ? WHERE userId = ? OR phone = ?`,
            [customerName, shopName, address, status, nowIso, userId, phone]
          );
        }
      }
    }
  } catch (err) {
    console.error('Error synchronizing customers table:', err);
  }
}

// Synchronize all orders with normalized invoices table
export async function syncInvoicesTable(database: Database): Promise<void> {
  try {
    const res = database.exec(`SELECT id, orderNumber, customerId, customerPhone, grandTotal, paidAmount, remainingBalance, createdAt FROM orders WHERE status != 'Cancelled'`);
    if (res.length > 0 && res[0].values) {
      const nowIso = new Date().toISOString();
      for (const row of res[0].values) {
        const orderId = String(row[0]);
        const orderNumber = String(row[1]);
        const customerId = String(row[2]);
        const grandTotal = Number(row[4] || 0);
        const paidAmount = Number(row[5] || 0);
        const remainingAmount = Number(row[6] !== null && row[6] !== undefined ? row[6] : Math.max(0, grandTotal - paidAmount));
        const createdAt = String(row[7] || nowIso);

        const check = database.prepare('SELECT id FROM invoices WHERE orderId = ? OR invoiceNumber = ?');
        const invNum = 'INV-' + orderNumber.replace('#', '');
        check.bind([orderId, invNum]);
        const exists = check.step();
        check.free();

        if (!exists) {
          const invId = 'inv_' + orderId.replace(/^ord_/, '');
          database.run(
            `INSERT INTO invoices (id, invoiceNumber, orderId, customerId, invoiceTotal, previousDebt, totalDue, paidAmount, remainingAmount, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              invId,
              invNum,
              orderId,
              customerId,
              grandTotal,
              0,
              grandTotal,
              paidAmount,
              remainingAmount,
              paidAmount >= grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'issued',
              createdAt,
              nowIso,
            ]
          );
        }
      }
    }
  } catch (err) {
    console.error('Error synchronizing invoices table:', err);
  }
}

export async function syncAdminUserAccount(database: Database): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    // 1. Permanently remove old legacy admin users
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
        `UPDATE users SET username = ?, password = ?, fullName = ?, phone = ?, role = ?, storeName = ?, address = ?, status = 'active', updatedAt = ? WHERE id = ? OR username = ?`,
        [
          INITIAL_ADMIN_CONFIG.username,
          hashedAdminPassword,
          INITIAL_ADMIN_CONFIG.fullName,
          INITIAL_ADMIN_CONFIG.phone,
          INITIAL_ADMIN_CONFIG.role,
          INITIAL_ADMIN_CONFIG.storeName,
          INITIAL_ADMIN_CONFIG.address,
          nowIso,
          INITIAL_ADMIN_CONFIG.id,
          INITIAL_ADMIN_CONFIG.username,
        ]
      );
    } else {
      database.run(
        `INSERT INTO users (id, username, password, fullName, phone, role, storeName, address, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          INITIAL_ADMIN_CONFIG.id,
          INITIAL_ADMIN_CONFIG.username,
          hashedAdminPassword,
          INITIAL_ADMIN_CONFIG.fullName,
          INITIAL_ADMIN_CONFIG.phone,
          INITIAL_ADMIN_CONFIG.role,
          INITIAL_ADMIN_CONFIG.storeName,
          INITIAL_ADMIN_CONFIG.address,
          'active',
          nowIso,
          nowIso,
        ]
      );
    }
  } catch (err) {
    console.error('Error syncing admin user:', err);
  }
}

export function seedCategories(database: Database): void {
  // Seed Categories if empty
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
    `INSERT OR IGNORE INTO settings (key, value, updatedAt) VALUES ('system_config', ?, ?)`,
    [JSON.stringify(settings), new Date().toISOString()]
  );
}

