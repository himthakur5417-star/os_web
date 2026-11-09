"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, KeyRound, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { auth, getFirebaseAuth } from "@/lib/firebase";
import UpiCheckoutView, { type UpiOrderClientData } from "@/components/UpiCheckoutView";

export default function DedicatedUpiOrderPage() {
  const params = useParams<{ orderNo: string }>();
  const router = useRouter();
  const orderNo = String(params?.orderNo || "").trim().toUpperCase();

  const { user, loading: authLoading, openAuthModal } = useAuth();
  const [order, setOrder] = useState<UpiOrderClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingFreshOrder, setCreatingFreshOrder] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasLoadedOrderRef = useRef(false);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const firebaseAuth = auth || getFirebaseAuth();
    const currentUser = firebaseAuth?.currentUser;
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const fetchOrder = useCallback(
    async (quiet = false) => {
      if (!user || !orderNo) {
        setLoading(false);
        return;
      }
      const idToken = await getIdToken();
      if (!idToken) {
        setLoading(false);
        return;
      }

      if (!quiet) {
        setRefreshing(true);
        if (!hasLoadedOrderRef.current) setLoading(true);
      }

      try {
        const res = await fetch(`/api/upi/orders/${encodeURIComponent(orderNo)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.order) {
          throw new Error(data?.error || "UPI order could not be found or belongs to another account.");
        }
        hasLoadedOrderRef.current = true;
        setOrder(data.order);
        setLoadError(null);
      } catch (err: any) {
        if (!quiet || !hasLoadedOrderRef.current) {
          setLoadError(err?.message || "Unable to load UPI order.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getIdToken, orderNo, user]
  );

  useEffect(() => {
    if (!authLoading) {
      fetchOrder(false);
    }
  }, [authLoading, fetchOrder]);

  // Poll every 5 seconds while order is pending or awaiting UTR verification
  useEffect(() => {
    if (!order || (order.status !== "pending" && order.status !== "review")) return;
    const id = setInterval(() => {
      fetchOrder(true);
    }, 5000);
    return () => clearInterval(id);
  }, [order, fetchOrder]);

  const handleSubmitUtr = async (utr: string) => {
    if (!order) return;
    setActionError(null);
    const idToken = await getIdToken();
    if (!idToken) {
      openAuthModal("signin", `/pay/${order.orderNo}`);
      return;
    }

    setSubmittingUtr(true);
    try {
      const res = await fetch(`/api/upi/orders/${encodeURIComponent(order.orderNo)}/submit-utr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ utr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.order) {
        throw new Error(data?.error || "Unable to submit UTR.");
      }
      setOrder(data.order);
    } catch (err: any) {
      setActionError(err?.message || "Unable to submit UTR.");
    } finally {
      setSubmittingUtr(false);
    }
  };

  const handleCreateFreshOrder = async () => {
    if (!order) return;
    setActionError(null);
    const idToken = await getIdToken();
    if (!idToken) {
      openAuthModal("signin", `/pay/${order.orderNo}`);
      return;
    }

    setCreatingFreshOrder(true);
    try {
      const res = await fetch("/api/upi/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ subjectId: order.subjectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.order) {
        throw new Error(data?.error || "Unable to create a fresh UPI QR.");
      }
      if (data.order.orderNo === order.orderNo) {
        setOrder(data.order);
      } else {
        router.push(`/pay/${data.order.orderNo}`);
      }
    } catch (err: any) {
      setActionError(err?.message || "Unable to create a fresh order.");
    } finally {
      setCreatingFreshOrder(false);
    }
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen bg-[#F3EFE6] text-[#252923] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#34483C] mx-auto" />
          <p className="text-xs font-label uppercase tracking-wider text-[#252923]/70">
            Loading Secured UPI Order…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F3EFE6] text-[#252923] flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#D8D5C8] p-8 text-center shadow-xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#F3EFE6] border border-[#D8D5C8] flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-[#34483C]" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold text-[#252923]">
              Sign In to View UPI Order
            </h1>
            <p className="text-xs text-[#252923]/70 leading-relaxed">
              For your security, order <span className="font-mono font-semibold">{orderNo}</span> can only be accessed by the signed-in student who created it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal("signin", `/pay/${orderNo}`)}
            className="w-full py-3 rounded-xl bg-[#34483C] hover:bg-[#252923] text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            <span>Sign In to Continue</span>
          </button>
          <div className="text-xs">
            <Link href="/resources" className="text-[#34483C] hover:underline">
              ← Return to Study Resources
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="min-h-screen bg-[#F3EFE6] text-[#252923] flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md rounded-2xl bg-white border border-rose-200 p-8 text-center shadow-xl space-y-5">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-bold text-[#252923]">
              Order Not Available
            </h1>
            <p className="text-xs text-[#252923]/70">
              {loadError || "This UPI payment order was not found for your account."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <Link
              href="/resources"
              className="px-4 py-2.5 rounded-xl bg-[#34483C] text-[#F3EFE6] text-xs font-label uppercase tracking-wider font-bold"
            >
              Browse Study Materials
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 rounded-xl border border-[#D8D5C8] text-[#252923] text-xs font-label uppercase tracking-wider font-semibold"
            >
              Student Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3EFE6] text-[#252923] py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/resources/${order.subjectId}`}
            className="inline-flex items-center gap-1.5 text-xs font-label uppercase tracking-wider text-[#34483C] hover:text-[#252923] font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {order.subjectTitle}</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-label uppercase tracking-wider text-[#252923]/70 hover:text-[#252923] underline"
          >
            Student Dashboard
          </Link>
        </div>

        <UpiCheckoutView
          order={order}
          onSubmitUtr={handleSubmitUtr}
          onRefreshStatus={() => fetchOrder(false)}
          onCreateFreshOrder={handleCreateFreshOrder}
          onClose={() => router.push(`/resources/${order.subjectId}`)}
          submittingUtr={submittingUtr}
          refreshing={refreshing}
          creatingOrder={creatingFreshOrder}
          errorMessage={actionError}
        />
      </div>
    </div>
  );
}
