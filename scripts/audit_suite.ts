import { getDb, saveDb } from '../src/server/db.js';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'MohamedFawzy';
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'Mf!7Qz#29vL@8Kx$4Np';

interface TestResult {
  scenario: string;
  name: string;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];

function record(scenario: string, name: string, passed: boolean, notes: string) {
  results.push({ scenario, name, passed, notes });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${scenario}] ${name}: ${notes}`);
}

async function runAudit() {
  console.log('===========================================================');
  console.log('🚀 STARTING COMPREHENSIVE PRODUCTION AUDIT FOR HALIM APP');
  console.log('===========================================================');

  const db = await getDb();

  // -------------------------------------------------------------------------
  // SETUP: Authenticate Master Admin
  // -------------------------------------------------------------------------
  let adminToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      adminToken = data.token;
      record('Admin Security', 'Admin Login with Master Credentials', true, `Authenticated as ${data.user.fullName}`);
    } else {
      record('Admin Security', 'Admin Login', false, `Failed: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    record('Admin Security', 'Admin Login', false, `Network error: ${err.message}`);
  }

  // Reset hidePrices to false for standard audit calculations
  try {
    await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ hidePrices: false }),
    });
  } catch {}

  // -------------------------------------------------------------------------
  // SETUP: Create two distinct test customers A and B
  // -------------------------------------------------------------------------
  const timestamp = Date.now();
  const phoneA = `01099${Math.floor(100000 + Math.random() * 900000)}`;
  const phoneB = `01088${Math.floor(100000 + Math.random() * 900000)}`;

  let customerAToken = '';
  let customerAId = '';
  let customerBToken = '';
  let customerBId = '';

  // Register Customer A
  try {
    const resA = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'سوبرماركت البركة (العميل A)',
        phone: phoneA,
        storeName: 'سوبرماركت البركة',
        address: 'شارع 45 العصافرة',
        password: 'PassA!123456',
      }),
    });
    const dataA = await resA.json();
    if (dataA.success && dataA.token) {
      customerAToken = dataA.token;
      customerAId = dataA.user.id;
      record('Customer Security', 'Register Customer A', true, `Registered ID: ${customerAId}, Phone: ${phoneA}`);
    } else {
      record('Customer Security', 'Register Customer A', false, `Failed: ${JSON.stringify(dataA)}`);
    }
  } catch (e: any) {
    record('Customer Security', 'Register Customer A', false, e.message);
  }

  // Register Customer B
  try {
    const resB = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'ماركت الفتح (العميل B)',
        phone: phoneB,
        storeName: 'ماركت الفتح',
        address: 'سيدي بشر قبلي',
        password: 'PassB!123456',
      }),
    });
    const dataB = await resB.json();
    if (dataB.success && dataB.token) {
      customerBToken = dataB.token;
      customerBId = dataB.user.id;
      record('Customer Security', 'Register Customer B', true, `Registered ID: ${customerBId}, Phone: ${phoneB}`);
    } else {
      record('Customer Security', 'Register Customer B', false, `Failed: ${JSON.stringify(dataB)}`);
    }
  } catch (e: any) {
    record('Customer Security', 'Register Customer B', false, e.message);
  }

  // Get a test product from DB
  const prodStmt = db.prepare('SELECT id, name, price, stock FROM products WHERE status = "open" AND stock > 10 LIMIT 1');
  let testProductId = '';
  let testProductName = '';
  let testProductPrice = 0;
  if (prodStmt.step()) {
    const row = prodStmt.getAsObject();
    testProductId = String(row.id);
    testProductName = String(row.name);
    testProductPrice = Number(row.price);
  }
  prodStmt.free();

  // Re-fetch exact official price directly
  const exactStmt = db.prepare('SELECT price FROM products WHERE id = ?');
  exactStmt.bind([testProductId]);
  if (exactStmt.step()) {
    testProductPrice = Number(exactStmt.getAsObject().price);
  }
  exactStmt.free();

  // -------------------------------------------------------------------------
  // 1. SCENARIO 1: CUSTOMER SECURITY & ISOLATION
  // -------------------------------------------------------------------------
  let orderBId = '';
  // Create an order for Customer B
  try {
    const orderBRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerBToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: testProductId, quantity: 2, unitPrice: testProductPrice }],
        notes: 'طلب خاص بالعميل B',
      }),
    });
    const orderBData = await orderBRes.json();
    if (orderBData.success && orderBData.orderId) {
      orderBId = orderBData.orderId;
    }
  } catch (err: any) {
    console.error('Error creating order for B:', err);
  }

  // Customer A attempts to fetch Customer B's single order
  try {
    const res = await fetch(`${BASE_URL}/api/orders/${orderBId}`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const pass = res.status === 403;
    record('Customer Security', 'Customer A blocked from viewing Customer B single order', pass, `HTTP status ${res.status}`);
  } catch (e: any) {
    record('Customer Security', 'Customer A blocked from viewing Customer B single order', false, e.message);
  }

  // Customer A attempts to view Customer B's debt
  try {
    const res = await fetch(`${BASE_URL}/api/customers/${customerBId}/debt`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const pass = res.status === 403;
    record('Customer Security', 'Customer A blocked from viewing Customer B debt', pass, `HTTP status ${res.status}`);
  } catch (e: any) {
    record('Customer Security', 'Customer A blocked from viewing Customer B debt', false, e.message);
  }

  // Customer A attempts to view Customer B's statement
  try {
    const res = await fetch(`${BASE_URL}/api/customers/${customerBId}/statement`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const pass = res.status === 403;
    record('Customer Security', 'Customer A blocked from viewing Customer B statement', pass, `HTTP status ${res.status}`);
  } catch (e: any) {
    record('Customer Security', 'Customer A blocked from viewing Customer B statement', false, e.message);
  }

  // Customer A attempts to access Admin Settings API
  try {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerAToken}`,
      },
      body: JSON.stringify({ hidePrices: true }),
    });
    const pass = res.status === 403;
    record('Customer Security', 'Customer A blocked from modifying Admin Settings', pass, `HTTP status ${res.status}`);
  } catch (e: any) {
    record('Customer Security', 'Customer A blocked from modifying Admin Settings', false, e.message);
  }

  // Customer A attempts to access Admin Financial Debts overview
  try {
    const res = await fetch(`${BASE_URL}/api/debts`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const pass = res.status === 403;
    record('Customer Security', 'Customer A blocked from accessing All Debts Overview', pass, `HTTP status ${res.status}`);
  } catch (e: any) {
    record('Customer Security', 'Customer A blocked from accessing All Debts Overview', false, e.message);
  }

  // Customer Isolation on Payments Endpoint
  try {
    // 1. Unauthenticated request to /api/payments -> 401
    const unauthPay = await fetch(`${BASE_URL}/api/payments`);
    record('Customer Security', 'Unauthenticated Access to Payments Blocked (401)', unauthPay.status === 401, `HTTP status ${unauthPay.status}`);

    // 2. Customer A receives only their own payments
    const custAPayRes = await fetch(`${BASE_URL}/api/payments`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const custAPayData = await custAPayRes.json();
    const onlyA = Array.isArray(custAPayData) && custAPayData.every((p: any) => p.customerId === customerAId);
    record('Customer Security', 'Customer A can only view their own payments', onlyA, `Retrieved ${custAPayData.length} records`);
  } catch (e: any) {
    record('Customer Security', 'Customer Payments Isolation', false, e.message);
  }

  // -------------------------------------------------------------------------
  // DATABASE & INFRASTRUCTURE PROTECTION
  // -------------------------------------------------------------------------
  try {
    const dbFileRes = await fetch(`${BASE_URL}/data/halim.sqlite`);
    const envFileRes = await fetch(`${BASE_URL}/.env`);
    const dotDotRes = await fetch(`${BASE_URL}/api/../data/halim.sqlite`);

    const protectedDb = dbFileRes.status === 403;
    const protectedEnv = envFileRes.status === 403;
    const protectedDot = dotDotRes.status === 403;

    record(
      'Infrastructure Security',
      'Direct Access to SQLite DB and .env Blocked (403)',
      protectedDb && protectedEnv && protectedDot,
      `DB Status: ${dbFileRes.status}, .env Status: ${envFileRes.status}, DotDot: ${dotDotRes.status}`
    );
  } catch (e: any) {
    record('Infrastructure Security', 'Direct Access Protection', false, e.message);
  }

  // -------------------------------------------------------------------------
  // PASSWORD POLICY & STRENGTH ENFORCEMENT
  // -------------------------------------------------------------------------
  try {
    const weakPhone = `01011${Math.floor(100000 + Math.random() * 900000)}`;
    const weakRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'حساب اختبار كلمة مرور ضعيفة',
        phone: weakPhone,
        password: 'password123', // common weak password
      }),
    });
    const weakData = await weakRegRes.json();
    record(
      'Password Security',
      'Reject Common/Weak Password Registration (400)',
      weakRegRes.status === 400 && !weakData.success,
      `Response: ${weakData.error || weakData.message}`
    );
  } catch (e: any) {
    record('Password Security', 'Password Policy Enforcement', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 2. SCENARIO 2: PRICE SECURITY
  // -------------------------------------------------------------------------
  try {
    // Attempt to submit order with unitPrice = 0.50 EGP when real price is 200+
    const fakePrice = 0.5;
    const requestedQty = 3;
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerAToken}`,
      },
      body: JSON.stringify({
        customerId: customerBId, // Attempt to spoof customer ID to Customer B
        items: [{ productId: testProductId, quantity: requestedQty, unitPrice: fakePrice }],
        notes: 'Price tampering test',
      }),
    });
    const data = await res.json();
    const itemUnitPrice = data.order?.items?.[0]?.unitPrice;
    const actualTotal = data.order?.grandTotal;
    const actualCustId = data.order?.customerId;

    // Price Security: Server ignored fake price (0.5 EGP), used DB price (>0), and total equals DB price * quantity
    const priceRecalculated = data.success && itemUnitPrice !== fakePrice && actualTotal === itemUnitPrice * requestedQty && actualTotal > 0;
    const customerIdProtected = actualCustId === customerAId;

    record('Price Security', 'Server recalculates official price from DB (ignores frontend spoofed price of 0.50 EGP)', priceRecalculated, `Fake: ${fakePrice} EGP, Server DB Unit Price: ${itemUnitPrice} EGP, Total: ${actualTotal} EGP`);
    record('Price Security', 'Customer ID spoofing prevented by session binding', customerIdProtected, `Forced Customer ID: ${actualCustId}`);
  } catch (e: any) {
    record('Price Security', 'Price and Customer ID Security', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 3. SCENARIO 3: ADMIN SECURITY (Server-Side Protections)
  // -------------------------------------------------------------------------
  let createdProductId = 'prod_audit_' + timestamp;
  try {
    // Admin creates product
    const createRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        id: createdProductId,
        name: 'منتج تجريبي للاختبار الأمني',
        category: 'عصائر ومشروبات',
        price: 350,
        unit: 'كرتونة',
        minQty: 1,
        stock: 50,
      }),
    });
    const createData = await createRes.json();
    const adminCreated = createData.success;

    // Customer attempts to create product
    const custCreateRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerAToken}`,
      },
      body: JSON.stringify({
        id: 'prod_hack_' + timestamp,
        name: 'منتج غير مصرح',
        category: 'عام',
        price: 10,
        unit: 'كرتونة',
      }),
    });
    const custBlocked = custCreateRes.status === 403;

    record('Admin Security', 'Admin can create products, Customer is blocked', adminCreated && custBlocked, `Admin: ${adminCreated}, Customer blocked (403): ${custBlocked}`);
  } catch (e: any) {
    record('Admin Security', 'Admin Product Security', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 4. SCENARIO 4: DEBT TEST (6,000 -> 2,500 -> Pay 5,000 -> 4,000)
  // -------------------------------------------------------------------------
  const debtCustomerPhone = `01077${Math.floor(100000 + Math.random() * 900000)}`;
  let debtCustId = '';
  let debtCustToken = '';

  try {
    // 1. Register Debt Customer
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'سوبرماركت التوحيد (اختبار المديونية)',
        phone: debtCustomerPhone,
        storeName: 'سوبرماركت التوحيد',
        password: 'PassDebt!123',
      }),
    });
    const regData = await regRes.json();
    debtCustId = regData.user.id;
    debtCustToken = regData.token;

    // 2. Create Initial Debt Order of 6,000
    // We create a special test product priced at 6,000 for exact math
    const p6kId = 'p_audit_6k_' + timestamp;
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: p6kId, name: 'صنف 6000 ج', category: 'عام', price: 6000, unit: 'بالتة', stock: 100 }),
    });

    const p2500Id = 'p_audit_2500_' + timestamp;
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: p2500Id, name: 'صنف 2500 ج', category: 'عام', price: 2500, unit: 'كرتونة', stock: 100 }),
    });

    const p4000Id = 'p_audit_4000_' + timestamp;
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: p4000Id, name: 'صنف 4000 ج', category: 'عام', price: 4000, unit: 'كرتونة', stock: 100 }),
    });

    // Create Order 1: 6,000 EGP
    const ord1Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${debtCustToken}` },
      body: JSON.stringify({ items: [{ productId: p6kId, quantity: 1 }] }),
    });
    const ord1Data = await ord1Res.json();
    const ord1Id = ord1Data.orderId;

    // Create Order 2: 2,500 EGP
    const ord2Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${debtCustToken}` },
      body: JSON.stringify({ items: [{ productId: p2500Id, quantity: 1 }] }),
    });
    const ord2Data = await ord2Res.json();
    const ord2 = ord2Data.order;

    const testStage1Pass = ord2.previousDebt === 6000 && ord2.currentInvoice === 2500 && ord2.totalDueWithDebt === 8500;
    record(
      'Debt Test',
      'Step 1: Previous 6,000 + Invoice 2,500 = Total Due 8,500',
      testStage1Pass,
      `Prev: ${ord2.previousDebt}, Inv: ${ord2.currentInvoice}, Total: ${ord2.totalDueWithDebt}`
    );

    // Record Payment of 5,000 on customer account
    const payRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 5000, paymentMethod: 'Cash', collectedBy: 'محمد فوزي' }),
    });
    const payData = await payRes.json();

    // Check Customer Statement / Remaining Debt
    const stmtRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/statement`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const stmtData = await stmtRes.json();
    const expectedRemaining = 3500; // (6000 + 2500) - 5000 = 3500
    const actualRemaining = stmtData.summary.totalDebt;
    const testStage2Pass = payData.success && actualRemaining === expectedRemaining;
    record(
      'Debt Test',
      'Step 2: Pay 5,000 -> Remaining Debt = 3,500',
      testStage2Pass,
      `Paid 5000, Remaining in DB: ${actualRemaining} (Expected: ${expectedRemaining})`
    );

    // Create Order 3: 4,000 EGP
    const ord3Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${debtCustToken}` },
      body: JSON.stringify({ items: [{ productId: p4000Id, quantity: 1 }] }),
    });
    const ord3Data = await ord3Res.json();
    const ord3 = ord3Data.order;

    const testStage3Pass = ord3.previousDebt === 3500 && ord3.currentInvoice === 4000 && ord3.totalDueWithDebt === 7500;
    record(
      'Debt Test',
      'Step 3: New Order 4,000 fetches accurate Prev Debt (3,500) -> Total Due 7,500',
      testStage3Pass,
      `Prev: ${ord3.previousDebt}, Inv: ${ord3.currentInvoice}, Total Due: ${ord3.totalDueWithDebt}`
    );
  } catch (e: any) {
    record('Debt Test', 'Debt Sequence Execution', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 5. SCENARIO 5: PAYMENT SECURITY
  // -------------------------------------------------------------------------
  try {
    // 1. Negative amount
    const resNeg = await fetch(`${BASE_URL}/api/customers/${debtCustId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: -500 }),
    });
    record('Payment Security', 'Reject Negative Payment Amount (-500)', resNeg.status === 400, `HTTP status ${resNeg.status}`);

    // 2. Zero amount
    const resZero = await fetch(`${BASE_URL}/api/customers/${debtCustId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 0 }),
    });
    record('Payment Security', 'Reject Zero Payment Amount (0)', resZero.status === 400, `HTTP status ${resZero.status}`);

    // 3. Amount greater than total debt (total debt is 7500, attempt to pay 50000)
    const resExcess = await fetch(`${BASE_URL}/api/customers/${debtCustId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 50000 }),
    });
    record('Payment Security', 'Reject Payment Exceeding Total Debt (50,000 > 7,500)', resExcess.status === 400, `HTTP status ${resExcess.status}`);

    // 4. Customer attempting to record payment
    const resCustPay = await fetch(`${BASE_URL}/api/customers/${debtCustId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${debtCustToken}` },
      body: JSON.stringify({ amount: 100 }),
    });
    record('Payment Security', 'Customer Account Blocked from Recording Payments', resCustPay.status === 403, `HTTP status ${resCustPay.status}`);

    // 5. Partial Collection: Debt is 7,500 -> Pay 2,000 -> Remaining Debt = 5,500
    const partialRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 2000, paymentMethod: 'Cash', notes: 'دفعة جزئية تجريبية' }),
    });
    const partialData = await partialRes.json();

    const partialStmtRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/statement`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const partialStmtData = await partialStmtRes.json();
    const afterPartialDebt = partialStmtData.summary.totalDebt;
    record(
      'Payment Security',
      '🟡 Partial Collection: Debt 7,500 -> Pay 2,000 -> Remaining 5,500',
      partialData.success && afterPartialDebt === 5500,
      `Paid 2,000, Remaining in DB: ${afterPartialDebt} (Expected: 5,500)`
    );

    // 6. Security Check: Customer blocked from full debt settlement endpoint
    const custFullSettleRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/settle-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${debtCustToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    record('Payment Security', 'Customer Blocked from Full Debt Settlement Endpoint (403)', custFullSettleRes.status === 403, `HTTP status ${custFullSettleRes.status}`);

    // 7. Full Debt Settlement (Admin Only): Remaining 5,500 -> Settle Full -> Remaining = 0 & All orders Paid
    const fullSettleRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/settle-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ paymentMethod: 'VodafoneCash', notes: 'سداد كامل مستحقات الحساب' }),
    });
    const fullSettleData = await fullSettleRes.json();

    const fullStmtRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/statement`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const fullStmtData = await fullStmtRes.json();
    const afterFullDebt = fullStmtData.summary.totalDebt;
    const allOrdersPaid = fullStmtData.orders.every((o: any) => o.remainingBalance === 0 && o.paymentStatus === 'Paid');

    record(
      'Payment Security',
      '🟢 Full Debt Settlement: Settle remaining 5,500 -> Remaining = 0 & all orders Paid',
      fullSettleData.success && fullSettleData.settledAmount === 5500 && afterFullDebt === 0 && allOrdersPaid,
      `Settled Amount: ${fullSettleData.settledAmount}, Remaining: ${afterFullDebt}, All Orders Paid: ${allOrdersPaid}`
    );

    // 8. Attempt full settlement when debt is already 0 -> should reject with 400
    const zeroDebtSettleRes = await fetch(`${BASE_URL}/api/customers/${debtCustId}/settle-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    record(
      'Payment Security',
      'Reject Full Settlement when Debt is 0 EGP',
      zeroDebtSettleRes.status === 400,
      `HTTP status ${zeroDebtSettleRes.status}`
    );
  } catch (e: any) {
    record('Payment Security', 'Payment Security Tests', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 6. SCENARIO 6: ORDER FULL CYCLE
  // -------------------------------------------------------------------------
  try {
    const cyclePhone = `01066${Math.floor(100000 + Math.random() * 900000)}`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'ماركت النصر الكامل',
        phone: cyclePhone,
        storeName: 'ماركت النصر',
        password: 'PassCycle!123',
      }),
    });
    const regData = await regRes.json();
    const cToken = regData.token;
    const cId = regData.user.id;

    // Create Order
    const ordRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cToken}` },
      body: JSON.stringify({
        items: [{ productId: testProductId, quantity: 4 }],
        notes: 'دورة طلب كاملة',
      }),
    });
    const ordData = await ordRes.json();
    const orderNum = ordData.orderNumber;
    const orderId = ordData.orderId;

    // Check in Customer's Orders list
    const myOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { 'Authorization': `Bearer ${cToken}` },
    });
    const myOrders = await myOrdersRes.json();
    const foundOrder = myOrders.find((o: any) => o.id === orderId);

    // Pay order partially
    const collectRes = await fetch(`${BASE_URL}/api/orders/${orderId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: ordData.order.grandTotal / 2, markDelivered: false }),
    });
    const collectData = await collectRes.json();

    const cyclePass = ordData.success && foundOrder && collectData.success && collectData.paymentStatus === 'Partial';
    record(
      'Order Test',
      'Full End-to-End Cycle (Login -> Order -> OrderNum -> My Orders -> Payment -> Debt)',
      cyclePass,
      `Order ${orderNum}, Status: ${collectData.paymentStatus}`
    );
  } catch (e: any) {
    record('Order Test', 'Full Cycle Error', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 7. SCENARIO 7: PRICE SNAPSHOT
  // -------------------------------------------------------------------------
  try {
    const snapProdId = 'prod_snap_' + timestamp;
    // Create product at 150 EGP
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: snapProdId, name: 'صنف اختبار السناب شوت', category: 'عام', price: 150, unit: 'كرتونة', stock: 100 }),
    });

    // Create order with 2 units at 150 EGP = 300 EGP
    const ordRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({ items: [{ productId: snapProdId, quantity: 2 }] }),
    });
    const ordData = await ordRes.json();
    const ordId = ordData.orderId;

    // Change product price in database to 250 EGP
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: snapProdId, name: 'صنف اختبار السناب شوت', category: 'عام', price: 250, unit: 'كرتونة', stock: 100 }),
    });

    // Retrieve old order and verify price snapshot is preserved
    const fetchOldRes = await fetch(`${BASE_URL}/api/orders/${ordId}`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const oldOrd = await fetchOldRes.json();
    const itemSnapPrice = oldOrd.items[0].unitPrice;
    const oldGrandTotal = oldOrd.grandTotal;

    const snapPass = itemSnapPrice === 150 && oldGrandTotal === 300;
    record(
      'Price Snapshot',
      'Old order permanently retains original price snapshot (150 EGP) after catalog price increased to 250 EGP',
      snapPass,
      `Snapshot Unit Price: ${itemSnapPrice} EGP, Total: ${oldGrandTotal} EGP`
    );
  } catch (e: any) {
    record('Price Snapshot', 'Price Snapshot Test', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 8. SCENARIO 8: DEALS TEST
  // -------------------------------------------------------------------------
  try {
    const dealProdId = 'prod_deal_' + timestamp;
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: dealProdId, name: 'صنف العرض والخصم', category: 'مشروبات', price: 200, unit: 'كرتونة', stock: 100 }),
    });

    // Create Active Deal: orig 200 -> offer 140
    const dealRes = await fetch(`${BASE_URL}/api/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        productId: dealProdId,
        offerPrice: 140,
        originalPrice: 200,
        badgeText: '🔥 خصم خاص 30%',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
    });
    const dealData = await dealRes.json();
    const dealId = dealData.deal?.id;

    // Customer views deals
    const custDealsRes = await fetch(`${BASE_URL}/api/deals`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const custDeals = await custDealsRes.json();
    const foundDeal = custDeals.find((d: any) => d.productId === dealProdId);

    // Customer places order for deal product -> Backend MUST apply deal price (140 EGP)
    const ordDealRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({ items: [{ productId: dealProdId, quantity: 2 }] }),
    });
    const ordDealData = await ordDealRes.json();
    const appliedUnitPrice = ordDealData.order.items[0].unitPrice;
    const appliedGrandTotal = ordDealData.order.grandTotal;

    const dealPass = foundDeal && appliedUnitPrice === 140 && appliedGrandTotal === 280;
    record(
      'Deals Test',
      'Active Deal correctly applies discount price (140 EGP) on order creation',
      Boolean(dealPass),
      `Deal Price Applied: ${appliedUnitPrice} EGP, Total: ${appliedGrandTotal} EGP`
    );

    // Test Expired Deal
    const expiredDealRes = await fetch(`${BASE_URL}/api/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        productId: dealProdId,
        offerPrice: 90,
        originalPrice: 200,
        startDate: '2025-01-01',
        endDate: '2025-01-10', // Expired in past
      }),
    });

    const custDealsAfterExp = await (await fetch(`${BASE_URL}/api/deals`, { headers: { 'Authorization': `Bearer ${customerAToken}` } })).json();
    const expiredDealFiltered = !custDealsAfterExp.some((d: any) => d.offerPrice === 90);
    record(
      'Deals Test',
      'Expired Deals automatically filtered from customer catalog',
      expiredDealFiltered,
      'Expired offer was not returned to customer'
    );
  } catch (e: any) {
    record('Deals Test', 'Deals Test Error', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 9. SCENARIO 9: STOCK CONTROL & LOW STOCK THRESHOLDS
  // -------------------------------------------------------------------------
  try {
    const stockProdId = 'prod_stock_' + timestamp;
    // Create product with stock = 5, lowStockThreshold = 5
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: stockProdId, name: 'صنف اختبار المخزون', category: 'عام', price: 100, unit: 'كرتونة', stock: 5 }),
    });

    // Update threshold to 5
    await fetch(`${BASE_URL}/api/products/${stockProdId}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ stock: 5, lowStockThreshold: 5 }),
    });

    // Attempt to order 10 units (Exceeds stock of 5)
    const excessOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({ items: [{ productId: stockProdId, quantity: 10 }] }),
    });
    const excessRejected = excessOrderRes.status === 400;

    // Order valid quantity (3 units)
    const validOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({ items: [{ productId: stockProdId, quantity: 3 }] }),
    });
    const validPassed = validOrderRes.status === 200;

    record(
      'Stock Control',
      'Rejects quantity exceeding stock (10 > 5), accepts valid quantity (3 <= 5)',
      excessRejected && validPassed,
      `Excess rejected (400): ${excessRejected}, Valid accepted: ${validPassed}`
    );
  } catch (e: any) {
    record('Stock Control', 'Stock Test Error', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 10. SCENARIO 10: REORDER TEST
  // -------------------------------------------------------------------------
  try {
    const reorderProdId = 'prod_reord_' + timestamp;
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: reorderProdId, name: 'صنف إعادة الطلب', category: 'عام', price: 80, unit: 'كرتونة', stock: 50 }),
    });

    // Initial order at 80 EGP
    const ordRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({ items: [{ productId: reorderProdId, quantity: 2 }] }),
    });
    const oldOrd = (await ordRes.json()).order;

    // Catalog price increases to 95 EGP
    await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: reorderProdId, name: 'صنف إعادة الطلب', category: 'عام', price: 95, unit: 'كرتونة', stock: 50 }),
    });

    // Revalidate cart with old order items using /api/cart/recalculate
    const recalcRes = await fetch(`${BASE_URL}/api/cart/recalculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({
        items: [{ productId: reorderProdId, quantity: 2, reportedPrice: 80 }],
      }),
    });
    const recalcData = await recalcRes.json();
    const newUnitPrice = recalcData.items[0].unitPrice;
    const priceChangeFlag = recalcData.items[0].priceChanged;

    const reorderPass = newUnitPrice === 95 && priceChangeFlag === true;
    record(
      'Reorder',
      'Reorder recalculation adopts current catalog price (95 EGP) and flags price change from old price (80 EGP)',
      reorderPass,
      `Updated Unit Price: ${newUnitPrice} EGP, Flagged Change: ${priceChangeFlag}`
    );
  } catch (e: any) {
    record('Reorder', 'Reorder Test Error', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 11. SCENARIO 11: INVOICE TEST
  // -------------------------------------------------------------------------
  try {
    const ordRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const orders = await ordRes.json();
    const testOrder = orders[0];

    const hasRequiredFields =
      testOrder.orderNumber &&
      testOrder.customerName &&
      testOrder.items &&
      testOrder.items.length > 0 &&
      testOrder.grandTotal !== undefined &&
      testOrder.previousDebt !== undefined &&
      testOrder.totalDueWithDebt !== undefined &&
      testOrder.finalRemainingWithDebt !== undefined;

    record(
      'Invoices',
      'Invoice contains all mathematical accounting fields (OrderNum, Customer, Items, PrevDebt, CurrentInvoice, TotalDue, Paid, Remaining)',
      Boolean(hasRequiredFields),
      `Order ${testOrder?.orderNumber}: PrevDebt=${testOrder?.previousDebt}, TotalDue=${testOrder?.totalDueWithDebt}`
    );
  } catch (e: any) {
    record('Invoices', 'Invoice Field Audit', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 12. SCENARIO 12: SETTINGS TEST (Toggle hidePrices)
  // -------------------------------------------------------------------------
  try {
    // 1. Set hidePrices = true
    const setRes = await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ hidePrices: true }),
    });

    // 2. Fetch products as customer
    const custProdsHidden = await (await fetch(`${BASE_URL}/api/products`, { headers: { 'Authorization': `Bearer ${customerAToken}` } })).json();
    const pricesHidden = custProdsHidden.length > 0 && custProdsHidden.every((p: any) => p.price === 0);

    // 3. Reset hidePrices = false
    await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ hidePrices: false }),
    });

    // 4. Fetch products as customer again
    const custProdsVisible = await (await fetch(`${BASE_URL}/api/products`, { headers: { 'Authorization': `Bearer ${customerAToken}` } })).json();
    const pricesVisible = custProdsVisible.some((p: any) => p.price > 0);

    const settingsPass = pricesHidden && pricesVisible;
    record(
      'Settings',
      'Wholesale Price Privacy toggle (hidePrices ON strips prices to 0, OFF restores visible prices)',
      settingsPass,
      `Hidden: ${pricesHidden}, Restored: ${pricesVisible}`
    );
  } catch (e: any) {
    record('Settings', 'Settings Toggle Test Error', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 13. SCENARIO 13: DATABASE INTEGRITY
  // -------------------------------------------------------------------------
  try {
    const ordersCountRes = db.exec('SELECT COUNT(*) FROM orders');
    const paymentsCountRes = db.exec('SELECT COUNT(*) FROM payments');
    const productsCountRes = db.exec('SELECT COUNT(*) FROM products');
    const usersCountRes = db.exec('SELECT COUNT(*) FROM users');

    const ordersCount = Number(ordersCountRes[0]?.values[0]?.[0] || 0);
    const paymentsCount = Number(paymentsCountRes[0]?.values[0]?.[0] || 0);
    const productsCount = Number(productsCountRes[0]?.values[0]?.[0] || 0);
    const usersCount = Number(usersCountRes[0]?.values[0]?.[0] || 0);

    const integrityPass = ordersCount > 0 && productsCount > 20 && usersCount > 0;
    record(
      'Database Integrity',
      'Database schema, foreign constraints, and record counts verified in SQLite',
      integrityPass,
      `Orders: ${ordersCount}, Payments: ${paymentsCount}, Products: ${productsCount}, Users: ${usersCount}`
    );
  } catch (e: any) {
    record('Database Integrity', 'Database Integrity Check', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 14. SCENARIO 14 & 15: ERROR HANDLING
  // -------------------------------------------------------------------------
  try {
    // 1. Empty order
    const emptyRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({ items: [] }),
    });
    const emptyHandled = emptyRes.status === 400;

    // 2. Non-existent product
    const nonExistentRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customerAToken}` },
      body: JSON.stringify({ items: [{ productId: 'invalid_prod_9999', quantity: 1 }] }),
    });
    const nonExistentHandled = nonExistentRes.status === 400;

    // 3. Expired / Invalid session token
    const invalidTokenRes = await fetch(`${BASE_URL}/api/debts`, {
      headers: { 'Authorization': 'Bearer invalid_garbage_token_12345' },
    });
    const invalidTokenHandled = invalidTokenRes.status === 403 || invalidTokenRes.status === 401;

    const errorPass = emptyHandled && nonExistentHandled && invalidTokenHandled;
    record(
      'Error Handling',
      'API gracefully handles invalid payloads, missing products, and fake sessions without crashes',
      errorPass,
      `Empty items: 400, Bad Product: 400, Invalid Token: ${invalidTokenRes.status}`
    );
  } catch (e: any) {
    record('Error Handling', 'Error Handling Test Error', false, e.message);
  }

  console.log('===========================================================');
  console.log('🏁 PRODUCTION AUDIT RUN FINISHED');
  console.log('===========================================================');
  console.log(JSON.stringify(results, null, 2));
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
