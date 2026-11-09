import crypto from "crypto";
import QRCode from "qrcode";
import {
  getConfiguredAmount,
  getPaidSubject,
  PAYMENT_ACCESS_DAYS,
  PAYMENT_CURRENCY,
  type PaidSubjectId,
} from "@/lib/paymentCatalog";
import { hasActiveSubjectAccess, type PaymentEntitlement } from "@/lib/purchases";

export const ORDER_EXPIRY_MINUTES = Math.max(
  5,
  Math.min(60, Number(process.env.UPI_ORDER_EXPIRY_MINUTES || 15) || 15)
);
export const MAX_UTR_ATTEMPTS = 3;
export const UTR_GRACE_MINUTES = 60;

export type UpiOrderStatus = "pending" | "review" | "paid" | "expired";

export interface UpiMerchantAccount {
  id: string;
  label: string;
  upiId: string;
  payeeName: string;
  dailyLimitPaise: number; // 0 means unlimited
  isActive: boolean;
  source: "firestore" | "env";
  createdAt: string;
  updatedAt: string;
}

export interface UpiPaymentOrder {
  orderNo: string;
  uid: string;
  userEmail: string;
  userName: string;
  subjectId: PaidSubjectId;
  subjectTitle: string;
  amountPaise: number;
  currency: string;
  status: UpiOrderStatus;
  upiAccountId: string;
  upiId: string;
  payeeName: string;
  customerUtr: string | null;
  utr: string | null;
  utrAttempts: number;
  utrSubmittedAt: string | null;
  reviewNote: string | null;
  verifiedBy: "utr_review" | "manual_admin" | null;
  verifiedByAdminEmail: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  integrityHmac: string;
}

export interface PaymentAuditLog {
  id: string;
  action:
    | "order_created"
    | "utr_submitted"
    | "utr_approved"
    | "utr_rejected"
    | "manual_paid"
    | "upi_account_saved"
    | "upi_account_deleted"
    | "security_violation";
  actorUid: string;
  actorEmail: string;
  orderNo: string | null;
  utr: string | null;
  amountPaise: number | null;
  details: string;
  ip: string | null;
  timestamp: string;
}

export interface StudentOrderView {
  orderNo: string;
  subjectId: PaidSubjectId;
  subjectTitle: string;
  amountPaise: number;
  currency: string;
  status: UpiOrderStatus;
  upiId: string;
  payeeName: string;
  customerUtr: string | null;
  utr: string | null;
  utrAttempts: number;
  maxUtrAttempts: number;
  utrRemainingAttempts: number;
  canSubmitUtr: boolean;
  reviewNote: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  upiIntentUrl: string | null;
  qrDataUrl: string | null;
  appLinks: {
    gpay: string;
    phonepe: string;
    paytm: string;
    generic: string;
  } | null;
}

const ORDERS_COLLECTION = "payment_orders";
const ENTITLEMENTS_COLLECTION = "payment_entitlements";
const UTR_REGISTRY_COLLECTION = "upi_utr_registry";
const ACCOUNTS_COLLECTION = "upi_accounts";
const AUDIT_LOGS_COLLECTION = "payment_audit_logs";

// In-memory rate limiter for abuse protection (sliding window)
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

export class GatewayError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "GATEWAY_ERROR") {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
  }
}

// --- Firebase Admin Firestore Singleton ---

let cachedFirestore: any = null;

export async function getGatewayFirestore() {
  if (cachedFirestore) return cachedFirestore;

  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "os-web-1cc80";
  const databaseId = process.env.FIREBASE_DATABASE_ID || "default";

  let app = getApps()[0] || null;
  if (!app) {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      const parsed = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8"));
      credential = cert(parsed);
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      credential = cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
    } else {
      throw new GatewayError("Payment database persistence is not configured.", 503, "DB_NOT_CONFIGURED");
    }

    app = initializeApp({ projectId, credential });
  }

  cachedFirestore = getFirestore(app, databaseId);
  return cachedFirestore;
}

// --- Cryptographic Integrity & Validation ---

function getIntegritySecret(): string {
  const secret = (process.env.UPI_GATEWAY_SECRET || process.env.ADMIN_SESSION_SECRET || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!secret || secret.length < 32) {
    throw new GatewayError(
      "Server cryptographic integrity secret is not configured.",
      503,
      "MISSING_INTEGRITY_SECRET"
    );
  }
  return secret;
}

