"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, Lock, QrCode, ShieldCheck } from "@phosphor-icons/react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { auth, getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthContext";
import UpiCheckoutView, { type UpiOrderClientData } from "@/components/UpiCheckoutView";
import type { PaidSubjectId } from "@/lib/paymentCatalog";

interface CatalogSubject {
  id: PaidSubjectId;
  title: string;
  amountPaise: number | null;
  currency: string;
  accessDays: number;
  configured: boolean;
}

export interface SubjectEntitlementInfo {
  subjectId: PaidSubjectId;
  active: boolean;
  expired: boolean;
  purchasedAt: string | null;
  expiresAt: string | null;
}

interface Props {
  subjectId: PaidSubjectId;
  entitlement?: SubjectEntitlementInfo | null;
  entitlementLoading?: boolean;
  onEntitlementUpdated?: (updated?: SubjectEntitlementInfo) => Promise<void> | void;
}

function formatAmount(amountPaise: number | null, currency: string): string {
  if (amountPaise === null) return "Price to be configured";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amountPaise / 100);
}

function formatExpiryDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const timestamp = Date.parse(isoDate);
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export default function SubjectPurchasePanel({
  subjectId,
  entitlement: externalEntitlement,
  entitlementLoading = false,
  onEntitlementUpdated,
}: Props) {
  const { user, openAuthModal } = useAuth();
  const [subject, setSubject] = useState<CatalogSubject | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localEntitlement, setLocalEntitlement] = useState<SubjectEntitlementInfo | null>(null);
  const [subjectOrder, setSubjectOrder] = useState<UpiOrderClientData | null>(null);
  const [activeOrder, setActiveOrder] = useState<UpiOrderClientData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [refreshingOrder, setRefreshingOrder] = useState(false);
  const [creatingFreshOrder, setCreatingFreshOrder] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    const firebaseAuth = auth || getFirebaseAuth();
    const currentUser = firebaseAuth?.currentUser;
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/payment-catalog", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setSubject((data.subjects || []).find((item: CatalogSubject) => item.id === subjectId) || null);
        setCheckoutReady(Boolean(data.checkoutReady));
      })
      .catch(() => {
        if (active) setMessage("Pricing is not available right now.");
      });
    return () => {
      active = false;
    };
  }, [subjectId]);

  const fetchStandaloneEntitlement = useCallback(async () => {
    const idToken = await getFreshToken();
    if (!user || !idToken) {
      setLocalEntitlement(null);
      return;
    }
    try {
      const res = await fetch("/api/payment-entitlements", {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const item = data?.entitlements?.[subjectId] as SubjectEntitlementInfo | undefined;
      if (item) {
        setLocalEntitlement(item);
      }
    } catch {
      // Ignore background entitlement fetch errors
    }
  }, [getFreshToken, subjectId, user]);

  useEffect(() => {
    if (externalEntitlement !== undefined) {
      setLocalEntitlement(externalEntitlement);
      return;
    }
    fetchStandaloneEntitlement();
  }, [externalEntitlement, fetchStandaloneEntitlement]);

  const effectiveEntitlement = localEntitlement ?? externalEntitlement ?? null;
  const expiryTimestamp = effectiveEntitlement?.expiresAt ? Date.parse(effectiveEntitlement.expiresAt) : NaN;
  const isAccessActive = Boolean(
    effectiveEntitlement?.active &&
      Number.isFinite(expiryTimestamp) &&
      expiryTimestamp > nowMs
  );
  const isAccessExpired = Boolean(
    effectiveEntitlement &&
      Number.isFinite(expiryTimestamp) &&
      expiryTimestamp <= nowMs
  );

  // Check if student already has an in-review or active pending UPI order for this subject
  const fetchExistingSubjectOrder = useCallback(async () => {
    if (!user || isAccessActive) {
      setSubjectOrder(null);
      return;
    }
    const idToken = await getFreshToken();
    if (!idToken) return;

    try {
      const res = await fetch("/api/upi/orders", {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const orders = Array.isArray(data?.orders) ? (data.orders as UpiOrderClientData[]) : [];
      const matching = orders.filter((o) => o.subjectId === subjectId);
      const inReview = matching.find((o) => o.status === "review");
      const activePending = matching.find(
        (o) => o.status === "pending" && Date.parse(o.expiresAt) > Date.now() + 10000
      );
      setSubjectOrder(inReview || activePending || null);
    } catch {
      // Ignore background order listing failure
    }
  }, [getFreshToken, isAccessActive, subjectId, user]);

  useEffect(() => {
    fetchExistingSubjectOrder();
  }, [fetchExistingSubjectOrder]);

  // Native <dialog> synchronization
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isModalOpen && activeOrder) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isModalOpen, activeOrder]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalError(null);
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, []);

  const syncOrderAndEntitlement = useCallback(
    async (orderData: UpiOrderClientData, ent?: SubjectEntitlementInfo | null) => {
      setActiveOrder(orderData);
      if (orderData.status === "review" || orderData.status === "pending") {
        setSubjectOrder(orderData);
      } else if (orderData.status === "expired") {
        setSubjectOrder(null);
      }

      if (ent?.active || orderData.status === "paid") {
        const updatedInfo: SubjectEntitlementInfo = ent?.active
          ? ent
          : {
              subjectId,
              active: true,
              expired: false,
              purchasedAt: orderData.paidAt || new Date().toISOString(),
              expiresAt: new Date(
                Date.parse(orderData.paidAt || new Date().toISOString()) +
                  (subject?.accessDays || 365) * 24 * 60 * 60 * 1000
              ).toISOString(),
            };
        setLocalEntitlement(updatedInfo);
        setSubjectOrder(null);
        await onEntitlementUpdated?.(updatedInfo);
      }
    },
    [onEntitlementUpdated, subject?.accessDays, subjectId]
  );

  const refreshOrderStatus = useCallback(
    async (orderNoToCheck?: string, quiet = false) => {
      const targetOrderNo = orderNoToCheck || activeOrder?.orderNo || subjectOrder?.orderNo;
      if (!targetOrderNo) return;
      const idToken = await getFreshToken();
      if (!idToken) return;

      if (!quiet) setRefreshingOrder(true);
      try {
        const res = await fetch(`/api/upi/orders/${encodeURIComponent(targetOrderNo)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.order) {
          await syncOrderAndEntitlement(data.order, data.entitlement);
        }
      } catch {
        // Ignore transient network poll error
      } finally {
        if (!quiet) setRefreshingOrder(false);
      }
    },
    [activeOrder?.orderNo, getFreshToken, subjectOrder?.orderNo, syncOrderAndEntitlement]
  );

  // Poll every 5s while checkout modal is open on pending/review
  useEffect(() => {
    if (!isModalOpen || !activeOrder) return;
    if (activeOrder.status !== "pending" && activeOrder.status !== "review") return;

    const id = setInterval(() => {
      refreshOrderStatus(activeOrder.orderNo, true);
    }, 5000);
    return () => clearInterval(id);
  }, [activeOrder, isModalOpen, refreshOrderStatus]);

  // Gentle 15s background check while an in-review banner is visible on card
  useEffect(() => {
    if (isModalOpen || isAccessActive || subjectOrder?.status !== "review") return;
    const id = setInterval(() => {
      refreshOrderStatus(subjectOrder.orderNo, true);
    }, 15000);
    return () => clearInterval(id);
  }, [isAccessActive, isModalOpen, refreshOrderStatus, subjectOrder]);

  const startOrResumeCheckout = async (forceCreateFresh = false) => {
    setMessage(null);
    setModalError(null);

    if (!user) {
      openAuthModal("signin");
      return;
    }
    if (isAccessActive) {
      setMessage(
        `Purchased / Access Active until ${formatExpiryDate(effectiveEntitlement?.expiresAt)}.`
      );
      return;
    }
    if (!subject?.configured || !checkoutReady) {
      setMessage("Direct UPI checkout is not configured for this subject yet.");
      return;
    }

    const idToken = await getFreshToken();
    if (!idToken) {
      setMessage("Please sign in again before starting UPI checkout.");
      openAuthModal("signin");
      return;
    }

    if (forceCreateFresh) setCreatingFreshOrder(true);
    else setBusy(true);

    try {
      const orderResponse = await fetch("/api/upi/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ subjectId }),
      });
      const data = await orderResponse.json().catch(() => ({}));

      if (orderResponse.status === 409 && data?.code === "ALREADY_ACTIVE") {
        await fetchStandaloneEntitlement();
        await onEntitlementUpdated?.();
        return;
      }

      if (!orderResponse.ok || !data?.order) {
        throw new Error(data?.error || "Unable to create UPI payment order.");
      }

      setActiveOrder(data.order);
      setSubjectOrder(data.order);
      setIsModalOpen(true);
    } catch (error: any) {
      const msg = error?.message || "Unable to open UPI checkout.";
      if (isModalOpen) setModalError(msg);
      else setMessage(msg);
    } finally {
      setBusy(false);
      setCreatingFreshOrder(false);
    }
  };

  const handleOpenExistingOrderModal = async (order: UpiOrderClientData) => {
    setActiveOrder(order);
    setModalError(null);
    setIsModalOpen(true);
    await refreshOrderStatus(order.orderNo, false);
  };

  const handleSubmitUtr = async (utr: string) => {
    if (!activeOrder) return;
    setModalError(null);

    const idToken = await getFreshToken();
    if (!idToken) {
      setModalError("Session expired. Please sign in again and retry.");
      return;
    }

    setSubmittingUtr(true);
    try {
      const res = await fetch(`/api/upi/orders/${encodeURIComponent(activeOrder.orderNo)}/submit-utr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ utr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.order) {
        throw new Error(data?.error || "Unable to submit UTR. Please verify the 12-digit number.");
      }
      await syncOrderAndEntitlement(data.order, null);
    } catch (error: any) {
      setModalError(error?.message || "Unable to submit UTR.");
    } finally {
      setSubmittingUtr(false);
    }
  };

  const isPointerOutsideDialog = (
    e: React.PointerEvent<HTMLDialogElement>,
    dialog: HTMLDialogElement
  ) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  if (!subject) return null;

  if (isAccessActive) {
    const formattedExpiry = formatExpiryDate(effectiveEntitlement?.expiresAt);
    return (
      <div className="mt-5 rounded-2xl border border-emerald-700/25 bg-emerald-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700/15 text-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle className="w-4 h-4" weight="bold" />
          </div>
          <div>
            <div className="text-xs font-label uppercase tracking-wider text-emerald-800 font-semibold">
              Purchased / Access Active
            </div>
            <div className="text-sm font-heading font-semibold text-[#0B192C]">
              {subject.title} · Valid until {formattedExpiry}
            </div>
            <div className="mt-1 text-[11px] text-slate-600 font-sans flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>All chapters in this volume open directly in full reader mode</span>
            </div>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#34483C] text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold shrink-0">
          <CheckCircle className="w-3.5 h-3.5" weight="bold" />
          <span>Access Active</span>
        </div>
      </div>
    );
  }

  const unavailableMessage = !subject.configured
    ? "Checkout is disabled until this subject price is configured."
    : !checkoutReady
    ? "Direct UPI checkout will open once the administrator activates a Merchant UPI ID."
    : null;

  const isInReview = subjectOrder?.status === "review";
  const hasPendingOrder = subjectOrder?.status === "pending";

  return (
    <>
      <div className="mt-5 rounded-2xl border border-[#34483C]/20 bg-[#F3EFE6] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#34483C]/10 text-[#34483C] flex items-center justify-center shrink-0">
              {isInReview ? <Clock className="w-4 h-4 text-[#B18A58]" weight="bold" /> : <Lock className="w-4 h-4" weight="bold" />}
            </div>
            <div>
              <div className="text-xs font-label uppercase tracking-wider text-[#34483C] font-semibold">
                {isAccessExpired ? "Access Expired · Renew Subject Access" : "Full Subject Access · Direct UPI"}
              </div>
              <div className="text-sm font-heading font-semibold text-[#252923]">
                {formatAmount(subject.amountPaise, subject.currency)} · {subject.accessDays}-day access
              </div>
              <div className="mt-1 text-[11px] text-[#252923]/65 font-sans flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34483C]" weight="bold" />
                <span>
                  {isAccessExpired
                    ? `Previous access expired on ${formatExpiryDate(effectiveEntitlement?.expiresAt)}. Scan UPI QR to renew.`
                    : "Scan UPI QR with GPay, PhonePe, Paytm, or BHIM · HMAC-verified 12-digit UTR"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {isInReview && subjectOrder ? (
              <button
                type="button"
                onClick={() => handleOpenExistingOrderModal(subjectOrder)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#B18A58] hover:bg-[#967243] text-[#252923] text-xs font-label uppercase tracking-wider font-bold transition-colors shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingOrder ? "animate-spin" : ""}`} />
                <span>Track UTR Verification</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  hasPendingOrder && subjectOrder
                    ? handleOpenExistingOrderModal(subjectOrder)
                    : startOrResumeCheckout(false)
                }
                disabled={busy || entitlementLoading || !subject.configured || !checkoutReady}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#34483C] hover:bg-[#252923] disabled:opacity-45 disabled:cursor-not-allowed text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold transition-colors shadow-sm"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Preparing QR…</span>
                  </>
                ) : subject.configured && checkoutReady ? (
                  <>
                    <QrCode className="w-4 h-4" weight="bold" />
                    <span>
                      {hasPendingOrder
                        ? "Resume UPI Payment"
                        : `Pay ${formatAmount(subject.amountPaise, subject.currency)} via UPI`}
                    </span>
                  </>
                ) : !subject.configured ? (
                  "Price Not Configured"
                ) : (
                  "UPI Not Configured"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Pending UTR Review Banner */}
        {isInReview && subjectOrder && (
          <div className="rounded-xl bg-amber-50/95 border border-amber-300 px-4 py-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>Verification In Progress · Please Wait for Admin Approval</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                UTR <strong className="font-mono font-bold text-amber-950">{subjectOrder.customerUtr}</strong> is submitted. Admin is verifying the credit in the bank. Access unlocks <b>automatically on this page</b> once confirmed (typically within 2–5 minutes).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenExistingOrderModal(subjectOrder)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-semibold transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingOrder ? "animate-spin" : ""}`} />
                Track Live Status
              </button>
              <Link
                href={`/pay/${subjectOrder.orderNo}`}
                className="text-[11px] font-semibold underline text-amber-900 hover:text-amber-950"
              >
                Order Receipt →
              </Link>
            </div>
          </div>
        )}

        {unavailableMessage && (
          <p className="text-xs text-[#34483C] font-sans" role="status">
            {unavailableMessage}
          </p>
        )}
        {message && !unavailableMessage && (
          <p className="text-xs text-rose-700 font-sans" role="status">
            {message}
          </p>
        )}
      </div>

      {/* Accessible Native Top-Layer UPI Checkout Dialog */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`upi-checkout-heading-${subjectId}`}
        onClose={() => {
          setIsModalOpen(false);
          setModalError(null);
        }}
        onPointerDown={(e) => {
          if (dialogRef.current) {
            pressedOutsideRef.current = isPointerOutsideDialog(e, dialogRef.current);
          }
        }}
        onPointerUp={(e) => {
          if (
            dialogRef.current &&
            pressedOutsideRef.current &&
            isPointerOutsideDialog(e, dialogRef.current) &&
            !submittingUtr &&
            !creatingFreshOrder
          ) {
            closeModal();
          }
          pressedOutsideRef.current = false;
        }}
        className="os-modal-dialog w-[calc(100%-1.5rem)] max-w-3xl max-h-[92svh] m-auto rounded-2xl p-0 bg-transparent shadow-2xl overflow-y-auto focus:outline-none"
      >
        {activeOrder && (
          <div className="relative">
            <h2 id={`upi-checkout-heading-${subjectId}`} className="sr-only">
              Direct UPI Checkout for {activeOrder.subjectTitle}
            </h2>

            <button
              type="button"
              onClick={closeModal}
              aria-label="Close UPI checkout"
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/95 hover:bg-[#F3EFE6] border border-[#34483C]/20 text-[#252923] flex items-center justify-center shadow-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <UpiCheckoutView
              order={activeOrder}
              onSubmitUtr={handleSubmitUtr}
              onRefreshStatus={() => refreshOrderStatus(activeOrder.orderNo, false)}
              onCreateFreshOrder={() => startOrResumeCheckout(true)}
              onClose={closeModal}
              submittingUtr={submittingUtr}
              refreshing={refreshingOrder}
              creatingOrder={creatingFreshOrder}
              errorMessage={modalError}
              standaloneLinkHref={`/pay/${activeOrder.orderNo}`}
            />
          </div>
        )}
      </dialog>
    </>
  );
}
