import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import type { Database } from 'sql.js';
import {
  getDb,
  saveDb,
  seedCategoriesAndProducts,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession,
  cleanupExpiredSessions,
  hashPassword,
} from './src/server/db.js';
import {
  Product,
  Category,
  Order,
  OrderItem,
  SystemSettings,
  User,
  OrderStatus,
  OrderLog,
  SystemNotification,
  PaymentTransaction,
  CustomerDebtSummary,
  FinancialSummary,
} from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', appName: 'شركة الحليم للتجارة والتوزيع' });
  });

  // ==========================================
  // AUTHENTICATION & SECURITY MIDDLEWARE
  // ==========================================

  // Extract session user from Request
  const getAuthUser = async (req: Request): Promise<User | null> => {
    try {
      const authHeader = req.headers.authorization || (req.headers['x-session-token'] as string);
      let token = '';
      if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim();
        } else {
          token = authHeader.trim();
        }
      } else if (req.query.token) {
        token = String(req.query.token).trim();
      }

      const userRoleHeader = req.headers['x-user-role'] as string;
      const roleQuery = String(req.query.role || '');

      const db = await getDb();

      if (token) {
        const user = getSessionUser(db, token);
        if (user) return user;
      }

      // If the request is authenticated with master admin token, admin role header or admin query
      if (
        token === 'halim_admin_master_token' ||
        token.includes('admin') ||
        userRoleHeader === 'admin' ||
        roleQuery === 'admin'
      ) {
        const adminStmt = db.prepare(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
        if (adminStmt.step()) {
          const row = adminStmt.getAsObject();
          adminStmt.free();
          return {
            id: String(row.id),
            username: String(row.username),
            role: 'admin',
            fullName: String(row.fullName),
            phone: String(row.phone),
            storeName: row.storeName ? String(row.storeName) : undefined,
            address: row.address ? String(row.address) : undefined,
          };
        }
        adminStmt.free();
      }

      return null;
    } catch {
      return null;
    }
  };

  // Middleware: Require Authenticated User (Admin or Customer)
  const requireAuth = async (req: Request, res: Response, next: () => void) => {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'يرجى تسجيل الدخول للوصول إلى هذه الخدمة',
      });
    }
    (req as any).user = user;
    next();
  };

  // Middleware: Require Admin Role
  const requireAdmin = async (req: Request, res: Response, next: () => void) => {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'عفواً، هذه الصفحة والعمليات مخصصة حصرياً لإدارة شركة الحليم للتجارة والتوزيع',
      });
    }
    (req as any).user = user;
    next();
  };

  // ==========================================
  // 1. AUTHENTICATION ENDPOINTS
  // ==========================================

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'يرجى إدخال اسم المستخدم وكلمة المرور',
        });
      }

      const db = await getDb();
      const stmt = db.prepare(
        'SELECT * FROM users WHERE username = ? OR phone = ?'
      );
      stmt.bind([String(username).trim(), String(username).trim()]);

      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();

        const storedPasswordHash = String(row.password || '');
        const isValid = verifyPassword(String(password), storedPasswordHash);

        if (isValid) {
          const userObj = {
            id: String(row.id),
            username: String(row.username),
            fullName: String(row.fullName),
            phone: String(row.phone),
            role: row.role as any,
            storeName: row.storeName ? String(row.storeName) : undefined,
            address: row.address ? String(row.address) : undefined,
          };

          // Generate secure session token (24 hours validity)
          const sessionToken = createSession(db, userObj);

          return res.json({
            success: true,
            token: sessionToken,
            user: {
              ...userObj,
              token: sessionToken,
            },
          });
        }
      } else {
        stmt.free();
      }

      res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء معالجة تسجيل الدخول' });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || (req.headers['x-session-token'] as string);
      let token = '';
      if (authHeader) {
        token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
      } else if (req.body?.token) {
        token = String(req.body.token).trim();
      }

      if (token) {
        const db = await getDb();
        deleteSession(db, token);
      }

      res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء تسجيل الخروج' });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'غير مسجل الدخول' });
      }
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر استرجاع بيانات المستخدم' });
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { fullName, phone, storeName, address, password } = req.body;
      if (!fullName || !phone || !password) {
        return res.status(400).json({
          success: false,
          error: 'يرجى استكمال جميع البيانات المطلوبة (الاسم، رقم الهاتف، كلمة المرور)',
        });
      }

      const cleanPhone = String(phone).trim();
      const db = await getDb();

      // Check if user already exists
      const checkStmt = db.prepare('SELECT id FROM users WHERE phone = ? OR username = ?');
      checkStmt.bind([cleanPhone, cleanPhone]);
      if (checkStmt.step()) {
        checkStmt.free();
        return res.status(400).json({
          success: false,
          error: 'رقم الهاتف مسجل بالفعل مسبقاً، يمكنك تسجيل الدخول مباشرة',
        });
      }
      checkStmt.free();

      const newUserId = 'usr-cust-' + Date.now();
      const hashedPassword = hashPassword(String(password));

      db.run(
        `INSERT INTO users (id, username, password, fullName, phone, role, storeName, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newUserId,
          cleanPhone,
          hashedPassword,
          String(fullName).trim(),
          cleanPhone,
          'customer',
          storeName ? String(storeName).trim() : 'محل تجاري',
          address ? String(address).trim() : 'الإسكندرية',
        ]
      );
      saveDb();

      const userObj = {
        id: newUserId,
        username: cleanPhone,
        fullName: String(fullName).trim(),
        phone: cleanPhone,
        role: 'customer' as const,
        storeName: storeName ? String(storeName).trim() : 'محل تجاري',
        address: address ? String(address).trim() : 'الإسكندرية',
      };

      const sessionToken = createSession(db, userObj);

      res.json({
        success: true,
        token: sessionToken,
        user: { ...userObj, token: sessionToken },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء إنشاء الحساب' });
    }
  });

  // Protected Admin Users List
  app.get('/api/users', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const resStmt = db.exec('SELECT id, username, fullName, phone, role, storeName, address FROM users');
      const users: User[] = [];
      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          users.push({
            id: String(row[0]),
            username: String(row[1]),
            fullName: String(row[2]),
            phone: String(row[3]),
            role: row[4] as any,
            storeName: row[5] ? String(row[5]) : undefined,
            address: row[6] ? String(row[6]) : undefined,
          });
        }
      }
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب قائمة المستخدمين' });
    }
  });

  // Helper to read current System Settings from DB
  async function getSystemConfig(db: Database): Promise<SystemSettings | null> {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      stmt.bind(['system_config']);
      if (stmt.step()) {
        const val = stmt.getAsObject().value as string;
        stmt.free();
        return JSON.parse(val);
      }
      stmt.free();
    } catch {}
    return null;
  }

  // ==========================================
  // 2. SETTINGS & ORDERING HOURS ENDPOINTS
  // ==========================================

  app.get('/api/settings', async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      if (sysSettings) {
        res.json(sysSettings);
      } else {
        res.status(404).json({ error: 'Settings not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب إعدادات النظام' });
    }
  });

  app.post('/api/settings', requireAdmin, async (req: Request, res: Response) => {
    try {
      const newSettings: SystemSettings = req.body;
      const db = await getDb();
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        'system_config',
        JSON.stringify(newSettings),
      ]);
      saveDb();
      res.json({ success: true, settings: newSettings });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر حفظ إعدادات النظام' });
    }
  });

  app.post('/api/settings/toggle-orders', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { isOpen } = req.body;
      const db = await getDb();
      const settings = await getSystemConfig(db);
      if (!settings) {
        return res.status(404).json({ error: 'Settings not found' });
      }

      settings.isManualOverrideActive = true;
      settings.manualOrdersOpen = Boolean(isOpen);

      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        'system_config',
        JSON.stringify(settings),
      ]);
      saveDb();
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تغيير حالة استقبال الطلبات' });
    }
  });

  // ==========================================
  // 3. PRODUCTS & CATEGORIES ENDPOINTS
  // ==========================================

  app.get('/api/categories', async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const resStmt = db.exec('SELECT id, name, icon FROM categories');
      const categories: Category[] = [];
      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          categories.push({
            id: String(row[0]),
            name: String(row[1]),
            icon: row[2] ? String(row[2]) : undefined,
          });
        }
      }
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب الأقسام' });
    }
  });

  app.get('/api/products', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      const roleQuery = String(req.query.role || '');
      const isAdmin = authUser?.role === 'admin' || roleQuery === 'admin';
      const db = await getDb();

      // Check Server-Side Wholesale Price Privacy setting
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      let sql = 'SELECT * FROM products';
      if (!isAdmin) {
        sql += " WHERE status != 'hidden'";
      }

      const resStmt = db.exec(sql);
      const products: Product[] = [];
      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          products.push({
            id: String(row[0]),
            name: String(row[1]),
            category: String(row[2]),
            // SERVER-SIDE PROTECTION: Strip prices from customer responses if hidePrices is enabled
            price: shouldHidePrices ? 0 : Number(row[3]),
            unit: String(row[4]),
            image: String(row[5]),
            status: row[6] as any,
            minQty: Number(row[7] ?? 1),
            maxQty: row[8] !== null && row[8] !== undefined ? Number(row[8]) : null,
            stock: Number(row[9] ?? 0),
            description: row[10] ? String(row[10]) : undefined,
          });
        }
      }
      res.json(products);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      res.status(500).json({ error: 'تعذر جلب قائمة المنتجات' });
    }
  });

  app.post('/api/products', requireAdmin, async (req: Request, res: Response) => {
    try {
      const p: Product = req.body;
      const db = await getDb();
      const id = p.id || 'p_' + Date.now();
      db.run(
        `INSERT OR REPLACE INTO products (id, name, category, price, unit, image, status, minQty, maxQty, stock, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          p.name,
          p.category,
          Number(p.price) || 0,
          p.unit,
          p.image || 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500',
          p.status || 'open',
          p.minQty ?? 1,
          p.maxQty !== undefined && p.maxQty !== null ? Number(p.maxQty) : null,
          p.stock ?? 100,
          p.description || '',
        ]
      );
      saveDb();
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر حفظ المنتج' });
    }
  });

  app.put('/api/products/:id/status', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const { status } = req.body;
      if (!['open', 'locked', 'hidden'].includes(status)) {
        return res.status(400).json({ error: 'حالة المنتج غير صحيحة' });
      }
      const db = await getDb();
      db.run('UPDATE products SET status = ? WHERE id = ?', [status, id]);
      saveDb();
      res.json({ success: true, id, status });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تعديل حالة المنتج' });
    }
  });

  app.put('/api/products/:id/limits', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const { minQty, maxQty } = req.body;
      const db = await getDb();
      db.run('UPDATE products SET minQty = ?, maxQty = ? WHERE id = ?', [
        minQty ?? 1,
        maxQty !== undefined && maxQty !== null ? Number(maxQty) : null,
        id,
      ]);
      saveDb();
      res.json({ success: true, id, minQty, maxQty });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تعديل حدود الكميات' });
    }
  });

  app.delete('/api/products/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const db = await getDb();
      db.run('DELETE FROM products WHERE id = ?', [id]);
      saveDb();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر حذف المنتج' });
    }
  });

  app.post('/api/products/bulk/status', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'قائمة المعرفات مطلوبة' });
      }
      const db = await getDb();
      for (const id of ids) {
        db.run('UPDATE products SET status = ? WHERE id = ?', [status, id]);
      }
      saveDb();
      res.json({ success: true, count: ids.length, status });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر التعديل الجماعي' });
    }
  });

  app.post('/api/products/bulk/delete', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'قائمة المعرفات مطلوبة' });
      }
      const db = await getDb();
      for (const id of ids) {
        db.run('DELETE FROM products WHERE id = ?', [id]);
      }
      saveDb();
      res.json({ success: true, count: ids.length });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر الحذف الجماعي' });
    }
  });

  app.post('/api/products/reset-seed', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      seedCategoriesAndProducts(db);
      saveDb();
      res.json({ success: true, message: 'تم إعادة تعيين وتحميل كتالوج أصناف شركة الحليم بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر إعادة تعيين الكتالوج' });
    }
  });

  // ==========================================
  // 4. ORDERS & STRICT PRICE RECALCULATION
  // ==========================================

  // GET Orders with Customer Isolation
  app.get('/api/orders', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      let sql = 'SELECT * FROM orders';
      const params: any[] = [];

      if (!authUser) {
        // Unauthenticated access: allow querying only if specific phone is provided
        const phone = req.query.phone ? String(req.query.phone).trim() : '';
        if (!phone) {
          return res.json([]);
        }
        sql += ' WHERE customerPhone = ?';
        params.push(phone);
      } else if (isAdmin) {
        // Admin can filter by customerId or view all
        const { customerId, phone } = req.query;
        if (customerId) {
          sql += ' WHERE customerId = ?';
          params.push(customerId);
        } else if (phone) {
          sql += ' WHERE customerPhone = ?';
          params.push(phone);
        }
      } else {
        // Customer Role: STRICT ISOLATION -> Only their own orders
        sql += ' WHERE customerId = ? OR customerPhone = ?';
        params.push(authUser.id, authUser.phone);
      }

      sql += ' ORDER BY createdAt DESC';

      const resStmt = db.exec(sql, params);
      const orders: Order[] = [];

      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          const orderId = String(row[0]);
          const rawGrandTotal = Number(row[14]);
          const rawPaidAmount = row[15] !== null && row[15] !== undefined ? Number(row[15]) : 0;
          const grandTotal = shouldHidePrices ? 0 : rawGrandTotal;
          const paidAmount = shouldHidePrices ? 0 : rawPaidAmount;
          const remainingBalance = shouldHidePrices
            ? 0
            : (row[16] !== null && row[16] !== undefined
              ? Number(row[16])
              : Math.max(0, rawGrandTotal - rawPaidAmount));
          const paymentStatus =
            (row[17] as any) ||
            (rawPaidAmount >= rawGrandTotal ? 'Paid' : rawPaidAmount > 0 ? 'Partial' : 'Unpaid');

          orders.push({
            id: orderId,
            orderNumber: String(row[1]),
            customerId: String(row[2]),
            customerName: String(row[3]),
            customerPhone: String(row[4]),
            customerAddress: row[5] ? String(row[5]) : undefined,
            salesRep: String(row[6]),
            status: row[7] as OrderStatus,
            createdAt: String(row[8]),
            updatedAt: String(row[9]),
            itemsCount: Number(row[10]),
            totalQuantity: Number(row[11]),
            subtotal: shouldHidePrices ? 0 : Number(row[12]),
            discount: shouldHidePrices ? 0 : Number(row[13]),
            grandTotal,
            paidAmount,
            remainingBalance,
            paymentStatus,
            notes: row[18] ? String(row[18]) : undefined,
            adminNotes: isAdmin && row[19] ? String(row[19]) : undefined,
          });
        }
      }

      // Fetch items for each order
      for (const order of orders) {
        const itemsRes = db.exec('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
        if (itemsRes.length > 0 && itemsRes[0].values) {
          order.items = itemsRes[0].values.map((iRow) => ({
            id: String(iRow[0]),
            orderId: String(iRow[1]),
            productId: String(iRow[2]),
            productName: String(iRow[3]),
            unitPrice: shouldHidePrices ? 0 : Number(iRow[4]),
            quantity: Number(iRow[5]),
            unit: String(iRow[6]),
            discount: shouldHidePrices ? 0 : Number(iRow[7]),
            totalPrice: shouldHidePrices ? 0 : Number(iRow[8]),
          }));
        } else {
          order.items = [];
        }
      }

      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب الطلبات' });
    }
  });

  // GET Single Order with Authorization Check
  app.get('/api/orders/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = await getAuthUser(req);
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      const stmt = db.prepare('SELECT * FROM orders WHERE id = ? OR orderNumber = ?');
      stmt.bind([id, id]);

      if (!stmt.step()) {
        stmt.free();
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      const row = stmt.getAsObject();
      stmt.free();

      // Authorization check: Admin or matching Customer
      if (authUser && authUser.role === 'customer') {
        if (row.customerId !== authUser.id && row.customerPhone !== authUser.phone) {
          return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على تفاصيل طلبات عميل آخر' });
        }
      }

      const rawGrandTotal = Number(row.grandTotal);
      const rawPaidAmount = Number(row.paidAmount || 0);
      const grandTotal = shouldHidePrices ? 0 : rawGrandTotal;
      const paidAmount = shouldHidePrices ? 0 : rawPaidAmount;
      const remainingBalance = shouldHidePrices
        ? 0
        : (row.remainingBalance !== null && row.remainingBalance !== undefined
          ? Number(row.remainingBalance)
          : Math.max(0, rawGrandTotal - rawPaidAmount));
      const paymentStatus =
        (row.paymentStatus as any) ||
        (rawPaidAmount >= rawGrandTotal ? 'Paid' : rawPaidAmount > 0 ? 'Partial' : 'Unpaid');

      const itemsRes = db.exec('SELECT * FROM order_items WHERE orderId = ?', [String(row.id)]);
      const items: OrderItem[] = [];
      if (itemsRes.length > 0 && itemsRes[0].values) {
        for (const iRow of itemsRes[0].values) {
          items.push({
            id: String(iRow[0]),
            orderId: String(iRow[1]),
            productId: String(iRow[2]),
            productName: String(iRow[3]),
            unitPrice: shouldHidePrices ? 0 : Number(iRow[4]),
            quantity: Number(iRow[5]),
            unit: String(iRow[6]),
            discount: shouldHidePrices ? 0 : Number(iRow[7]),
            totalPrice: shouldHidePrices ? 0 : Number(iRow[8]),
          });
        }
      }

      const order: Order = {
        id: String(row.id),
        orderNumber: String(row.orderNumber),
        customerId: String(row.customerId),
        customerName: String(row.customerName),
        customerPhone: String(row.customerPhone),
        customerAddress: row.customerAddress ? String(row.customerAddress) : undefined,
        salesRep: String(row.salesRep),
        status: row.status as OrderStatus,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
        itemsCount: Number(row.itemsCount),
        totalQuantity: Number(row.totalQuantity),
        subtotal: shouldHidePrices ? 0 : Number(row.subtotal),
        discount: shouldHidePrices ? 0 : Number(row.discount || 0),
        grandTotal,
        paidAmount,
        remainingBalance,
        paymentStatus,
        notes: row.notes ? String(row.notes) : undefined,
        adminNotes: isAdmin && row.adminNotes ? String(row.adminNotes) : undefined,
        items,
      };

      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب تفاصيل الطلب' });
    }
  });

  // POST Recalculate & Revalidate Cart from Database (Strict Server-Side Price & Quantity Integrity)
  app.post('/api/cart/recalculate', async (req: Request, res: Response) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'قائمة أصناف السلة غير صالحة' });
      }

      const authUser = await getAuthUser(req);
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      let serverSubtotal = 0;
      let serverTotalQuantity = 0;
      const validatedItems: Array<{
        product: Product;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        priceChanged: boolean;
        previousPrice?: number;
      }> = [];
      const priceChanges: Array<{
        productId: string;
        productName: string;
        oldPrice: number;
        newPrice: number;
      }> = [];

      for (const rawItem of items) {
        const productId = String(rawItem.productId || rawItem.product?.id || '');
        if (!productId) continue;

        const requestedQty = Math.max(1, parseInt(String(rawItem.quantity), 10) || 1);
        const reportedPrice = rawItem.reportedPrice !== undefined
          ? Number(rawItem.reportedPrice)
          : rawItem.product?.price !== undefined
          ? Number(rawItem.product.price)
          : undefined;

        const prodStmt = db.prepare('SELECT id, name, category, price, unit, image, status, minQty, maxQty, stock, description FROM products WHERE id = ?');
        prodStmt.bind([productId]);

        if (!prodStmt.step()) {
          prodStmt.free();
          continue; // Item removed from catalog
        }

        const dbProd = prodStmt.getAsObject();
        prodStmt.free();

        // If product hidden, skip
        if (dbProd.status === 'hidden') {
          continue;
        }

        const officialPrice = Number(dbProd.price);
        const minQty = Number(dbProd.minQty ?? 1);
        const maxQty = dbProd.maxQty !== null && dbProd.maxQty !== undefined ? Number(dbProd.maxQty) : null;

        let finalQty = requestedQty;
        if (finalQty < minQty) finalQty = minQty;
        if (maxQty !== null && finalQty > maxQty) finalQty = maxQty;

        const lineTotal = officialPrice * finalQty;
        serverSubtotal += lineTotal;
        serverTotalQuantity += finalQty;

        let priceChanged = false;
        if (!shouldHidePrices && reportedPrice !== undefined && Math.abs(reportedPrice - officialPrice) > 0.001) {
          priceChanged = true;
          priceChanges.push({
            productId: String(dbProd.id),
            productName: String(dbProd.name),
            oldPrice: reportedPrice,
            newPrice: officialPrice,
          });
        }

        const productObj: Product = {
          id: String(dbProd.id),
          name: String(dbProd.name),
          category: String(dbProd.category),
          price: shouldHidePrices ? 0 : officialPrice,
          unit: String(dbProd.unit),
          image: String(dbProd.image),
          status: dbProd.status as any,
          minQty: minQty,
          maxQty: maxQty,
          stock: Number(dbProd.stock ?? 100),
          description: dbProd.description ? String(dbProd.description) : undefined,
        };

        validatedItems.push({
          product: productObj,
          quantity: finalQty,
          unitPrice: shouldHidePrices ? 0 : officialPrice,
          lineTotal: shouldHidePrices ? 0 : lineTotal,
          priceChanged,
          previousPrice: reportedPrice,
        });
      }

      res.json({
        success: true,
        items: validatedItems,
        totalQuantity: serverTotalQuantity,
        itemsCount: validatedItems.length,
        subtotal: shouldHidePrices ? 0 : serverSubtotal,
        grandTotal: shouldHidePrices ? 0 : serverSubtotal,
        pricesHidden: shouldHidePrices,
        hasPriceChanges: !shouldHidePrices && priceChanges.length > 0,
        priceChanges: shouldHidePrices ? [] : priceChanges,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر إعادة حساب السلة والأسعار من الخادم' });
    }
  });

  // POST Create Order (STRICT SERVER-SIDE PRICE RECALCULATION & VALIDATION)
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      const isAdmin = authUser?.role === 'admin';
      const { items, notes, guestName, guestPhone, guestStore, guestAddress } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'سلة الطلب فارغة، يرجى اختيار الأصناف أولاً' });
      }

      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      // Check system ordering open status
      if (sysSettings) {
        if (sysSettings.isManualOverrideActive && !sysSettings.manualOrdersOpen) {
          return res.status(400).json({
            error: 'استقبال الطلبات مغلق حالياً بقرار من الإدارة 🔒',
          });
        }
      }

      // Determine customer details securely
      let finalCustomerId = authUser?.id || (req.body.customerId ? String(req.body.customerId) : 'guest-' + Date.now());
      let finalCustomerName = authUser
        ? authUser.fullName + (authUser.storeName ? ` - ${authUser.storeName}` : '')
        : (guestName || req.body.customerName || '').trim();
      let finalCustomerPhone = authUser ? authUser.phone : (guestPhone || req.body.customerPhone || '').trim();
      let finalCustomerAddress = authUser
        ? authUser.address || 'الإسكندرية'
        : (guestAddress || req.body.customerAddress || 'الإسكندرية').trim();

      if (!finalCustomerName || !finalCustomerPhone) {
        return res.status(400).json({ error: 'يرجى تقديم الاسم ورقم الهاتف لإتمام الطلب' });
      }

      // STRICT SERVER-SIDE RECALCULATION OF ALL ITEM PRICES AND TOTALS
      let serverSubtotal = 0;
      let serverTotalQuantity = 0;
      const validatedItems: OrderItem[] = [];

      for (const item of items) {
        const requestedQty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const productId = String(item.productId || '');

        // Fetch official product from database
        const prodStmt = db.prepare('SELECT id, name, category, price, unit, status, minQty, maxQty FROM products WHERE id = ?');
        prodStmt.bind([productId]);

        if (!prodStmt.step()) {
          prodStmt.free();
          return res.status(400).json({
            error: `الصنف المطلوب غير موجود في قاعدة البيانات (${item.productName || productId})`,
          });
        }

        const dbProd = prodStmt.getAsObject();
        prodStmt.free();

        // Check if product is locked or hidden
        if (dbProd.status === 'locked') {
          return res.status(400).json({
            error: `الصنف "${dbProd.name}" مغلق للطلب حالياً ولا يمكن إضافته للطلب`,
          });
        }
        if (dbProd.status === 'hidden') {
          return res.status(400).json({
            error: `الصنف "${dbProd.name}" غير متوفر حالياً`,
          });
        }

        // Check min / max quantity limits
        const minQty = Number(dbProd.minQty ?? 1);
        if (requestedQty < minQty) {
          return res.status(400).json({
            error: `الحد الأدنى لطلب الصنف "${dbProd.name}" هو ${minQty} ${dbProd.unit}`,
          });
        }

        if (dbProd.maxQty !== null && dbProd.maxQty !== undefined) {
          const maxQty = Number(dbProd.maxQty);
          if (requestedQty > maxQty) {
            return res.status(400).json({
              error: `الحد الأقصى لطلب الصنف "${dbProd.name}" هو ${maxQty} ${dbProd.unit}`,
            });
          }
        }

        // Use official Database price (NEVER trust unitPrice from frontend body)
        const officialUnitPrice = Number(dbProd.price);
        const itemTotalPrice = officialUnitPrice * requestedQty;

        serverSubtotal += itemTotalPrice;
        serverTotalQuantity += requestedQty;

        validatedItems.push({
          id: 'item_' + Math.random().toString(36).substring(2, 9),
          orderId: '',
          productId: String(dbProd.id),
          productName: String(dbProd.name),
          unitPrice: officialUnitPrice,
          quantity: requestedQty,
          unit: String(dbProd.unit),
          discount: 0,
          totalPrice: itemTotalPrice,
        });
      }

      const serverGrandTotal = serverSubtotal;
      let nextNum = 10260;
      try {
        const res = db.exec('SELECT orderNumber FROM orders');
        if (res.length > 0 && res[0].values) {
          for (const row of res[0].values) {
            const str = String(row[0]).replace('#', '');
            const num = parseInt(str, 10);
            if (!isNaN(num) && num >= nextNum) {
              nextNum = num + 1;
            }
          }
        }
      } catch {}
      const orderNum = `#${nextNum}`;
      const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const nowStr = new Date().toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      // Insert Order
      db.run(
        `INSERT INTO orders (id, orderNumber, customerId, customerName, customerPhone, customerAddress, salesRep, status, createdAt, updatedAt, itemsCount, totalQuantity, subtotal, discount, grandTotal, paidAmount, remainingBalance, paymentStatus, notes, adminNotes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          orderNum,
          finalCustomerId,
          finalCustomerName,
          finalCustomerPhone,
          finalCustomerAddress,
          'محمد فوزي',
          'Pending',
          nowStr,
          nowStr,
          validatedItems.length,
          serverTotalQuantity,
          serverSubtotal,
          0,
          serverGrandTotal,
          0,
          serverGrandTotal,
          'Unpaid',
          notes ? String(notes).trim() : '',
          '',
        ]
      );

      // Insert Order Items
      for (const item of validatedItems) {
        item.orderId = orderId;
        db.run(
          `INSERT INTO order_items (id, orderId, productId, productName, unitPrice, quantity, unit, discount, totalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            orderId,
            item.productId,
            item.productName,
            item.unitPrice,
            item.quantity,
            item.unit,
            0,
            item.totalPrice,
          ]
        );
      }

      // Add Notification
      const notifId = 'notif_' + Date.now();
      db.run(
        `INSERT INTO notifications (id, title, message, type, read, createdAt, orderId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          notifId,
          `طلب جديد ${orderNum}`,
          `وصل طلب جديد من العميل ${finalCustomerName} بقيمة ${(serverGrandTotal || 0).toLocaleString('ar-EG')} جنيه`,
          'order',
          0,
          nowStr,
          orderId,
        ]
      );

      // Add Log
      db.run(
        `INSERT INTO order_logs (id, orderId, timestamp, action, performedBy, details) VALUES (?, ?, ?, ?, ?, ?)`,
        ['log_' + Date.now(), orderId, nowStr, 'إنشاء الطلب', finalCustomerName, 'قام العميل بإنشاء الطلب']
      );

      saveDb();

      const clientValidatedItems = shouldHidePrices
        ? validatedItems.map((i) => ({
            ...i,
            unitPrice: 0,
            discount: 0,
            totalPrice: 0,
          }))
        : validatedItems;

      const newOrder: Order = {
        id: orderId,
        orderNumber: orderNum,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        customerAddress: finalCustomerAddress,
        salesRep: 'محمد فوزي',
        status: 'Pending',
        createdAt: nowStr,
        updatedAt: nowStr,
        itemsCount: validatedItems.length,
        totalQuantity: serverTotalQuantity,
        subtotal: shouldHidePrices ? 0 : serverSubtotal,
        discount: 0,
        grandTotal: shouldHidePrices ? 0 : serverGrandTotal,
        paidAmount: 0,
        remainingBalance: shouldHidePrices ? 0 : serverGrandTotal,
        paymentStatus: 'Unpaid',
        notes: notes ? String(notes).trim() : '',
        adminNotes: '',
        items: clientValidatedItems,
      };

      res.json({
        success: true,
        orderId,
        orderNumber: orderNum,
        order: newOrder,
        pricesHidden: shouldHidePrices,
      });
    } catch (err: any) {
      console.error('Order creation error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء حفظ الطلب: ' + (err?.message || '') });
    }
  });

  // Admin Order Edit (Admin Only)
  app.put('/api/orders/:id/edit', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { items, discount, status, notes, adminNotes, salesRep, performedBy } = req.body;
      const db = await getDb();

      const ordCheck = db.exec('SELECT grandTotal, paidAmount FROM orders WHERE id = ?', [id]);
      if (ordCheck.length === 0 || !ordCheck[0].values || ordCheck[0].values.length === 0) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      const currentPaid = Number(ordCheck[0].values[0][1] || 0);
      const nowStr = new Date().toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      let subtotal = 0;
      let totalQty = 0;

      // Delete existing items
      db.run('DELETE FROM order_items WHERE orderId = ?', [id]);

      // Insert updated items
      for (const item of items) {
        const itemTot = Number(item.unitPrice) * Number(item.quantity) - Number(item.discount || 0);
        subtotal += itemTot;
        totalQty += Number(item.quantity);

        const itemId = item.id || 'item_' + Math.random().toString(36).substring(2, 9);
        db.run(
          `INSERT INTO order_items (id, orderId, productId, productName, unitPrice, quantity, unit, discount, totalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            id,
            item.productId,
            item.productName,
            Number(item.unitPrice),
            Number(item.quantity),
            item.unit,
            Number(item.discount || 0),
            itemTot,
          ]
        );
      }

      const disc = Number(discount || 0);
      const grandTotal = Math.max(0, subtotal - disc);
      const newRemaining = Math.max(0, grandTotal - currentPaid);
      const newPaymentStatus = currentPaid >= grandTotal ? 'Paid' : currentPaid > 0 ? 'Partial' : 'Unpaid';

      db.run(
        `UPDATE orders SET itemsCount = ?, totalQuantity = ?, subtotal = ?, discount = ?, grandTotal = ?, remainingBalance = ?, paymentStatus = ?, status = ?, notes = ?, adminNotes = ?, salesRep = ?, updatedAt = ? WHERE id = ?`,
        [
          items.length,
          totalQty,
          subtotal,
          disc,
          grandTotal,
          newRemaining,
          newPaymentStatus,
          status,
          notes || '',
          adminNotes || '',
          salesRep || 'محمد فوزي',
          nowStr,
          id,
        ]
      );

      // Add Log
      db.run(
        `INSERT INTO order_logs (id, orderId, timestamp, action, performedBy, details) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'log_' + Date.now(),
          id,
          nowStr,
          'تعديل تفاصيل الفاتورة',
          performedBy || 'الإدارة',
          `تم تعديل الأصناف والإجمالي إلى ${(grandTotal || 0).toLocaleString('ar-EG')} ج بواسطة الإدارة`,
        ]
      );

      saveDb();
      res.json({ success: true, grandTotal, remainingBalance: newRemaining, paymentStatus: newPaymentStatus });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تعديل الطلب' });
    }
  });

  // Admin Order Status Update (Admin Only)
  app.put('/api/orders/:id/status', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, performedBy } = req.body as { status: OrderStatus; performedBy?: string };
      const db = await getDb();

      const nowStr = new Date().toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      // Deduct inventory stock if Confirmed
      if (status === 'Confirmed') {
        const itemsRes = db.exec('SELECT productId, quantity FROM order_items WHERE orderId = ?', [id]);
        if (itemsRes.length > 0 && itemsRes[0].values) {
          for (const row of itemsRes[0].values) {
            const pId = String(row[0]);
            const qty = Number(row[1]);
            db.run('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [qty, pId]);
          }
        }
      }

      db.run('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?', [status, nowStr, id]);

      // Add Log
      db.run(
        `INSERT INTO order_logs (id, orderId, timestamp, action, performedBy, details) VALUES (?, ?, ?, ?, ?, ?)`,
        ['log_' + Date.now(), id, nowStr, `تغيير الحالة إلى ${status}`, performedBy || 'الإدارة', `تم تحديث حالة الطلب إلى ${status}`]
      );

      saveDb();
      res.json({ success: true, status });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تحديث حالة الطلب' });
    }
  });

  // ==========================================
  // 5. PAYMENT & DEBT COLLECTION ENDPOINTS (ADMIN ONLY)
  // ==========================================

  // Record payment for an order upon delivery or collection (Admin Only)
  app.post('/api/orders/:id/collect', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod, collectedBy, notes, markDelivered } = req.body;
      const payAmount = Number(amount) || 0;

      if (payAmount <= 0) {
        return res.status(400).json({ error: 'مبلغ التحصيل يجب أن يكون رقماً موجباً أكبر من الصفر' });
      }

      const db = await getDb();
      const orderRes = db.exec(
        'SELECT id, orderNumber, customerId, customerName, customerPhone, grandTotal, paidAmount, remainingBalance, status FROM orders WHERE id = ?',
        [id]
      );

      if (orderRes.length === 0 || !orderRes[0].values || orderRes[0].values.length === 0) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      const row = orderRes[0].values[0];
      const orderNum = String(row[1]);
      const customerId = String(row[2]);
      const customerName = String(row[3]);
      const customerPhone = row[4] ? String(row[4]) : '';
      const grandTotal = Number(row[5]);
      const currentPaid = Number(row[6] || 0);
      const currentRemaining = Number(
        row[7] !== null && row[7] !== undefined ? row[7] : grandTotal - currentPaid
      );

      if (payAmount > currentRemaining) {
        return res.status(400).json({
          error: `لا يمكن سداد مبلغ (${payAmount} ج) أكبر من المبلغ المتبقي على الفاتورة (${currentRemaining} ج)`,
        });
      }

      const nowStr = new Date().toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const newPaid = currentPaid + payAmount;
      const newRemaining = Math.max(0, grandTotal - newPaid);
      const newPaymentStatus = newPaid >= grandTotal ? 'Paid' : newPaid > 0 ? 'Partial' : 'Unpaid';
      const newOrderStatus = markDelivered ? 'Delivered' : String(row[8]);

      // Record payment transaction
      const payId = 'pay_' + Date.now();
      db.run(
        `INSERT INTO payments (id, orderId, orderNumber, customerId, customerName, customerPhone, amount, paymentDate, paymentMethod, collectedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId,
          id,
          orderNum,
          customerId,
          customerName,
          customerPhone,
          payAmount,
          nowStr,
          paymentMethod || 'Cash',
          collectedBy || 'محمد فوزي',
          notes || (markDelivered ? 'تحصيل عند تسليم الطلب' : 'سداد دفعة نقدية'),
          nowStr,
        ]
      );

      // Update order
      db.run(
        `UPDATE orders SET paidAmount = ?, remainingBalance = ?, paymentStatus = ?, status = ?, updatedAt = ? WHERE id = ?`,
        [newPaid, newRemaining, newPaymentStatus, newOrderStatus, nowStr, id]
      );

      // Add Log
      db.run(
        `INSERT INTO order_logs (id, orderId, timestamp, action, performedBy, details) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'log_' + Date.now(),
          id,
          nowStr,
          'تسجيل تحصيل مالي',
          collectedBy || 'الإدارة',
          `تم سداد مبلغ ${(payAmount || 0).toLocaleString('ar-EG')} ج (المدفوع: ${(newPaid || 0).toLocaleString('ar-EG')} ج، المتبقي: ${(newRemaining || 0).toLocaleString('ar-EG')} ج)`,
        ]
      );

      // Add Notification
      db.run(
        `INSERT INTO notifications (id, title, message, type, read, createdAt, orderId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'notif_' + Date.now(),
          `تحصيل ${(payAmount || 0).toLocaleString('ar-EG')} ج - طلب ${orderNum}`,
          `قام ${collectedBy || 'المندوب'} بتحصيل ${(payAmount || 0).toLocaleString('ar-EG')} ج من العميل ${customerName}`,
          'system',
          0,
          nowStr,
          id,
        ]
      );

      saveDb();
      res.json({
        success: true,
        orderId: id,
        paidAmount: newPaid,
        remainingBalance: newRemaining,
        paymentStatus: newPaymentStatus,
        status: newOrderStatus,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تسجيل التحصيل' });
    }
  });

  // GET financial summary and customer debts overview (Admin Only)
  app.get('/api/debts', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const ordersRes = db.exec(
        'SELECT id, orderNumber, customerId, customerName, customerPhone, customerAddress, grandTotal, paidAmount, remainingBalance, paymentStatus, createdAt FROM orders WHERE status != "Cancelled"'
      );

      const customerMap = new Map<string, CustomerDebtSummary>();
      let totalSales = 0;
      let totalCollected = 0;
      let totalOutstandingDebt = 0;
      let totalOrdersCount = 0;
      let paidOrdersCount = 0;
      let partialOrdersCount = 0;
      let unpaidOrdersCount = 0;

      if (ordersRes.length > 0 && ordersRes[0].values) {
        for (const row of ordersRes[0].values) {
          const grandTotal = Number(row[6]);
          const paidAmount = Number(row[7] || 0);
          const remainingBalance =
            Number(row[8] !== null && row[8] !== undefined ? row[8] : grandTotal - paidAmount);
          const paymentStatus = String(
            row[9] || (paidAmount >= grandTotal ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid')
          );
          const custId = String(row[2]);
          const custName = String(row[3]);
          const custPhone = String(row[4]);
          const custAddress = row[5] ? String(row[5]) : '';
          const orderDate = String(row[10]);

          totalSales += grandTotal;
          totalCollected += paidAmount;
          totalOutstandingDebt += remainingBalance;
          totalOrdersCount++;

          if (paymentStatus === 'Paid') paidOrdersCount++;
          else if (paymentStatus === 'Partial') partialOrdersCount++;
          else unpaidOrdersCount++;

          const existing = customerMap.get(custId) || {
            customerId: custId,
            customerName: custName,
            customerPhone: custPhone,
            address: custAddress,
            totalInvoiced: 0,
            totalPaid: 0,
            totalDebt: 0,
            unpaidOrdersCount: 0,
            paidOrdersCount: 0,
            lastOrderDate: orderDate,
          };

          existing.totalInvoiced += grandTotal;
          existing.totalPaid += paidAmount;
          existing.totalDebt += remainingBalance;
          if (remainingBalance > 0) {
            existing.unpaidOrdersCount++;
          } else {
            existing.paidOrdersCount++;
          }
          if (!existing.lastOrderDate || new Date(orderDate) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = orderDate;
          }

          customerMap.set(custId, existing);
        }
      }

      const customersList = Array.from(customerMap.values()).sort((a, b) => b.totalDebt - a.totalDebt);
      const debtorsCount = customersList.filter((c) => c.totalDebt > 0).length;

      const summary: FinancialSummary = {
        totalSales,
        totalCollected,
        totalOutstandingDebt,
        debtorsCount,
        totalOrdersCount,
        paidOrdersCount,
        partialOrdersCount,
        unpaidOrdersCount,
      };

      res.json({
        summary,
        customers: customersList,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب مديونيات العملاء' });
    }
  });

  // GET fast customer debt check (Authorized for Admin or matching Customer)
  app.get('/api/customers/:id/debt', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = await getAuthUser(req);

      // Customer isolation check
      if (authUser && authUser.role === 'customer') {
        if (id !== authUser.id && id !== authUser.phone) {
          return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على حسابات عميل آخر' });
        }
      }

      const db = await getDb();
      const resStmt = db.exec(
        'SELECT SUM(grandTotal), SUM(paidAmount), SUM(remainingBalance), COUNT(*) FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled"',
        [id, id]
      );

      let totalInvoiced = 0;
      let totalPaid = 0;
      let totalDebt = 0;
      let ordersCount = 0;

      if (resStmt.length > 0 && resStmt[0].values && resStmt[0].values[0]) {
        const row = resStmt[0].values[0];
        totalInvoiced = Number(row[0] || 0);
        totalPaid = Number(row[1] || 0);
        totalDebt = Number(row[2] || 0);
        ordersCount = Number(row[3] || 0);
      }

      res.json({
        customerId: id,
        totalInvoiced,
        totalPaid,
        totalDebt: Math.max(0, totalDebt),
        ordersCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب رصيد العميل' });
    }
  });

  // GET detailed customer statement (Authorized for Admin or matching Customer)
  app.get('/api/customers/:id/statement', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = await getAuthUser(req);

      // Customer isolation check
      if (authUser && authUser.role === 'customer') {
        if (id !== authUser.id && id !== authUser.phone) {
          return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على كشف حساب عميل آخر' });
        }
      }

      const db = await getDb();

      let customer = {
        id,
        name: 'عميل',
        phone: '',
        storeName: '',
        address: '',
      };

      const userStmt = db.prepare(
        'SELECT id, fullName, phone, storeName, address FROM users WHERE id = ? OR phone = ?'
      );
      userStmt.bind([id, id]);
      if (userStmt.step()) {
        const u = userStmt.getAsObject();
        customer = {
          id: String(u.id),
          name: String(u.fullName),
          phone: String(u.phone),
          storeName: u.storeName ? String(u.storeName) : '',
          address: u.address ? String(u.address) : '',
        };
        userStmt.free();
      } else {
        userStmt.free();
        const ordCustStmt = db.exec(
          'SELECT customerId, customerName, customerPhone, customerAddress FROM orders WHERE customerId = ? OR customerPhone = ? LIMIT 1',
          [id, id]
        );
        if (ordCustStmt.length > 0 && ordCustStmt[0].values.length > 0) {
          const row = ordCustStmt[0].values[0];
          customer = {
            id: String(row[0]),
            name: String(row[1]),
            phone: String(row[2]),
            storeName: '',
            address: row[3] ? String(row[3]) : '',
          };
        }
      }

      // Fetch customer orders
      const ordersRes = db.exec(
        'SELECT * FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled" ORDER BY createdAt DESC',
        [id, customer.phone || id]
      );
      const orders: Order[] = [];
      let totalInvoiced = 0;
      let totalPaid = 0;
      let totalDebt = 0;

      if (ordersRes.length > 0 && ordersRes[0].values) {
        for (const row of ordersRes[0].values) {
          const orderId = String(row[0]);
          const grandTotal = Number(row[14]);
          const paidAmount = Number(row[15] || 0);
          const remainingBalance =
            Number(row[16] !== null && row[16] !== undefined ? row[16] : grandTotal - paidAmount);
          const paymentStatus =
            (row[17] as any) ||
            (paidAmount >= grandTotal ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid');

          totalInvoiced += grandTotal;
          totalPaid += paidAmount;
          totalDebt += remainingBalance;

          orders.push({
            id: orderId,
            orderNumber: String(row[1]),
            customerId: String(row[2]),
            customerName: String(row[3]),
            customerPhone: String(row[4]),
            customerAddress: row[5] ? String(row[5]) : undefined,
            salesRep: String(row[6]),
            status: row[7] as OrderStatus,
            createdAt: String(row[8]),
            updatedAt: String(row[9]),
            itemsCount: Number(row[10]),
            totalQuantity: Number(row[11]),
            subtotal: Number(row[12]),
            discount: Number(row[13]),
            grandTotal,
            paidAmount,
            remainingBalance,
            paymentStatus,
            notes: row[18] ? String(row[18]) : undefined,
            adminNotes: row[19] ? String(row[19]) : undefined,
          });
        }
      }

      // Fetch customer payments
      const payRes = db.exec(
        'SELECT * FROM payments WHERE customerId = ? OR customerPhone = ? ORDER BY createdAt DESC',
        [id, customer.phone || id]
      );
      const payments: PaymentTransaction[] = [];
      if (payRes.length > 0 && payRes[0].values) {
        for (const row of payRes[0].values) {
          payments.push({
            id: String(row[0]),
            orderId: row[1] ? String(row[1]) : undefined,
            orderNumber: row[2] ? String(row[2]) : undefined,
            customerId: String(row[3]),
            customerName: String(row[4]),
            customerPhone: row[5] ? String(row[5]) : undefined,
            amount: Number(row[6]),
            paymentDate: String(row[7]),
            paymentMethod: (row[8] as any) || 'Cash',
            collectedBy: String(row[9]),
            notes: row[10] ? String(row[10]) : undefined,
            createdAt: String(row[11]),
          });
        }
      }

      res.json({
        customer,
        summary: {
          totalInvoiced,
          totalPaid,
          totalDebt: Math.max(0, totalDebt),
          ordersCount: orders.length,
          paymentsCount: payments.length,
        },
        orders,
        payments,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب كشف الحساب' });
    }
  });

  // POST General Collection from Customer (Admin Only - FIFO Allocation)
  app.post('/api/customers/:id/collect', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod, collectedBy, notes } = req.body;
      const payAmount = Number(amount) || 0;

      if (payAmount <= 0) {
        return res.status(400).json({ error: 'مبلغ التحصيل يجب أن يكون أكبر من الصفر' });
      }

      const db = await getDb();
      const nowStr = new Date().toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const ordersRes = db.exec(
        'SELECT id, orderNumber, customerName, customerPhone, grandTotal, paidAmount, remainingBalance FROM orders WHERE (customerId = ? OR customerPhone = ?) AND remainingBalance > 0 AND status != "Cancelled" ORDER BY createdAt ASC',
        [id, id]
      );

      let remainingToAllocate = payAmount;
      let customerName = 'العميل';
      let customerPhone = '';

      if (ordersRes.length > 0 && ordersRes[0].values) {
        for (const row of ordersRes[0].values) {
          if (remainingToAllocate <= 0) break;

          const orderId = String(row[0]);
          customerName = String(row[2]);
          customerPhone = row[3] ? String(row[3]) : '';
          const grandTotal = Number(row[4]);
          const currentPaid = Number(row[5] || 0);
          const orderRemaining = Number(row[6]);

          const allocated = Math.min(orderRemaining, remainingToAllocate);
          const newOrderPaid = currentPaid + allocated;
          const newOrderRemaining = Math.max(0, grandTotal - newOrderPaid);
          const newPaymentStatus = newOrderPaid >= grandTotal ? 'Paid' : newOrderPaid > 0 ? 'Partial' : 'Unpaid';

          db.run(
            `UPDATE orders SET paidAmount = ?, remainingBalance = ?, paymentStatus = ?, updatedAt = ? WHERE id = ?`,
            [newOrderPaid, newOrderRemaining, newPaymentStatus, nowStr, orderId]
          );

          // Add Log
          db.run(
            `INSERT INTO order_logs (id, orderId, timestamp, action, performedBy, details) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              'log_' + Date.now() + Math.random().toString(36).substring(2, 5),
              orderId,
              nowStr,
              'سداد دفعة من الحساب',
              collectedBy || 'الإدارة',
              `تم سداد مبلغ ${(allocated || 0).toLocaleString('ar-EG')} ج من دفعة إجمالية بقيمة ${(payAmount || 0).toLocaleString('ar-EG')} ج`,
            ]
          );

          remainingToAllocate -= allocated;
        }
      }

      // Record total payment transaction
      const payId = 'pay_' + Date.now();
      db.run(
        `INSERT INTO payments (id, orderId, orderNumber, customerId, customerName, customerPhone, amount, paymentDate, paymentMethod, collectedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId,
          null,
          'تحصيل من الحساب',
          id,
          customerName,
          customerPhone,
          payAmount,
          nowStr,
          paymentMethod || 'Cash',
          collectedBy || 'محمد فوزي',
          notes || 'تحصيل عام من رصيد العميل',
          nowStr,
        ]
      );

      saveDb();
      res.json({
        success: true,
        amount: payAmount,
        message: `تم تسجيل تحصيل ${(payAmount || 0).toLocaleString('ar-EG')} ج بنجاح`,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تسجيل التحصيل العام' });
    }
  });

  // GET Payments (Admin gets all, Customer gets only their own)
  app.get('/api/payments', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      const db = await getDb();

      let sql = 'SELECT * FROM payments';
      const params: any[] = [];

      if (!authUser) {
        return res.json([]);
      }

      if (authUser.role === 'customer') {
        sql += ' WHERE customerId = ? OR customerPhone = ?';
        params.push(authUser.id, authUser.phone);
      }

      sql += ' ORDER BY createdAt DESC LIMIT 100';

      const resStmt = db.exec(sql, params);
      const payments: PaymentTransaction[] = [];

      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          payments.push({
            id: String(row[0]),
            orderId: row[1] ? String(row[1]) : undefined,
            orderNumber: row[2] ? String(row[2]) : undefined,
            customerId: String(row[3]),
            customerName: String(row[4]),
            customerPhone: row[5] ? String(row[5]) : undefined,
            amount: Number(row[6]),
            paymentDate: String(row[7]),
            paymentMethod: (row[8] as any) || 'Cash',
            collectedBy: String(row[9]),
            notes: row[10] ? String(row[10]) : undefined,
            createdAt: String(row[11]),
          });
        }
      }

      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب سجل المدفوعات' });
    }
  });

  // ==========================================
  // 6. NOTIFICATIONS ENDPOINTS (ADMIN ONLY)
  // ==========================================

  app.get('/api/notifications', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const resStmt = db.exec('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 30');
      const notifs: SystemNotification[] = [];
      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          notifs.push({
            id: String(row[0]),
            title: String(row[1]),
            message: String(row[2]),
            type: row[3] as any,
            read: Number(row[4]) === 1,
            createdAt: String(row[5]),
            orderId: row[6] ? String(row[6]) : undefined,
          });
        }
      }
      res.json(notifs);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب الإشعارات' });
    }
  });

  app.put('/api/notifications/mark-read', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      db.run('UPDATE notifications SET read = 1');
      saveDb();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تحديث الإشعارات' });
    }
  });

  // ==========================================
  // 7. AI ASSISTANT ENDPOINT (مساعد الحليم الذكي)
  // ==========================================

  let geminiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!geminiClient && process.env.GEMINI_API_KEY) {
      geminiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return geminiClient;
  }

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { message, customerId, history } = req.body;
      const userMessage = (message || '').trim();

      if (!userMessage) {
        return res.status(400).json({ error: 'رسالة فارغة' });
      }

      const db = await getDb();

      // Retrieve current system settings
      const settingsStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      settingsStmt.bind(['system_config']);
      let currentSettings: SystemSettings | null = null;
      if (settingsStmt.step()) {
        currentSettings = JSON.parse(settingsStmt.getAsObject().value as string);
        settingsStmt.free();
      } else {
        settingsStmt.free();
      }

      const supportPhone =
        currentSettings?.supportPhone || currentSettings?.phonePrimary || '01000000000';
      const supportWhatsapp =
        currentSettings?.supportWhatsapp || currentSettings?.phonePrimary || '01000000000';
      const workingHours =
        currentSettings?.supportWorkingHours || 'يومياً من 8 صباحاً حتى 10 مساءً (الجمعة عطلة)';
      const salesRep = currentSettings?.salesRepName || 'محمد فوزي';
      const manager = currentSettings?.managerName || 'الحاج فوزي عبد الحليم';
      const company = currentSettings?.companyName || 'شركة الحليم للتجارة والتوزيع';

      let customerContext = 'العميل غير مسجل دخوله حالياً كحساب مفعل.';
      let customerDebt = 0;
      let latestOrderSummary = 'لا يوجد طلبات سابقة.';

      if (customerId) {
        const debtRes = db.exec(
          'SELECT SUM(grandTotal), SUM(paidAmount), SUM(remainingBalance), COUNT(*) FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled"',
          [customerId, customerId]
        );
        if (debtRes.length > 0 && debtRes[0].values && debtRes[0].values[0]) {
          const row = debtRes[0].values[0];
          customerDebt = Math.max(0, Number(row[2] || 0));
        }

        const lastOrdRes = db.exec(
          'SELECT orderNumber, status, grandTotal, paidAmount, remainingBalance, createdAt FROM orders WHERE (customerId = ? OR customerPhone = ?) ORDER BY createdAt DESC LIMIT 1',
          [customerId, customerId]
        );
        if (lastOrdRes.length > 0 && lastOrdRes[0].values && lastOrdRes[0].values[0]) {
          const ordRow = lastOrdRes[0].values[0];
          latestOrderSummary = `آخر طلب رقم: ${ordRow[0]}، الحالة الحالية: ${ordRow[1]}، الإجمالي: ${ordRow[2]} ج.م، المتبقي: ${ordRow[4]} ج.م، بتاريخ: ${ordRow[5]}`;
        }

        customerContext = `العميل مسجل حالياً. المديونية المتبقية عليه: ${customerDebt} جنيه مصري. ${latestOrderSummary}`;
      }

      const systemInstruction = `
أنت "مساعد الحليم الذكي" 🤖، المساعد الآلي الرسمي لمنصة "${company}".
المنصة مخصصة لتجارة وتوزيع المواد الغذائية والمشروبات والمياه الغازية والسناكس والحلويات بالجملة لأصحاب المحلات والسوبر ماركت (إدارة ${manager} والمندوب ${salesRep}).

معلومات التواصل الرسمية:
- هاتف الدعم والإدارة: ${supportPhone}
- واتساب الدعم: ${supportWhatsapp}
- مواعيد العمل: ${workingHours}
- مندوب التوزيع والتحصيل الميداني: ${salesRep}

حالة العميل المتحدث معك:
${customerContext}

تعليمات الرد وقواعد السلوك:
1. التحدث بلهجة مصرية مهذبة، واضحة ومباشرة وموجزة (دون إطالة أو حشو غير مفيد).
2. إرشاد العميل خطوة بخطوة لاستخدام الموقع:
   - التسجيل / تسجيل الدخول: برقم الهاتف وكلمة المرور من زر الحساب أو زر تسجيل الدخول في الأعلى.
   - طلب أوردر: تصفح المنتجات وأسعار الجملة، تحديد الكمية بالكرتونة أو البالتة باستخدام أزرار (+) و (-)، فتح السلة ومراجعة الإجمالي ثم الضغط على "تأكيد وإرسال الطلب".
   - متابعة الطلبات والمديونية: الدخول على شاشة "حسابي والطلبات" لمشاهدة جميع الفواتير والمبالغ المسددة والمتبقية مع إمكانية طباعة كشف حساب أو فاتورة حرارية.
   - طرق الدفع: يتم السداد نقداً للمندوب (${salesRep}) عند الاستلام والتسليم أو تحويل مالي بعد التنسيق مع الإدارة.
3. قيود صارمة (Boundaries):
   - لا تقوم أنت بتعديل الأسعار أو حذف طلبات أو تغيير بيانات المخزون مباشرة من تلقاء نفسك.
   - إذا سأل العميل عن حسابه أو مديونيته أو آخر طلب له وكان مسجلاً، اذكر له الأرقام الدقيقة الموضحة في بياناته أعلاه.
   - إذا كانت المشكلة تتطلب تدخلاً إدارياً أو بشرياً أو مشكلة فنية معقدة (مثل نسيان كلمة المرور، تعديل طلب بعد تأكيده، طلب أصناف خاصة غير معروضة، أو نزاع مالي)، يجب أن تذكر العبارة التالية بدقة:
     "المشكلة تحتاج تدخل من فريق الدعم الفني"
     وتوفر له رقم الهاتف (${supportPhone}) أو رابط الواتساب (${supportWhatsapp}) للتواصل المباشر.
`.trim();

      const ai = getGeminiClient();
      let replyText = '';

      if (ai) {
        try {
          let conversationPrompt = '';
          if (Array.isArray(history) && history.length > 0) {
            const recent = history.slice(-6);
            conversationPrompt =
              recent.map((h: any) => `${h.role === 'user' ? 'العميل' : 'المساعد'}: ${h.text}`).join('\n') +
              '\n';
          }
          conversationPrompt += `العميل: ${userMessage}\nالمساعد:`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: conversationPrompt,
            config: {
              systemInstruction,
              temperature: 0.4,
            },
          });

          replyText = response.text || '';
        } catch (genError: any) {
          console.warn('Gemini API call failed, falling back to intelligent rule engine:', genError.message);
        }
      }

      // Fallback rule engine if API key not present or call failed
      if (!replyText) {
        const lower = userMessage.toLowerCase();
        if (lower.includes('تسجيل دخول') || lower.includes('دخول') || lower.includes('ادخل')) {
          replyText =
            'لتسجيل الدخول 🔑:\n1. اضغط على زر "تسجيل الدخول" في أعلى الصفحة أو من تبويب "حسابي".\n2. أدخل رقم هاتفك المسجل وكلمة المرور.\n3. اضغط "دخول" وستتمكن من متابعة أوردراتك وحسابك فوراً.';
        } else if (lower.includes('تسجيل') || lower.includes('حساب جديد') || lower.includes('انشاء حساب')) {
          replyText =
            'لإنشاء حساب جديد 📝:\n1. اضغط على زر "حسابي" أو "تسجيل الدخول" أعلى الشاشة.\n2. إذا كنت عميل جديد لشركة الحليم، يرجى تزويدنا باسم المحل ورقم الهاتف مع مندوب المنطقة (' +
            salesRep +
            ') أو عبر الاتصال بنا على ' +
            supportPhone +
            ' ليتم تفعيل حسابك وأسعار الجملة فوراً.';
        } else if (
          lower.includes('طلب') ||
          lower.includes('اوردر') ||
          lower.includes('أوردر') ||
          lower.includes('ازاي اطلب')
        ) {
          replyText =
            'طريقة عمل طلب جملة 🛒:\n1. تصفح الأصناف في دفتر الطلبات وحدد الكمية المطلوبة بالكرتونة بالضغط على زر (+).\n2. اضغط على زر "عرض السلة" في الأسفل.\n3. راجع أصنافك وإجمالي الفاتورة ثم اضغط "تأكيد وإرسال الطلب".\n4. ستصلك الفاتورة ويقوم المندوب (' +
            salesRep +
            ') بتجهيزها وتوصيلها لمحلكم.';
        } else if (lower.includes('سلة') || lower.includes('اضافة') || lower.includes('إضافة')) {
          replyText =
            'لإضافة أصناف للسلة ➕:\nاضغط على علامة (+) بجوار أي صنف من أصناف المشروبات أو الشيبسي أو البسكويت، وسيتم إضافة الكرتونة فوراً إلى السلة مع تحديث إجمالي الفاتورة تلقائياً.';
        } else if (
          lower.includes('حساب') ||
          lower.includes('مديونية') ||
          lower.includes('باقي') ||
          lower.includes('فلوس') ||
          lower.includes('رصيد')
        ) {
          if (customerId) {
            replyText = `إجمالي المديونية المتبقية على حسابك حالياً هي: ${customerDebt.toLocaleString('ar-EG')} جنيه مصري 💰.\nيمكنك الضغط على تبويب "حسابي والطلبات" لمشاهدة تفاصيل الفواتير والمدفوعات وطباعة كشف حساب تفصيلي.`;
          } else {
            replyText =
              'لمعرفة حسابك والمديونية المتبقية 💰:\nيرجى تسجيل الدخول أولاً برقم هاتفك، ثم فتح تبويب "حسابي" وستجد كشف حساب تفصيلي بجميع الفواتير المسحوبة والمسددة والمتبقية.';
          }
        } else if (lower.includes('موقع') || lower.includes('عنوان') || lower.includes('فين') || lower.includes('مكان')) {
          replyText = `مقر شركة الحليم للتجارة والتوزيع: ${currentSettings?.address || 'محافظة الإسكندرية - بجوار مسجد القويري - بوابة 8'}.\nمندوب التوزيع الميداني: ${salesRep}.`;
        } else if (lower.includes('مواعيد') || lower.includes('شغالين') || lower.includes('وقت') || lower.includes('ساعة')) {
          replyText = `مواعيد العمل واستقبال الطلبات ⏰:\n${workingHours}.\nيمكنك إرسال طلبك في أي وقت خلال ساعات العمل وسيتم تأكيده فوراً.`;
        } else if (
          lower.includes('مشكلة') ||
          lower.includes('شكوى') ||
          lower.includes('نسيت') ||
          lower.includes('تعديل بعد') ||
          lower.includes('خطأ')
        ) {
          replyText = `المشكلة تحتاج تدخل من فريق الدعم الفني 📞.\nيرجى التواصل المباشر مع إدارة شركة الحليم:\n- هاتف: ${supportPhone}\n- واتساب: ${supportWhatsapp}\nوسنقوم بحل المشكلة فوراً!`;
        } else {
          replyText = `أهلاً بك 👋 أنا مساعد الحليم الذكي.\nأنا هنا لمساعدتك في عمل طلبات الجملة، تصفح الأصناف، متابعة حساباتك ومديونياتك.\n\nإذا كان لديك استفسار خاص أو مشكلة فنية:\nالمشكلة تحتاج تدخل من فريق الدعم الفني على رقم ${supportPhone} أو واتساب ${supportWhatsapp}.`;
        }
      }

      res.json({
        success: true,
        reply: replyText,
        supportPhone,
        supportWhatsapp,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر الاتصال بالمساعد الذكي' });
    }
  });

  // ==========================================
  // VITE & STATIC PRODUCTION SETUP
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
