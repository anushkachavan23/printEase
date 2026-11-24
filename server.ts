import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  calculateItemPricing,
  calculateOrderPricing,
  CAMPUS_COUNTER,
  DEFAULT_PRINT_SETTINGS,
  ORDER_STATUS_FLOW,
} from './src/shared/catalog.ts';
import type {
  ColorMode,
  OrderStatus,
  PaperSize,
  PaymentMethod,
  PrintOrderItemRecord,
  PrintOrderRecord,
  PrintSettings,
  PublicUserAccount,
  ReadyPushNotification,
  SidesMode,
} from './src/shared/catalog.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'pressline-store.json');
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

interface StoredUser extends PublicUserAccount {
  passwordSalt: string;
  passwordHash: string;
}

interface DeviceSubscription {
  id: string;
  userId: string | null;
  pickupCodes: string[];
  deviceLabel: string;
  createdAt: string;
}

interface PersistedStore {
  users: StoredUser[];
  orders: PrintOrderRecord[];
  deviceSubscriptions: DeviceSubscription[];
  notifications: ReadyPushNotification[];
  staffCredential: {
    salt: string;
    hash: string;
    claimedAt: string;
  } | null;
}

function createInitialStore(): PersistedStore {
  return {
    users: [],
    orders: [],
    deviceSubscriptions: [],
    notifications: [],
    staffCredential: null,
  };
}

function loadStore(): PersistedStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = createInitialStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      deviceSubscriptions: Array.isArray(parsed.deviceSubscriptions)
        ? parsed.deviceSubscriptions
        : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      staffCredential: parsed.staffCredential ?? null,
    };
  } catch (err) {
    console.error('Failed to load printEase store:', err);
    return createInitialStore();
  }
}

function saveStore(store: PersistedStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

const store = loadStore();

function hashSecret(secret: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifySecret(secret: string, salt: string, expectedHash: string): boolean {
  const actual = crypto.scryptSync(secret, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

interface TokenPayload {
  sub: string;
  role: 'user' | 'staff';
  exp: number;
}

function signToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    ) as TokenPayload;
    if (!payload.sub || !payload.role || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function toPublicUser(user: StoredUser): PublicUserAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    defaultSettings: user.defaultSettings,
    deviceNotificationsEnabled: user.deviceNotificationsEnabled,
    createdAt: user.createdAt,
  };
}

function sanitizeTrackingOrder(order: PrintOrderRecord, includeContact: boolean) {
  if (includeContact) {
    return order;
  }
  const firstName = order.customerName.trim().split(/\s+/)[0] || 'Student';
  return {
    ...order,
    customerName: firstName,
    customerEmail: '',
    customerPhone: '',
  };
}

interface SseClient {
  id: string;
  res: Response;
  role: 'public' | 'user' | 'staff';
  userId: string | null;
  watchCode: string | null;
}

const sseClients = new Map<string, SseClient>();

function broadcastSseEvent(
  eventName: string,
  data: unknown,
  filter: (client: SseClient) => boolean
) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of sseClients.entries()) {
    if (!filter(client)) continue;
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(id);
    }
  }
}

function getAuthenticatedUser(req: Request): StoredUser | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'user') return null;
  return store.users.find((u) => u.id === payload.sub) || null;
}

function requireUser(req: Request, res: Response, next: NextFunction): void {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  (req as Request & { authUser: StoredUser }).authUser = user;
  next();
}

function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Staff authentication required.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'staff') {
    res.status(403).json({ error: 'Staff privileges required.' });
    return;
  }
  next();
}

