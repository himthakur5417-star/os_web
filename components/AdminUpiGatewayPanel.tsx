"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  IndianRupee,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

export interface AdminUpiOrder {
  orderNo: string;
  uid: string;
  userEmail: string;
  userName: string;
  subjectId: string;
  subjectTitle: string;
  amountPaise: number;
  currency: string;
  status: "pending" | "review" | "paid" | "expired";
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
  integrityValid: boolean;
}

export interface AdminUpiAccount {
  id: string;
  label: string;
  upiId: string;
  payeeName: string;
  dailyLimitPaise: number;
  isActive: boolean;
  source: "firestore" | "env";
  createdAt: string;
  updatedAt: string;
}

export interface AdminUpiOverviewData {
  orders: AdminUpiOrder[];
  accounts: AdminUpiAccount[];
  envFallback: AdminUpiAccount | null;
  counts: {
    total: number;
    review: number;
    pending: number;
    paid: number;
    expired: number;
    totalRevenuePaise: number;
  };
  auditLogs: Array<{
    id: string;
    action: string;
    actorUid: string;
    actorEmail: string;
    orderNo: string | null;
    utr: string | null;
    amountPaise: number | null;
    details: string;
    ip: string | null;
    timestamp: string;
  }>;
}

interface Props {
  overview: AdminUpiOverviewData | null;
  loading: boolean;
  getAdminHeaders: (extra?: Record<string, string>) => Record<string, string>;
  onReload: () => Promise<void>;
}

function formatInr(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format((paise || 0) / 100);
}

