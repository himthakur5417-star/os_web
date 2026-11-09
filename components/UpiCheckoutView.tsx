"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clipboard,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";

export interface UpiOrderClientData {
  orderNo: string;
  subjectId: "nda-mathematics" | "cds-mathematics" | "nda-cds-english";
  subjectTitle: string;
  amountPaise: number;
  currency: string;
  status: "pending" | "review" | "paid" | "expired";
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

interface Props {
  order: UpiOrderClientData;
  onSubmitUtr: (utr: string) => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  onCreateFreshOrder?: () => Promise<void>;
  onClose?: () => void;
  submittingUtr?: boolean;
  refreshing?: boolean;
  creatingOrder?: boolean;
  errorMessage?: string | null;
  standaloneLinkHref?: string;
}

function formatInr(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(paise / 100);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export default function UpiCheckoutView({
  order,
  onSubmitUtr,
  onRefreshStatus,
  onCreateFreshOrder,
  onClose,
  submittingUtr = false,
  refreshing = false,
  creatingOrder = false,
  errorMessage = null,
  standaloneLinkHref,
}: Props) {
  const [utrInput, setUtrInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [returnedFromApp, setReturnedFromApp] = useState(false);
  const [activeAppGuide, setActiveAppGuide] = useState<"gpay" | "phonepe" | "paytm" | null>(null);
  const utrInputRef = useRef<HTMLInputElement | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const diff = Date.parse(order.expiresAt) - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  const totalSeconds = Math.max(
    1,
    Math.floor((Date.parse(order.expiresAt) - Date.parse(order.createdAt)) / 1000) || 900
  );

  useEffect(() => {
    const updateTick = () => {
      const diff = Date.parse(order.expiresAt) - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(diff / 1000)));
    };
    updateTick();
    if (order.status !== "pending") return;
    const id = setInterval(updateTick, 1000);
    return () => clearInterval(id);
  }, [order.expiresAt, order.status]);

  // Gentle focus prompt when student switches back from UPI app
  useEffect(() => {
    let wasHidden = false;
    const handleVisibility = () => {
      if (document.hidden) {
        wasHidden = true;
      } else if (wasHidden && order.status === "pending") {
        setReturnedFromApp(true);
        setTimeout(() => {
          utrInputRef.current?.focus();
        }, 350);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [order.status]);

  // Trigger a status refresh if timer hits 0 while pending
  useEffect(() => {
    if (order.status === "pending" && secondsLeft === 0) {
      onRefreshStatus();
    }
  }, [order.status, secondsLeft, onRefreshStatus]);

  useEffect(() => {
    if (order.status === "review" || order.status === "paid") {
      setUtrInput("");
      setLocalError(null);
      setReturnedFromApp(false);
    }
  }, [order.status, order.orderNo]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const extractUtrFromText = (raw: string): string => {
    // 1. Look for contiguous 12-digit sequence
    const exactMatch = raw.match(/\b\d{12}\b/);
    if (exactMatch) return exactMatch[0];
    // 2. Strip non-digits and take first 12 digits
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 12) return digits.slice(0, 12);
    return digits;
  };

  const handlePasteUtr = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const extracted = extractUtrFromText(text);
      if (extracted.length === 12) {
        setUtrInput(extracted);
        if (localError) setLocalError(null);
      } else if (text.trim()) {
        setUtrInput(extracted || text.trim());
        if (localError) setLocalError(null);
      }
    } catch {
      // Clipboard blocked: focus input directly
      utrInputRef.current?.focus();
    }
  };

  const handleUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleaned = utrInput.replace(/\s+/g, "").trim();
    if (!/^\d{12}$/.test(cleaned) || cleaned === "000000000000") {
      setLocalError("Please enter the exact 12-digit numeric UTR / UPI Ref. No. from your payment app.");
      return;
    }
    await onSubmitUtr(cleaned);
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const dashOffset = (100.5 * (1 - Math.min(1, secondsLeft / totalSeconds))).toFixed(2);
  const ringStroke = secondsLeft < 60 ? "#E07A5F" : "#B18A58";
  const displayedError = localError || errorMessage;
  const isValidUtr = /^\d{12}$/.test(utrInput.trim()) && utrInput.trim() !== "000000000000";

  return (
    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#34483C]/15 overflow-hidden grid md:grid-cols-5">
      {/* Left Institutional Summary Column */}
      <div className="md:col-span-2 bg-[#34483C] text-[#F3EFE6] p-4 sm:p-6 lg:p-7 flex flex-col justify-between relative overflow-hidden">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F3EFE6]/10 border border-[#F3EFE6]/20 flex items-center justify-center text-[#B18A58] font-heading font-bold text-sm">
                OS
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#D8D5C8]/75 font-label">
                  Paying To
                </div>
                <div className="font-heading font-semibold text-sm truncate text-[#F3EFE6]">
                  {order.payeeName}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-7">
            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#D8D5C8]/75 font-label">
              Amount Payable
            </div>
            <div className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-sans font-extrabold tracking-tight tabular-nums text-[#F3EFE6]">
              {formatInr(order.amountPaise, order.currency)}
            </div>
            <div className="mt-1 text-xs text-[#D8D5C8]/90 font-sans">
              {order.subjectTitle} · 365-day access
            </div>
          </div>

          <dl className="mt-5 sm:mt-7 space-y-2 sm:space-y-3 text-xs border-t border-[#F3EFE6]/10 pt-4 sm:pt-5">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#D8D5C8]/70 shrink-0">Order ID</dt>
              <dd className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-[#F3EFE6] text-xs truncate">{order.orderNo}</span>
                <button
                  type="button"
                  onClick={() => handleCopy("order", order.orderNo)}
                  className="text-[#D8D5C8]/70 hover:text-[#B18A58] transition-colors shrink-0"
                  title="Copy Order ID"
                >
                  {copiedKey === "order" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#D8D5C8]/70 shrink-0">UPI ID</dt>
              <dd className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-[#F3EFE6] text-xs truncate">{order.upiId}</span>
                <button
                  type="button"
                  onClick={() => handleCopy("upi", order.upiId)}
                  className="text-[#D8D5C8]/70 hover:text-[#B18A58] transition-colors shrink-0"
                  title="Copy UPI ID"
                >
                  {copiedKey === "upi" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 sm:mt-7 pt-4 sm:pt-5 border-t border-[#F3EFE6]/10 space-y-3 sm:space-y-4">
          {order.status === "pending" && (
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 shrink-0">
                <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="rgba(243, 239, 230, 0.14)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke={ringStroke}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="100.5"
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center font-mono text-[11px] font-semibold text-[#F3EFE6]">
                  {mins}:{secs}
                </div>
              </div>
              <div className="text-xs">
                <div className="font-semibold text-[#F3EFE6]">Complete within time</div>
                <div className="text-[#D8D5C8]/75 text-[11px]">QR expires automatically after timer ends.</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-[11px] text-[#D8D5C8]/75">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#B18A58]" />
              HMAC-Secured Gateway
            </span>
            {standaloneLinkHref && (
              <Link
                href={standaloneLinkHref}
                className="inline-flex items-center gap-1 text-[#F3EFE6] hover:text-[#B18A58] underline underline-offset-2"
              >
                Full Page <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Right Interactive Payment Column */}
      <div className="md:col-span-3 p-4 sm:p-6 lg:p-7 flex flex-col bg-[#FDFCF8]">
        {order.status === "paid" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="mt-5 text-xl font-heading font-bold text-[#252923]">
              Payment Verified &amp; Active
            </h3>
            <p className="mt-1.5 text-sm text-[#252923]/70">
              {formatInr(order.amountPaise, order.currency)} confirmed for {order.subjectTitle}
            </p>
            <dl className="mt-6 w-full max-w-xs rounded-xl bg-[#F3EFE6] border border-[#34483C]/15 divide-y divide-[#34483C]/10 text-xs text-left">
              <div className="flex justify-between px-4 py-3">
                <dt className="text-[#252923]/65">Verified UTR</dt>
                <dd className="font-mono font-semibold text-[#252923]">{order.utr}</dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-[#252923]/65">Verified At</dt>
                <dd className="font-medium text-[#252923]">{formatDateTime(order.paidAt)}</dd>
              </div>
            </dl>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-6 px-5 py-2.5 rounded-xl bg-[#34483C] hover:bg-[#252923] text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold transition-colors"
              >
                Open Study Materials
              </button>
            )}
          </div>
        ) : order.status === "review" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="relative w-16 h-16 rounded-full bg-amber-100/80 text-amber-900 flex items-center justify-center">
              <Loader2 className="w-16 h-16 animate-spin text-[#B18A58] absolute inset-0 stroke-[1.5]" />
              <ShieldCheck className="w-8 h-8 relative z-10 text-amber-900" />
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-950 text-[11px] font-bold font-label uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
              Verification In Progress
            </div>
            <h3 className="mt-3 text-xl font-heading font-bold text-[#252923]">
              UTR Submitted Successfully!
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-[#252923]/80 max-w-md leading-relaxed">
              Your 12-digit UTR has been recorded. Admin is checking the bank credit. Access will <b>automatically unlock right here</b> once confirmed — please keep this window open or check back in 2–5 minutes.
            </p>
            <div className="mt-3 text-[11px] text-[#252923]/70 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 max-w-sm">
              ✨ <b>Automated Live Checking Active:</b> No need to refresh the page. As soon as admin clicks approve, your study materials will unlock instantly.
            </div>
            <dl className="mt-4 w-full max-w-xs rounded-xl bg-[#F3EFE6] border border-[#34483C]/15 divide-y divide-[#34483C]/10 text-xs text-left">
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-[#252923]/65">Submitted UTR</dt>
                <dd className="font-mono font-semibold text-[#252923]">{order.customerUtr}</dd>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-[#252923]/65">Status</dt>
                <dd className="font-semibold text-amber-800">Waiting for Bank Match</dd>
              </div>
            </dl>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={onRefreshStatus}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#34483C] hover:bg-[#252923] disabled:opacity-50 text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold transition-colors shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Checking…" : "Check Status Now"}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-[#34483C]/20 text-[#252923] text-xs font-label uppercase tracking-wider font-semibold hover:bg-[#F3EFE6]"
                >
                  Close
                </button>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[#252923]/55">
              Do not transfer money again. Auto-polling is running every 5 seconds.
            </p>
          </div>
        ) : order.status === "expired" && !order.canSubmitUtr ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-16 h-16 rounded-full bg-[#F3EFE6] text-[#252923]/45 flex items-center justify-center border border-[#34483C]/15">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="mt-5 text-xl font-heading font-bold text-[#252923]">
              Payment Session Expired
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-[#252923]/70 max-w-sm">
              {order.utrAttempts >= order.maxUtrAttempts
                ? "Maximum UTR verification attempts were reached for this order. Start a fresh UPI checkout to continue."
                : "This UPI QR window has expired without a payment confirmation."}
            </p>
            {onCreateFreshOrder && (
              <button
                type="button"
                onClick={onCreateFreshOrder}
                disabled={creatingOrder}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#34483C] hover:bg-[#252923] disabled:opacity-50 text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold transition-colors"
              >
                {creatingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Generate Fresh UPI QR
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {order.status === "pending" && order.qrDataUrl ? (
              <>
                <div className="text-center">
                  <h3 className="text-base sm:text-lg font-heading font-bold text-[#252923]">
                    Scan &amp; Pay via Any UPI App
                  </h3>
                  <p className="text-xs text-[#252923]/65 mt-0.5">
                    Open GPay, PhonePe, Paytm, or BHIM and scan this QR code. Amount ({formatInr(order.amountPaise, order.currency)}) is locked automatically.
                  </p>
                </div>

                {/* Scannable NPCI QR Container */}
                <div className="relative mx-auto mt-4 p-3 rounded-2xl bg-white border border-[#34483C]/15 shadow-sm">
                  <span className="absolute -top-px -left-px w-5 h-5 border-t-[3px] border-l-[3px] border-[#34483C] rounded-tl-xl" />
                  <span className="absolute -top-px -right-px w-5 h-5 border-t-[3px] border-r-[3px] border-[#34483C] rounded-tr-xl" />
                  <span className="absolute -bottom-px -left-px w-5 h-5 border-b-[3px] border-l-[3px] border-[#34483C] rounded-bl-xl" />
                  <span className="absolute -bottom-px -right-px w-5 h-5 border-b-[3px] border-r-[3px] border-[#34483C] rounded-br-xl" />
                  <img
                    src={order.qrDataUrl}
                    alt={`UPI QR Code to pay ${formatInr(order.amountPaise, order.currency)}`}
                    className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                  />
                </div>

                <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[11px] font-semibold">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F3EFE6] border border-[#34483C]/15 text-[#1a73e8]">
                    GPay
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F3EFE6] border border-[#34483C]/15 text-[#5f259f]">
                    PhonePe
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F3EFE6] border border-[#34483C]/15 text-[#0099cc]">
                    Paytm
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F3EFE6] border border-[#34483C]/15 text-[#e65100]">
                    BHIM UPI
                  </span>
                </div>

                {/* Mobile Deep-Link Intent Buttons */}
                {order.appLinks && (
                  <div className="md:hidden mt-4 space-y-2">
                    <a
                      href={order.appLinks.generic}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#34483C] text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold"
                    >
                      <Smartphone className="w-4 h-4" />
                      Pay {formatInr(order.amountPaise, order.currency)} with UPI App
                    </a>
                    <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-center">
                      <a
                        href={order.appLinks.gpay}
                        className="py-1.5 rounded-lg bg-[#F3EFE6] border border-[#34483C]/15 text-[#1a73e8]"
                      >
                        GPay
                      </a>
                      <a
                        href={order.appLinks.phonepe}
                        className="py-1.5 rounded-lg bg-[#F3EFE6] border border-[#34483C]/15 text-[#5f259f]"
                      >
                        PhonePe
                      </a>
                      <a
                        href={order.appLinks.paytm}
                        className="py-1.5 rounded-lg bg-[#F3EFE6] border border-[#34483C]/15 text-[#0099cc]"
                      >
                        Paytm
                      </a>
                    </div>
                  </div>
                )}

                {/* Copyable UPI ID row */}
                <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-[#F3EFE6] border border-[#34483C]/15 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[#252923]/60 font-label">
                      Or pay manually to UPI ID
                    </div>
                    <div className="font-mono text-xs font-semibold text-[#252923] truncate">
                      {order.upiId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy("upi_box", order.upiId)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#34483C]/15 text-[11px] font-semibold text-[#34483C] hover:bg-[#34483C] hover:text-[#F3EFE6] transition-colors shrink-0"
                  >
                    {copiedKey === "upi_box" ? (
                      <>
                        <Check className="w-3 h-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">QR Timer Expired</div>
                  <p className="mt-0.5 text-amber-800">
                    If you already transferred {formatInr(order.amountPaise, order.currency)}, submit your 12-digit UTR below so we can verify it — do not pay again.
                  </p>
                </div>
                {onCreateFreshOrder && (
                  <button
                    type="button"
                    onClick={onCreateFreshOrder}
                    disabled={creatingOrder}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-900 text-white text-[11px] font-semibold hover:bg-amber-950"
                  >
                    New QR
                  </button>
                )}
              </div>
            )}

            {/* Rejection Warning Alert */}
            {order.reviewNote && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                <div>
                  <span className="font-semibold">Previous UTR Rejected: </span>
                  {order.reviewNote}
                </div>
              </div>
            )}

            {/* Banner when user returns from UPI app */}
            {returnedFromApp && order.status === "pending" && (
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950 flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
                <div className="flex items-center gap-2 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Returned from UPI app? Paste your 12-digit UTR below to verify.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReturnedFromApp(false)}
                  className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold uppercase shrink-0 px-2 py-0.5 rounded bg-emerald-100/70"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* 12-Digit UTR Submission Form */}
            <form
              onSubmit={handleUtrSubmit}
              noValidate
              className="mt-4 rounded-xl border border-[#34483C]/20 bg-white p-3.5 sm:p-4 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`utr-input-${order.orderNo}`}
                  className="block text-xs font-heading font-bold text-[#252923]"
                >
                  Already Paid? Submit 12-Digit UTR
                </label>
                <button
                  type="button"
                  onClick={handlePasteUtr}
                  className="px-2.5 py-1 rounded-md border border-[#34483C]/25 bg-[#F3EFE6]/70 hover:bg-[#F3EFE6] text-[11px] font-semibold text-[#34483C] inline-flex items-center gap-1 transition-colors"
                  title="Paste 12-digit UTR from clipboard"
                >
                  <Clipboard className="w-3 h-3 text-[#B18A58]" />
                  <span>Paste UTR</span>
                </button>
              </div>

              <p className="text-[11px] text-[#252923]/70">
                Copy the 12-digit <b>UTR / UPI Ref No.</b> from your GPay, PhonePe, or Paytm payment receipt.
              </p>

              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    ref={utrInputRef}
                    id={`utr-input-${order.orderNo}`}
                    name="utr"
                    type="text"
                    inputMode="numeric"
                    enterKeyHint="done"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    pattern="\d{12}"
                    maxLength={14}
                    required
                    aria-invalid={Boolean(displayedError)}
                    aria-describedby={displayedError ? `utr-err-${order.orderNo} utr-help-${order.orderNo}` : `utr-help-${order.orderNo}`}
                    value={utrInput}
                    onChange={(e) => {
                      const extracted = extractUtrFromText(e.target.value);
                      setUtrInput(extracted);
                      if (localError) setLocalError(null);
                    }}
                    onBlur={() => {
                      const cleaned = utrInput.replace(/\s+/g, "").trim();
                      if (cleaned.length > 0 && (!/^\d{12}$/.test(cleaned) || cleaned === "000000000000")) {
                        setLocalError("UTR must be exactly 12 digits from your UPI payment receipt.");
                      }
                    }}
                    placeholder="e.g. 412345678901"
                    className={`w-full px-3 py-2.5 rounded-lg border font-mono text-base sm:text-sm tracking-wider text-[#252923] focus:outline-none transition-all ${isValidUtr
                        ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                        : "border-[#34483C]/25 bg-[#F3EFE6]/40 focus:ring-2 focus:ring-[#34483C]"
                      }`}
                  />
                  {isValidUtr && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingUtr}
                  className={`px-4 py-2.5 rounded-lg text-xs font-label uppercase tracking-wider font-bold transition-all shrink-0 inline-flex items-center gap-1.5 ${isValidUtr
                      ? "bg-[#B18A58] hover:bg-[#967243] text-white shadow-md shadow-[#B18A58]/30 scale-[1.02]"
                      : "bg-[#252923] hover:bg-[#34483C] text-[#F3EFE6]"
                    } disabled:opacity-50`}
                >
                  {submittingUtr ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting
                    </>
                  ) : isValidUtr ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Submit UTR
                    </>
                  ) : (
                    "Submit UTR"
                  )}
                </button>
              </div>

              {/* Instant positive validation cue */}
              {isValidUtr && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold font-sans">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>12-digit UTR ready. Click &quot;Submit UTR&quot; to send for instant verification.</span>
                </div>
              )}

              {/* Interactive App Guidance Tabs */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-[#252923]/70">
                  <span className="font-semibold flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-[#B18A58]" /> Where to find UTR?
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveAppGuide((prev) => (prev === "phonepe" ? null : "phonepe"))}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition-colors ${activeAppGuide === "phonepe"
                          ? "bg-[#5f259f] text-white border-[#5f259f]"
                          : "bg-[#F3EFE6] text-[#5f259f] border-[#34483C]/15 hover:bg-[#5f259f]/10"
                        }`}
                    >
                      PhonePe
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAppGuide((prev) => (prev === "gpay" ? null : "gpay"))}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition-colors ${activeAppGuide === "gpay"
                          ? "bg-[#1a73e8] text-white border-[#1a73e8]"
                          : "bg-[#F3EFE6] text-[#1a73e8] border-[#34483C]/15 hover:bg-[#1a73e8]/10"
                        }`}
                    >
                      GPay
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAppGuide((prev) => (prev === "paytm" ? null : "paytm"))}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition-colors ${activeAppGuide === "paytm"
                          ? "bg-[#0099cc] text-white border-[#0099cc]"
                          : "bg-[#F3EFE6] text-[#0099cc] border-[#34483C]/15 hover:bg-[#0099cc]/10"
                        }`}
                    >
                      Paytm
                    </button>
                  </div>
                </div>

                {activeAppGuide === "phonepe" && (
                  <div className="rounded-lg bg-purple-50/80 border border-purple-200 p-2.5 text-[11px] text-purple-950 space-y-1">
                    <div className="font-bold text-[#5f259f]">PhonePe Step-by-Step:</div>
                    <p>1. Open PhonePe &gt; Tap <b>History</b> (bottom right).</p>
                    <p>2. Tap the <b>₹{order.amountPaise / 100}</b> transaction to <b>{order.payeeName}</b>.</p>
                    <p>3. Under <i>Transfer Details</i>, copy the 12-digit number next to <b>UTR</b>.</p>
                  </div>
                )}

                {activeAppGuide === "gpay" && (
                  <div className="rounded-lg bg-blue-50/80 border border-blue-200 p-2.5 text-[11px] text-blue-950 space-y-1">
                    <div className="font-bold text-[#1a73e8]">Google Pay (GPay) Step-by-Step:</div>
                    <p>1. Open GPay &gt; Scroll down to <b>See transaction history</b>.</p>
                    <p>2. Tap the payment to <b>{order.payeeName}</b>.</p>
                    <p>3. Scroll down to find the 12-digit <b>UPI transaction ID</b>.</p>
                  </div>
                )}

                {activeAppGuide === "paytm" && (
                  <div className="rounded-lg bg-sky-50/80 border border-sky-200 p-2.5 text-[11px] text-sky-950 space-y-1">
                    <div className="font-bold text-[#0099cc]">Paytm Step-by-Step:</div>
                    <p>1. Open Paytm &gt; Tap <b>Balance &amp; History</b>.</p>
                    <p>2. Tap the transaction to <b>{order.payeeName}</b>.</p>
                    <p>3. Tap <i>Payment Details</i> to see the 12-digit <b>UPI Ref No.</b></p>
                  </div>
                )}
              </div>

              {displayedError && (
                <p id={`utr-err-${order.orderNo}`} role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{displayedError}</span>
                </p>
              )}

              <div id={`utr-help-${order.orderNo}`} className="mt-2 flex items-center justify-between text-[11px] text-[#252923]/55">
                <span>{order.utrRemainingAttempts} attempt{order.utrRemainingAttempts === 1 ? "" : "s"} remaining</span>
                <span>Strict 1-UTR-per-order anti-fraud check</span>
              </div>
            </form>

            {/* Direct WhatsApp Support Fallback */}
            <div className="mt-3 pt-2.5 border-t border-[#34483C]/10 flex items-center justify-between gap-2 text-xs text-[#252923]/65">
              <span>Trouble finding UTR?</span>
              <a
                href={`https://wa.me/918969634656?text=${encodeURIComponent(`Hi Officium Supremum, I paid ₹${order.amountPaise / 100} for Order ${order.orderNo} (${order.subjectTitle}). Please assist with verification.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#252923] hover:text-[#34483C] underline flex items-center gap-1 text-[11px]"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                <span>Send Receipt on WhatsApp</span>
                <ExternalLink className="w-3 h-3 text-[#252923]/50" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
