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
  validateStrongPassword,
  revokeAllUserSessions,
  logSecurityEvent,
  recordLoginAttempt,
  checkLoginLockout,
  clearLoginAttempts,
  createPasswordResetToken,
  verifyAndConsumePasswordResetToken,
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
  DealOffer,
  OfferType,
  AdminCustomerRecord,
  InformationItem,
  InformationType,
  InformationPriority,
  InformationStatus,
} from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request body size limits
  app.use(express.json({ limit: '2mb' }));

  // Global CORS & Preflight Handling (Crucial for Production, WebView, and Cross-Origin clients)
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-Token, X-User-Role'
    );

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // Strict Direct Database & Config File Protection
  app.use((req: Request, res: Response, next) => {
    const lowerUrl = req.url.toLowerCase();
    if (
      lowerUrl.includes('.sqlite') ||
      lowerUrl.includes('.db') ||
      lowerUrl.includes('.env') ||
      lowerUrl.startsWith('/data/') ||
      lowerUrl.includes('..')
    ) {
      return res.status(403).json({ success: false, error: 'Access Denied (Protected Resource)' });
    }
    next();
  });

  // Security Headers Middleware
  app.use((req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Client IP helper - comprehensive extraction for Cloud Run, Vercel, Proxies
  const getClientIp = (req: Request): string => {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp) return cfIp.trim();

    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp) return realIp.trim();

    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  };

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

      if (!token) return null;

      const db = await getDb();
      const user = getSessionUser(db, token);
      if (user) return user;

      return null;
    } catch {
      return null;
    }
  };

  // ==========================================
  // DEDICATED SECURITY & ISOLATION MIDDLEWARES
  // ==========================================

  // Middleware: Brute-Force Rate Limiting for Auth Endpoints
  const authRateLimiter = async (req: Request, res: Response, next: () => void) => {
    try {
      const db = await getDb();
      const ip = getClientIp(req);
      const identifier = String(req.body?.username || req.body?.phone || req.body?.identifier || '').trim();

      const lockout = checkLoginLockout(db, identifier, ip);
      if (lockout.isLocked) {
        logSecurityEvent(
          db,
          'LOGIN_LOCKOUT_TRIGGERED',
          undefined,
          identifier,
          ip,
          `Rate limit triggered: locked for ${lockout.remainingMinutes} min`
        );
        res.setHeader('Retry-After', String(lockout.remainingMinutes * 60));
        return res.status(429).json({
          success: false,
          error: `تم إيقاف محاولات الدخول مؤقتاً لحماية الحساب. يرجى المحاولة بعد ${lockout.remainingMinutes} دقيقة`,
          message: `تم إيقاف محاولات الدخول مؤقتاً لحماية الحساب. يرجى المحاولة بعد ${lockout.remainingMinutes} دقيقة`,
          remainingMinutes: lockout.remainingMinutes,
        });
      }
      next();
    } catch (e) {
      next();
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
      const ip = getClientIp(req);
      const db = await getDb();
      logSecurityEvent(db, 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT', user?.id, user?.username, ip, `Blocked path: ${req.path}`);
      return res.status(403).json({
        success: false,
        error: 'عفواً، هذه الصفحة والعمليات مخصصة حصرياً لإدارة شركة الحليم للتجارة والتوزيع',
      });
    }
    (req as any).user = user;
    next();
  };

  // Middleware: Strict Customer Isolation for Account/Debt/Statement APIs (Anti-IDOR)
  const requireCustomerIsolation = (idParamName = 'id') => {
    return async (req: Request, res: Response, next: () => void) => {
      try {
        const user = await getAuthUser(req);
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'يرجى تسجيل الدخول للوصول إلى بيانات الحساب',
          });
        }
        (req as any).user = user;

        // Admin has full authorized access to customer statements and records
        if (user.role === 'admin') {
          return next();
        }

        // Customer Role: Must strictly match their own customer ID or phone
        const requestedTarget = String(req.params[idParamName] || req.query[idParamName] || req.body[idParamName] || '').trim();
        if (requestedTarget && requestedTarget !== user.id && requestedTarget !== user.phone) {
          const db = await getDb();
          const ip = getClientIp(req);
          logSecurityEvent(
            db,
            'IDOR_ATTEMPT_BLOCKED',
            user.id,
            user.username,
            ip,
            `Customer ${user.id} attempted to access data for ${requestedTarget} on ${req.path}`
          );
          return res.status(403).json({
            success: false,
            error: 'غير مصرح لك بالاطلاع على أو تعديل بيانات وحسابات عميل آخر (حماية عزل الحسابات)',
          });
        }

        next();
      } catch (err: any) {
        return res.status(500).json({ error: 'تعذر التحقق من صلاحيات الأمان' });
      }
    };
  };

  // Middleware: Session Verification & Customer Isolation for Orders and Invoices (Anti-IDOR)
  const requireSessionForOrdersAndInvoices = async (req: Request, res: Response, next: () => void) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'يرجى تسجيل الدخول للوصول إلى بيانات الطلبات والفواتير',
        });
      }
      (req as any).user = user;

      // Admin has full authorized access across all customers
      if (user.role === 'admin') {
        return next();
      }

      // Customer Role: Check if an explicit customerId was requested in params, query, or body
      const requestedCustomerId = String(
        req.params.customerId || req.query.customerId || req.body.customerId || ''
      ).trim();

      if (requestedCustomerId && requestedCustomerId !== user.id && requestedCustomerId !== user.phone) {
        const db = await getDb();
        const ip = getClientIp(req);
        logSecurityEvent(
          db,
          'IDOR_CUSTOMER_MISMATCH_BLOCKED',
          user.id,
          user.username,
          ip,
          `Customer ${user.id} requested unauthorized customerId=${requestedCustomerId} on ${req.method} ${req.path}`
        );
        return res.status(403).json({
          success: false,
          error: 'غير مصرح لك بالوصول إلى بيانات أو فواتير عميل آخر (حماية عزل الجلسة)',
        });
      }

      next();
    } catch (err: any) {
      return res.status(500).json({ error: 'تعذر التحقق من جلسة المستخدم' });
    }
  };

  // Middleware: Strict Order Ownership Isolation for Single Order Details (Anti-IDOR)
  const requireOrderOwnerOrAdmin = async (req: Request, res: Response, next: () => void) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى تفاصيل الطلب' });
      }
      (req as any).user = user;
      if (user.role === 'admin') {
        return next();
      }

      const id = req.params.id || req.params.orderId;
      const db = await getDb();
      const stmt = db.prepare('SELECT customerId, customerPhone FROM orders WHERE id = ? OR orderNumber = ?');
      stmt.bind([id, id]);
      if (!stmt.step()) {
        stmt.free();
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }
      const ordRow = stmt.getAsObject();
      stmt.free();

      if (String(ordRow.customerId) !== user.id && String(ordRow.customerPhone) !== user.phone) {
        const ip = getClientIp(req);
        logSecurityEvent(
          db,
          'IDOR_ORDER_ACCESS_BLOCKED',
          user.id,
          user.username,
          ip,
          `Customer ${user.id} attempted to access order ${id} of customer ${ordRow.customerId}`
        );
        return res.status(403).json({
          error: 'غير مصرح لك بالاطلاع على تفاصيل طلبات عميل آخر',
        });
      }

      next();
    } catch (err: any) {
      return res.status(500).json({ error: 'تعذر التحقق من ملكية الطلب' });
    }
  };

  // Middleware: Strict Invoice Ownership Isolation for Single Invoice Details (Anti-IDOR)
  const requireInvoiceOwnerOrAdmin = async (req: Request, res: Response, next: () => void) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى تفاصيل الفاتورة' });
      }
      (req as any).user = user;
      if (user.role === 'admin') {
        return next();
      }

      const id = req.params.id || req.params.invoiceId || req.params.orderId;
      const db = await getDb();
      const stmt = db.prepare('SELECT customerId, customerPhone FROM orders WHERE id = ? OR orderNumber = ?');
      stmt.bind([id, id]);
      if (!stmt.step()) {
        stmt.free();
        return res.status(404).json({ error: 'الفاتورة المطلوبة غير موجودة' });
      }
      const ordRow = stmt.getAsObject();
      stmt.free();

      if (String(ordRow.customerId) !== user.id && String(ordRow.customerPhone) !== user.phone) {
        const ip = getClientIp(req);
        logSecurityEvent(
          db,
          'IDOR_INVOICE_ACCESS_BLOCKED',
          user.id,
          user.username,
          ip,
          `Customer ${user.id} attempted to access invoice ${id} of customer ${ordRow.customerId}`
        );
        return res.status(403).json({
          error: 'غير مصرح لك بالاطلاع على فواتير عميل آخر',
        });
      }

      next();
    } catch (err: any) {
      return res.status(500).json({ error: 'تعذر التحقق من ملكية الفاتورة' });
    }
  };

  // ==========================================
  // 1. AUTHENTICATION & ACCOUNT ENDPOINTS
  // ==========================================

  app.post('/api/auth/login', authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { username, password, rememberMe } = req.body;
      const ip = getClientIp(req);
      const db = await getDb();

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'يرجى إدخال اسم المستخدم وكلمة المرور',
        });
      }

      const cleanUsername = String(username).trim();

      // Check brute-force login lockout
      const lockout = checkLoginLockout(db, cleanUsername, ip);
      if (lockout.isLocked) {
        logSecurityEvent(db, 'LOGIN_LOCKOUT_TRIGGERED', undefined, cleanUsername, ip, `Excessive failed attempts, locked for ${lockout.remainingMinutes} min`);
        return res.status(429).json({
          success: false,
          message: `تم إيقاف محاولات الدخول مؤقتاً لحماية الحساب. يرجى المحاولة بعد ${lockout.remainingMinutes} دقيقة`,
        });
      }

      const stmt = db.prepare(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR username = ? OR phone = ?'
      );
      stmt.bind([cleanUsername, cleanUsername, cleanUsername]);

      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();

        const storedPasswordHash = String(row.password || '');
        const isValid = await verifyPassword(String(password), storedPasswordHash);

        if (isValid) {
          if (row.status === 'disabled') {
            return res.status(403).json({
              success: false,
              message: 'تم تعطيل هذا الحساب من قبل الإدارة. يرجى التواصل مع الدعم الفني لتفعيل الحساب.',
            });
          }

          // Clear previous failed attempts
          clearLoginAttempts(db, cleanUsername, ip);
          recordLoginAttempt(db, cleanUsername, ip, true);

          const userObj: User = {
            id: String(row.id),
            username: String(row.username),
            fullName: String(row.fullName),
            phone: String(row.phone),
            role: row.role as any,
            storeName: row.storeName ? String(row.storeName) : undefined,
            address: row.address ? String(row.address) : undefined,
            status: (row.status as any) || 'active',
            createdAt: row.createdAt ? String(row.createdAt) : undefined,
          };

          // Session Duration: 30 days if rememberMe, otherwise 24 hours
          const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
          const sessionToken = createSession(db, userObj, durationMs);

          logSecurityEvent(
            db,
            userObj.role === 'admin' ? 'ADMIN_LOGIN_SUCCESS' : 'CUSTOMER_LOGIN_SUCCESS',
            userObj.id,
            userObj.username,
            ip,
            `Logged in with ${rememberMe ? '30-day' : '24-hour'} session`
          );

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

      // Record failed attempt
      recordLoginAttempt(db, cleanUsername, ip, false);
      logSecurityEvent(db, 'LOGIN_FAILED', undefined, cleanUsername, ip, 'Invalid login attempt');

      res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة',
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
        const user = getSessionUser(db, token);
        deleteSession(db, token);
        if (user) {
          logSecurityEvent(db, 'LOGOUT', user.id, user.username, getClientIp(req), 'User logged out');
        }
      }

      res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء تسجيل الخروج' });
    }
  });

  // Logout all sessions across all devices
  app.post('/api/auth/logout-all', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const db = await getDb();
      revokeAllUserSessions(db, user.id);
      logSecurityEvent(db, 'LOGOUT_ALL_DEVICES', user.id, user.username, getClientIp(req), 'Revoked all user sessions');

      res.json({ success: true, message: 'تم تسجيل الخروج من جميع الأجهزة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر إلغاء الجلسات من الأجهزة' });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'غير مسجل الدخول' });
      }

      const db = await getDb();
      const stmt = db.prepare('SELECT id, username, fullName, phone, role, storeName, address, createdAt FROM users WHERE id = ?');
      stmt.bind([user.id]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return res.json({
          success: true,
          user: {
            id: String(row.id),
            username: String(row.username),
            fullName: String(row.fullName),
            phone: String(row.phone),
            role: row.role as any,
            storeName: row.storeName ? String(row.storeName) : undefined,
            address: row.address ? String(row.address) : undefined,
            createdAt: row.createdAt ? String(row.createdAt) : undefined,
            token: user.token,
          },
        });
      }
      stmt.free();
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر استرجاع بيانات المستخدم' });
    }
  });

  app.post('/api/auth/register', authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { fullName, phone, storeName, address, password, confirmPassword, rememberMe } = req.body;
      const ip = getClientIp(req);

      // Server-Side Input Validation
      if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال اسم العميل بالكامل (3 أحرف على الأقل)' });
      }

      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ success: false, error: 'يرجى إدخال رقم هاتف صحيح' });
      }

      const cleanPhone = String(phone).replace(/\s+/g, '').trim();
      if (!/^01[0125][0-9]{8}$/.test(cleanPhone) && cleanPhone.length < 10) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال رقم هاتف محمول صالح (11 رقم)' });
      }

      const pwValidation = validateStrongPassword(password);
      if (!pwValidation.valid) {
        return res.status(400).json({ success: false, error: pwValidation.message || 'كلمة المرور لا تلبي معايير الأمان' });
      }

      if (confirmPassword !== undefined && password !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'كلمة المرور وتأكيد كلمة المرور غير متطابقين' });
      }

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

      const countRes = db.exec(`SELECT COUNT(*) FROM users WHERE role = 'customer'`);
      const currentCustCount = (countRes[0]?.values[0]?.[0] as number) || 0;
      const nextCustNum = 1001 + currentCustCount;
      const newUserId = `Customer ${nextCustNum}`;
      const hashedPassword = await hashPassword(String(password));
      const nowIso = new Date().toISOString();

      // STRICT ADMIN/CUSTOMER SEPARATION: Role is hardcoded to 'customer', client role is completely ignored
      db.run(
        `INSERT INTO users (id, username, password, fullName, phone, role, storeName, address, createdAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newUserId,
          cleanPhone,
          hashedPassword,
          String(fullName).trim(),
          cleanPhone,
          'customer',
          storeName ? String(storeName).trim() : 'محل تجاري',
          address ? String(address).trim() : 'محافظة الإسكندرية',
          nowIso,
          'active',
        ]
      );
      saveDb();

      const userObj: User = {
        id: newUserId,
        username: cleanPhone,
        fullName: String(fullName).trim(),
        phone: cleanPhone,
        role: 'customer',
        storeName: storeName ? String(storeName).trim() : 'محل تجاري',
        address: address ? String(address).trim() : 'محافظة الإسكندرية',
        status: 'active',
        createdAt: nowIso,
      };

      const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const sessionToken = createSession(db, userObj, durationMs);

      logSecurityEvent(db, 'CUSTOMER_REGISTRATION', newUserId, cleanPhone, ip, 'New customer registered');

      res.json({
        success: true,
        token: sessionToken,
        user: { ...userObj, token: sessionToken },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء إنشاء الحساب' });
    }
  });

  // Password Reset Request ("نسيت كلمة المرور؟")
  app.post('/api/auth/forgot-password', authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      const ip = getClientIp(req);
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الهاتف المسجل' });
      }

      const cleanPhone = String(phone).replace(/\s+/g, '').trim();
      const db = await getDb();

      const stmt = db.prepare('SELECT id, phone, username FROM users WHERE phone = ? OR username = ?');
      stmt.bind([cleanPhone, cleanPhone]);

      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();

        const token = createPasswordResetToken(db, String(row.id), String(row.phone));
        logSecurityEvent(db, 'PASSWORD_RESET_REQUESTED', String(row.id), String(row.username), ip, 'Password reset token generated');

        return res.json({
          success: true,
          message: 'تم توليد رمز استعادة الحساب بنجاح (صالح لمدة 15 دقيقة)',
          resetToken: token,
        });
      } else {
        stmt.free();
        // Return generic message to prevent phone enumeration
        return res.json({
          success: true,
          message: 'إذا كان رقم الهاتف مسجلاً لدينا، فسيتم قبول طلب استعادة كلمة المرور',
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء طلب استعادة كلمة المرور' });
    }
  });

  // Reset Password Execution
  app.post('/api/auth/reset-password', authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { phone, token, newPassword, confirmPassword } = req.body;
      const ip = getClientIp(req);

      if (!phone || !token || !newPassword) {
        return res.status(400).json({ success: false, error: 'يرجى استكمال جميع الحقول المطلوبة' });
      }

      const pwValidation = validateStrongPassword(newPassword);
      if (!pwValidation.valid) {
        return res.status(400).json({ success: false, error: pwValidation.message || 'كلمة المرور الجديدة لا تلبي معايير الأمان' });
      }

      if (confirmPassword !== undefined && newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'كلمة المرور وتأكيد كلمة المرور غير متطابقين' });
      }

      const cleanPhone = String(phone).replace(/\s+/g, '').trim();
      const db = await getDb();

      const verification = verifyAndConsumePasswordResetToken(db, cleanPhone, String(token));
      if (!verification.valid || !verification.userId) {
        logSecurityEvent(db, 'PASSWORD_RESET_FAILED', undefined, cleanPhone, ip, 'Invalid or expired reset token');
        return res.status(400).json({ success: false, error: 'رمز استعادة الحساب غير صحيح أو منتهي الصلاحية' });
      }

      const hashedPassword = await hashPassword(newPassword);
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, verification.userId]);

      // Invalidate all old sessions for this user
      revokeAllUserSessions(db, verification.userId);
      saveDb();

      logSecurityEvent(db, 'PASSWORD_RESET_SUCCESS', verification.userId, cleanPhone, ip, 'Password reset executed, all sessions invalidated');

      res.json({
        success: true,
        message: 'تم إعادة تعيين كلمة المرور بنجاح، يرجى تسجيل الدخول بكلمة المرور الجديدة',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء إعادة تعيين كلمة المرور' });
    }
  });

  // Change Password for Authenticated User
  app.post('/api/auth/change-password', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const ip = getClientIp(req);

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال كلمة المرور الحالية والجديدة' });
      }

      const pwValidation = validateStrongPassword(newPassword);
      if (!pwValidation.valid) {
        return res.status(400).json({ success: false, error: pwValidation.message || 'كلمة المرور الجديدة لا تلبي معايير الأمان' });
      }

      if (confirmPassword !== undefined && newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'كلمة المرور وتأكيد كلمة المرور غير متطابقين' });
      }

      const db = await getDb();
      const stmt = db.prepare('SELECT password FROM users WHERE id = ?');
      stmt.bind([user.id]);

      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();

        const storedPasswordHash = String(row.password || '');
        const isCurrentValid = await verifyPassword(String(currentPassword), storedPasswordHash);

        if (!isCurrentValid) {
          logSecurityEvent(db, 'PASSWORD_CHANGE_FAILED', user.id, user.username, ip, 'Incorrect current password');
          return res.status(400).json({ success: false, error: 'كلمة المرور الحالية غير صحيحة' });
        }

        const hashedNewPassword = await hashPassword(newPassword);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, user.id]);

        // Revoke all previous sessions and create a fresh one
        revokeAllUserSessions(db, user.id);
        const newToken = createSession(db, user);
        saveDb();

        logSecurityEvent(db, 'PASSWORD_CHANGE_SUCCESS', user.id, user.username, ip, 'Password changed, old sessions invalidated');

        return res.json({
          success: true,
          message: 'تم تغيير كلمة المرور بنجاح وتم تسجيل الخروج من الأجهزة الأخرى',
          token: newToken,
        });
      } else {
        stmt.free();
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء تغيير كلمة المرور' });
    }
  });

  // Update Profile Information (Customer Name, Store Name, Address)
  app.put('/api/auth/profile', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const { fullName, storeName, address } = req.body;
      const ip = getClientIp(req);

      if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال اسم العميل بالكامل' });
      }

      const db = await getDb();
      const cleanFullName = String(fullName).trim();
      const cleanStoreName = storeName ? String(storeName).trim() : (user.storeName || 'محل تجاري');
      const cleanAddress = address ? String(address).trim() : (user.address || 'محافظة الإسكندرية');

      // Update users table (STRICT: role, phone, id, debt CANNOT be modified)
      db.run(
        'UPDATE users SET fullName = ?, storeName = ?, address = ? WHERE id = ?',
        [cleanFullName, cleanStoreName, cleanAddress, user.id]
      );

      // Update active sessions with new profile details
      db.run(
        'UPDATE sessions SET fullName = ?, storeName = ?, address = ? WHERE userId = ?',
        [cleanFullName, cleanStoreName, cleanAddress, user.id]
      );
      saveDb();

      logSecurityEvent(db, 'PROFILE_UPDATED', user.id, user.username, ip, 'Customer profile details updated');

      const updatedUser: User = {
        ...user,
        fullName: cleanFullName,
        storeName: cleanStoreName,
        address: cleanAddress,
      };

      res.json({
        success: true,
        message: 'تم حفظ وتحديث بيانات الحساب بنجاح',
        user: updatedUser,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء تحديث بيانات الحساب' });
    }
  });

  // Admin Audit Logs Endpoint
  app.get('/api/admin/audit-logs', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
      const logs: any[] = [];
      while (stmt.step()) {
        logs.push(stmt.getAsObject());
      }
      stmt.free();
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر تحميل سجلات الأمان' });
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
      const db = await getDb();
      const current = (await getSystemConfig(db)) || ({} as any);
      const newSettings: SystemSettings = { ...current, ...req.body };
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

  app.put('/api/settings', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const current = (await getSystemConfig(db)) || ({} as any);
      const newSettings: SystemSettings = { ...current, ...req.body };
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
      const isAdmin = authUser?.role === 'admin';
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
      const p: Product & { notifyPriceChange?: boolean } = req.body;
      const db = await getDb();
      const id = p.id || 'p_' + Date.now();
      const newPrice = Number(p.price) || 0;

      // Check if product previously existed and had a different price
      let previousPrice: number | null = null;
      let existingProductName = p.name;
      let existingUnit = p.unit;
      let existingImage = p.image;

      if (p.id) {
        const prevStmt = db.prepare('SELECT price, name, unit, image FROM products WHERE id = ?');
        prevStmt.bind([p.id]);
        if (prevStmt.step()) {
          const row = prevStmt.getAsObject();
          previousPrice = Number(row.price) || 0;
          existingProductName = String(row.name || p.name);
          existingUnit = String(row.unit || p.unit);
          existingImage = String(row.image || p.image);
        }
        prevStmt.free();
      }

      db.run(
        `INSERT OR REPLACE INTO products (id, name, category, price, unit, image, status, minQty, maxQty, stock, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          p.name,
          p.category,
          newPrice,
          p.unit,
          p.image || 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500',
          p.status || 'open',
          p.minQty ?? 1,
          p.maxQty !== undefined && p.maxQty !== null ? Number(p.maxQty) : null,
          p.stock ?? 100,
          p.description || '',
        ]
      );

      // Smart Notification Trigger: If price has changed and notification is requested or enabled
      const hasPriceChanged = previousPrice !== null && previousPrice !== newPrice && previousPrice > 0;
      const shouldNotify = p.notifyPriceChange !== false && (p.notifyPriceChange === true || hasPriceChanged);

      let createdInfoId: string | null = null;

      if (hasPriceChanged && shouldNotify) {
        try {
          const priceDiff = newPrice - (previousPrice || 0);
          const pctChange = Math.round(((newPrice - (previousPrice || 0)) / (previousPrice || 1)) * 100);
          const isDecrease = priceDiff < 0;
          const pctFormatted = Math.abs(pctChange);
          const signText = isDecrease ? `انخفاض بنسبة ${pctFormatted}% 📉` : `تعديل بنسبة +${pctFormatted}% 📈`;

          const infoTitle = `تحديث سعر: ${p.name} (${newPrice.toLocaleString('ar-EG')} ج.م)`;
          const infoContent = `نحيط عملاءنا الكرام علماً بتحديث سعر صنف "${p.name}". السعر الجديد: ${newPrice.toLocaleString('ar-EG')} ج.م لكل ${p.unit || 'كرتونة'} (السعر السابق: ${(previousPrice || 0).toLocaleString('ar-EG')} ج.م - ${signText}). متاح الآن للطلب المباشر.`;

          createdInfoId = 'info_pc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          const nowIso = new Date().toISOString();
          const adminUser = (req as any).user;

          db.run(`
            INSERT INTO information (
              id, title, content, type, priority, targetType, targetId, targetName,
              productId, productName, productImage, productUnit, oldPrice, newPrice, priceChangePercentage,
              status, publishedAt, expiresAt, createdBy, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            createdInfoId,
            infoTitle,
            infoContent,
            'price_change',
            'high',
            'all',
            null,
            null,
            id,
            p.name,
            p.image || existingImage || null,
            p.unit || existingUnit || 'كرتونة',
            previousPrice,
            newPrice,
            pctChange,
            'published',
            nowIso,
            null,
            adminUser?.fullName || 'إدارة التسعير',
            nowIso,
            nowIso,
          ]);
        } catch (infoErr) {
          console.error('Error creating automatic price change information:', infoErr);
        }
      }

      saveDb();
      res.json({ success: true, id, priceChangeNotificationId: createdInfoId });
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

  app.put('/api/products/:id/stock', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const { stock, lowStockThreshold } = req.body;
      const db = await getDb();
      if (stock !== undefined) {
        db.run('UPDATE products SET stock = ? WHERE id = ?', [Math.max(0, parseInt(stock, 10) || 0), id]);
      }
      if (lowStockThreshold !== undefined) {
        db.run('UPDATE products SET lowStockThreshold = ? WHERE id = ?', [Math.max(1, parseInt(lowStockThreshold, 10) || 5), id]);
      }
      saveDb();
      res.json({ success: true, id, stock, lowStockThreshold });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تحديث كمية المخزون' });
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

  // Helper to fetch active deal offer for a product if valid and not expired
  function getActiveDealForProduct(db: Database, productId: string): DealOffer | null {
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const todayStr = nowIso.split('T')[0];

      const stmt = db.prepare(`
        SELECT * FROM deals 
        WHERE productId = ? 
          AND isActive = 1
        ORDER BY createdAt DESC
      `);
      stmt.bind([productId]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        const startDate = String(row.startDate || '');
        const endDate = row.endDate ? String(row.endDate) : null;

        // Check date validity
        const isStarted = !startDate || startDate <= nowIso || startDate <= todayStr;
        let isNotExpired = true;
        if (endDate) {
          // If endDate is just date format (e.g. 2026-08-30), compare with end of that day
          const endTimestamp = endDate.includes('T') ? new Date(endDate).getTime() : new Date(endDate + 'T23:59:59').getTime();
          if (Date.now() > endTimestamp) {
            isNotExpired = false;
          }
        }

        if (isStarted && isNotExpired) {
          stmt.free();
          return {
            id: String(row.id),
            productId: String(row.productId),
            productName: String(row.productName),
            productImage: row.productImage ? String(row.productImage) : undefined,
            productBrand: row.productBrand ? String(row.productBrand) : undefined,
            productSize: row.productSize ? String(row.productSize) : undefined,
            productUnit: row.productUnit ? String(row.productUnit) : undefined,
            category: row.category ? String(row.category) : undefined,
            offerType: (row.offerType as OfferType) || 'discount',
            badgeText: String(row.badgeText || 'عرض خاص'),
            offerPrice: Number(row.offerPrice),
            originalPrice: Number(row.originalPrice),
            discountPercentage: row.discountPercentage ? Number(row.discountPercentage) : undefined,
            startDate: String(row.startDate),
            endDate,
            description: row.description ? String(row.description) : undefined,
            isActive: Number(row.isActive) === 1,
            targetType: (row.targetType as any) || 'all',
            targetId: row.targetId ? String(row.targetId) : null,
            createdAt: String(row.createdAt),
          };
        }
      }
      stmt.free();
    } catch (err) {
      console.error('Error fetching active deal for product:', err);
    }
    return null;
  }

  // ==========================================
  // 3.5. DEALS & OFFERS ENDPOINTS (🔥 العروض والفرص)
  // ==========================================

  // GET Deals (Admin gets all; Customers get active only, respecting hidePrices)
  app.get('/api/deals', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      const resStmt = db.exec('SELECT * FROM deals ORDER BY createdAt DESC');
      const allDeals: DealOffer[] = [];

      if (resStmt.length > 0 && resStmt[0].values) {
        const nowMs = Date.now();

        for (const row of resStmt[0].values) {
          const id = String(row[0]);
          const productId = String(row[1]);
          const productName = String(row[2]);
          const productImage = row[3] ? String(row[3]) : undefined;
          const productBrand = row[4] ? String(row[4]) : undefined;
          const productSize = row[5] ? String(row[5]) : undefined;
          const productUnit = row[6] ? String(row[6]) : undefined;
          const category = row[7] ? String(row[7]) : undefined;
          const offerType = (row[8] as OfferType) || 'discount';
          const badgeText = String(row[9] || 'عرض خاص');
          const rawOfferPrice = Number(row[10]);
          const rawOriginalPrice = Number(row[11]);
          const discountPercentage = row[12] ? Number(row[12]) : undefined;
          const startDate = String(row[13]);
          const endDate = row[14] ? String(row[14]) : null;
          const description = row[15] ? String(row[15]) : undefined;
          const isActive = Number(row[16]) === 1;
          const targetType = (row[17] as any) || 'all';
          const targetId = row[18] ? String(row[18]) : null;
          const createdAt = String(row[19]);

          let isExpired = false;
          let remainingSeconds: number | undefined = undefined;

          if (endDate) {
            const endMs = endDate.includes('T') ? new Date(endDate).getTime() : new Date(endDate + 'T23:59:59').getTime();
            const diffMs = endMs - nowMs;
            if (diffMs <= 0) {
              isExpired = true;
              remainingSeconds = 0;
            } else {
              remainingSeconds = Math.floor(diffMs / 1000);
            }
          }

          // If customer, filter out inactive or expired offers
          if (!isAdmin) {
            if (!isActive || isExpired) {
              continue;
            }
          }

          allDeals.push({
            id,
            productId,
            productName,
            productImage,
            productBrand,
            productSize,
            productUnit,
            category,
            offerType,
            badgeText,
            offerPrice: shouldHidePrices ? 0 : rawOfferPrice,
            originalPrice: shouldHidePrices ? 0 : rawOriginalPrice,
            discountPercentage: shouldHidePrices ? undefined : discountPercentage,
            startDate,
            endDate,
            description,
            isActive,
            targetType,
            targetId,
            createdAt,
            isExpired,
            remainingSeconds,
          });
        }
      }

      res.json(allDeals);
    } catch (err: any) {
      console.error('Error fetching deals:', err);
      res.status(500).json({ error: 'تعذر جلب قائمة العروض والفرص' });
    }
  });

  // POST Create Deal (Admin Only)
  app.post('/api/deals', requireAdmin, async (req: Request, res: Response) => {
    try {
      const dealData: Partial<DealOffer> = req.body;
      const {
        productId,
        productName,
        productImage,
        productBrand,
        productSize,
        productUnit,
        category,
        offerType,
        badgeText,
        offerPrice,
        originalPrice,
        startDate,
        endDate,
        description,
        targetType,
        targetId,
      } = dealData;

      if (!productId || offerPrice === undefined || originalPrice === undefined) {
        return res.status(400).json({ error: 'بيانات العرض غير مكتملة (الصنف وسعر العرض والسعر الأصلي مطلوبة)' });
      }

      const db = await getDb();

      // Ensure product exists
      const pStmt = db.prepare('SELECT name, image, unit, category FROM products WHERE id = ?');
      pStmt.bind([productId]);
      let defaultName = productName || 'منتج';
      let defaultImage = productImage || '';
      let defaultUnit = productUnit || 'كرتونة';
      let defaultCat = category || 'عام';
      if (pStmt.step()) {
        const prod = pStmt.getAsObject();
        defaultName = String(prod.name || defaultName);
        defaultImage = String(prod.image || defaultImage);
        defaultUnit = String(prod.unit || defaultUnit);
        defaultCat = String(prod.category || defaultCat);
      }
      pStmt.free();

      const origP = Number(originalPrice) || 1;
      const offP = Number(offerPrice) || 0;
      const discountPercentage = Math.max(0, Math.round(((origP - offP) / origP) * 100));

      const dealId = 'deal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const createdAt = new Date().toISOString();
      const finalStartDate = startDate || createdAt.split('T')[0];

      db.run(`
        INSERT INTO deals (id, productId, productName, productImage, productBrand, productSize, productUnit, category, offerType, badgeText, offerPrice, originalPrice, discountPercentage, startDate, endDate, description, isActive, targetType, targetId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dealId,
        productId,
        defaultName,
        defaultImage,
        productBrand || '',
        productSize || '',
        defaultUnit,
        defaultCat,
        offerType || 'discount',
        badgeText || '🔥 عرض خاص',
        offP,
        origP,
        discountPercentage,
        finalStartDate,
        endDate || null,
        description || '',
        1,
        targetType || 'all',
        targetId || null,
        createdAt,
      ]);

      saveDb();

      res.json({
        success: true,
        deal: {
          id: dealId,
          productId,
          productName: defaultName,
          productImage: defaultImage,
          productBrand,
          productSize,
          productUnit: defaultUnit,
          category: defaultCat,
          offerType: offerType || 'discount',
          badgeText: badgeText || '🔥 عرض خاص',
          offerPrice: offP,
          originalPrice: origP,
          discountPercentage,
          startDate: finalStartDate,
          endDate: endDate || null,
          description: description || '',
          isActive: true,
          targetType: targetType || 'all',
          targetId: targetId || null,
          createdAt,
        },
      });
    } catch (err: any) {
      console.error('Error creating deal:', err);
      res.status(500).json({ error: 'تعذر إنشاء العرض: ' + (err?.message || '') });
    }
  });

  // PUT Update Deal (Admin Only)
  app.put('/api/deals/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const dealData: Partial<DealOffer> = req.body;
      const db = await getDb();

      const origP = Number(dealData.originalPrice) || 1;
      const offP = Number(dealData.offerPrice) || 0;
      const discountPercentage = Math.max(0, Math.round(((origP - offP) / origP) * 100));

      db.run(`
        UPDATE deals SET
          productName = ?,
          productImage = ?,
          productBrand = ?,
          productSize = ?,
          productUnit = ?,
          category = ?,
          offerType = ?,
          badgeText = ?,
          offerPrice = ?,
          originalPrice = ?,
          discountPercentage = ?,
          startDate = ?,
          endDate = ?,
          description = ?,
          isActive = ?,
          targetType = ?,
          targetId = ?
        WHERE id = ?
      `, [
        dealData.productName,
        dealData.productImage || '',
        dealData.productBrand || '',
        dealData.productSize || '',
        dealData.productUnit || 'كرتونة',
        dealData.category || '',
        dealData.offerType || 'discount',
        dealData.badgeText || '🔥 عرض خاص',
        offP,
        origP,
        discountPercentage,
        dealData.startDate || new Date().toISOString().split('T')[0],
        dealData.endDate || null,
        dealData.description || '',
        dealData.isActive !== false ? 1 : 0,
        dealData.targetType || 'all',
        dealData.targetId || null,
        id,
      ]);

      saveDb();
      res.json({ success: true, message: 'تم تحديث العرض بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تعديل العرض' });
    }
  });

  // PATCH / PUT Toggle Deal Active State (Admin Only)
  const handleDealToggle = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = await getDb();
      db.run('UPDATE deals SET isActive = 1 - isActive WHERE id = ?', [id]);
      saveDb();
      res.json({ success: true, message: 'تم تغيير حالة العرض' });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تغيير حالة العرض' });
    }
  };
  app.patch('/api/deals/:id/toggle', requireAdmin, handleDealToggle);
  app.put('/api/deals/:id/toggle', requireAdmin, handleDealToggle);

  // DELETE Deal (Admin Only)
  app.delete('/api/deals/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = await getDb();
      db.run('DELETE FROM deals WHERE id = ?', [id]);
      saveDb();
      res.json({ success: true, message: 'تم حذف العرض بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر حذف العرض' });
    }
  });

  // ==========================================
  // 3.6. INFORMATION & NOTIFICATIONS SYSTEM (🔔 مركز المعلومات والتنبيهات)
  // ==========================================

  // GET Information (Admin gets all with read stats; Customer gets targeted published items with isRead)
  app.get('/api/information', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const { type, status, priority, search } = req.query;

      const totalCustomersRes = db.exec(`SELECT COUNT(*) FROM users WHERE role = 'customer'`);
      const totalCustomersCount = (totalCustomersRes[0]?.values[0]?.[0] as number) || 0;

      let sql = 'SELECT * FROM information WHERE 1=1';
      const params: any[] = [];

      if (!isAdmin) {
        // Customer visibility rules: only published, non-expired, and addressed to all or this user
        sql += " AND status = 'published'";
        if (authUser) {
          sql += " AND (targetType = 'all' OR targetId = ? OR targetId IS NULL OR targetId = '')";
          params.push(authUser.id);
        } else {
          sql += " AND targetType = 'all'";
        }
      } else {
        // Admin filtering
        if (status && status !== 'all') {
          sql += ' AND status = ?';
          params.push(String(status));
        }
      }

      if (type && type !== 'all') {
        sql += ' AND type = ?';
        params.push(String(type));
      }

      if (priority && priority !== 'all') {
        sql += ' AND priority = ?';
        params.push(String(priority));
      }

      if (search && typeof search === 'string' && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        sql += ' AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(productName) LIKE ?)';
        params.push(q, q, q);
      }

      sql += ' ORDER BY publishedAt DESC, createdAt DESC';

      const resStmt = db.exec(sql, params);
      const items: InformationItem[] = [];
      let unreadCount = 0;

      if (resStmt.length > 0 && resStmt[0].values) {
        const nowIso = new Date().toISOString();

        for (const row of resStmt[0].values) {
          const id = String(row[0]);
          const title = String(row[1]);
          const content = String(row[2]);
          const itemType = (row[3] as InformationType) || 'general';
          const itemPriority = (row[4] as InformationPriority) || 'normal';
          const targetType = (row[5] as any) || 'all';
          const targetId = row[6] ? String(row[6]) : null;
          const targetName = row[7] ? String(row[7]) : null;
          const productId = row[8] ? String(row[8]) : null;
          const productName = row[9] ? String(row[9]) : null;
          const productImage = row[10] ? String(row[10]) : null;
          const productUnit = row[11] ? String(row[11]) : null;
          const oldPrice = row[12] !== null && row[12] !== undefined ? Number(row[12]) : null;
          const newPrice = row[13] !== null && row[13] !== undefined ? Number(row[13]) : null;
          const priceChangePercentage = row[14] !== null && row[14] !== undefined ? Number(row[14]) : null;
          const itemStatus = (row[15] as InformationStatus) || 'published';
          const publishedAt = String(row[16]);
          const expiresAt = row[17] ? String(row[17]) : null;
          const createdBy = row[18] ? String(row[18]) : 'إدارة الشركة';
          const createdAt = String(row[19]);
          const updatedAt = String(row[20] || row[19]);

          // Check if expired for customers
          if (!isAdmin && expiresAt && expiresAt < nowIso) {
            continue;
          }

          // Check read status for current authenticated user
          let isRead = false;
          let readAt: string | null = null;
          let readCount = 0;

          if (authUser) {
            const readStmt = db.prepare('SELECT readAt FROM information_reads WHERE informationId = ? AND userId = ?');
            readStmt.bind([id, authUser.id]);
            if (readStmt.step()) {
              isRead = true;
              const rObj = readStmt.getAsObject();
              readAt = String(rObj.readAt || '');
            }
            readStmt.free();

            if (!isRead && itemStatus === 'published') {
              unreadCount++;
            }
          }

          // Get total read count for admin
          if (isAdmin) {
            const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM information_reads WHERE informationId = ?');
            countStmt.bind([id]);
            if (countStmt.step()) {
              readCount = Number(countStmt.getAsObject().cnt) || 0;
            }
            countStmt.free();
          }

          items.push({
            id,
            title,
            content,
            type: itemType,
            priority: itemPriority,
            targetType,
            targetId,
            targetName,
            productId,
            productName,
            productImage,
            productUnit,
            oldPrice,
            newPrice,
            priceChangePercentage,
            status: itemStatus,
            publishedAt,
            expiresAt,
            createdBy,
            createdAt,
            updatedAt,
            isRead,
            readAt,
            readCount,
            totalTargetCount: targetType === 'all' ? totalCustomersCount : 1,
          });
        }
      }

      res.json({
        success: true,
        information: items,
        unreadCount,
        totalCount: items.length,
      });
    } catch (err: any) {
      console.error('Error fetching information:', err);
      res.status(500).json({ success: false, error: 'تعذر جلب سجلات المعلومات والتنبيهات' });
    }
  });

  // GET Quick Unread Count for Authenticated User
  app.get('/api/information/unread-count', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) {
        return res.json({ success: true, unreadCount: 0 });
      }

      const db = await getDb();
      const nowIso = new Date().toISOString();

      const stmt = db.prepare(`
        SELECT COUNT(*) as unreadCount 
        FROM information i
        WHERE i.status = 'published'
          AND (i.targetType = 'all' OR i.targetId = ? OR i.targetId IS NULL OR i.targetId = '')
          AND (i.expiresAt IS NULL OR i.expiresAt > ?)
          AND i.id NOT IN (
            SELECT informationId FROM information_reads WHERE userId = ?
          )
      `);
      stmt.bind([authUser.id, nowIso, authUser.id]);

      let unreadCount = 0;
      if (stmt.step()) {
        unreadCount = Number(stmt.getAsObject().unreadCount) || 0;
      }
      stmt.free();

      res.json({ success: true, unreadCount });
    } catch (err: any) {
      res.json({ success: true, unreadCount: 0 });
    }
  });

  // POST Create New Information (Admin Only)
  app.post('/api/information', requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        title,
        content,
        type = 'general',
        priority = 'normal',
        targetType = 'all',
        targetId,
        targetName,
        productId,
        productName,
        productImage,
        productUnit,
        oldPrice,
        newPrice,
        priceChangePercentage,
        status = 'published',
        publishedAt,
        expiresAt,
      } = req.body;

      const adminUser = (req as any).user;
      const cleanTitle = String(title || '').trim();
      const cleanContent = String(content || '').trim();

      if (!cleanTitle || !cleanContent) {
        return res.status(400).json({ success: false, error: 'عنوان ونص المعلومة مطلوبان' });
      }

      const db = await getDb();
      const nowIso = new Date().toISOString();
      const infoId = 'info_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // If productId is provided, hydrate product details if missing
      let finalProdName = productName || null;
      let finalProdImage = productImage || null;
      let finalProdUnit = productUnit || null;
      let finalOldPrice = oldPrice !== undefined ? Number(oldPrice) : null;
      let finalNewPrice = newPrice !== undefined ? Number(newPrice) : null;
      let finalPct = priceChangePercentage !== undefined ? Number(priceChangePercentage) : null;

      if (productId) {
        const pStmt = db.prepare('SELECT name, image, unit, price FROM products WHERE id = ?');
        pStmt.bind([productId]);
        if (pStmt.step()) {
          const pObj = pStmt.getAsObject();
          finalProdName = finalProdName || String(pObj.name || '');
          finalProdImage = finalProdImage || String(pObj.image || '');
          finalProdUnit = finalProdUnit || String(pObj.unit || '');
          if (finalNewPrice === null && pObj.price !== undefined) {
            finalNewPrice = Number(pObj.price);
          }
        }
        pStmt.free();
      }

      if (finalOldPrice !== null && finalNewPrice !== null && finalPct === null && finalOldPrice > 0) {
        finalPct = Math.round(((finalNewPrice - finalOldPrice) / finalOldPrice) * 100);
      }

      db.run(`
        INSERT INTO information (
          id, title, content, type, priority, targetType, targetId, targetName,
          productId, productName, productImage, productUnit, oldPrice, newPrice, priceChangePercentage,
          status, publishedAt, expiresAt, createdBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        infoId,
        cleanTitle,
        cleanContent,
        type,
        priority,
        targetType,
        targetId || null,
        targetName || null,
        productId || null,
        finalProdName,
        finalProdImage,
        finalProdUnit,
        finalOldPrice,
        finalNewPrice,
        finalPct,
        status,
        publishedAt || nowIso,
        expiresAt || null,
        adminUser?.fullName || 'إدارة شركة الحليم',
        nowIso,
        nowIso,
      ]);

      saveDb();

      logSecurityEvent(
        db,
        'INFORMATION_CREATED',
        adminUser?.id,
        adminUser?.username,
        getClientIp(req),
        `Information "${cleanTitle}" created (${type})`
      );

      res.json({
        success: true,
        message: 'تم نشر المعلومة بنجاح',
        id: infoId,
      });
    } catch (err: any) {
      console.error('Error creating information:', err);
      res.status(500).json({ success: false, error: 'تعذر إنشاء ونشر المعلومة' });
    }
  });

  // PUT Update Information (Admin Only)
  app.put('/api/information/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        title,
        content,
        type,
        priority,
        targetType,
        targetId,
        targetName,
        productId,
        productName,
        productImage,
        productUnit,
        oldPrice,
        newPrice,
        priceChangePercentage,
        status,
        publishedAt,
        expiresAt,
      } = req.body;

      const adminUser = (req as any).user;
      const cleanTitle = String(title || '').trim();
      const cleanContent = String(content || '').trim();

      if (!cleanTitle || !cleanContent) {
        return res.status(400).json({ success: false, error: 'عنوان ونص المعلومة مطلوبان' });
      }

      const db = await getDb();
      const nowIso = new Date().toISOString();

      db.run(`
        UPDATE information SET
          title = ?,
          content = ?,
          type = ?,
          priority = ?,
          targetType = ?,
          targetId = ?,
          targetName = ?,
          productId = ?,
          productName = ?,
          productImage = ?,
          productUnit = ?,
          oldPrice = ?,
          newPrice = ?,
          priceChangePercentage = ?,
          status = ?,
          publishedAt = ?,
          expiresAt = ?,
          updatedAt = ?
        WHERE id = ?
      `, [
        cleanTitle,
        cleanContent,
        type || 'general',
        priority || 'normal',
        targetType || 'all',
        targetId || null,
        targetName || null,
        productId || null,
        productName || null,
        productImage || null,
        productUnit || null,
        oldPrice !== undefined ? Number(oldPrice) : null,
        newPrice !== undefined ? Number(newPrice) : null,
        priceChangePercentage !== undefined ? Number(priceChangePercentage) : null,
        status || 'published',
        publishedAt || nowIso,
        expiresAt || null,
        nowIso,
        id,
      ]);

      saveDb();

      logSecurityEvent(
        db,
        'INFORMATION_UPDATED',
        adminUser?.id,
        adminUser?.username,
        getClientIp(req),
        `Information "${cleanTitle}" updated`
      );

      res.json({ success: true, message: 'تم تحديث المعلومة بنجاح', id });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر تحديث المعلومة' });
    }
  });

  // PATCH / PUT Quick Toggle Information Status (Admin Only)
  const handleInfoStatusChange = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({ success: false, error: 'حالة المعلومة غير صحيحة' });
      }

      const db = await getDb();
      const nowIso = new Date().toISOString();
      db.run('UPDATE information SET status = ?, updatedAt = ? WHERE id = ?', [status, nowIso, id]);
      saveDb();

      res.json({ success: true, message: 'تم تغيير حالة المعلومة بنجاح', status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر تعديل حالة المعلومة' });
    }
  };
  app.patch('/api/information/:id/status', requireAdmin, handleInfoStatusChange);
  app.put('/api/information/:id/status', requireAdmin, handleInfoStatusChange);

  // DELETE Information (Admin Only)
  app.delete('/api/information/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const adminUser = (req as any).user;
      const db = await getDb();

      db.run('DELETE FROM information WHERE id = ?', [id]);
      db.run('DELETE FROM information_reads WHERE informationId = ?', [id]);
      saveDb();

      logSecurityEvent(
        db,
        'INFORMATION_DELETED',
        adminUser?.id,
        adminUser?.username,
        getClientIp(req),
        `Information ${id} deleted`
      );

      res.json({ success: true, message: 'تم حذف المعلومة وسجل قراءاتها بنجاح' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر حذف المعلومة' });
    }
  });

  // POST Mark Single Information Item as Read (Auth User)
  app.post('/api/information/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as User;
      const db = await getDb();
      const readId = 'read_' + user.id + '_' + id;
      const nowIso = new Date().toISOString();

      db.run(
        `INSERT OR REPLACE INTO information_reads (id, informationId, userId, readAt) VALUES (?, ?, ?, ?)`,
        [readId, id, user.id, nowIso]
      );
      saveDb();

      res.json({ success: true, isRead: true, readAt: nowIso });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر تسجيل قراءة المعلومة' });
    }
  });

  // POST Mark All Information as Read (Auth User)
  app.post('/api/information/read-all', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const db = await getDb();
      const nowIso = new Date().toISOString();

      // Find all published info IDs that this user can see and has not read
      const stmt = db.prepare(`
        SELECT i.id 
        FROM information i
        WHERE i.status = 'published'
          AND (i.targetType = 'all' OR i.targetId = ? OR i.targetId IS NULL OR i.targetId = '')
          AND (i.expiresAt IS NULL OR i.expiresAt > ?)
          AND i.id NOT IN (
            SELECT informationId FROM information_reads WHERE userId = ?
          )
      `);
      stmt.bind([user.id, nowIso, user.id]);

      const unreadIds: string[] = [];
      while (stmt.step()) {
        unreadIds.push(String(stmt.getAsObject().id));
      }
      stmt.free();

      for (const infoId of unreadIds) {
        const readId = 'read_' + user.id + '_' + infoId;
        db.run(
          `INSERT OR REPLACE INTO information_reads (id, informationId, userId, readAt) VALUES (?, ?, ?, ?)`,
          [readId, infoId, user.id, nowIso]
        );
      }

      saveDb();

      res.json({
        success: true,
        message: 'تم تحديد كافة المعلومات كمقروءة بنجاح',
        markedCount: unreadIds.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'تعذر تحديد الكل كمقروء' });
    }
  });

  // ==========================================
  // 4. ORDERS & STRICT PRICE RECALCULATION & DEBT CALCULATION
  // ==========================================

  // Helper to compute previous customer debt directly from database
  function calculateCustomerPreviousDebt(
    db: any,
    customerId: string,
    customerPhone: string,
    currentOrderId?: string
  ): number {
    try {
      let sql =
        'SELECT SUM(grandTotal), SUM(paidAmount) FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled"';
      const params: any[] = [customerId, customerPhone];
      if (currentOrderId) {
        sql += ' AND id != ?';
        params.push(currentOrderId);
      }
      const res = db.exec(sql, params);
      if (res.length > 0 && res[0].values && res[0].values[0]) {
        const totalInvoiced = Number(res[0].values[0][0] || 0);
        const totalPaid = Number(res[0].values[0][1] || 0);
        return Math.max(0, totalInvoiced - totalPaid);
      }
    } catch (err) {
      console.error('Error calculating customer debt:', err);
    }
    return 0;
  }

  // GET Orders with Customer Isolation & Session Middleware
  app.get('/api/orders', requireSessionForOrdersAndInvoices, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user || (await getAuthUser(req));
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      let sql = 'SELECT * FROM orders';
      const params: any[] = [];

      if (isAdmin) {
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
        // Customer Role: STRICT ISOLATION -> Only their own orders with Session customer ID
        sql += ' WHERE (customerId = ? OR customerPhone = ?)';
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

      // Fetch items and compute real-time previous customer debt for each order
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

        // Server-Side Debt Calculations
        const prevDebt = calculateCustomerPreviousDebt(db, order.customerId, order.customerPhone, order.id);
        const currInvoice = order.grandTotal;
        const totalDue = shouldHidePrices ? 0 : prevDebt + currInvoice;
        const paid = order.paidAmount || 0;
        const finalRemaining = shouldHidePrices ? 0 : Math.max(0, totalDue - paid);

        order.previousDebt = shouldHidePrices ? 0 : prevDebt;
        order.currentInvoice = currInvoice;
        order.totalDueWithDebt = totalDue;
        order.finalRemainingWithDebt = finalRemaining;
      }

      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب الطلبات' });
    }
  });

  // GET Single Order with Authorization Check & Customer Isolation
  app.get('/api/orders/:id', requireOrderOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = (req as any).user || (await getAuthUser(req));
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      let sql = 'SELECT * FROM orders WHERE (id = ? OR orderNumber = ?)';
      const params: any[] = [id, id];

      // Enforce SQL-level customer isolation directly in database query (WHERE customerId = current_session.customer_id)
      if (authUser && authUser.role === 'customer') {
        sql += ' AND (customerId = ? OR customerPhone = ?)';
        params.push(authUser.id, authUser.phone);
      }

      const stmt = db.prepare(sql);
      stmt.bind(params);

      if (!stmt.step()) {
        stmt.free();
        return res.status(404).json({ error: 'الطلب غير موجود أو غير مصرح لك بالوصول إليه' });
      }

      const row = stmt.getAsObject();
      stmt.free();

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

      // Server-Side Debt Calculations
      const prevDebt = calculateCustomerPreviousDebt(db, String(row.customerId), String(row.customerPhone), String(row.id));
      const currInvoice = grandTotal;
      const totalDue = shouldHidePrices ? 0 : prevDebt + currInvoice;
      const finalRemaining = shouldHidePrices ? 0 : Math.max(0, totalDue - paidAmount);

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
        previousDebt: shouldHidePrices ? 0 : prevDebt,
        currentInvoice: currInvoice,
        totalDueWithDebt: totalDue,
        finalRemainingWithDebt: finalRemaining,
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

  // ==========================================
  // INVOICE ENDPOINTS (Protected with Session Middleware & Anti-IDOR WHERE customer_id clause)
  // ==========================================

  // GET Invoices List (Protected with requireSessionForOrdersAndInvoices)
  app.get('/api/invoices', requireSessionForOrdersAndInvoices, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user || (await getAuthUser(req));
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      let sql = 'SELECT * FROM orders WHERE status != "Cancelled"';
      const params: any[] = [];

      if (isAdmin) {
        const { customerId, phone } = req.query;
        if (customerId) {
          sql += ' AND customerId = ?';
          params.push(customerId);
        } else if (phone) {
          sql += ' AND customerPhone = ?';
          params.push(phone);
        }
      } else {
        // Customer Role: Strictly isolate to current session's customerId
        sql += ' AND (customerId = ? OR customerPhone = ?)';
        params.push(authUser.id, authUser.phone);
      }

      sql += ' ORDER BY createdAt DESC';

      const resStmt = db.exec(sql, params);
      const invoices: any[] = [];

      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          const orderId = String(row[0]);
          const orderNumber = String(row[1]);
          const customerId = String(row[2]);
          const customerName = String(row[3]);
          const customerPhone = String(row[4]);
          const customerAddress = row[5] ? String(row[5]) : undefined;
          const salesRep = String(row[6]);
          const status = row[7] as OrderStatus;
          const createdAt = String(row[8]);
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

          // Real-time previous customer debt calculation
          const prevDebt = calculateCustomerPreviousDebt(db, customerId, customerPhone, orderId);
          const currInvoice = grandTotal;
          const totalDue = shouldHidePrices ? 0 : prevDebt + currInvoice;
          const finalRemaining = shouldHidePrices ? 0 : Math.max(0, totalDue - paidAmount);

          // Get items
          const itemsRes = db.exec('SELECT * FROM order_items WHERE orderId = ?', [orderId]);
          const items = itemsRes.length > 0 && itemsRes[0].values
            ? itemsRes[0].values.map((iRow) => ({
                id: String(iRow[0]),
                productId: String(iRow[2]),
                productName: String(iRow[3]),
                unitPrice: shouldHidePrices ? 0 : Number(iRow[4]),
                quantity: Number(iRow[5]),
                unit: String(iRow[6]),
                discount: shouldHidePrices ? 0 : Number(iRow[7]),
                totalPrice: shouldHidePrices ? 0 : Number(iRow[8]),
              }))
            : [];

          invoices.push({
            id: orderId,
            invoiceNumber: 'INV-' + orderNumber.replace('#', ''),
            orderId,
            orderNumber,
            customerId,
            customerName,
            customerPhone,
            customerAddress,
            salesRep,
            status,
            createdAt,
            itemsCount: Number(row[10]),
            totalQuantity: Number(row[11]),
            subtotal: shouldHidePrices ? 0 : Number(row[12]),
            discount: shouldHidePrices ? 0 : Number(row[13]),
            grandTotal,
            paidAmount,
            remainingBalance,
            previousDebt: shouldHidePrices ? 0 : prevDebt,
            currentInvoice: currInvoice,
            totalDueWithDebt: totalDue,
            finalRemainingWithDebt: finalRemaining,
            paymentStatus,
            items,
          });
        }
      }

      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب قائمة الفواتير' });
    }
  });

  // GET Single Invoice (Protected with requireInvoiceOwnerOrAdmin)
  app.get('/api/invoices/:id', requireInvoiceOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = (req as any).user || (await getAuthUser(req));
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      let sql = 'SELECT * FROM orders WHERE (id = ? OR orderNumber = ?)';
      const params: any[] = [id, id];

      // Enforce SQL-level customer isolation directly in database query
      if (authUser && authUser.role === 'customer') {
        sql += ' AND (customerId = ? OR customerPhone = ?)';
        params.push(authUser.id, authUser.phone);
      }

      const stmt = db.prepare(sql);
      stmt.bind(params);

      if (!stmt.step()) {
        stmt.free();
        return res.status(404).json({ error: 'الفاتورة غير موجودة أو غير مصرح لك بالوصول إليها' });
      }

      const row = stmt.getAsObject();
      stmt.free();

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
      const items: any[] = [];
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

      // Payments history for this order/invoice
      const payRes = db.exec('SELECT * FROM payments WHERE orderId = ? OR orderNumber = ? ORDER BY createdAt DESC', [String(row.id), String(row.orderNumber)]);
      const payments: any[] = [];
      if (payRes.length > 0 && payRes[0].values) {
        for (const pRow of payRes[0].values) {
          payments.push({
            id: String(pRow[0]),
            amount: Number(pRow[6]),
            paymentDate: String(pRow[7]),
            paymentMethod: String(pRow[8]),
            collectedBy: String(pRow[9]),
            notes: pRow[10] ? String(pRow[10]) : undefined,
          });
        }
      }

      // Server-Side Debt Calculations
      const prevDebt = calculateCustomerPreviousDebt(db, String(row.customerId), String(row.customerPhone), String(row.id));
      const currInvoice = grandTotal;
      const totalDue = shouldHidePrices ? 0 : prevDebt + currInvoice;
      const finalRemaining = shouldHidePrices ? 0 : Math.max(0, totalDue - paidAmount);

      const invoice = {
        id: String(row.id),
        invoiceNumber: 'INV-' + String(row.orderNumber).replace('#', ''),
        orderId: String(row.id),
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
        previousDebt: shouldHidePrices ? 0 : prevDebt,
        currentInvoice: currInvoice,
        totalDueWithDebt: totalDue,
        finalRemainingWithDebt: finalRemaining,
        paymentStatus,
        notes: row.notes ? String(row.notes) : undefined,
        items,
        payments,
      };

      res.json(invoice);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب تفاصيل الفاتورة' });
    }
  });

  // GET Invoices by Customer (Protected with requireSessionForOrdersAndInvoices)
  app.get('/api/invoices/customer/:customerId', requireSessionForOrdersAndInvoices, async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const authUser = (req as any).user || (await getAuthUser(req));
      const isAdmin = authUser?.role === 'admin';
      const db = await getDb();
      const sysSettings = await getSystemConfig(db);
      const shouldHidePrices = !isAdmin && Boolean(sysSettings?.hidePrices);

      // Customer isolation check: Customer can ONLY query their own customerId
      if (authUser && authUser.role === 'customer') {
        if (customerId !== authUser.id && customerId !== authUser.phone) {
          return res.status(403).json({
            success: false,
            error: 'غير مصرح لك بالاطلاع على فواتير عميل آخر',
          });
        }
      }

      const targetCustomerId = authUser && authUser.role === 'customer' ? authUser.id : customerId;
      const targetCustomerPhone = authUser && authUser.role === 'customer' ? authUser.phone : customerId;

      const sql = 'SELECT * FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled" ORDER BY createdAt DESC';
      const resStmt = db.exec(sql, [targetCustomerId, targetCustomerPhone]);
      const invoices: any[] = [];

      if (resStmt.length > 0 && resStmt[0].values) {
        for (const row of resStmt[0].values) {
          const orderId = String(row[0]);
          const orderNumber = String(row[1]);
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

          const prevDebt = calculateCustomerPreviousDebt(db, String(row[2]), String(row[4]), orderId);
          const currInvoice = grandTotal;
          const totalDue = shouldHidePrices ? 0 : prevDebt + currInvoice;
          const finalRemaining = shouldHidePrices ? 0 : Math.max(0, totalDue - paidAmount);

          invoices.push({
            id: orderId,
            invoiceNumber: 'INV-' + orderNumber.replace('#', ''),
            orderId,
            orderNumber,
            customerId: String(row[2]),
            customerName: String(row[3]),
            customerPhone: String(row[4]),
            customerAddress: row[5] ? String(row[5]) : undefined,
            salesRep: String(row[6]),
            status: row[7] as OrderStatus,
            createdAt: String(row[8]),
            itemsCount: Number(row[10]),
            totalQuantity: Number(row[11]),
            subtotal: shouldHidePrices ? 0 : Number(row[12]),
            discount: shouldHidePrices ? 0 : Number(row[13]),
            grandTotal,
            paidAmount,
            remainingBalance,
            previousDebt: shouldHidePrices ? 0 : prevDebt,
            currentInvoice: currInvoice,
            totalDueWithDebt: totalDue,
            finalRemainingWithDebt: finalRemaining,
            paymentStatus,
          });
        }
      }

      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر جلب فواتير العميل' });
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

        // Check if product has an active valid offer
        const activeDeal = getActiveDealForProduct(db, productId);
        const officialPrice = activeDeal ? activeDeal.offerPrice : Number(dbProd.price);
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
          lowStockThreshold: Number(dbProd.lowStockThreshold ?? 5),
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

      // Check system ordering open status strictly on the server (Prevents any bypass)
      if (sysSettings && !isAdmin) {
        // 1. Manual Override check
        if (sysSettings.isManualOverrideActive && !sysSettings.manualOrdersOpen) {
          return res.status(400).json({
            error: 'عذرًا، تم إغلاق استقبال الطلبات حاليًا بقرار من الإدارة. يرجى المحاولة مرة أخرى لاحقًا.',
            storeClosed: true,
            code: 'STORE_CLOSED',
          });
        }

        // 2. Automated Schedule check (if schedule is active and manual override is not forced)
        if (!sysSettings.isManualOverrideActive && sysSettings.scheduleEnabled && Array.isArray(sysSettings.weeklySchedule) && sysSettings.weeklySchedule.length > 0) {
          const dayNames: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
          const now = new Date();
          const currentDayKey = dayNames[now.getDay()];
          const dayConfig = sysSettings.weeklySchedule.find((d: any) => d.dayKey === currentDayKey);

          if (!dayConfig || !dayConfig.isOpen) {
            return res.status(400).json({
              error: 'عذرًا، تم إغلاق استقبال الطلبات اليوم وفقًا لمواعيد العمل الرسمية.',
              storeClosed: true,
              code: 'STORE_CLOSED',
            });
          }

          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const [oH, oM] = (dayConfig.openTime || '08:00').split(':').map(Number);
          const [cH, cM] = (dayConfig.closeTime || '22:00').split(':').map(Number);
          const openMinutes = (oH || 0) * 60 + (oM || 0);
          const closeMinutes = (cH || 0) * 60 + (cM || 0);

          if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
            return res.status(400).json({
              error: `عذرًا، تم إغلاق استقبال الطلبات حاليًا. مواعيد العمل اليوم من ${dayConfig.openTime} حتى ${dayConfig.closeTime}. يرجى المحاولة مرة أخرى لاحقًا.`,
              storeClosed: true,
              code: 'STORE_CLOSED',
            });
          }
        }
      }

      // Determine customer details securely based on authenticated session
      let finalCustomerId = '';
      let finalCustomerName = '';
      let finalCustomerPhone = '';
      let finalCustomerAddress = '';

      if (authUser) {
        if (authUser.role === 'admin') {
          // Admin can create an order for a customer if specified
          finalCustomerId = req.body.customerId ? String(req.body.customerId).trim() : authUser.id;
          finalCustomerName = (req.body.customerName || authUser.fullName).trim();
          finalCustomerPhone = (req.body.customerPhone || authUser.phone).trim();
          finalCustomerAddress = (req.body.customerAddress || authUser.address || 'الإسكندرية').trim();
        } else {
          // Customer is strictly bound to their verified session identity (Anti-Spoofing)
          finalCustomerId = authUser.id;
          finalCustomerName = (authUser.fullName + (authUser.storeName ? ` - ${authUser.storeName}` : '')).trim();
          finalCustomerPhone = authUser.phone.trim();
          finalCustomerAddress = (authUser.address || 'الإسكندرية').trim();
        }
      } else {
        // Unauthenticated guest order
        finalCustomerId = 'guest-' + Date.now();
        finalCustomerName = (guestName || req.body.customerName || '').trim();
        finalCustomerPhone = (guestPhone || req.body.customerPhone || '').trim();
        finalCustomerAddress = (guestAddress || req.body.customerAddress || 'الإسكندرية').trim();
      }

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
        const prodStmt = db.prepare('SELECT id, name, category, price, unit, status, minQty, maxQty, stock FROM products WHERE id = ?');
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

        // Check Stock Control
        const currentStock = dbProd.stock !== null && dbProd.stock !== undefined ? Number(dbProd.stock) : 100;
        if (currentStock <= 0) {
          return res.status(400).json({
            error: `الصنف "${dbProd.name}" نفد من المخزن بالكامل (المتاح: 0)`,
          });
        }
        if (requestedQty > currentStock) {
          return res.status(400).json({
            error: `الكمية المطلوبة من "${dbProd.name}" (${requestedQty} ${dbProd.unit}) أكبر من الكمية المتاحة بالمخزن (${currentStock} ${dbProd.unit})`,
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

        // Use official Database price or active deal offer price (NEVER trust unitPrice from frontend body)
        const activeDeal = getActiveDealForProduct(db, productId);
        const officialUnitPrice = activeDeal ? activeDeal.offerPrice : Number(dbProd.price);
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

      // Calculate previous debt for this customer from DB
      const prevDebt = calculateCustomerPreviousDebt(db, finalCustomerId, finalCustomerPhone, orderId);
      const currInvoice = shouldHidePrices ? 0 : serverGrandTotal;
      const totalDue = shouldHidePrices ? 0 : prevDebt + currInvoice;

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
        previousDebt: shouldHidePrices ? 0 : prevDebt,
        currentInvoice: currInvoice,
        totalDueWithDebt: totalDue,
        finalRemainingWithDebt: totalDue,
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

      const ordCheck = db.exec('SELECT grandTotal, paidAmount, status FROM orders WHERE id = ?', [id]);
      if (ordCheck.length === 0 || !ordCheck[0].values || ordCheck[0].values.length === 0) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      const currentPaid = Number(ordCheck[0].values[0][1] || 0);
      const currentStatus = String(ordCheck[0].values[0][2] || 'Confirmed');
      const finalStatus = status || currentStatus;
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

        const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
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
          finalStatus,
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
      console.error('Error editing order in PUT /api/orders/:id/edit:', err);
      res.status(500).json({ error: 'تعذر تعديل الطلب: ' + (err?.message || '') });
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

      const nowIso = new Date().toISOString();
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
          nowIso,
          paymentMethod || 'Cash',
          collectedBy || 'محمد فوزي',
          notes || (markDelivered ? 'تحصيل عند تسليم الطلب' : 'سداد دفعة نقدية'),
          nowIso,
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

  // --- DATE & PERIOD HELPERS FOR REAL PAYMENTS & COLLECTIONS (Server-Authoritative) ---
  function parsePaymentDate(createdAtStr?: string, paymentDateStr?: string): Date {
    if (!createdAtStr && !paymentDateStr) return new Date();
    
    // 1. Standard ISO date parsing
    if (createdAtStr) {
      const d1 = new Date(createdAtStr);
      if (!isNaN(d1.getTime())) return d1;
    }
    if (paymentDateStr) {
      const d2 = new Date(paymentDateStr);
      if (!isNaN(d2.getTime())) return d2;
    }
    
    // 2. Arabic / Egyptian locale parsing (e.g. "25/8/2026, 2:30:00 PM" or "2026/8/25")
    const target = createdAtStr || paymentDateStr || '';
    const dmyMatch = target.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const p3 = parseInt(dmyMatch[3], 10);
      // Determine if p1 is day and p2 is month or vice versa
      const day = p1 > 12 ? p1 : p1;
      const month = (p1 > 12 ? p2 : p2) - 1;
      const year = p3;
      const parsed = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    return new Date();
  }

  function getPeriodDateRange(
    period: string,
    customStart?: string,
    customEnd?: string
  ): { start: Date; end: Date } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const day = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

    switch (period) {
      case 'today':
        return {
          start: new Date(year, month, date, 0, 0, 0, 0),
          end: new Date(year, month, date, 23, 59, 59, 999),
        };
      case 'yesterday':
        return {
          start: new Date(year, month, date - 1, 0, 0, 0, 0),
          end: new Date(year, month, date - 1, 23, 59, 59, 999),
        };
      case 'this_week': {
        // Arab world / Egypt standard: week starts on Saturday (day 6 of JS getDay)
        const diffToSaturday = (day + 1) % 7;
        const weekStart = new Date(year, month, date - diffToSaturday, 0, 0, 0, 0);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        return { start: weekStart, end: weekEnd };
      }
      case 'last_week': {
        const diffToSaturday = (day + 1) % 7;
        const thisWeekStart = new Date(year, month, date - diffToSaturday, 0, 0, 0, 0);
        const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekEnd = new Date(thisWeekStart.getTime() - 1);
        return { start: lastWeekStart, end: lastWeekEnd };
      }
      case 'this_month':
        return {
          start: new Date(year, month, 1, 0, 0, 0, 0),
          end: new Date(year, month + 1, 0, 23, 59, 59, 999),
        };
      case 'last_month':
        return {
          start: new Date(year, month - 1, 1, 0, 0, 0, 0),
          end: new Date(year, month, 0, 23, 59, 59, 999),
        };
      case 'this_year':
        return {
          start: new Date(year, 0, 1, 0, 0, 0, 0),
          end: new Date(year, 11, 31, 23, 59, 59, 999),
        };
      case 'last_year':
        return {
          start: new Date(year - 1, 0, 1, 0, 0, 0, 0),
          end: new Date(year - 1, 11, 31, 23, 59, 59, 999),
        };
      case 'custom':
        if (customStart && customEnd) {
          const s = new Date(customStart + 'T00:00:00');
          const e = new Date(customEnd + 'T23:59:59.999');
          return {
            start: isNaN(s.getTime()) ? new Date(year, month, 1, 0, 0, 0, 0) : s,
            end: isNaN(e.getTime()) ? new Date() : e,
          };
        }
        return {
          start: new Date(year, month, 1, 0, 0, 0, 0),
          end: new Date(year, month + 1, 0, 23, 59, 59, 999),
        };
      default:
        return {
          start: new Date(year, month, 1, 0, 0, 0, 0),
          end: new Date(year, month + 1, 0, 23, 59, 59, 999),
        };
    }
  }

  // GET financial summary and customer debts overview (Admin Only)
  app.get('/api/debts', requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const ordersRes = db.exec(
        'SELECT id, orderNumber, customerId, customerName, customerPhone, customerAddress, grandTotal, paidAmount, remainingBalance, paymentStatus, createdAt FROM orders WHERE status != "Cancelled"'
      );

      const customerMap = new Map<string, CustomerDebtSummary>();
      let totalSales = 0;
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

      // Query actual payments table for accurate collections per period (Today, This Week, This Month, This Year)
      const payRes = db.exec(
        'SELECT id, amount, paymentDate, createdAt FROM payments ORDER BY createdAt DESC'
      );

      const todayRange = getPeriodDateRange('today');
      const thisWeekRange = getPeriodDateRange('this_week');
      const thisMonthRange = getPeriodDateRange('this_month');
      const thisYearRange = getPeriodDateRange('this_year');

      let collectedToday = 0;
      let collectedThisWeek = 0;
      let collectedThisMonth = 0;
      let collectedThisYear = 0;
      let totalCollected = 0;

      if (payRes.length > 0 && payRes[0].values) {
        for (const row of payRes[0].values) {
          const amt = Number(row[1] || 0);
          const paymentDateStr = row[2] ? String(row[2]) : '';
          const createdAtStr = row[3] ? String(row[3]) : '';
          const pDate = parsePaymentDate(createdAtStr, paymentDateStr);

          totalCollected += amt;

          if (pDate >= todayRange.start && pDate <= todayRange.end) {
            collectedToday += amt;
          }
          if (pDate >= thisWeekRange.start && pDate <= thisWeekRange.end) {
            collectedThisWeek += amt;
          }
          if (pDate >= thisMonthRange.start && pDate <= thisMonthRange.end) {
            collectedThisMonth += amt;
          }
          if (pDate >= thisYearRange.start && pDate <= thisYearRange.end) {
            collectedThisYear += amt;
          }
        }
      }

      const customersList = Array.from(customerMap.values()).sort((a, b) => b.totalDebt - a.totalDebt);
      const debtorsCount = customersList.filter((c) => c.totalDebt > 0).length;

      const summary: FinancialSummary = {
        totalSales,
        totalCollected,
        collectedToday,
        collectedThisWeek,
        collectedThisMonth,
        collectedThisYear,
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

  // GET Collections and Receipts Detailed Report (Admin Only)
  app.get('/api/reports/collections', requireAdmin, async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as string) || 'this_month';
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const paymentMethodFilter = (req.query.paymentMethod as string) || 'all';
      const searchQuery = ((req.query.q as string) || '').trim().toLowerCase();

      const db = await getDb();
      const payRes = db.exec(
        'SELECT id, orderId, orderNumber, customerId, customerName, customerPhone, amount, paymentDate, paymentMethod, collectedBy, notes, createdAt FROM payments ORDER BY createdAt DESC'
      );

      const todayRange = getPeriodDateRange('today');
      const thisWeekRange = getPeriodDateRange('this_week');
      const thisMonthRange = getPeriodDateRange('this_month');
      const thisYearRange = getPeriodDateRange('this_year');
      const selectedRange = getPeriodDateRange(period, startDate, endDate);

      let collectedToday = 0;
      let collectedThisWeek = 0;
      let collectedThisMonth = 0;
      let collectedThisYear = 0;
      let totalCollectedAllTime = 0;

      let periodTotal = 0;
      const byMethod = {
        Cash: 0,
        Bank: 0,
        VodafoneCash: 0,
        Cheque: 0,
        Other: 0,
      };

      const filteredPayments: PaymentTransaction[] = [];

      if (payRes.length > 0 && payRes[0].values) {
        for (const row of payRes[0].values) {
          const item: PaymentTransaction = {
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
          };

          const pDate = parsePaymentDate(item.createdAt, item.paymentDate);
          const amt = item.amount || 0;

          // Global periods stats (server-authoritative)
          totalCollectedAllTime += amt;
          if (pDate >= todayRange.start && pDate <= todayRange.end) {
            collectedToday += amt;
          }
          if (pDate >= thisWeekRange.start && pDate <= thisWeekRange.end) {
            collectedThisWeek += amt;
          }
          if (pDate >= thisMonthRange.start && pDate <= thisMonthRange.end) {
            collectedThisMonth += amt;
          }
          if (pDate >= thisYearRange.start && pDate <= thisYearRange.end) {
            collectedThisYear += amt;
          }

          // Filter for selected period
          const inPeriod = pDate >= selectedRange.start && pDate <= selectedRange.end;
          if (!inPeriod) continue;

          // Filter by payment method
          if (paymentMethodFilter !== 'all' && item.paymentMethod !== paymentMethodFilter) {
            continue;
          }

          // Filter by search query
          if (searchQuery) {
            const match =
              (item.customerName || '').toLowerCase().includes(searchQuery) ||
              (item.customerPhone || '').includes(searchQuery) ||
              (item.orderNumber || '').toLowerCase().includes(searchQuery) ||
              (item.collectedBy || '').toLowerCase().includes(searchQuery) ||
              (item.notes || '').toLowerCase().includes(searchQuery);
            if (!match) continue;
          }

          // Accumulate breakdown
          const m = item.paymentMethod;
          if (m === 'Cash') byMethod.Cash += amt;
          else if (m === 'Bank') byMethod.Bank += amt;
          else if (m === 'VodafoneCash') byMethod.VodafoneCash += amt;
          else if (m === 'Cheque' || m === 'Check') byMethod.Cheque += amt;
          else byMethod.Other += amt;

          periodTotal += amt;
          filteredPayments.push(item);
        }
      }

      // Outstanding Debt & Total Sales Calculation
      let totalSales = 0;
      let totalOutstandingDebt = 0;
      const ordersRes = db.exec(
        'SELECT grandTotal, remainingBalance FROM orders WHERE status != "Cancelled"'
      );
      if (ordersRes.length > 0 && ordersRes[0].values) {
        for (const row of ordersRes[0].values) {
          totalSales += Number(row[0] || 0);
          totalOutstandingDebt += Number(row[1] || 0);
        }
      }

      res.json({
        summary: {
          today: collectedToday,
          thisWeek: collectedThisWeek,
          thisMonth: collectedThisMonth,
          thisYear: collectedThisYear,
          totalOutstandingDebt,
          totalSales,
          totalCollectedAllTime,
        },
        periodSummary: {
          period: period as any,
          startDate,
          endDate,
          totalCollected: periodTotal,
          transactionsCount: filteredPayments.length,
          byMethod,
        },
        payments: filteredPayments,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر توليد تقرير التحصيل والمقبوضات' });
    }
  });

  // GET fast customer debt check (Authorized for Admin or matching Customer)
  app.get('/api/customers/:id/debt', requireCustomerIsolation('id'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = (req as any).user || (await getAuthUser(req));

      if (!authUser) {
        return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى بيانات الحساب' });
      }

      // Customer isolation check
      if (authUser.role === 'customer') {
        if (id !== authUser.id && id !== authUser.phone) {
          return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على حسابات عميل آخر' });
        }
      }

      // Always bind to current session identity if customer
      const queryId = authUser.role === 'customer' ? authUser.id : id;
      const queryPhone = authUser.role === 'customer' ? authUser.phone : id;

      const db = await getDb();
      const resStmt = db.exec(
        'SELECT SUM(grandTotal), SUM(paidAmount), SUM(remainingBalance), COUNT(*) FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled"',
        [queryId, queryPhone]
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
        customerId: queryId,
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
  app.get('/api/customers/:id/statement', requireCustomerIsolation('id'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = (req as any).user || (await getAuthUser(req));

      if (!authUser) {
        return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى كشف الحساب' });
      }

      // Customer isolation check
      if (authUser.role === 'customer') {
        if (id !== authUser.id && id !== authUser.phone) {
          return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على كشف حساب عميل آخر' });
        }
      }

      // Always bind to current session identity if customer
      const queryId = authUser.role === 'customer' ? authUser.id : id;
      const queryPhone = authUser.role === 'customer' ? authUser.phone : id;

      const db = await getDb();

      let customer = {
        id: queryId,
        name: 'عميل',
        phone: '',
        storeName: '',
        address: '',
      };

      const userStmt = db.prepare(
        'SELECT id, fullName, phone, storeName, address FROM users WHERE id = ? OR phone = ?'
      );
      userStmt.bind([queryId, queryPhone]);
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
          [queryId, queryPhone]
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

      // Fetch customer orders with mandatory session isolation
      const ordersRes = db.exec(
        'SELECT * FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled" ORDER BY createdAt DESC',
        [queryId, queryPhone]
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

      // Fetch customer payments with mandatory session isolation
      const payRes = db.exec(
        'SELECT * FROM payments WHERE customerId = ? OR customerPhone = ? ORDER BY createdAt DESC',
        [queryId, queryPhone]
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

      let totalCustomerDebt = 0;
      if (ordersRes.length > 0 && ordersRes[0].values) {
        for (const row of ordersRes[0].values) {
          totalCustomerDebt += Number(row[6] || 0);
        }
      }

      if (totalCustomerDebt <= 0) {
        return res.status(400).json({ error: 'لا توجد مديونيات أو مبالغ مستحقة للتحصيل على هذا العميل' });
      }

      if (payAmount > totalCustomerDebt) {
        return res.status(400).json({
          error: `لا يمكن تحصيل مبلغ (${payAmount} ج) أكبر من إجمالي المديونية المستحقة على العميل (${totalCustomerDebt} ج)`,
        });
      }

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
      const nowIso = new Date().toISOString();
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
          nowIso,
          paymentMethod || 'Cash',
          collectedBy || 'محمد فوزي',
          notes || 'تحصيل عام من رصيد العميل',
          nowIso,
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

  // POST Settle Full Customer Debt (Admin Only - Server-Authoritative Full Debt Settlement)
  const handleFullDebtSettlement = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUser = (req as any).user || (await getAuthUser(req));
      if (!authUser || authUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'غير مصرح لك بتنفيذ التحصيل الكامل. هذه العملية متاحة للأدمن فقط.',
        });
      }

      const db = await getDb();
      const adminName = authUser.fullName || 'محمد فوزي (الإدارة)';
      const paymentMethod = (req.body?.paymentMethod as string) || 'Cash';
      const userNotes = req.body?.notes ? String(req.body.notes).trim() : '';

      // 1. Fetch customer details
      let customerId = id;
      let customerName = 'عميل';
      let customerPhone = '';

      const userStmt = db.prepare('SELECT id, fullName, phone, storeName FROM users WHERE id = ? OR phone = ?');
      userStmt.bind([id, id]);
      if (userStmt.step()) {
        const u = userStmt.getAsObject();
        customerId = String(u.id);
        customerName = String(u.fullName || 'عميل');
        customerPhone = String(u.phone || '');
      }
      userStmt.free();

      // 2. Fetch all unpaid or partially paid orders directly from database
      const ordersRes = db.exec(
        'SELECT id, orderNumber, customerName, customerPhone, grandTotal, paidAmount, remainingBalance FROM orders WHERE (customerId = ? OR customerPhone = ?) AND remainingBalance > 0 AND status != "Cancelled" ORDER BY createdAt ASC',
        [customerId, customerPhone || customerId]
      );

      let actualTotalDebt = 0;
      const ordersToSettle: Array<{
        id: string;
        orderNumber: string;
        grandTotal: number;
        paidAmount: number;
        remainingBalance: number;
      }> = [];

      if (ordersRes.length > 0 && ordersRes[0].values) {
        for (const row of ordersRes[0].values) {
          const ordId = String(row[0]);
          const ordNum = String(row[1]);
          const ordCustomerName = String(row[2] || '');
          const ordCustomerPhone = row[3] ? String(row[3]) : '';
          const grandTotal = Number(row[4]);
          const paidAmount = Number(row[5] || 0);
          const remainingBalance = Number(row[6] || 0);

          if (!customerName || customerName === 'عميل') {
            customerName = ordCustomerName;
          }
          if (!customerPhone) {
            customerPhone = ordCustomerPhone;
          }

          if (remainingBalance > 0) {
            actualTotalDebt += remainingBalance;
            ordersToSettle.push({
              id: ordId,
              orderNumber: ordNum,
              grandTotal,
              paidAmount,
              remainingBalance,
            });
          }
        }
      }

      // 3. Strict Server-Side check: Debt must be strictly greater than 0
      if (actualTotalDebt <= 0 || ordersToSettle.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'لا توجد أي مديونية فعلية مستحقة على هذا العميل (إجمالي المديونية الحالية 0 ج.م)',
        });
      }

      const nowStr = new Date().toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      // 4. Update each order to fully Paid with 0 remaining balance and add audit log
      for (const ord of ordersToSettle) {
        db.run(
          `UPDATE orders SET paidAmount = ?, remainingBalance = 0, paymentStatus = 'Paid', updatedAt = ? WHERE id = ?`,
          [ord.grandTotal, nowStr, ord.id]
        );

        db.run(
          `INSERT INTO order_logs (id, orderId, timestamp, action, performedBy, details) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            'log_' + Date.now() + Math.random().toString(36).substring(2, 5),
            ord.id,
            nowStr,
            'تحصيل كامل المديونية',
            adminName,
            `تم سداد كامل متبقي الفاتورة (${(ord.remainingBalance || 0).toLocaleString('ar-EG')} ج) ضمن عملية التحصيل الكامل للحساب بواسطة ${adminName}`,
          ]
        );
      }

      // 5. Insert genuine transaction record in payments table
      const payId = 'pay_' + Date.now();
      const nowIso = new Date().toISOString();
      const settlementNotes = userNotes
        ? `تحصيل كامل المديونية (${actualTotalDebt.toLocaleString('ar-EG')} ج) - ${userNotes}`
        : `تحصيل وسداد كامل المديونية المستحقة على الحساب (${ordersToSettle.length} فواتير)`;

      db.run(
        `INSERT INTO payments (id, orderId, orderNumber, customerId, customerName, customerPhone, amount, paymentDate, paymentMethod, collectedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId,
          null,
          'تحصيل كامل المديونية',
          customerId,
          customerName,
          customerPhone,
          actualTotalDebt,
          nowIso,
          paymentMethod,
          adminName,
          settlementNotes,
          nowIso,
        ]
      );

      // 6. Record System Notification
      db.run(
        `INSERT INTO notifications (id, title, message, type, read, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'notif_' + Date.now(),
          `تحصيل كامل مديونية ${customerName}`,
          `قام ${adminName} بتحصيل كامل مديونية العميل ${customerName} بقيمة ${(actualTotalDebt || 0).toLocaleString('ar-EG')} ج بنجاح`,
          'system',
          0,
          nowStr,
        ]
      );

      saveDb();

      res.json({
        success: true,
        settledAmount: actualTotalDebt,
        settledOrdersCount: ordersToSettle.length,
        remainingDebt: 0,
        customer: {
          id: customerId,
          name: customerName,
          phone: customerPhone,
          totalDebt: 0,
        },
        message: 'تم تحصيل كامل مديونية العميل بنجاح',
      });
    } catch (err: any) {
      console.error('Error settling full debt:', err);
      res.status(500).json({ error: 'تعذر تنفيذ التحصيل الكامل للعميل' });
    }
  };

  app.post('/api/customers/:id/settle-full', requireAdmin, handleFullDebtSettlement);
  app.post('/api/customers/:id/full-collection', requireAdmin, handleFullDebtSettlement);

  // GET Admin Customers List with Aggregated Stats (Admin Only)
  const handleGetAdminCustomers = async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const usersRes = db.exec(
        `SELECT id, username, fullName, phone, role, storeName, address, createdAt, status FROM users WHERE role = 'customer' ORDER BY createdAt DESC`
      );

      const customersList: AdminCustomerRecord[] = [];
      if (usersRes.length > 0 && usersRes[0].values) {
        for (const row of usersRes[0].values) {
          const custId = String(row[0]);
          const username = String(row[1]);
          const fullName = String(row[2]);
          const phone = String(row[3]);
          const storeName = row[5] ? String(row[5]) : '';
          const address = row[6] ? String(row[6]) : '';
          const createdAt = row[7] ? String(row[7]) : '';
          const status = (row[8] as any) === 'disabled' ? 'disabled' : 'active';

          // Aggregate orders stats
          const ordStmt = db.prepare(
            `SELECT COUNT(*) as ordersCount, SUM(grandTotal) as totalPurchases, SUM(paidAmount) as totalPaid, SUM(remainingBalance) as currentDebt
             FROM orders
             WHERE (customerId = ? OR customerPhone = ?) AND status != 'Cancelled'`
          );
          ordStmt.bind([custId, phone]);

          let ordersCount = 0;
          let totalPurchases = 0;
          let totalPaid = 0;
          let currentDebt = 0;

          if (ordStmt.step()) {
            const stats = ordStmt.getAsObject();
            ordersCount = Number(stats.ordersCount || 0);
            totalPurchases = Number(stats.totalPurchases || 0);
            totalPaid = Number(stats.totalPaid || 0);
            currentDebt = Math.max(0, Number(stats.currentDebt || 0));
          }
          ordStmt.free();

          customersList.push({
            id: custId,
            username,
            fullName,
            storeName,
            phone,
            address,
            ordersCount,
            totalPurchases,
            totalPaid,
            currentDebt,
            createdAt: createdAt || '2026-08-01',
            status,
          });
        }
      }

      res.json(customersList);
    } catch (err: any) {
      console.error('Error fetching admin customers:', err);
      res.status(500).json({ error: 'تعذر جلب قائمة العملاء' });
    }
  };

  app.get('/api/admin/customers', requireAdmin, handleGetAdminCustomers);
  app.get('/api/customers', requireAdmin, handleGetAdminCustomers);

  // PUT Toggle / Update Customer Status (Active / Disabled) (Admin Only)
  app.put('/api/admin/customers/:id/status', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const newStatus = status === 'disabled' ? 'disabled' : 'active';
      const ip = getClientIp(req);
      const db = await getDb();

      db.run(`UPDATE users SET status = ? WHERE id = ? OR phone = ?`, [newStatus, id, id]);
      
      if (newStatus === 'disabled') {
        // Immediately revoke all sessions for this customer
        revokeAllUserSessions(db, id);
      }

      saveDb();

      logSecurityEvent(
        db,
        newStatus === 'disabled' ? 'CUSTOMER_ACCOUNT_DISABLED' : 'CUSTOMER_ACCOUNT_ENABLED',
        id,
        undefined,
        ip,
        `Admin changed customer status to ${newStatus}`
      );

      res.json({
        success: true,
        status: newStatus,
        message: newStatus === 'disabled' ? 'تم تعطيل حساب العميل بنجاح' : 'تم تفعيل حساب العميل بنجاح',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تغيير حالة حساب العميل' });
    }
  });

  // GET Payments (Admin gets all, Customer gets only their own - Protected)
  app.get('/api/payments', requireAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user as User;
      const db = await getDb();

      let sql = 'SELECT * FROM payments';
      const params: any[] = [];

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

  // POST Payment / Collection (Admin Only - Supports payments payload)
  app.post('/api/payments', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { customerId, customerName, customerPhone, amount, paymentMethod, notes, collectedBy } = req.body;
      const payAmount = Number(amount) || 0;

      if (!customerId || payAmount <= 0) {
        return res.status(400).json({ success: false, error: 'بيانات الدفعة غير مكتملة أو المبلغ غير صحيح' });
      }

      const db = await getDb();
      const nowStr = new Date().toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const nowIso = new Date().toISOString();

      // Find customer info
      let cName = customerName || '';
      let cPhone = customerPhone || '';
      const userStmt = db.prepare('SELECT fullName, phone FROM users WHERE id = ?');
      userStmt.bind([customerId]);
      if (userStmt.step()) {
        const u = userStmt.getAsObject();
        if (!cName) cName = String(u.fullName || '');
        if (!cPhone) cPhone = String(u.phone || '');
      }
      userStmt.free();

      // Insert payment record
      const payId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      db.run(
        `INSERT INTO payments (id, customerId, customerName, customerPhone, amount, paymentDate, paymentMethod, collectedBy, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId,
          customerId,
          cName || 'عميل',
          cPhone || '',
          payAmount,
          nowStr,
          paymentMethod || 'Cash',
          collectedBy || 'محمد فوزي (المندوب)',
          notes || 'تسجيل دفعة نقدية',
          nowIso,
        ]
      );

      // FIFO allocation across open unpaid orders
      const ordersRes = db.exec(
        'SELECT id, orderNumber, grandTotal, paidAmount, remainingBalance FROM orders WHERE (customerId = ? OR customerPhone = ?) AND remainingBalance > 0 AND status != "Cancelled" ORDER BY createdAt ASC',
        [customerId, cPhone || customerId]
      );

      let remainingToAllocate = payAmount;
      if (ordersRes.length > 0 && ordersRes[0].values) {
        for (const row of ordersRes[0].values) {
          if (remainingToAllocate <= 0) break;
          const oId = String(row[0]);
          const curPaid = Number(row[3] || 0);
          const curRem = Number(row[4] || 0);

          const alloc = Math.min(remainingToAllocate, curRem);
          const newPaid = curPaid + alloc;
          const newRem = Math.max(0, curRem - alloc);
          const newStatus = newRem === 0 ? 'Paid' : 'Partial';

          db.run(
            'UPDATE orders SET paidAmount = ?, remainingBalance = ?, paymentStatus = ?, updatedAt = ? WHERE id = ?',
            [newPaid, newRem, newStatus, nowIso, oId]
          );

          remainingToAllocate -= alloc;
        }
      }

      saveDb();

      res.json({
        success: true,
        message: 'تم تسجيل الدفعة وتحديث الحساب بنجاح',
        paymentId: payId,
      });
    } catch (err: any) {
      console.error('Error recording payment:', err);
      res.status(500).json({ success: false, error: 'تعذر تسجيل الدفعة' });
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

      const authUser = await getAuthUser(req);
      let targetCustId: string | null = null;
      let targetCustPhone: string | null = null;

      if (authUser) {
        if (authUser.role === 'customer') {
          // Strictly use the logged-in customer's own session identity
          targetCustId = authUser.id;
          targetCustPhone = authUser.phone;
        } else if (authUser.role === 'admin' && customerId) {
          // Admin can query on behalf of a specific customer
          targetCustId = String(customerId);
          targetCustPhone = String(customerId);
        }
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

      if (targetCustId) {
        const debtRes = db.exec(
          'SELECT SUM(grandTotal), SUM(paidAmount), SUM(remainingBalance), COUNT(*) FROM orders WHERE (customerId = ? OR customerPhone = ?) AND status != "Cancelled"',
          [targetCustId, targetCustPhone || targetCustId]
        );
        if (debtRes.length > 0 && debtRes[0].values && debtRes[0].values[0]) {
          const row = debtRes[0].values[0];
          customerDebt = Math.max(0, Number(row[2] || 0));
        }

        const lastOrdRes = db.exec(
          'SELECT orderNumber, status, grandTotal, paidAmount, remainingBalance, createdAt FROM orders WHERE (customerId = ? OR customerPhone = ?) ORDER BY createdAt DESC LIMIT 1',
          [targetCustId, targetCustPhone || targetCustId]
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