export function computeOrderHmac(order: {
  orderNo: string;
  uid: string;
  subjectId: PaidSubjectId;
  amountPaise: number;
  currency: string;
  upiId: string;
  payeeName: string;
  createdAt: string;
}): string {
  const payload = [
    order.orderNo,
    order.uid,
    order.subjectId,
    String(order.amountPaise),
    order.currency,
    order.upiId,
    order.payeeName,
    order.createdAt,
  ].join("|");
  return crypto.createHmac("sha256", getIntegritySecret()).update(payload).digest("hex");
}

export function verifyOrderIntegrity(order: UpiPaymentOrder | null | undefined): boolean {
  if (!order || !order.integrityHmac) return false;
  try {
    const expected = computeOrderHmac(order);
    const a = Buffer.from(order.integrityHmac, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isValidUpiVpa(vpa: string): boolean {
  const clean = String(vpa || "").trim();
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/.test(clean);
}

export function sanitizePayeeName(name: string): string {
  return String(name || "")
    .replace(/[^a-zA-Z0-9 ._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

export function normalizeUtr(raw: string): string {
  return String(raw || "").replace(/\s+/g, "").trim();
}

export function isValidUtr(utr: string): boolean {
  if (!/^\d{12}$/.test(utr)) return false;
  // Reject obvious impossible all-zero sequence
  if (utr === "000000000000") return false;
  return true;
}

export function acceptsCustomerUtr(order: UpiPaymentOrder, now = Date.now()): boolean {
  if ((order.utrAttempts || 0) >= MAX_UTR_ATTEMPTS) return false;
  if (order.status === "pending") return true;
  if (order.status === "expired") {
    const expiryMs = Date.parse(order.expiresAt);
    const graceCutoff = expiryMs + UTR_GRACE_MINUTES * 60 * 1000;
    return Number.isFinite(expiryMs) && now <= graceCutoff;
  }
  return false;
}

export function buildUpiIntentUrl(
  order: Pick<UpiPaymentOrder, "orderNo" | "upiId" | "payeeName" | "amountPaise" | "currency" | "subjectTitle">,
  scheme: "upi://pay" | "tez://upi/pay" | "phonepe://pay" | "paytmmp://pay" = "upi://pay"
): string {
  const note = `OS ${order.orderNo} ${order.subjectTitle}`
    .replace(/[^a-zA-Z0-9 .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 45);

  const entries: Array<[string, string]> = [
    ["pa", order.upiId],
    ["pn", sanitizePayeeName(order.payeeName) || "Officium Supremum"],
    ["am", (order.amountPaise / 100).toFixed(2)],
    ["cu", order.currency || "INR"],
    ["tr", order.orderNo],
    ["tn", note],
  ];

  // Use RFC 3986 percent-encoding (%20 for spaces rather than +) per NPCI UPI linking spec
  const query = entries
    .map(([k, v]) => {
      const encoded = encodeURIComponent(v);
      return `${k}=${k === "pa" ? encoded.replace(/%40/g, "@") : encoded}`;
    })
    .join("&");

  return `${scheme}?${query}`;
}

export async function generateQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#252923",
      light: "#FFFFFF",
    },
  });
}

// --- Merchant UPI Account Resolution ---

function getEnvFallbackAccount(): UpiMerchantAccount | null {
  const vpa = (process.env.UPI_MERCHANT_VPA || "").trim();
  if (!isValidUpiVpa(vpa)) return null;
  const payeeName = sanitizePayeeName(process.env.UPI_MERCHANT_NAME || "Officium Supremum") || "Officium Supremum";
  return {
    id: "env_default",
    label: "Environment UPI",
    upiId: vpa,
    payeeName,
    dailyLimitPaise: 0,
    isActive: true,
    source: "env",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export async function listUpiAccounts(): Promise<UpiMerchantAccount[]> {
  try {
    const db = await getGatewayFirestore();
    const snap = await db.collection(ACCOUNTS_COLLECTION).get();
    const accounts: UpiMerchantAccount[] = [];
    snap.forEach((doc: any) => {
      const d = doc.data();
      if (d && isValidUpiVpa(d.upiId)) {
        accounts.push({
          id: doc.id,
          label: String(d.label || "Primary UPI"),
          upiId: String(d.upiId).trim(),
          payeeName: sanitizePayeeName(d.payeeName || "Officium Supremum"),
          dailyLimitPaise: Number(d.dailyLimitPaise || 0),
          isActive: Boolean(d.isActive),
          source: "firestore",
          createdAt: String(d.createdAt || ""),
          updatedAt: String(d.updatedAt || ""),
        });
      }
    });
    accounts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return accounts;
  } catch {
    return [];
  }
}

export async function getActiveUpiAccountForAmount(amountPaise: number): Promise<UpiMerchantAccount | null> {
  const accounts = await listUpiAccounts();
  const activeAccounts = accounts.filter((acc) => acc.isActive);

  if (activeAccounts.length > 0) {
    const db = await getGatewayFirestore();
    const todayPrefix = new Date().toISOString().slice(0, 10);

    // Filter by daily limit if set (check today's paid orders)
    const eligible: Array<{ account: UpiMerchantAccount; todayTotal: number }> = [];
    const hasLimits = activeAccounts.some((acc) => acc.dailyLimitPaise > 0);

    const spendByAccount = new Map<string, number>();
    if (hasLimits) {
      const paidSnap = await db
        .collection(ORDERS_COLLECTION)
        .where("status", "==", "paid")
        .get();
      paidSnap.forEach((doc: any) => {
        const d = doc.data();
        if (d?.paidAt && String(d.paidAt).startsWith(todayPrefix) && d?.upiAccountId) {
          spendByAccount.set(
            d.upiAccountId,
            (spendByAccount.get(d.upiAccountId) || 0) + Number(d.amountPaise || 0)
          );
        }
      });
    }

    for (const acc of activeAccounts) {
      const spent = spendByAccount.get(acc.id) || 0;
      if (acc.dailyLimitPaise <= 0 || spent + amountPaise <= acc.dailyLimitPaise) {
        eligible.push({ account: acc, todayTotal: spent });
      }
    }

    if (eligible.length > 0) {
      // Load-balance / rotate across eligible accounts by picking lowest daily spent first
      eligible.sort((a, b) => a.todayTotal - b.todayTotal);
      return eligible[0].account;
    }

    // If all limited accounts hit daily cap, fall back to env only if configured
    return getEnvFallbackAccount();
  }

  return getEnvFallbackAccount();
}

export async function isUpiGatewayConfigured(): Promise<boolean> {
  try {
    await getIntegritySecret();
    const account = await getActiveUpiAccountForAmount(100);
    return Boolean(account);
  } catch {
    return false;
  }
}

export async function saveUpiAccount(
  input: {
    id?: string;
    label: string;
    upiId: string;
    payeeName: string;
    dailyLimitRupees?: number;
    isActive?: boolean;
  },
  adminEmail: string,
  ip?: string | null
): Promise<UpiMerchantAccount> {
  const upiId = String(input.upiId || "").trim();
  const payeeName = sanitizePayeeName(input.payeeName);
  const label = String(input.label || "Merchant UPI").trim().slice(0, 60);

  if (!isValidUpiVpa(upiId)) {
    throw new GatewayError("Enter a valid UPI ID (e.g. name@okaxis or merchant@ybl).", 400, "INVALID_VPA");
  }
  if (!payeeName || payeeName.length < 2) {
    throw new GatewayError("Payee Name must be at least 2 characters.", 400, "INVALID_PAYEE");
  }

  const dailyLimitRupees = Number(input.dailyLimitRupees || 0);
  const dailyLimitPaise =
    Number.isFinite(dailyLimitRupees) && dailyLimitRupees > 0 ? Math.round(dailyLimitRupees * 100) : 0;

  const db = await getGatewayFirestore();
  const now = new Date().toISOString();
  const id = input.id?.trim() || `upi_${crypto.randomBytes(6).toString("hex")}`;
  const ref = db.collection(ACCOUNTS_COLLECTION).doc(id);
  const existing = await ref.get();

  const record: UpiMerchantAccount = {
    id,
    label,
    upiId,
    payeeName,
    dailyLimitPaise,
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
    source: "firestore",
    createdAt: existing.exists ? String(existing.data()?.createdAt || now) : now,
    updatedAt: now,
  };

  await ref.set(record);
  await writeAuditLog(db, {
    action: "upi_account_saved",
    actorUid: "admin",
    actorEmail: adminEmail,
    orderNo: null,
    utr: null,
    amountPaise: null,
    details: `${existing.exists ? "Updated" : "Created"} UPI account ${label} (${upiId}) · Active: ${record.isActive}`,
    ip: ip || null,
  });

  return record;
}

export async function deleteUpiAccount(id: string, adminEmail: string, ip?: string | null): Promise<void> {
  const db = await getGatewayFirestore();
  const ref = db.collection(ACCOUNTS_COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new GatewayError("UPI account not found.", 404);
  const data = snap.data();
  await ref.delete();
  await writeAuditLog(db, {
    action: "upi_account_deleted",
    actorUid: "admin",
    actorEmail: adminEmail,
    orderNo: null,
    utr: null,
    amountPaise: null,
    details: `Deleted UPI account ${data?.label || id} (${data?.upiId || ""})`,
    ip: ip || null,
  });
}

// --- Audit Logging ---

async function writeAuditLog(
  db: any,
  entry: Omit<PaymentAuditLog, "id" | "timestamp">,
  transaction?: any
): Promise<void> {
  const id = `AUD_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const doc: PaymentAuditLog = {
    id,
    ...entry,
    timestamp: new Date().toISOString(),
  };
  const ref = db.collection(AUDIT_LOGS_COLLECTION).doc(id);
  if (transaction) {
    transaction.set(ref, doc);
  } else {
    await ref.set(doc);
  }
}

// --- Student Order Formatting ---

export async function buildStudentOrderView(order: UpiPaymentOrder): Promise<StudentOrderView> {
  const now = Date.now();
  const showQr = order.status === "pending";
  const upiIntentUrl = showQr ? buildUpiIntentUrl(order, "upi://pay") : null;
  const qrDataUrl = upiIntentUrl ? await generateQrDataUrl(upiIntentUrl) : null;
  const appLinks = showQr
    ? {
        gpay: buildUpiIntentUrl(order, "tez://upi/pay"),
        phonepe: buildUpiIntentUrl(order, "phonepe://pay"),
        paytm: buildUpiIntentUrl(order, "paytmmp://pay"),
        generic: upiIntentUrl!,
      }
    : null;

  return {
    orderNo: order.orderNo,
    subjectId: order.subjectId,
    subjectTitle: order.subjectTitle,
    amountPaise: order.amountPaise,
    currency: order.currency,
    status: order.status,
    upiId: order.upiId,
    payeeName: order.payeeName,
    customerUtr: order.customerUtr,
    utr: order.utr,
    utrAttempts: order.utrAttempts || 0,
    maxUtrAttempts: MAX_UTR_ATTEMPTS,
    utrRemainingAttempts: Math.max(0, MAX_UTR_ATTEMPTS - (order.utrAttempts || 0)),
    canSubmitUtr: acceptsCustomerUtr(order, now),
    reviewNote: order.reviewNote,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    upiIntentUrl,
    qrDataUrl,
    appLinks,
  };
}

// --- Student Order Lifecycle ---

export async function createOrResumeUpiOrder(params: {
  uid: string;
  email: string;
  name: string;
  subjectId: string;
  ip?: string | null;
}): Promise<StudentOrderView> {
  if (!checkRateLimit(`create_order:${params.uid}`, 12, 10 * 60 * 1000)) {
    throw new GatewayError("Too many payment requests. Please wait a few minutes.", 429, "RATE_LIMITED");
  }

  const subject = getPaidSubject(params.subjectId);
  if (!subject) {
    throw new GatewayError("Invalid or non-purchasable subject.", 400, "INVALID_SUBJECT");
  }

  const { active: alreadyActive } = await hasActiveSubjectAccess(params.uid, subject.id);
  if (alreadyActive) {
    throw new GatewayError("You already have active access to this subject.", 409, "ALREADY_ACTIVE");
  }

  const amountPaise = getConfiguredAmount(subject);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new GatewayError("Subject pricing is not configured properly.", 503, "INVALID_AMOUNT");
  }

  const account = await getActiveUpiAccountForAmount(amountPaise);
  if (!account) {
    throw new GatewayError(
      "Direct UPI payments are not configured yet. Please ask the administrator to add a Merchant UPI ID.",
      503,
      "UPI_NOT_CONFIGURED"
    );
  }

  const db = await getGatewayFirestore();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Reuse an active pending or review order for this user + subject so students don't flood orders
  const userOrdersSnap = await db.collection(ORDERS_COLLECTION).where("uid", "==", params.uid).get();
  let reusable: UpiPaymentOrder | null = null;

  userOrdersSnap.forEach((doc: any) => {
    const d = doc.data() as UpiPaymentOrder;
    if (!d || d.subjectId !== subject.id || !verifyOrderIntegrity(d)) return;
    if (d.status === "review") {
      reusable = d;
    } else if (
      d.status === "pending" &&
      d.amountPaise === amountPaise &&
      d.upiId === account.upiId &&
      Date.parse(d.expiresAt) > nowMs + 60 * 1000 // at least 1 minute left
    ) {
      if (!reusable || reusable.status !== "review") {
        reusable = d;
      }
    }
  });

  if (reusable) {
    return buildStudentOrderView(reusable);
  }

  const orderNo = `ORD${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(nowMs + ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const orderData: Omit<UpiPaymentOrder, "integrityHmac"> = {
    orderNo,
    uid: params.uid,
    userEmail: params.email,
    userName: params.name || params.email.split("@")[0],
    subjectId: subject.id,
    subjectTitle: subject.title,
    amountPaise,
    currency: PAYMENT_CURRENCY,
    status: "pending",
    upiAccountId: account.id,
    upiId: account.upiId,
    payeeName: account.payeeName,
    customerUtr: null,
    utr: null,
    utrAttempts: 0,
    utrSubmittedAt: null,
    reviewNote: null,
    verifiedBy: null,
    verifiedByAdminEmail: null,
    createdAt: nowIso,
    expiresAt,
    paidAt: null,
  };

  const order: UpiPaymentOrder = {
    ...orderData,
    integrityHmac: computeOrderHmac(orderData),
  };

  await db.collection(ORDERS_COLLECTION).doc(orderNo).set(order);
  await writeAuditLog(db, {
    action: "order_created",
    actorUid: params.uid,
    actorEmail: params.email,
    orderNo,
    utr: null,
    amountPaise,
    details: `Created UPI order for ${subject.title} (${account.upiId})`,
    ip: params.ip || null,
  });

  return buildStudentOrderView(order);
}

export async function getStudentOrder(orderNo: string, uid: string): Promise<StudentOrderView | null> {
  const cleanOrderNo = String(orderNo || "").trim().toUpperCase();
  if (!/^ORD[A-F0-9]{16}$/.test(cleanOrderNo)) return null;

  const db = await getGatewayFirestore();
  const ref = db.collection(ORDERS_COLLECTION).doc(cleanOrderNo);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const order = snap.data() as UpiPaymentOrder;
  // Strict ownership & HMAC tamper verification — hide non-owned orders with 404
  if (!order || order.uid !== uid || !verifyOrderIntegrity(order)) {
    return null;
  }

  // Auto-expire pending orders past their timer
  if (order.status === "pending" && Date.now() > Date.parse(order.expiresAt)) {
    await ref.update({ status: "expired" });
    order.status = "expired";
  }

  return buildStudentOrderView(order);
}

export async function listStudentOrders(uid: string): Promise<StudentOrderView[]> {
  const db = await getGatewayFirestore();
  const snap = await db.collection(ORDERS_COLLECTION).where("uid", "==", uid).get();
  const orders: UpiPaymentOrder[] = [];
  const now = Date.now();

  snap.forEach((doc: any) => {
    const d = doc.data() as UpiPaymentOrder;
    if (!d || d.uid !== uid || !verifyOrderIntegrity(d)) return;
    if (d.status === "pending" && now > Date.parse(d.expiresAt)) {
      d.status = "expired";
    }
    orders.push(d);
  });

  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return Promise.all(orders.slice(0, 20).map((o) => buildStudentOrderView(o)));
}

export async function submitCustomerUtr(params: {
  orderNo: string;
  uid: string;
  email: string;
  rawUtr: string;
  ip?: string | null;
}): Promise<StudentOrderView> {
  if (!checkRateLimit(`submit_utr:${params.uid}`, 10, 5 * 60 * 1000)) {
    throw new GatewayError("Too many UTR attempts. Please wait a few minutes.", 429, "RATE_LIMITED");
  }

  const cleanOrderNo = String(params.orderNo || "").trim().toUpperCase();
  if (!/^ORD[A-F0-9]{16}$/.test(cleanOrderNo)) {
    throw new GatewayError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

  const utr = normalizeUtr(params.rawUtr);
  if (!isValidUtr(utr)) {
    throw new GatewayError(
      "UTR must be the exact 12-digit numeric UPI reference number from your payment app.",
      400,
      "INVALID_UTR_FORMAT"
    );
  }

  const db = await getGatewayFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(cleanOrderNo);
  const utrRef = db.collection(UTR_REGISTRY_COLLECTION).doc(utr);

  let integrityViolationPayload: Omit<PaymentAuditLog, "id" | "timestamp"> | null = null;

  const result = await db.runTransaction(async (tx: any) => {
    const [orderSnap, utrSnap] = await Promise.all([tx.get(orderRef), tx.get(utrRef)]);

    if (!orderSnap.exists) {
      throw new GatewayError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    const order = orderSnap.data() as UpiPaymentOrder;
    if (!order || order.uid !== params.uid) {
      throw new GatewayError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    if (!verifyOrderIntegrity(order)) {
      integrityViolationPayload = {
        action: "security_violation",
        actorUid: params.uid,
        actorEmail: params.email,
        orderNo: cleanOrderNo,
        utr,
        amountPaise: order.amountPaise,
        details: "HMAC integrity check failed on order during UTR submission.",
        ip: params.ip || null,
      };
      return { abortedIntegrity: true as const };
    }

    if (!acceptsCustomerUtr(order)) {
      throw new GatewayError(
        "UTR can no longer be submitted for this order (maximum attempts reached or grace window closed).",
        400,
        "UTR_WINDOW_CLOSED"
      );
    }

    // Strict Global UTR Exclusivity Check — prevents UTR reuse across orders & students
    if (utrSnap.exists) {
      throw new GatewayError(
        "This 12-digit UTR has already been submitted or used on another order.",
        409,
        "UTR_ALREADY_USED"
      );
    }

    const nowIso = new Date().toISOString();
    const nextAttempts = (order.utrAttempts || 0) + 1;

    tx.set(utrRef, {
      utr,
      orderNo: cleanOrderNo,
      uid: params.uid,
      subjectId: order.subjectId,
      status: "review",
      lockedAt: nowIso,
    });

    const updates = {
      status: "review" as const,
      customerUtr: utr,
      utrSubmittedAt: nowIso,
      utrAttempts: nextAttempts,
      reviewNote: null,
    };
    tx.update(orderRef, updates);

    await writeAuditLog(
      db,
      {
        action: "utr_submitted",
        actorUid: params.uid,
        actorEmail: params.email,
        orderNo: cleanOrderNo,
        utr,
        amountPaise: order.amountPaise,
        details: `Student submitted UTR ${utr} (attempt ${nextAttempts}/${MAX_UTR_ATTEMPTS})`,
        ip: params.ip || null,
      },
      tx
    );

    return { abortedIntegrity: false as const, order: { ...order, ...updates } };
  });

  if (result.abortedIntegrity && integrityViolationPayload) {
    await writeAuditLog(db, integrityViolationPayload).catch(() => {});
    throw new GatewayError("Order security check failed. Please create a new order.", 400, "INTEGRITY_FAILED");
  }

  return buildStudentOrderView(result.order);
}

// --- Admin Order Review & Reconciliation ---

export async function approveOrderUtr(params: {
  orderNo: string;
  adminEmail: string;
  rawBankUtr: string;
  ip?: string | null;
}): Promise<UpiPaymentOrder> {
  const cleanOrderNo = String(params.orderNo || "").trim().toUpperCase();
  const bankUtr = normalizeUtr(params.rawBankUtr);

  if (!isValidUtr(bankUtr)) {
    throw new GatewayError("Enter the exact 12-digit UTR shown in your bank/UPI app.", 400, "INVALID_UTR_FORMAT");
  }

  const db = await getGatewayFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(cleanOrderNo);
  const utrRef = db.collection(UTR_REGISTRY_COLLECTION).doc(bankUtr);

  return db.runTransaction(async (tx: any) => {
    const [orderSnap, utrSnap] = await Promise.all([tx.get(orderRef), tx.get(utrRef)]);
    if (!orderSnap.exists) {
      throw new GatewayError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    const order = orderSnap.data() as UpiPaymentOrder;
    if (!verifyOrderIntegrity(order)) {
      throw new GatewayError("Order HMAC integrity seal failed! Refusing approval.", 400, "INTEGRITY_FAILED");
    }

    if (order.status !== "review") {
      throw new GatewayError("This order is not currently waiting for UTR review.", 400, "NOT_IN_REVIEW");
    }

    // Timing-safe match check: admin-typed bank UTR MUST match student-submitted UTR
    const submitted = Buffer.from(String(order.customerUtr || ""), "utf8");
    const entered = Buffer.from(bankUtr, "utf8");
    if (submitted.length !== entered.length || !crypto.timingSafeEqual(submitted, entered)) {
      throw new GatewayError(
        "Entered Bank UTR does not match what the student submitted. Check your bank/UPI app carefully or reject.",
        400,
        "UTR_MISMATCH"
      );
    }

    if (utrSnap.exists && utrSnap.data()?.orderNo !== cleanOrderNo) {
      throw new GatewayError("This UTR is already locked to another order.", 409, "UTR_ALREADY_USED");
    }

    const purchasedAt = new Date().toISOString();
    const expiresAt = new Date(Date.parse(purchasedAt) + PAYMENT_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const entId = `${order.uid}_${order.subjectId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const entRef = db.collection(ENTITLEMENTS_COLLECTION).doc(entId);

    const updates = {
      status: "paid" as const,
      utr: bankUtr,
      verifiedBy: "utr_review" as const,
      verifiedByAdminEmail: params.adminEmail,
      paidAt: purchasedAt,
      reviewNote: null,
    };

    tx.update(orderRef, updates);
    tx.set(utrRef, {
      utr: bankUtr,
      orderNo: cleanOrderNo,
      uid: order.uid,
      subjectId: order.subjectId,
      status: "paid",
      paidAt: purchasedAt,
    });

    const entitlementRecord: PaymentEntitlement = {
      id: entId,
      uid: order.uid,
      subjectId: order.subjectId,
      paymentId: bankUtr,
      orderId: cleanOrderNo,
      status: "active",
      purchasedAt,
      expiresAt,
    };
    tx.set(entRef, entitlementRecord);

    await writeAuditLog(
      db,
      {
        action: "utr_approved",
        actorUid: "admin",
        actorEmail: params.adminEmail,
        orderNo: cleanOrderNo,
        utr: bankUtr,
        amountPaise: order.amountPaise,
        details: `Admin matched & approved UTR ${bankUtr} for ${order.userEmail} (${order.subjectTitle})`,
        ip: params.ip || null,
      },
      tx
    );

    return { ...order, ...updates };
  });
}

export async function rejectOrderUtr(params: {
  orderNo: string;
  adminEmail: string;
  reason?: string;
  ip?: string | null;
}): Promise<UpiPaymentOrder> {
  const cleanOrderNo = String(params.orderNo || "").trim().toUpperCase();
  const cleanReason = String(params.reason || "").trim().slice(0, 180);

  const db = await getGatewayFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(cleanOrderNo);

  return db.runTransaction(async (tx: any) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) {
      throw new GatewayError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    const order = orderSnap.data() as UpiPaymentOrder;
    if (!verifyOrderIntegrity(order)) {
      throw new GatewayError("Order HMAC integrity check failed.", 400, "INTEGRITY_FAILED");
    }

    if (order.status !== "review") {
      throw new GatewayError("Only orders in review can be rejected.", 400, "NOT_IN_REVIEW");
    }

    const utrToRelease = order.customerUtr ? normalizeUtr(order.customerUtr) : null;
    const utrRef = utrToRelease ? db.collection(UTR_REGISTRY_COLLECTION).doc(utrToRelease) : null;
    const utrSnap = utrRef ? await tx.get(utrRef) : null;

    const canRetry = (order.utrAttempts || 0) < MAX_UTR_ATTEMPTS;
    const nextStatus: UpiOrderStatus = canRetry ? "pending" : "expired";
    const freshExpiry = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const note =
      cleanReason ||
      `UTR ${utrToRelease || ""} could not be matched in the academy bank account.`;

    // Release rejected review lock so valid payer/order isn't locked out
    if (utrSnap?.exists && utrSnap.data()?.orderNo === cleanOrderNo && utrSnap.data()?.status === "review") {
      tx.delete(utrRef);
    }

    const updates = {
      status: nextStatus,
      reviewNote: note,
      ...(canRetry ? { expiresAt: freshExpiry } : {}),
    };
    tx.update(orderRef, updates);

    await writeAuditLog(
      db,
      {
        action: "utr_rejected",
        actorUid: "admin",
        actorEmail: params.adminEmail,
        orderNo: cleanOrderNo,
        utr: utrToRelease,
        amountPaise: order.amountPaise,
        details: `Rejected UTR (${utrToRelease}). Can retry: ${canRetry}. Reason: ${note}`,
        ip: params.ip || null,
      },
      tx
    );

    return { ...order, ...updates };
  });
}

export async function markOrderPaidManually(params: {
  orderNo: string;
  adminEmail: string;
  rawUtr: string;
  ip?: string | null;
}): Promise<UpiPaymentOrder> {
  const cleanOrderNo = String(params.orderNo || "").trim().toUpperCase();
  const utr = normalizeUtr(params.rawUtr);

  if (!isValidUtr(utr)) {
    throw new GatewayError("A valid 12-digit numeric UTR is required to mark an order paid.", 400, "INVALID_UTR_FORMAT");
  }

  const db = await getGatewayFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(cleanOrderNo);
  const utrRef = db.collection(UTR_REGISTRY_COLLECTION).doc(utr);

  return db.runTransaction(async (tx: any) => {
    const [orderSnap, utrSnap] = await Promise.all([tx.get(orderRef), tx.get(utrRef)]);
    if (!orderSnap.exists) {
      throw new GatewayError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    const order = orderSnap.data() as UpiPaymentOrder;
    if (!verifyOrderIntegrity(order)) {
      throw new GatewayError("Order HMAC integrity seal failed.", 400, "INTEGRITY_FAILED");
    }

    if (order.status === "paid") {
      throw new GatewayError("Order is already marked paid.", 400, "ALREADY_PAID");
    }
    if (order.status === "review") {
      throw new GatewayError("Student submitted a UTR. Use Match & Approve or Reject instead.", 400, "IN_REVIEW");
    }

    if (utrSnap.exists) {
      throw new GatewayError("This 12-digit UTR is already locked on another order.", 409, "UTR_ALREADY_USED");
    }

    const purchasedAt = new Date().toISOString();
    const expiresAt = new Date(Date.parse(purchasedAt) + PAYMENT_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const entId = `${order.uid}_${order.subjectId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const entRef = db.collection(ENTITLEMENTS_COLLECTION).doc(entId);

    const updates = {
      status: "paid" as const,
      utr,
      verifiedBy: "manual_admin" as const,
      verifiedByAdminEmail: params.adminEmail,
      paidAt: purchasedAt,
      reviewNote: null,
    };

    tx.update(orderRef, updates);
    tx.set(utrRef, {
      utr,
      orderNo: cleanOrderNo,
      uid: order.uid,
      subjectId: order.subjectId,
      status: "paid",
      paidAt: purchasedAt,
    });
    tx.set(entRef, {
      id: entId,
      uid: order.uid,
      subjectId: order.subjectId,
      paymentId: utr,
      orderId: cleanOrderNo,
      status: "active",
      purchasedAt,
      expiresAt,
    } satisfies PaymentEntitlement);

    await writeAuditLog(
      db,
      {
        action: "manual_paid",
        actorUid: "admin",
        actorEmail: params.adminEmail,
        orderNo: cleanOrderNo,
        utr,
        amountPaise: order.amountPaise,
        details: `Admin manually confirmed order with UTR ${utr} for ${order.userEmail}`,
        ip: params.ip || null,
      },
      tx
    );

    return { ...order, ...updates };
  });
}

// --- Admin Overview & Queries ---

export async function getAdminUpiOverview() {
  const db = await getGatewayFirestore();
  const [ordersSnap, accounts, logsSnap] = await Promise.all([
    db.collection(ORDERS_COLLECTION).get(),
    listUpiAccounts(),
    db.collection(AUDIT_LOGS_COLLECTION).get(),
  ]);

  const now = Date.now();
  const orders: Array<Omit<UpiPaymentOrder, "integrityHmac"> & { integrityValid: boolean }> = [];

  ordersSnap.forEach((doc: any) => {
    const d = doc.data() as UpiPaymentOrder;
    if (!d?.orderNo) return;
    const integrityValid = verifyOrderIntegrity(d);
    let effectiveStatus = d.status;
    if (effectiveStatus === "pending" && now > Date.parse(d.expiresAt)) {
      effectiveStatus = "expired";
    }
    const { integrityHmac: _omit, ...rest } = d;
    orders.push({
      ...rest,
      status: effectiveStatus,
      integrityValid,
    });
  });

  orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const auditLogs: PaymentAuditLog[] = [];
  logsSnap.forEach((doc: any) => {
    const d = doc.data() as PaymentAuditLog;
    if (d?.id) auditLogs.push(d);
  });
  auditLogs.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  const envFallback = getEnvFallbackAccount();
  const counts = {
    total: orders.length,
    review: orders.filter((o) => o.status === "review").length,
    pending: orders.filter((o) => o.status === "pending").length,
    paid: orders.filter((o) => o.status === "paid").length,
    expired: orders.filter((o) => o.status === "expired").length,
    totalRevenuePaise: orders
      .filter((o) => o.status === "paid")
      .reduce((acc, o) => acc + Number(o.amountPaise || 0), 0),
  };

  return {
    orders: orders.slice(0, 150),
    accounts,
    envFallback,
    counts,
    auditLogs: auditLogs.slice(0, 60),
  };
}