function generateUniquePickupCode(): string {
  const existing = new Set(store.orders.map((o) => o.pickupCode));
  for (let i = 0; i < 50; i += 1) {
    const num = crypto.randomInt(1000, 9999);
    const candidate = `PRL-${num}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `PRL-${crypto.randomInt(10000, 99999)}`;
}

function validatePrintSettings(raw: unknown): PrintSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const colorMode = obj.colorMode;
  const sides = obj.sides;
  const paperSize = obj.paperSize;
  const copies = Number(obj.copies);

  if (colorMode !== 'bw' && colorMode !== 'color') return null;
  if (sides !== 'single' && sides !== 'double') return null;
  if (paperSize !== 'A4' && paperSize !== 'A3' && paperSize !== 'Letter') return null;
  if (!Number.isInteger(copies) || copies < 1 || copies > 500) return null;

  return {
    colorMode: colorMode as ColorMode,
    sides: sides as SidesMode,
    paperSize: paperSize as PaperSize,
    copies,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 180;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && phone.length <= 32;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/register', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Please enter your full name (2–80 characters).' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (phone && !isValidPhone(phone)) {
      res.status(400).json({ error: 'Please enter a valid phone number.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      return;
    }

    if (store.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const { salt, hash } = hashSecret(password);
    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID()}`,
      name,
      email,
      phone,
      defaultSettings: { ...DEFAULT_PRINT_SETTINGS },
      deviceNotificationsEnabled: false,
      createdAt: new Date().toISOString(),
      passwordSalt: salt,
      passwordHash: hash,
    };

    store.users.push(newUser);
    saveStore(store);

    const token = signToken({
      sub: newUser.id,
      role: 'user',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      token,
      user: toPublicUser(newUser),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const user = store.users.find((u) => u.email === email);
    if (!user || !verifySecret(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken({
      sub: user.id,
      role: 'user',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      user: toPublicUser(user),
    });
  });

  app.get('/api/account/me', requireUser, (req, res) => {
    const user = (req as Request & { authUser: StoredUser }).authUser;
    res.json({ user: toPublicUser(user) });
  });

  app.put('/api/account/preferences', requireUser, (req, res) => {
    const user = (req as Request & { authUser: StoredUser }).authUser;
    const body = req.body as Record<string, unknown>;

    if (body.defaultSettings !== undefined) {
      const validated = validatePrintSettings(body.defaultSettings);
      if (!validated) {
        res.status(400).json({ error: 'Invalid default print settings.' });
        return;
      }
      user.defaultSettings = validated;
    }

    if (typeof body.phone === 'string') {
      const trimmedPhone = body.phone.trim();
      if (trimmedPhone && !isValidPhone(trimmedPhone)) {
        res.status(400).json({ error: 'Please enter a valid phone number.' });
        return;
      }
      user.phone = trimmedPhone;
    }

    if (typeof body.deviceNotificationsEnabled === 'boolean') {
      user.deviceNotificationsEnabled = body.deviceNotificationsEnabled;
    }

    saveStore(store);
    res.json({ user: toPublicUser(user) });
  });

  app.get('/api/account/orders', requireUser, (req, res) => {
    const user = (req as Request & { authUser: StoredUser }).authUser;
    const userOrders = store.orders
      .filter((o) => o.userId === user.id || o.customerEmail.toLowerCase() === user.email)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ orders: userOrders });
  });

  app.post('/api/notifications/subscribe', (req, res) => {
    const authUser = getAuthenticatedUser(req);
    const body = req.body as Record<string, unknown>;
    const pickupCode =
      typeof body.pickupCode === 'string'
        ? body.pickupCode.trim().toUpperCase()
        : null;
    const deviceLabel =
      typeof body.deviceLabel === 'string'
        ? body.deviceLabel.slice(0, 120)
        : 'Web Browser Device';

    if (pickupCode && !/^PRL-\d{4,6}$/.test(pickupCode)) {
      res.status(400).json({ error: 'Invalid pickup code format.' });
      return;
    }

    if (authUser) {
      authUser.deviceNotificationsEnabled = true;
    }

    const existing = store.deviceSubscriptions.find(
      (s) =>
        (authUser && s.userId === authUser.id) ||
        (pickupCode && s.pickupCodes.includes(pickupCode))
    );

    if (existing) {
      if (pickupCode && !existing.pickupCodes.includes(pickupCode)) {
        existing.pickupCodes.push(pickupCode);
      }
      if (authUser && !existing.userId) {
        existing.userId = authUser.id;
      }
      saveStore(store);
      res.json({ subscribed: true, subscriptionId: existing.id });
      return;
    }

    const sub: DeviceSubscription = {
      id: `dev_${crypto.randomUUID()}`,
      userId: authUser?.id ?? null,
      pickupCodes: pickupCode ? [pickupCode] : [],
      deviceLabel,
      createdAt: new Date().toISOString(),
    };
    store.deviceSubscriptions.push(sub);
    saveStore(store);

    res.status(201).json({ subscribed: true, subscriptionId: sub.id });
  });

  app.post('/api/orders', (req, res) => {
    const authUser = getAuthenticatedUser(req);
    const body = req.body as Record<string, unknown>;

    const customerName =
      typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const customerEmail =
      typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
    const customerPhone =
      typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
    const paymentMethod = body.paymentMethod as PaymentMethod;
    const rawPayRef =
      typeof body.paymentReference === 'string' ? body.paymentReference.trim() : '';
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2 || customerName.length > 80) {
      res.status(400).json({ error: 'Full name is required (2–80 characters).' });
      return;
    }
    if (!isValidEmail(customerEmail)) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    if (!isValidPhone(customerPhone)) {
      res.status(400).json({ error: 'Valid phone number is required.' });
      return;
    }
    if (paymentMethod !== 'upi_qr' && paymentMethod !== 'upi_id') {
      res.status(400).json({ error: 'Select UPI QR or UPI ID payment method.' });
      return;
    }
    if (paymentMethod === 'upi_id') {
      if (!/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/.test(rawPayRef)) {
        res.status(400).json({ error: 'Enter a valid UPI ID (e.g., name@okicici).' });
        return;
      }
    } else if (!/^[a-zA-Z0-9\-_]{6,40}$/.test(rawPayRef)) {
      res.status(400).json({
        error: 'Enter a valid UPI Transaction ID (6–40 alphanumeric characters).',
      });
      return;
    }
    if (rawItems.length === 0 || rawItems.length > 30) {
      res.status(400).json({ error: 'Please include between 1 and 30 documents.' });
      return;
    }

    const validatedItems: PrintOrderItemRecord[] = [];
    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') {
        res.status(400).json({ error: 'Invalid document item payload.' });
        return;
      }
      const item = raw as Record<string, unknown>;
      const fileName =
        typeof item.fileName === 'string' ? item.fileName.trim().slice(0, 140) : '';
      const fileSize = Number(item.fileSize);
      const mimeType =
        typeof item.mimeType === 'string'
          ? item.mimeType.slice(0, 100)
          : 'application/pdf';
      const pages = Number(item.pages);
      const printSettings = validatePrintSettings(item);

      if (!fileName || !Number.isFinite(fileSize) || fileSize < 0) {
        res.status(400).json({ error: 'Each document must include a valid file name and size.' });
        return;
      }
      if (!Number.isInteger(pages) || pages < 1 || pages > 500 || !printSettings) {
        res.status(400).json({ error: `Invalid print options for "${fileName}".` });
        return;
      }

      const calc = calculateItemPricing({
        pages,
        copies: printSettings.copies,
        colorMode: printSettings.colorMode,
        sides: printSettings.sides,
        paperSize: printSettings.paperSize,
      });

      validatedItems.push({
        id: typeof item.id === 'string' ? item.id.slice(0, 64) : crypto.randomUUID(),
        fileName,
        fileSize,
        mimeType,
        pages,
        colorMode: printSettings.colorMode,
        sides: printSettings.sides,
        paperSize: printSettings.paperSize,
        copies: printSettings.copies,
        lineSubtotal: calc.lineSubtotal,
        totalSheetsUsed: calc.totalSheetsUsed,
      });
    }

    const totals = calculateOrderPricing(validatedItems);
    const nowIso = new Date().toISOString();
    const pickupCode = generateUniquePickupCode();
    const paymentReference =
      rawPayRef.slice(0, 80) ||
      `UPI-${crypto.randomInt(100000, 999999)}`;

    const newOrder: PrintOrderRecord = {
      pickupCode,
      userId: authUser?.id ?? null,
      customerName,
      customerEmail,
      customerPhone,
      counterName: CAMPUS_COUNTER.name,
      counterLocation: CAMPUS_COUNTER.location,
      paymentMethod,
      paymentReference,
      paymentStatus: 'Paid',
      items: validatedItems,
      subtotal: totals.subtotal,
      total: totals.total,
      totalSheets: totals.totalSheets,
      status: 'Received',
      statusHistory: [
        {
          status: 'Received',
          timestamp: nowIso,
          note: 'Order received at Print Shop SSPU. We will notify you once it is ready.',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
      readyNotificationSent: false,
    };

    store.orders.unshift(newOrder);
    saveStore(store);

    broadcastSseEvent('order:created', { order: newOrder }, (c) => c.role === 'staff');

    res.status(201).json({ order: newOrder });
  });

  app.get('/api/orders/:code', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    if (!/^PRL-\d{4,6}$/.test(code)) {
      res.status(400).json({ error: 'Enter a valid pickup code (e.g., PRL-4821).' });
      return;
    }

    const order = store.orders.find((o) => o.pickupCode === code);
    if (!order) {
      res.status(404).json({ error: `No order found with pickup code ${code}.` });
      return;
    }

    const authUser = getAuthenticatedUser(req);
    const token = extractBearerToken(req);
    const tokenPayload = token ? verifyToken(token) : null;
    const isStaff = tokenPayload?.role === 'staff';
    const isOwner =
      authUser !== null &&
      (order.userId === authUser.id || order.customerEmail.toLowerCase() === authUser.email);

    res.json({ order: sanitizeTrackingOrder(order, isStaff || isOwner) });
  });

  app.get('/api/orders/stream/live', (req, res) => {
    const tokenParam = typeof req.query.token === 'string' ? req.query.token : null;
    const watchCodeParam =
      typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : null;

    let role: 'public' | 'user' | 'staff' = 'public';
    let userId: string | null = null;

    if (tokenParam) {
      const payload = verifyToken(tokenParam);
      if (payload?.role === 'staff') {
        role = 'staff';
      } else if (payload?.role === 'user') {
        role = 'user';
        userId = payload.sub;
      }
    }

    const watchCode =
      watchCodeParam && /^PRL-\d{4,6}$/.test(watchCodeParam) ? watchCodeParam : null;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const clientId = crypto.randomUUID();
    sseClients.set(clientId, { id: clientId, res, role, userId, watchCode });

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, role })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(clientId);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(clientId);
    });
  });

  app.get('/api/staff/status', (_req, res) => {
    const envPasscodeSet = Boolean(
      process.env.STAFF_PASSCODE && process.env.STAFF_PASSCODE.trim().length > 0
    );
    res.json({
      envConfigured: envPasscodeSet,
      claimed: envPasscodeSet || store.staffCredential !== null,
    });
  });

  app.post('/api/staff/claim', (req, res) => {
    const envPasscode = process.env.STAFF_PASSCODE?.trim();
    if (envPasscode) {
      res.status(409).json({ error: 'Staff passcode is already configured via environment.' });
      return;
    }
    if (store.staffCredential !== null) {
      res.status(409).json({ error: 'Staff passcode has already been claimed. Please sign in.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : '';
    if (passcode.length < 6 || passcode.length > 64) {
      res.status(400).json({ error: 'Staff passcode must be 6–64 characters.' });
      return;
    }

    const { salt, hash } = hashSecret(passcode);
    store.staffCredential = {
      salt,
      hash,
      claimedAt: new Date().toISOString(),
    };
    saveStore(store);

    const token = signToken({
      sub: 'staff-operator',
      role: 'staff',
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ token });
  });

  app.post('/api/staff/login', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : '';
    const envPasscode = process.env.STAFF_PASSCODE?.trim();

    let authorized = false;
    if (envPasscode) {
      const a = Buffer.from(passcode, 'utf-8');
      const b = Buffer.from(envPasscode, 'utf-8');
      authorized = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else if (store.staffCredential) {
      authorized = verifySecret(
        passcode,
        store.staffCredential.salt,
        store.staffCredential.hash
      );
    } else {
      res.status(400).json({ error: 'No staff passcode set yet. Claim one first.' });
      return;
    }

    if (!authorized) {
      res.status(401).json({ error: 'Incorrect staff passcode.' });
      return;
    }

    const token = signToken({
      sub: 'staff-operator',
      role: 'staff',
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    res.json({ token });
  });

  app.get('/api/staff/orders', requireStaff, (_req, res) => {
    const sorted = [...store.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ orders: sorted });
  });

  app.patch('/api/staff/orders/:code/status', requireStaff, (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const order = store.orders.find((o) => o.pickupCode === code);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const nextStatus = body.status as OrderStatus;
    const noteInput = typeof body.note === 'string' ? body.note.trim().slice(0, 160) : '';

    if (!ORDER_STATUS_FLOW.includes(nextStatus)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const defaultNotes: Record<OrderStatus, string> = {
      Received: 'Order queued at Print Shop SSPU.',
      Printing: 'Your documents are currently printing.',
      'Ready for Pickup': `Prints are ready at ${order.counterLocation}.`,
      Completed: 'Collected at Print Shop SSPU.',
    };

    order.status = nextStatus;
    order.updatedAt = nowIso;
    order.statusHistory.push({
      status: nextStatus,
      timestamp: nowIso,
      note: noteInput || defaultNotes[nextStatus],
    });

    let pushNotification: ReadyPushNotification | null = null;
    if (nextStatus === 'Ready for Pickup') {
      order.readyNotificationSent = true;
      pushNotification = {
        id: `notif_${crypto.randomUUID()}`,
        pickupCode: order.pickupCode,
        counterName: order.counterName,
        counterLocation: order.counterLocation,
        customerName: order.customerName,
        createdAt: nowIso,
      };
      store.notifications.unshift(pushNotification);
      if (store.notifications.length > 100) {
        store.notifications = store.notifications.slice(0, 100);
      }
    }

    saveStore(store);

    for (const [, client] of sseClients.entries()) {
      const canSeeFull =
        client.role === 'staff' ||
        (client.role === 'user' && order.userId && client.userId === order.userId);
      const isWatchingCode = client.watchCode === order.pickupCode;

      if (canSeeFull || isWatchingCode) {
        const payload = {
          order: sanitizeTrackingOrder(order, Boolean(canSeeFull)),
        };
        try {
          client.res.write(`event: order:updated\ndata: ${JSON.stringify(payload)}\n\n`);
          if (pushNotification) {
            client.res.write(
              `event: order:ready\ndata: ${JSON.stringify({ notification: pushNotification })}\n\n`
            );
          }
        } catch {
          // cleaned up on close
        }
      }
    }

    res.json({ order, pushNotification });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`printEase server running on http://localhost:${PORT}`);
  });
}

startServer();