function formatTs(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export default function AdminUpiGatewayPanel({
  overview,
  loading,
  getAdminHeaders,
  onReload,
}: Props) {
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Per-order Match & Approve / Reject inputs
  const [bankUtrInputs, setBankUtrInputs] = useState<Record<string, string>>({});
  const [rejectReasonInputs, setRejectReasonInputs] = useState<Record<string, string>>({});

  // Manual Mark Paid inline drawer per order
  const [manualPaidOrderNo, setManualPaidOrderNo] = useState<string | null>(null);
  const [manualPaidUtr, setManualPaidUtr] = useState("");

  // New Merchant UPI Account form
  const [accLabel, setAccLabel] = useState("Academy Primary UPI");
  const [accUpiId, setAccUpiId] = useState("");
  const [accPayeeName, setAccPayeeName] = useState("Officium Supremum");
  const [accDailyLimitRupees, setAccDailyLimitRupees] = useState("0");
  const [accIsActive, setAccIsActive] = useState(true);

  // Ledger filters
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "review" | "pending" | "paid" | "expired">("all");

  const copyValue = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusyKey("save_account");

    try {
      const res = await fetch("/api/admin/upi/accounts", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          label: accLabel.trim(),
          upiId: accUpiId.trim(),
          payeeName: accPayeeName.trim(),
          dailyLimitRupees: Number(accDailyLimitRupees || 0),
          isActive: accIsActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save merchant UPI account.");

      setFeedback({
        type: "success",
        text: `Merchant UPI "${data.account?.upiId}" saved and ready for checkout.`,
      });
      setAccUpiId("");
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Unable to save UPI account." });
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleAccount = async (acc: AdminUpiAccount) => {
    setFeedback(null);
    setBusyKey(`toggle:${acc.id}`);
    try {
      const res = await fetch("/api/admin/upi/accounts", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          id: acc.id,
          label: acc.label,
          upiId: acc.upiId,
          payeeName: acc.payeeName,
          dailyLimitRupees: Math.round((acc.dailyLimitPaise || 0) / 100),
          isActive: !acc.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update UPI account status.");

      setFeedback({
        type: "success",
        text: `${acc.upiId} is now ${!acc.isActive ? "Active" : "Paused"}.`,
      });
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to toggle UPI account." });
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteAccount = async (acc: AdminUpiAccount) => {
    if (!confirm(`Delete UPI account ${acc.label} (${acc.upiId})? Existing orders keep their receipt details.`)) {
      return;
    }
    setFeedback(null);
    setBusyKey(`delete:${acc.id}`);
    try {
      const res = await fetch(`/api/admin/upi/accounts?id=${encodeURIComponent(acc.id)}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete UPI account.");

      setFeedback({ type: "success", text: `Deleted UPI account ${acc.upiId}.` });
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to delete UPI account." });
    } finally {
      setBusyKey(null);
    }
  };

  const handleApproveOrder = async (orderNo: string, explicitUtr?: string) => {
    const bankUtr = (explicitUtr || bankUtrInputs[orderNo] || "").replace(/\s+/g, "").trim();
    if (!/^\d{12}$/.test(bankUtr) || bankUtr === "000000000000") {
      setFeedback({
        type: "error",
        text: `Enter or select a valid 12-digit Bank UTR for ${orderNo}.`,
      });
      return;
    }

    setFeedback(null);
    setBusyKey(`approve:${orderNo}`);
    try {
      const res = await fetch(`/api/admin/upi/orders/${encodeURIComponent(orderNo)}/approve`, {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ bankUtr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Approval failed.");

      setBankUtrInputs((prev) => {
        const next = { ...prev };
        delete next[orderNo];
        return next;
      });
      setFeedback({
        type: "success",
        text: data?.message || `Approved ${orderNo} and unlocked 365-day subject access.`,
      });
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to approve order." });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRejectOrder = async (orderNo: string) => {
    setFeedback(null);
    setBusyKey(`reject:${orderNo}`);
    try {
      const reason = (rejectReasonInputs[orderNo] || "").trim();
      const res = await fetch(`/api/admin/upi/orders/${encodeURIComponent(orderNo)}/reject`, {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to reject UTR.");

      setRejectReasonInputs((prev) => {
        const next = { ...prev };
        delete next[orderNo];
        return next;
      });
      setFeedback({
        type: "success",
        text: data?.message || `Rejected UTR for ${orderNo}.`,
      });
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to reject UTR." });
    } finally {
      setBusyKey(null);
    }
  };

  const handleManualMarkPaid = async (orderNo: string) => {
    const cleanUtr = manualPaidUtr.replace(/\s+/g, "").trim();
    if (!/^\d{12}$/.test(cleanUtr) || cleanUtr === "000000000000") {
      setFeedback({
        type: "error",
        text: "A valid 12-digit numeric UTR is required to manually confirm payment.",
      });
      return;
    }

    setFeedback(null);
    setBusyKey(`manual:${orderNo}`);
    try {
      const res = await fetch(`/api/admin/upi/orders/${encodeURIComponent(orderNo)}/mark-paid`, {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ utr: cleanUtr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Manual confirmation failed.");

      setManualPaidOrderNo(null);
      setManualPaidUtr("");
      setFeedback({
        type: "success",
        text: data?.message || `Confirmed ${orderNo} manually and unlocked subject access.`,
      });
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Manual confirmation failed." });
    } finally {
      setBusyKey(null);
    }
  };

  const orders = useMemo(() => overview?.orders || [], [overview?.orders]);
  const accounts = overview?.accounts || [];
  const envFallback = overview?.envFallback || null;
  const counts = overview?.counts || {
    total: 0,
    review: 0,
    pending: 0,
    paid: 0,
    expired: 0,
    totalRevenuePaise: 0,
  };
  const auditLogs = overview?.auditLogs || [];

  const hasAnyActiveAccount =
    accounts.some((a) => a.isActive) || Boolean(envFallback?.isActive);

  const reviewOrders = useMemo(
    () => orders.filter((o) => o.status === "review"),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderStatusFilter !== "all" && o.status !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        o.orderNo.toLowerCase().includes(q) ||
        o.userEmail.toLowerCase().includes(q) ||
        o.userName.toLowerCase().includes(q) ||
        o.subjectTitle.toLowerCase().includes(q) ||
        (o.customerUtr || "").toLowerCase().includes(q) ||
        (o.utr || "").toLowerCase().includes(q)
      );
    });
  }, [orderSearch, orderStatusFilter, orders]);

  if (loading && !overview) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
        <RefreshCw className="w-8 h-8 text-[#C8A84E] animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-label uppercase tracking-wider font-semibold">
          Loading Direct UPI Gateway Ledger…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Unconfigured UPI Alert */}
      {!hasAnyActiveAccount && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <div className="font-heading font-bold text-amber-950">
              Merchant UPI ID Not Configured Yet
            </div>
            <p className="text-amber-900">
              Students will not be able to generate payment QRs until you add and activate at least one Merchant UPI ID below (or set <code className="font-mono bg-amber-100 px-1 rounded">UPI_MERCHANT_VPA</code> in environment variables).
            </p>
          </div>
        </div>
      )}

      {/* Action Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-60 hover:opacity-100 text-xs font-bold px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* UPI Gateway Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-soft-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-label uppercase tracking-wider text-amber-800 font-bold">
              Awaiting UTR Review
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-[#0B192C]">
            {counts.review}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Match against bank credit to unlock</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-soft-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-label uppercase tracking-wider text-emerald-800 font-bold">
              Verified UPI Revenue
            </span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-[#0B192C] tabular-nums">
            {formatInr(counts.totalRevenuePaise)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{counts.paid} confirmed order(s)</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-sky-200/80 shadow-soft-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-label uppercase tracking-wider text-sky-800 font-bold">
              Active QRs (Pending)
            </span>
            <QrCode className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-[#0B192C]">
            {counts.pending}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Awaiting student scan &amp; UTR</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-label uppercase tracking-wider text-slate-600 font-bold">
              Total / Expired
            </span>
            <ShieldCheck className="w-4 h-4 text-[#C8A84E]" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-[#0B192C]">
            {counts.total}{" "}
            <span className="text-xs font-sans font-normal text-slate-500">
              ({counts.expired} expired)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">HMAC-SHA256 protected orders</div>
        </div>
      </div>

      {/* SECTION A: Pending UTR Verification Queue */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-amber-50/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-heading font-bold text-base text-[#0B192C] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C8A84E]" />
              Two-Step UTR Verification Queue ({reviewOrders.length})
            </h3>
            <p className="text-xs text-slate-600">
              Verify credit in your bank/UPI business app first, then re-enter the exact 12-digit UTR to approve &amp; unlock access.
            </p>
          </div>
        </div>

        {reviewOrders.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No student UTR submissions are waiting for verification right now.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviewOrders.map((order) => {
              const approveBusy = busyKey === `approve:${order.orderNo}`;
              const rejectBusy = busyKey === `reject:${order.orderNo}`;

              return (
                <div key={order.orderNo} className="p-5 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-900">
                          {order.orderNo}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-label text-[10px] font-bold uppercase tracking-wider">
                          Review Required · Attempt {order.utrAttempts}/3
                        </span>
                        {order.integrityValid ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                            HMAC Valid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-bold">
                            HMAC Integrity Failed
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-heading font-semibold text-[#0B192C]">
                        {order.userName} ({order.userEmail}) — {order.subjectTitle}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          Amount: <strong className="text-slate-900">{formatInr(order.amountPaise, order.currency)}</strong>
                        </span>
                        <span>
                          Merchant VPA: <code className="font-mono text-slate-700">{order.upiId}</code>
                        </span>
                        <span>Submitted: {formatTs(order.utrSubmittedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 shrink-0">
                      <div>
                        <div className="text-[10px] font-label uppercase tracking-wider text-slate-500">
                          Student-Submitted UTR
                        </div>
                        <div className="font-mono text-base font-bold text-[#0B192C] tracking-wider">
                          {order.customerUtr || "—"}
                        </div>
                      </div>
                      {order.customerUtr && (
                        <button
                          type="button"
                          onClick={() => copyValue(`utr:${order.orderNo}`, order.customerUtr!)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                          title="Copy Student UTR"
                        >
                          {copiedKey === `utr:${order.orderNo}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Approve + Reject Forms Side-by-Side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                    {/* Match & Approve */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`bank-utr-${order.orderNo}`}
                          className="block text-[11px] font-label uppercase tracking-wider font-bold text-emerald-950"
                        >
                          1. Confirm Bank Credit &amp; Approve
                        </label>
                        {order.customerUtr && (
                          <span className="text-[10px] text-emerald-800 font-medium">
                            Submitted: <strong className="font-mono">{order.customerUtr}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={approveBusy || rejectBusy || !order.integrityValid || !order.customerUtr}
                          onClick={() => handleApproveOrder(order.orderNo, order.customerUtr!)}
                          className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-label uppercase tracking-wider font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                          title="Instant 1-click approval using student's submitted UTR"
                        >
                          {approveBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          1-Click Quick Approve
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setBankUtrInputs((prev) => ({
                              ...prev,
                              [order.orderNo]: order.customerUtr || "",
                            }))
                          }
                          className="px-2.5 py-2 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-semibold transition-colors"
                          title="Auto-fill the manual verification box"
                        >
                          Auto-fill Box
                        </button>
                      </div>

                      <div className="flex gap-2 pt-1 border-t border-emerald-200/60">
                        <input
                          id={`bank-utr-${order.orderNo}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={14}
                          value={bankUtrInputs[order.orderNo] || ""}
                          onChange={(e) =>
                            setBankUtrInputs((prev) => ({
                              ...prev,
                              [order.orderNo]: e.target.value.replace(/[^\d\s]/g, ""),
                            }))
                          }
                          placeholder="Or type manual UTR if different"
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <button
                          type="button"
                          disabled={approveBusy || rejectBusy || !order.integrityValid}
                          onClick={() => handleApproveOrder(order.orderNo)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-label uppercase tracking-wider font-bold shrink-0 inline-flex items-center gap-1 transition-colors"
                        >
                          Verify Match
                        </button>
                      </div>
                    </div>

                    {/* Reject UTR */}
                    <div className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200/70 space-y-2">
                      <label
                        htmlFor={`reject-reason-${order.orderNo}`}
                        className="block text-[11px] font-label uppercase tracking-wider font-bold text-rose-950"
                      >
                        2. Or Reject If Payment Not Received ({order.utrAttempts < 3 ? "Allows Retry" : "Final Attempt · Expires Order"})
                      </label>
                      <div className="flex gap-2">
                        <input
                          id={`reject-reason-${order.orderNo}`}
                          type="text"
                          maxLength={160}
                          value={rejectReasonInputs[order.orderNo] || ""}
                          onChange={(e) =>
                            setRejectReasonInputs((prev) => ({
                              ...prev,
                              [order.orderNo]: e.target.value,
                            }))
                          }
                          placeholder="Reason (e.g. No credit received in bank)"
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white border border-rose-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <button
                          type="button"
                          disabled={approveBusy || rejectBusy}
                          onClick={() => handleRejectOrder(order.orderNo)}
                          className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-label uppercase tracking-wider font-bold shrink-0 inline-flex items-center gap-1.5"
                        >
                          {rejectBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION B: Merchant UPI Accounts & Rotation */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs p-5 space-y-4">
          <div>
            <h3 className="font-heading font-bold text-base text-[#0B192C] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#C8A84E]" />
              Add Merchant UPI ID
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Multiple active accounts automatically load-balance by lowest daily collection.
            </p>
          </div>

          <form onSubmit={handleSaveAccount} className="space-y-3">
            <div>
              <label htmlFor="upi-acc-label" className="block text-[11px] font-label uppercase tracking-wider font-semibold text-slate-700 mb-1">
                Account Label
              </label>
              <input
                id="upi-acc-label"
                name="label"
                type="text"
                required
                value={accLabel}
                onChange={(e) => setAccLabel(e.target.value)}
                placeholder="e.g. Academy SBI Current"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="upi-acc-vpa" className="block text-[11px] font-label uppercase tracking-wider font-semibold text-slate-700 mb-1">
                UPI ID (VPA) *
              </label>
              <input
                id="upi-acc-vpa"
                name="upiId"
                type="text"
                required
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={accUpiId}
                onChange={(e) => setAccUpiId(e.target.value)}
                placeholder="e.g. merchant@okaxis or 9876543210@ybl"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="upi-acc-payee" className="block text-[11px] font-label uppercase tracking-wider font-semibold text-slate-700 mb-1">
                  Payee Display Name *
                </label>
                <input
                  id="upi-acc-payee"
                  name="payeeName"
                  type="text"
                  required
                  value={accPayeeName}
                  onChange={(e) => setAccPayeeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white"
                />
              </div>
              <div>
                <label htmlFor="upi-acc-limit" className="block text-[11px] font-label uppercase tracking-wider font-semibold text-slate-700 mb-1">
                  Daily Cap (₹, 0 = Unlimited)
                </label>
                <input
                  id="upi-acc-limit"
                  name="dailyLimitRupees"
                  type="text"
                  inputMode="numeric"
                  value={accDailyLimitRupees}
                  onChange={(e) => setAccDailyLimitRupees(e.target.value.replace(/[^\d]/g, ""))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={accIsActive}
                onChange={(e) => setAccIsActive(e.target.checked)}
                className="rounded border-slate-300 text-[#0B192C] focus:ring-[#C8A84E]"
              />
              <span>Active immediately for student checkouts</span>
            </label>

            <button
              type="submit"
              disabled={busyKey === "save_account"}
              className="w-full py-2.5 rounded-xl bg-[#0B192C] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-label uppercase tracking-wider font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              {busyKey === "save_account" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Merchant UPI Account
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-heading font-bold text-base text-[#0B192C]">
                Configured UPI Receiving Accounts ({accounts.length + (envFallback ? 1 : 0)})
              </h3>
              <p className="text-xs text-slate-500">
                Students scan these VPAs cleanly inside GPay, PhonePe, Paytm, and BHIM.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-semibold text-sm text-[#0B192C] truncate">
                      {acc.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        acc.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {acc.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-slate-700 truncate">
                    {acc.upiId} · Payee: {acc.payeeName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Daily limit: {acc.dailyLimitPaise > 0 ? formatInr(acc.dailyLimitPaise) : "Unlimited"}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyKey === `toggle:${acc.id}`}
                    onClick={() => handleToggleAccount(acc)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    {acc.isActive ? "Pause" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === `delete:${acc.id}`}
                    onClick={() => handleDeleteAccount(acc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Delete UPI Account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {envFallback && (
              <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/60 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-semibold text-sm text-[#0B192C]">
                      {envFallback.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold uppercase">
                      ENV Fallback
                    </span>
                  </div>
                  <div className="font-mono text-xs text-slate-700">
                    {envFallback.upiId} · Payee: {envFallback.payeeName}
                  </div>
                </div>
                <span className="text-[11px] text-sky-800 font-medium">
                  Active when no DB account selected
                </span>
              </div>
            )}

            {accounts.length === 0 && !envFallback && (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                No UPI receiving accounts configured yet. Add one using the form on the left.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION C: All UPI Orders Ledger */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-base text-[#0B192C]">
              Direct UPI Orders Ledger ({filteredOrders.length})
            </h3>
            <p className="text-xs text-slate-500">
              Complete audit-protected history of student orders, HMAC seals, and entitlement activations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search Order, email, UTR…"
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E]"
              />
            </div>

            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-label uppercase tracking-wider focus:outline-none focus:border-[#C8A84E]"
            >
              <option value="all">All Statuses</option>
              <option value="review">In Review</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No UPI orders match your current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/70 text-slate-500 font-label uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Order</th>
                  <th className="py-3 px-4 font-semibold">Student / Subject</th>
                  <th className="py-3 px-4 font-semibold">Amount / VPA</th>
                  <th className="py-3 px-4 font-semibold">Status &amp; Seal</th>
                  <th className="py-3 px-4 font-semibold">UTR Ref</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => {
                  const showManualBox = manualPaidOrderNo === o.orderNo;
                  return (
                    <React.Fragment key={o.orderNo}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">{o.orderNo}</div>
                          <div className="text-[11px] text-slate-400">{formatTs(o.createdAt)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{o.userName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{o.userEmail}</div>
                          <div className="text-[11px] text-slate-600">{o.subjectTitle}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {formatInr(o.amountPaise, o.currency)}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">{o.upiId}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap space-y-1">
                          <div>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                o.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : o.status === "review"
                                  ? "bg-amber-100 text-amber-900"
                                  : o.status === "pending"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {o.status}
                            </span>
                          </div>
                          <div className="text-[10px]">
                            {o.integrityValid ? (
                              <span className="text-emerald-700 font-medium">✓ HMAC Sealed</span>
                            ) : (
                              <span className="text-rose-700 font-bold">⚠ Integrity Fail</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          <div>{o.utr || o.customerUtr || "—"}</div>
                          {o.paidAt && (
                            <div className="text-[10px] font-sans text-emerald-700">
                              Paid {formatTs(o.paidAt)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {(o.status === "pending" || o.status === "expired") && o.integrityValid ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (showManualBox) {
                                  setManualPaidOrderNo(null);
                                  setManualPaidUtr("");
                                } else {
                                  setManualPaidOrderNo(o.orderNo);
                                  setManualPaidUtr("");
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold"
                            >
                              {showManualBox ? "Cancel" : "Manual Confirm"}
                            </button>
                          ) : o.status === "paid" ? (
                            <span className="text-[11px] text-slate-400">
                              {o.verifiedBy === "manual_admin" ? "Manual" : "Matched"}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-700 font-medium">In Queue Above</span>
                          )}
                        </td>
                      </tr>
                      {showManualBox && (
                        <tr className="bg-amber-50/40">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold text-slate-800">
                                Enter verified 12-digit UTR to unlock {o.orderNo}:
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={14}
                                value={manualPaidUtr}
                                onChange={(e) => setManualPaidUtr(e.target.value.replace(/[^\d\s]/g, ""))}
                                placeholder="e.g. 412345678901"
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900"
                              />
                              <button
                                type="button"
                                disabled={busyKey === `manual:${o.orderNo}`}
                                onClick={() => handleManualMarkPaid(o.orderNo)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1"
                              >
                                {busyKey === `manual:${o.orderNo}` && (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                )}
                                Confirm &amp; Unlock
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION D: Immutable Payment Security Audit Log */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-base text-[#0B192C] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#C8A84E]" />
              Payment Security Audit Trail ({auditLogs.length})
            </h3>
            <p className="text-xs text-slate-500">
              Append-only server event log of order creations, UTR checks, approvals, and tamper detections.
            </p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No payment audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/70">
                <tr className="text-slate-500 font-label uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Event</th>
                  <th className="py-2.5 px-4 font-semibold">Actor</th>
                  <th className="py-2.5 px-4 font-semibold">Order / UTR</th>
                  <th className="py-2.5 px-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatTs(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          log.action === "security_violation"
                            ? "bg-rose-100 text-rose-900"
                            : log.action === "utr_approved" || log.action === "manual_paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.action === "utr_rejected"
                            ? "bg-rose-50 text-rose-700"
                            : log.action === "utr_submitted"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700">
                      {log.actorEmail}
                      {log.ip ? <span className="text-slate-400 block">{log.ip}</span> : null}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {log.orderNo || "—"}
                      {log.utr ? <div className="text-slate-500">UTR: {log.utr}</div> : null}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-md">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
