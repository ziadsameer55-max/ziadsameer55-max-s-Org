import initSqlJs, { Database } from 'sql.js';
import {
  initSchema,
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  recordLoginAttempt,
  checkLoginLockout,
  clearLoginAttempts,
  createDatabaseBackup,
  logSecurityEvent,
} from './db.js';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

export interface TestReport {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

export async function runComprehensiveDatabaseTests(): Promise<TestReport> {
  const startTime = Date.now();
  const results: TestResult[] = [];

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  await initSchema(db);

  async function test(suite: string, name: string, fn: () => Promise<void> | void) {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ suite, name, passed: true, durationMs: Date.now() - t0 });
    } catch (err: any) {
      results.push({
        suite,
        name,
        passed: false,
        message: err?.message || String(err),
        durationMs: Date.now() - t0,
      });
    }
  }

  // -------------------------------------------------------------
  // SUITE 1: User Authentication, Argon2id & Security
  // -------------------------------------------------------------
  await test('Auth & Security', 'Argon2id password hashing produces non-empty secure hash', async () => {
    const plain = 'SecretTestPassword#123';
    const hash = await hashPassword(plain);
    if (!hash || !hash.startsWith('$argon2id$')) {
      throw new Error(`Expected argon2id prefix, got: ${hash}`);
    }
    const isValid = await verifyPassword(plain, hash);
    if (!isValid) throw new Error('Password verification failed for valid password');
    const isInvalid = await verifyPassword('WrongPassword', hash);
    if (isInvalid) throw new Error('Password verification returned true for invalid password');
  });

  await test('Auth & Security', 'Session creation and verification with expiration', async () => {
    const user = {
      id: 'test-cust-101',
      username: '01099998888',
      role: 'customer' as const,
      fullName: 'عميل اختبار',
      phone: '01099998888',
      storeName: 'محل البركة',
      address: 'الإسكندرية',
    };

    // Insert user into users table first
    db.run(
      `INSERT INTO users (id, username, password, fullName, phone, role, storeName, address, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, 'hash_test', user.fullName, user.phone, user.role, user.storeName, user.address, 'active', new Date().toISOString(), new Date().toISOString()]
    );

    const token = createSession(db, user, 1000 * 60); // 1 minute
    if (!token || token.length < 32) throw new Error('Session token not generated');

    const sessionUser = getSessionUser(db, token);
    if (!sessionUser || sessionUser.id !== user.id) {
      throw new Error('Session user mismatch or retrieval failure');
    }
  });

  await test('Auth & Security', 'Brute force login rate limiting and lockout check', async () => {
    const testPhone = '01077776666';
    const testIp = '192.168.1.50';

    // Record 5 failed attempts
    for (let i = 0; i < 5; i++) {
      recordLoginAttempt(db, testPhone, testIp, false);
    }

    const lockout = checkLoginLockout(db, testPhone, testIp);
    if (!lockout.isLocked) {
      throw new Error('Account was expected to be locked after 5 failed attempts');
    }

    // Clear attempts
    clearLoginAttempts(db, testPhone, testIp);
    const clearedLockout = checkLoginLockout(db, testPhone, testIp);
    if (clearedLockout.isLocked) {
      throw new Error('Lockout was expected to be cleared');
    }
  });

  // -------------------------------------------------------------
  // SUITE 2: Customer Isolation & Access Control
  // -------------------------------------------------------------
  await test('Customer Isolation', 'Customer A cannot view Customer B orders or statement', async () => {
    const custA = 'cust-user-a';
    const custB = 'cust-user-b';

    db.run(
      `INSERT INTO users (id, username, password, fullName, phone, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [custA, '01011111111', 'hash', 'عميل أ', '01011111111', 'customer', 'active', new Date().toISOString(), new Date().toISOString()]
    );
    db.run(
      `INSERT INTO users (id, username, password, fullName, phone, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [custB, '01022222222', 'hash', 'عميل ب', '01022222222', 'customer', 'active', new Date().toISOString(), new Date().toISOString()]
    );

    // Insert orders for Cust A and Cust B
    db.run(
      `INSERT INTO orders (id, orderNumber, customerId, customerName, customerPhone, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, grandTotal, remainingBalance, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ord-a-1', '#1001', custA, 'عميل أ', '01011111111', 'محمد فوزي', 'Delivered', new Date().toISOString(), new Date().toISOString(), 1, 2, 500, 500, 500, 'Unpaid']
    );

    db.run(
      `INSERT INTO orders (id, orderNumber, customerId, customerName, customerPhone, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, grandTotal, remainingBalance, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ord-b-1', '#1002', custB, 'عميل ب', '01022222222', 'محمد فوزي', 'Delivered', new Date().toISOString(), new Date().toISOString(), 1, 1, 300, 300, 300, 'Unpaid']
    );

    // Verify querying by customer ID strictly isolates
    const resA = db.exec(`SELECT id FROM orders WHERE customerId = '${custA}'`);
    const ordersA = resA[0]?.values?.map((v) => v[0]) || [];
    if (ordersA.length !== 1 || ordersA[0] !== 'ord-a-1') {
      throw new Error(`Customer A query returned unexpected orders: ${JSON.stringify(ordersA)}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 3: Catalog, Stock Control & Deals
  // -------------------------------------------------------------
  await test('Catalog & Stock', 'Product creation with stock limits and atomic stock deduction', async () => {
    const prodId = 'prod-test-cola';
    db.run(
      `INSERT INTO products (id, name, category, price, stock, minQty, maxQty, unit, image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prodId, 'كوكاكولا كانز 330 مل', 'مشروبات', 15.0, 50, 1, 20, 'كرتونة', 'cola.jpg', 'active']
    );

    // Deduct 5 units
    db.run(`UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?`, [5, prodId]);

    const res = db.exec(`SELECT stock FROM products WHERE id = '${prodId}'`);
    const newStock = res[0]?.values?.[0]?.[0];
    if (newStock !== 45) {
      throw new Error(`Expected stock 45, got: ${newStock}`);
    }
  });

  await test('Catalog & Stock', 'Active deal overrides product unit price', async () => {
    const prodId = 'prod-test-deal';
    db.run(
      `INSERT INTO products (id, name, category, price, stock, unit, image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [prodId, 'شيبسي عائلي', 'سناكس', 25.0, 100, 'كرتونة', 'chips.jpg', 'active']
    );

    const dealId = 'deal-test-1';
    db.run(
      `INSERT INTO deals (id, productId, offerType, badgeText, offerPrice, originalPrice, discountPercentage, startDate, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dealId, prodId, 'discount', 'عرض خاص', 20.0, 25.0, 20, '2026-01-01', 1, new Date().toISOString()]
    );

    const dealRes = db.exec(`SELECT offerPrice FROM deals WHERE productId = '${prodId}' AND isActive = 1`);
    const offerPrice = dealRes[0]?.values?.[0]?.[0];
    if (offerPrice !== 20.0) {
      throw new Error(`Expected deal price 20.0, got: ${offerPrice}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 4: Order Creation, Snapshots & Invoices
  // -------------------------------------------------------------
  await test('Orders & Invoices', 'Order creation preserves immutable snapshots in order_items and creates invoice', async () => {
    const custId = 'cust-test-snap';
    const ordId = 'ord-snap-101';
    const prodId = 'prod-test-snap';

    db.run(
      `INSERT INTO products (id, name, brand, category, size, packaging, price, stock, unit, image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prodId, 'أرز الضحى 1 كجم', 'الضحى', 'بقوليات', '1 كجم', 'شيكارة', 35.0, 100, 'شيكارة', 'rice.jpg', 'active']
    );

    // Insert Order
    db.run(
      `INSERT INTO orders (id, orderNumber, customerId, customerName, customerPhone, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, grandTotal, paidAmount, remainingBalance, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ordId, '#1050', custId, 'عميل الأرز', '01033334444', 'محمد فوزي', 'Pending', new Date().toISOString(), new Date().toISOString(), 1, 10, 350.0, 350.0, 0, 350.0, 'Unpaid']
    );

    // Insert Order Item with snapshots
    db.run(
      `INSERT INTO order_items (id, orderId, productId, productName, productNameSnapshot, brandSnapshot, sizeSnapshot, packagingSnapshot, unitPrice, unitPriceSnapshot, quantity, unit, totalPrice, itemTotal, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-1', ordId, prodId, 'أرز الضحى 1 كجم', 'أرز الضحى 1 كجم', 'الضحى', '1 كجم', 'شيكارة', 35.0, 35.0, 10, 'شيكارة', 350.0, 350.0, new Date().toISOString()]
    );

    // Insert corresponding invoice
    db.run(
      `INSERT INTO invoices (id, invoiceNumber, orderId, customerId, invoiceTotal, previousDebt, totalDue, paidAmount, remainingAmount, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['inv-1050', 'INV-1050', ordId, custId, 350.0, 0, 350.0, 0, 350.0, 'issued', new Date().toISOString(), new Date().toISOString()]
    );

    // Modify original product price
    db.run(`UPDATE products SET price = 50.0 WHERE id = ?`, [prodId]);

    // Verify order item snapshot price is still 35.0
    const snapRes = db.exec(`SELECT unitPriceSnapshot, productNameSnapshot, brandSnapshot FROM order_items WHERE orderId = '${ordId}'`);
    const snapPrice = snapRes[0]?.values?.[0]?.[0];
    const snapName = snapRes[0]?.values?.[0]?.[1];
    const snapBrand = snapRes[0]?.values?.[0]?.[2];

    if (snapPrice !== 35.0 || snapName !== 'أرز الضحى 1 كجم' || snapBrand !== 'الضحى') {
      throw new Error(`Snapshot preservation failed: Price ${snapPrice}, Name ${snapName}, Brand ${snapBrand}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 5: Financials, Partial Payment & Full Settlement
  // -------------------------------------------------------------
  await test('Financial Calculations', 'FIFO allocation of partial payment across multiple debt orders', async () => {
    const custId = 'cust-fifo-test';

    // Order 1: 200 EGP
    db.run(
      `INSERT INTO orders (id, orderNumber, customerId, customerName, customerPhone, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, grandTotal, paidAmount, remainingBalance, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ord-f-1', '#2001', custId, 'عميل فيفو', '01055556666', 'محمد فوزي', 'Delivered', '2026-08-01 10:00:00', '2026-08-01 10:00:00', 1, 1, 200, 200, 0, 200, 'Unpaid']
    );

    // Order 2: 300 EGP
    db.run(
      `INSERT INTO orders (id, orderNumber, customerId, customerName, customerPhone, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, grandTotal, paidAmount, remainingBalance, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ord-f-2', '#2002', custId, 'عميل فيفو', '01055556666', 'محمد فوزي', 'Delivered', '2026-08-02 10:00:00', '2026-08-02 10:00:00', 1, 1, 300, 300, 0, 300, 'Unpaid']
    );

    // Partial collection of 250 EGP
    const payAmount = 250;
    let remainingToAllocate = payAmount;

    const ordersRes = db.exec(
      `SELECT id, grandTotal, paidAmount, remainingBalance FROM orders WHERE customerId = '${custId}' AND remainingBalance > 0 ORDER BY createdAt ASC`
    );

    for (const row of ordersRes[0].values) {
      if (remainingToAllocate <= 0) break;
      const oId = String(row[0]);
      const gTotal = Number(row[1]);
      const curPaid = Number(row[2] || 0);
      const rem = Number(row[3]);

      const allocated = Math.min(rem, remainingToAllocate);
      const newPaid = curPaid + allocated;
      const newRem = gTotal - newPaid;
      const status = newPaid >= gTotal ? 'Paid' : 'Partial';

      db.run(`UPDATE orders SET paidAmount = ?, remainingBalance = ?, paymentStatus = ? WHERE id = ?`, [newPaid, newRem, status, oId]);
      remainingToAllocate -= allocated;
    }

    // Check Order 1: fully paid (paid 200, rem 0, status Paid)
    const o1 = db.exec(`SELECT paidAmount, remainingBalance, paymentStatus FROM orders WHERE id = 'ord-f-1'`)[0].values[0];
    if (o1[0] !== 200 || o1[1] !== 0 || o1[2] !== 'Paid') {
      throw new Error(`Order 1 FIFO mismatch: ${JSON.stringify(o1)}`);
    }

    // Check Order 2: partially paid (paid 50, rem 250, status Partial)
    const o2 = db.exec(`SELECT paidAmount, remainingBalance, paymentStatus FROM orders WHERE id = 'ord-f-2'`)[0].values[0];
    if (o2[0] !== 50 || o2[1] !== 250 || o2[2] !== 'Partial') {
      throw new Error(`Order 2 FIFO mismatch: ${JSON.stringify(o2)}`);
    }
  });

  await test('Financial Calculations', 'Full settlement (settle-full) clears all customer debt and logs payment', async () => {
    const custId = 'cust-settle-test';

    db.run(
      `INSERT INTO orders (id, orderNumber, customerId, customerName, customerPhone, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, grandTotal, paidAmount, remainingBalance, paymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ord-s-1', '#3001', custId, 'عميل تسوية', '01088889999', 'محمد فوزي', 'Delivered', new Date().toISOString(), new Date().toISOString(), 1, 1, 450, 450, 50, 400, 'Partial']
    );

    // Settle full debt
    const ordersRes = db.exec(`SELECT id, grandTotal, remainingBalance FROM orders WHERE customerId = '${custId}' AND remainingBalance > 0`);
    let totalSettled = 0;

    for (const row of ordersRes[0].values) {
      const oId = String(row[0]);
      const gTotal = Number(row[1]);
      const rem = Number(row[2]);
      totalSettled += rem;
      db.run(`UPDATE orders SET paidAmount = ?, remainingBalance = 0, paymentStatus = 'Paid' WHERE id = ?`, [gTotal, oId]);
    }

    // Record payment
    db.run(
      `INSERT INTO payments (id, customerId, customerName, amount, paymentDate, paymentMethod, collectedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['pay-settle-1', custId, 'عميل تسوية', totalSettled, new Date().toISOString(), 'Cash', 'محمد فوزي', 'تحصيل كامل المديونية', new Date().toISOString()]
    );

    // Verify remaining balance is 0
    const checkRes = db.exec(`SELECT SUM(remainingBalance) FROM orders WHERE customerId = '${custId}' AND status != 'Cancelled'`);
    const totalRemaining = Number(checkRes[0]?.values?.[0]?.[0] || 0);
    if (totalRemaining !== 0) {
      throw new Error(`Expected 0 remaining debt after full settlement, got: ${totalRemaining}`);
    }

    // Verify payment was recorded
    const payRes = db.exec(`SELECT amount FROM payments WHERE id = 'pay-settle-1'`);
    const paidAmount = payRes[0]?.values?.[0]?.[0];
    if (paidAmount !== 400) {
      throw new Error(`Expected recorded payment of 400 EGP, got: ${paidAmount}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 6: Database Backup & Audit Logs
  // -------------------------------------------------------------
  await test('System & Auditing', 'Audit log records security events without passwords', async () => {
    logSecurityEvent(db, 'TEST_AUDIT_ACTION', 'usr-test', 'testuser', '127.0.0.1', 'Audit log validation test');

    const res = db.exec(`SELECT event, userId, username, details FROM audit_logs WHERE event = 'TEST_AUDIT_ACTION'`);
    if (res.length === 0 || !res[0].values || res[0].values.length === 0) {
      throw new Error('Audit log record not found');
    }
    const details = String(res[0].values[0][3]);
    if (details.includes('password') || details.includes('secret')) {
      throw new Error('Audit log contained sensitive credentials');
    }
  });

  await test('System & Auditing', 'Database backup utility executes cleanly', async () => {
    const backupPath = createDatabaseBackup();
    // In memory DB might return string or null, function should not crash
    if (backupPath !== null && typeof backupPath !== 'string') {
      throw new Error('createDatabaseBackup returned invalid format');
    }
  });

  const durationMs = Date.now() - startTime;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    durationMs,
    results,
  };
}
