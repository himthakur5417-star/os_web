"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Shield,
  User,
  BookOpen,
  Clock,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Phone,
  Mail,
  Calendar,
  Compass,
  Edit3,
  Save,
  X,
  LogOut,
  ChevronRight,
  Sparkles,
  Loader2,
  RefreshCw,
  FileText,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { auth, getFirebaseAuth } from "@/lib/firebase";

interface StudentProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  rollNumber: string | null;
  authProvider: string | null;
  phone: string | null;
  targetExam: string | null;
  createdAt: string | null;
  lastLogin: string | null;
}

interface EntitlementSummary {
  subjectId: "nda-mathematics" | "cds-mathematics" | "nda-cds-english";
  active: boolean;
  expired: boolean;
  purchasedAt: string | null;
  expiresAt: string | null;
}

interface StudentUpiOrderSummary {
  orderNo: string;
  subjectId: "nda-mathematics" | "cds-mathematics" | "nda-cds-english";
  subjectTitle: string;
  amountPaise: number;
  currency: string;
  status: "pending" | "review" | "paid" | "expired";
  customerUtr: string | null;
  utr: string | null;
  createdAt: string;
}

type EntitlementsMap = Record<string, EntitlementSummary>;

const TRACK_LABELS: Record<string, { title: string; subtitle: string }> = {
  nda: {
    title: "NDA / NA Leadership Track",
    subtitle: "National Defence Academy & Naval Academy Examination",
  },
  cds: {
    title: "CDS Combined Defence Track",
    subtitle: "Combined Defence Services Examination",
  },
  afcat: {
    title: "AFCAT Air Force Track",
    subtitle: "Air Force Common Admission Test",
  },
  scholars: {
    title: "Scholars Program (Class 11–12)",
    subtitle: "Senior Secondary Board & Academic Foundation",
  },
  juniors: {
    title: "Juniors Program (Class 7–10)",
    subtitle: "Early Academic Habits & Cognitive Discipline",
  },
  general: {
    title: "General Academic Mentorship",
    subtitle: "Discipline-First Academic Strategy",
  },
};

const SUBJECTS_INFO = [
  {
    id: "nda-mathematics",
    title: "NDA Mathematics",
    chaptersCount: "30 Chapters",
    description: "Complete chapter drills and 14 years of officer-level solved questions.",
    href: "/resources/nda-mathematics",
  },
  {
    id: "cds-mathematics",
    title: "CDS Mathematics",
    chaptersCount: "22 Chapters",
    description: "Comprehensive arithmetic, algebra, trigonometry and geometry dossiers.",
    href: "/resources/cds-mathematics",
  },
  {
    id: "nda-cds-english",
    title: "NDA & CDS English",
    chaptersCount: "34 Chapters",
    description: "Officer vocabulary, syntax, reading comprehension and error spotting.",
    href: "/resources/nda-cds-english",
  },
];

function calculateDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return null;
  const diff = expiryMs - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return "Not recorded";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Not recorded";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Not recorded";
  }
}

export default function StudentDashboardPage() {
  const { user, loading: authLoading, openAuthModal, logout } = useAuth();

  const [isDevPreview, setIsDevPreview] = useState(false);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsMap | null>(null);
  const [upiOrders, setUpiOrders] = useState<StudentUpiOrderSummary[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("preview") === "student") {
        setIsDevPreview(true);
      }
    }
  }, []);

  const effectiveUser = useMemo(
    () =>
      user ||
      (isDevPreview
        ? {
            uid: "test_cadet_uid_8412",
            email: "cadet.vikram@officiumsupremum.in",
            displayName: "Cadet Vikram Sharma",
            role: "user" as const,
            rollNumber: "OS-USR-8412",
          }
        : null),
    [isDevPreview, user]
  );

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTargetExam, setEditTargetExam] = useState("nda");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const fetchFreshIdToken = async (): Promise<string | null> => {
    try {
      const firebaseAuth = auth || getFirebaseAuth();
      if (firebaseAuth?.currentUser) {
        return await firebaseAuth.currentUser.getIdToken(true);
      }
    } catch (err) {
      console.warn("Could not retrieve fresh Firebase token:", err);
    }
    return null;
  };

  const loadDashboard = useCallback(
    async (isManualRefresh = false) => {
      if (!effectiveUser) {
        setDataLoading(false);
        return;
      }

      if (isManualRefresh) setRefreshing(true);
      else setDataLoading(true);
      setFetchError(null);

      // Dev preview mode fallback when no live Firebase user is authenticated
      if (isDevPreview && !user) {
        setStudent({
          uid: "test_cadet_uid_8412",
          email: "cadet.vikram@officiumsupremum.in",
          displayName: "Cadet Vikram Sharma",
          role: "user",
          rollNumber: "OS-USR-8412",
          authProvider: "google.com",
          phone: "+91 98765 43210",
          targetExam: "nda",
          createdAt: "2026-10-15T10:00:00.000Z",
          lastLogin: "2026-11-05T02:00:00.000Z",
        });
        setEditName("Cadet Vikram Sharma");
        setEditPhone("+91 98765 43210");
        setEditTargetExam("nda");
        setEntitlements({
          "nda-mathematics": {
            subjectId: "nda-mathematics",
            active: true,
            expired: false,
            purchasedAt: "2026-10-15T10:30:00.000Z",
            expiresAt: "2027-10-15T10:30:00.000Z",
          },
          "cds-mathematics": {
            subjectId: "cds-mathematics",
            active: false,
            expired: false,
            purchasedAt: null,
            expiresAt: null,
          },
          "nda-cds-english": {
            subjectId: "nda-cds-english",
            active: false,
            expired: false,
            purchasedAt: null,
            expiresAt: null,
          },
        });
        setDataLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const token = await fetchFreshIdToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const [res, ordersRes] = await Promise.all([
          fetch("/api/student/dashboard", {
            method: "GET",
            headers,
            cache: "no-store",
          }),
          fetch("/api/upi/orders", {
            method: "GET",
            headers,
            cache: "no-store",
          }).catch(() => null),
        ]);

        if (res.status === 401) {
          setFetchError("Your session has expired. Please sign in again.");
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }

        const data = await res.json();
        if (data.student) {
          setStudent(data.student);
          setEditName(data.student.displayName || "");
          setEditPhone(data.student.phone || "");
          setEditTargetExam(data.student.targetExam || "nda");
        }
        if (data.entitlements) {
          setEntitlements(data.entitlements);
        }
        if (ordersRes && ordersRes.ok) {
          const ordersData = await ordersRes.json().catch(() => ({}));
          setUpiOrders(Array.isArray(ordersData?.orders) ? ordersData.orders : []);
        }
      } catch (err: any) {
        console.error("Dashboard data load error:", err);
        setFetchError(err.message || "Unable to load dashboard data. Please try again.");
      } finally {
        setDataLoading(false);
        setRefreshing(false);
      }
    },
    [effectiveUser, isDevPreview, user]
  );

  useEffect(() => {
    if (!authLoading && effectiveUser) {
      loadDashboard();
    } else if (!authLoading && !effectiveUser) {
      setDataLoading(false);
    }
  }, [authLoading, effectiveUser, loadDashboard]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    // Dev preview mode save
    if (isDevPreview && !user) {
      setStudent((prev) =>
        prev
          ? {
              ...prev,
              displayName: editName.trim(),
              phone: editPhone.trim() || null,
              targetExam: editTargetExam,
            }
          : null
      );
      setSaveSuccessMsg("Your preferences were updated successfully (Preview Mode).");
      setIsEditing(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      setSavingProfile(false);
      return;
    }

    try {
      const token = await fetchFreshIdToken();
      if (!token) {
        throw new Error("Authentication token is missing. Please sign in again.");
      }

      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: editName.trim(),
          phone: editPhone.trim() ? editPhone.trim() : null,
          targetExam: editTargetExam,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }

      if (data.profile) {
        setStudent((prev) => (prev ? { ...prev, ...data.profile } : data.profile));
      }
      setSaveSuccessMsg("Your preferences were updated successfully.");
      setIsEditing(false);

      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      setSaveErrorMsg(err.message || "Failed to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  // 1. Initial Authentication Loading State
  if (authLoading || (effectiveUser && dataLoading)) {
    return (
      <div className="bg-[#F3EFE6] text-[#252923] min-h-screen py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-[#D8D5C8] text-center space-y-4 shadow-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-[#252923] mx-auto" />
          <h2 className="font-heading font-medium text-xl font-light text-[#252923]">
            Accessing Student Command Desk...
          </h2>
          <p className="text-xs text-[#252923]/65 font-sans font-light">
            Synchronizing profile and study materials credentials.
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Visitor Barrier
  if (!effectiveUser) {
    return (
      <div className="bg-[#F3EFE6] text-[#252923] min-h-screen py-24 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Tactile Parchment Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(#E8DCC6 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />

        <div className="max-w-lg mx-auto relative z-10">
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#D8D5C8] shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F3EFE6] border border-[#D8D5C8] flex items-center justify-center text-[#252923] mx-auto shadow-md">
              <Shield className="w-8 h-8 text-[#252923]/65" />
            </div>

            <div className="space-y-2">
              <span className="font-sans uppercase tracking-wider text-xs uppercase tracking-[0.2em] text-[#252923]/65">
                Officium Supremum Academy
              </span>
              <h1 className="font-heading font-medium text-3xl font-light text-[#252923]">
                Student Dashboard Access
              </h1>
              <p className="text-xs sm:text-sm text-[#252923]/65 font-sans font-light leading-relaxed">
                Sign in to view your student profile, academic study vault, examination preferences, and unlocked subject dossiers.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={() => openAuthModal("signin", "/dashboard")}
                className="w-full py-4 rounded-xl bg-[#34483C] hover:bg-[#252923] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors shadow-md flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34483C]"
              >
                <KeyRound className="w-4 h-4" />
                <span>Sign In to Student Dashboard</span>
              </button>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-sans text-[#252923]/65">
                <Link
                  href="/book-orientation"
                  className="hover:text-[#252923] underline transition-colors"
                >
                  Book a Free Guidance Call
                </Link>
                <span className="hidden sm:inline opacity-30">·</span>
                <Link href="/contact" className="hover:text-[#252923] underline transition-colors">
                  Contact Admissions Desk
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Error Loading State
  if (fetchError) {
    return (
      <div className="bg-[#F3EFE6] text-[#252923] min-h-screen py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-rose-500/30 text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="font-heading font-medium text-2xl font-light text-[#252923]">
            Unable to Load Dashboard
          </h2>
          <p className="text-xs text-[#252923]/65 font-sans font-light">{fetchError}</p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => loadDashboard()}
              className="px-5 py-2.5 rounded-xl bg-[#34483C] hover:bg-[#252923] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => logout()}
              className="px-5 py-2.5 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentTrack = student?.targetExam ? TRACK_LABELS[student.targetExam] : TRACK_LABELS.nda;

  return (
    <div className="bg-[#F3EFE6] text-[#252923] min-h-screen relative overflow-x-hidden selection:bg-[#34483C] selection:text-[#F3EFE6] pb-24">
      {/* Tactile Parchment Grain Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(#E8DCC6 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      {/* Subtle Ambient Burgundy Glow */}
      <div
        className="absolute top-0 left-0 right-0 h-[360px] overflow-hidden pointer-events-none -z-0"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[680px] h-[340px] bg-[#34483C]/5 blur-[130px] rounded-full" />
      </div>

      {/* Top Banner for Admin Users */}
      {effectiveUser.role === "admin" && (
        <div className="bg-[#34483C]/10 border-b border-[#34483C]/20 px-4 py-2.5 text-center text-xs text-[#252923] relative z-20">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#252923]" />
            <span className="font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]">
              Administrator View:
            </span>
            <span className="font-sans">
              You are signed in as an Academy Administrator.
            </span>
            <Link
              href="/admin"
              className="font-sans uppercase tracking-wider uppercase tracking-wider underline hover:text-[#252923] ml-2"
            >
              Open Admin Control Center →
            </Link>
          </div>
        </div>
      )}

      {/* Main Header / Welcome Section */}
      <section className="relative pt-16 pb-8 sm:pt-20 sm:pb-10 border-b border-[#D8D5C8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#D8D5C8] text-[11px] font-sans uppercase tracking-wider uppercase tracking-[0.2em] text-[#252923]">
                <Shield className="w-3.5 h-3.5 text-[#252923]/65" />
                <span>Officium Supremum · Academic Command Desk</span>
              </div>

              <h1 className="font-heading font-medium text-3xl sm:text-4xl lg:text-5xl font-light text-[#252923] tracking-tight">
                Student Dashboard
              </h1>

              <p className="text-xs sm:text-sm text-[#252923]/65 font-sans font-light max-w-xl">
                Welcome back,{" "}
                <span className="text-[#252923] font-normal">
                  {student?.displayName || effectiveUser.displayName || "Student"}
                </span>
                . Your study vault, active modules, and examination targets are synchronized below.
              </p>
            </div>

            {/* Quick Actions & Roll Number ID Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-white border border-[#D8D5C8] flex items-center gap-2.5">
                <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65">
                  Roll No:
                </span>
                <span className="font-mono text-xs font-semibold text-[#252923]">
                  {student?.rollNumber || effectiveUser.rollNumber || "OS-USR-PENDING"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
                title="Refresh dashboard state"
                className="p-2.5 rounded-xl bg-white border border-[#D8D5C8] hover:border-[#34483C] text-[#252923]/65 hover:text-[#252923] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34483C]"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => logout("/")}
                className="px-4 py-2 rounded-xl bg-[#F3EFE6] hover:bg-white border border-rose-500/30 text-rose-300 font-sans uppercase tracking-wider uppercase text-xs tracking-wider transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34483C]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Success Notification */}
          {saveSuccessMsg && (
            <div className="mt-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs font-sans flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10 relative z-10">

        {/* ========================================================================= */}
        {/* ROW 1: Student Profile & Examination Target Preference                    */}
        {/* ========================================================================= */}
        <section aria-labelledby="profile-heading">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Student Profile Card (7 Columns) */}
            <div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-white border border-[#D8D5C8] shadow-xl relative overflow-hidden">
              <div
                className="h-1 w-full bg-[#34483C] absolute top-0 left-0"
                aria-hidden="true"
              />

              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="space-y-1">
                  <h2
                    id="profile-heading"
                    className="font-heading font-medium text-xl sm:text-2xl font-light text-[#252923]"
                  >
                    Student Credentials &amp; Profile
                  </h2>
                  <p className="text-xs text-[#252923]/65 font-sans font-light">
                    Official enrolment details registered with the academy.
                  </p>
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#F3EFE6] border border-[#D8D5C8] hover:border-[#34483C] text-xs font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923] transition-colors flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                /* Inline Profile Edit Form */
                <form onSubmit={handleProfileSave} className="space-y-4 pt-2">
                  {saveErrorMsg && (
                    <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
                      {saveErrorMsg}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]">
                      Full Name <span className="text-[#C18388]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full bg-[#F3EFE6] border border-[#D8D5C8] rounded-xl px-4 py-2.5 text-sm text-[#252923] outline-none focus:border-[#34483C] focus:ring-2 focus:ring-[#34483C]/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full bg-[#F3EFE6] border border-[#D8D5C8] rounded-xl px-4 py-2.5 text-sm text-[#252923] outline-none focus:border-[#34483C] focus:ring-2 focus:ring-[#34483C]/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]">
                        Target Examination
                      </label>
                      <select
                        value={editTargetExam}
                        onChange={(e) => setEditTargetExam(e.target.value)}
                        className="w-full bg-[#F3EFE6] border border-[#D8D5C8] rounded-xl px-4 py-2.5 text-sm text-[#252923] outline-none focus:border-[#34483C] focus:ring-2 focus:ring-[#34483C]/50 cursor-pointer"
                      >
                        <option value="nda">NDA / NA Leadership Track</option>
                        <option value="cds">CDS Combined Defence Track</option>
                        <option value="afcat">AFCAT Air Force Track</option>
                        <option value="scholars">Scholars Program (Class 11–12)</option>
                        <option value="juniors">Juniors Program (Class 7–10)</option>
                        <option value="general">General Academic Mentorship</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setSaveErrorMsg(null);
                        setEditName(student?.displayName || "");
                        setEditPhone(student?.phone || "");
                        setEditTargetExam(student?.targetExam || "nda");
                      }}
                      className="px-4 py-2 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] text-xs font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]/65 hover:text-[#252923]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2 rounded-xl bg-[#34483C] hover:bg-[#252923] disabled:bg-[#34483C]/60 text-xs font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923] transition-colors flex items-center gap-2"
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Read-Only Profile Overview Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  <div className="p-3.5 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] space-y-1">
                    <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                      Registered Student Name
                    </span>
                    <span className="text-sm font-medium text-[#252923] block">
                      {student?.displayName || "Cadet"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] space-y-1">
                    <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                      Primary Email Address
                    </span>
                    <span className="text-sm font-medium text-[#252923] truncate block">
                      {student?.email || effectiveUser.email}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] space-y-1">
                    <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                      Contact Phone / WhatsApp
                    </span>
                    <span className="text-sm font-medium text-[#252923] block">
                      {student?.phone || "Not provided"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] space-y-1">
                    <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                      Authentication Provider
                    </span>
                    <span className="text-sm font-medium text-[#252923] capitalize block">
                      {student?.authProvider === "google.com"
                        ? "Google Account"
                        : student?.authProvider || "Email & Password"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] space-y-1">
                    <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                      Enrolment Date
                    </span>
                    <span className="text-xs text-[#252923] block">
                      {formatDate(student?.createdAt)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] space-y-1">
                    <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                      Last Active Session
                    </span>
                    <span className="text-xs text-[#252923] block">
                      {formatDate(student?.lastLogin)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Target Examination Preference Card (5 Columns) */}
            <div className="lg:col-span-5 p-6 sm:p-8 rounded-2xl bg-white border border-[#D8D5C8] shadow-xl flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3EFE6] border border-[#34483C]/50 text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]">
                  <Compass className="w-3 h-3 text-[#252923]/65" />
                  <span>Selected Focus Track</span>
                </div>

                <h3 className="font-heading font-medium text-2xl font-light text-[#252923]">
                  {currentTrack.title}
                </h3>

                <p className="text-xs text-[#252923]/65 font-sans font-light leading-relaxed">
                  {currentTrack.subtitle}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]/65">
                    Curriculum Alignment:
                  </span>
                  <span className="font-medium text-[#252923]">Active</span>
                </div>
                <p className="text-[11px] text-[#252923]/65/80 font-sans font-light">
                  All vault chapters and syllabus documents below are prioritized for your selected target examination.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full py-3 rounded-xl bg-[#F3EFE6] hover:bg-white border border-[#D8D5C8] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#252923]/65" />
                  <span>Change Target Track</span>
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* ROW 2: My Learning — Subject Study Dossiers (Mathematics & English)      */}
        {/* ========================================================================= */}
        <section aria-labelledby="learning-heading" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="font-sans uppercase tracking-wider text-xs uppercase tracking-[0.2em] text-[#252923]/65 block mb-1">
                Core Curricula
              </span>
              <h2
                id="learning-heading"
                className="font-heading font-medium text-2xl sm:text-3xl font-light text-[#252923]"
              >
                My Study Vault &amp; Modules
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
              <Link
                href="/resources"
                className="text-xs font-sans uppercase tracking-wider text-[#252923] hover:text-[#34483C] flex items-center gap-1.5 transition-colors"
              >
                <span>All Resources</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUBJECTS_INFO.map((subj) => {
              const ent = entitlements?.[subj.id];
              const isUnlocked = ent?.active === true;
              const isExpired = ent?.expired === true;
              const daysLeft = calculateDaysRemaining(ent?.expiresAt || null);

              return (
                <div
                  key={subj.id}
                  className="p-6 rounded-2xl bg-white border border-[#D8D5C8] hover:border-[#34483C]/60 transition-all flex flex-col justify-between space-y-6 shadow-lg group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-[#F3EFE6] border border-[#D8D5C8] text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]/65">
                        {subj.chaptersCount}
                      </span>

                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#34483C]/40 border border-[#34483C] text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]">
                          <CheckCircle2 className="w-3 h-3 text-[#252923]" />
                          <span>Unlocked</span>
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/40 border border-amber-600/50 text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-amber-300">
                          <Clock className="w-3 h-3" />
                          <span>Expired</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3EFE6] border border-[#D8D5C8] text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]/65">
                          <Lock className="w-3 h-3 text-[#252923]/65" />
                          <span>Catalog Access</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-heading font-medium text-xl font-light text-[#252923] group-hover:text-[#252923] transition-colors">
                      {subj.title}
                    </h3>

                    <p className="text-xs text-[#252923]/65 font-sans font-light leading-relaxed">
                      {subj.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#D8D5C8] space-y-3">
                    {isUnlocked && daysLeft !== null && (
                      <div className="text-[11px] font-sans text-[#252923]/65 flex items-center justify-between">
                        <span>Access Validity:</span>
                        <span className="font-medium text-[#252923]">{daysLeft} days remaining</span>
                      </div>
                    )}

                    <Link
                      href={subj.href}
                      className={`w-full py-2.5 rounded-xl font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5 ${
                        isUnlocked
                          ? "bg-[#34483C] hover:bg-[#252923] text-[#252923]"
                          : "bg-[#F3EFE6] hover:bg-white border border-[#D8D5C8] text-[#252923]"
                      }`}
                    >
                      <span>{isUnlocked ? "Open Chapter Dossiers" : "Inspect Module & Access"}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ROW 3: Free Curricular Resources (Syllabus & Solved PYQ Papers)           */}
        {/* ========================================================================= */}
        <section aria-labelledby="free-resources-heading" className="space-y-5">
          <div className="space-y-1">
            <span className="font-sans uppercase tracking-wider text-xs uppercase tracking-[0.2em] text-[#252923]/65 block">
              Open Curriculum
            </span>
            <h2
              id="free-resources-heading"
              className="font-heading font-medium text-2xl sm:text-3xl font-light text-[#252923]"
            >
              Public Exam Blueprints &amp; Past Papers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Syllabus Dossier Card */}
            <div className="p-6 rounded-2xl bg-white border border-[#D8D5C8] hover:border-[#34483C]/60 transition-all flex flex-col justify-between space-y-6 shadow-md">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] flex items-center justify-center text-[#252923]">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65">
                    Official UPSC Curriculum
                  </span>
                  <h3 className="font-heading font-medium text-xl font-light text-[#252923]">
                    UPSC Defence Exam Syllabus Dossier
                  </h3>
                </div>
                <p className="text-xs text-[#252923]/65 font-sans font-light leading-relaxed">
                  Section-by-section breakdown of Mathematics, English, and General Ability requirements for NDA and CDS examinations.
                </p>
              </div>

              <div className="pt-2 border-t border-[#D8D5C8]">
                <Link
                  href="/resources/syllabus"
                  className="w-full py-2.5 rounded-xl bg-[#F3EFE6] hover:bg-white border border-[#D8D5C8] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Open Syllabus Dossier</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Solved PYQ Archive Card */}
            <div className="p-6 rounded-2xl bg-white border border-[#D8D5C8] hover:border-[#34483C]/60 transition-all flex flex-col justify-between space-y-6 shadow-md">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] flex items-center justify-center text-[#252923]">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65">
                    14-Year Solved Vault
                  </span>
                  <h3 className="font-heading font-medium text-xl font-light text-[#252923]">
                    Previous Years&apos; Solved Papers (2011–2025)
                  </h3>
                </div>
                <p className="text-xs text-[#252923]/65 font-sans font-light leading-relaxed">
                  Complete official question papers categorized by year with step-by-step officer walkthrough solutions.
                </p>
              </div>

              <div className="pt-2 border-t border-[#D8D5C8]">
                <Link
                  href="/resources/previous-year-papers"
                  className="w-full py-2.5 rounded-xl bg-[#F3EFE6] hover:bg-white border border-[#D8D5C8] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Access Solved Papers Archive</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* ROW 4: My Purchases & Entitlement Subscription Status                     */}
        {/* ========================================================================= */}
        <section aria-labelledby="purchases-heading" className="space-y-5">
          <div className="space-y-1">
            <span className="font-sans uppercase tracking-wider text-xs uppercase tracking-[0.2em] text-[#252923]/65 block">
              Account Entitlements
            </span>
            <h2
              id="purchases-heading"
              className="font-heading font-medium text-2xl sm:text-3xl font-light text-[#252923]"
            >
              My Purchases &amp; Access Subscriptions
            </h2>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#D8D5C8] shadow-xl space-y-6">
            {/* Table / Cards list of Entitlements */}
            {entitlements &&
            Object.values(entitlements).some((e) => e.active || e.purchasedAt) ? (
              <div className="space-y-4">
                <div className="hidden sm:grid grid-cols-12 text-[11px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]/65 pb-2 border-b border-[#D8D5C8]">
                  <div className="col-span-5">Subject Dossier</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-3 text-center">Validity / Expiry</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {Object.values(entitlements).map((ent) => {
                  const subjectMeta = SUBJECTS_INFO.find((s) => s.id === ent.subjectId);
                  const daysLeft = calculateDaysRemaining(ent.expiresAt);

                  return (
                    <div
                      key={ent.subjectId}
                      className="flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-3 py-3 border-b border-[#D8D5C8] text-xs font-sans"
                    >
                      <div className="sm:col-span-5">
                        <span className="font-medium text-[#252923] text-sm block">
                          {subjectMeta?.title || ent.subjectId}
                        </span>
                        <span className="text-[11px] text-[#252923]/65">
                          Purchased on {formatDate(ent.purchasedAt)}
                        </span>
                      </div>

                      <div className="sm:col-span-2 sm:text-center">
                        {ent.active ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/50 text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-emerald-300">
                            Active (365 Days)
                          </span>
                        ) : ent.expired ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-950/60 border border-rose-500/50 text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-rose-300">
                            Expired
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F3EFE6] border border-[#D8D5C8] text-[10px] font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923]/65">
                            Not Active
                          </span>
                        )}
                      </div>

                      <div className="sm:col-span-3 sm:text-center text-[#252923]/65">
                        {ent.active && daysLeft !== null ? (
                          <span>
                            Expires {formatDate(ent.expiresAt)} ({daysLeft} days remaining)
                          </span>
                        ) : ent.expired ? (
                          <span>Expired on {formatDate(ent.expiresAt)}</span>
                        ) : (
                          <span>No active subscription</span>
                        )}
                      </div>

                      <div className="sm:col-span-2 sm:text-right pt-1 sm:pt-0">
                        <Link
                          href={subjectMeta?.href || "/resources"}
                          className="text-xs font-sans uppercase tracking-wider uppercase tracking-wider text-[#252923] hover:text-[#252923] underline inline-flex items-center gap-1"
                        >
                          <span>{ent.active ? "Access Vault" : "View Details"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Dignified Empty State */
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#F3EFE6] border border-[#D8D5C8] flex items-center justify-center text-[#252923]/65 mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-heading font-medium text-lg font-light text-[#252923]">
                    No Paid Study Modules Active
                  </h4>
                  <p className="text-xs text-[#252923]/65 font-sans font-light max-w-md mx-auto leading-relaxed">
                    You currently have full access to our open UPSC Syllabus and 14-Year Solved Past Papers. Comprehensive chapter dossiers for NDA Mathematics, CDS Mathematics, and English can be unlocked individually.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/resources"
                    className="px-5 py-2.5 rounded-xl bg-[#34483C] hover:bg-[#252923] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Browse Academic Study Modules</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {upiOrders.length > 0 && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#D8D5C8] shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading font-medium text-xl text-[#252923]">
                  Recent Direct UPI Transactions
                </h3>
                <span className="text-[11px] font-mono text-[#252923]/60">
                  {upiOrders.length} order{upiOrders.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="divide-y divide-[#D8D5C8]">
                {upiOrders.slice(0, 6).map((ord) => (
                  <div
                    key={ord.orderNo}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans"
                  >
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-[#252923]">{ord.orderNo}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ord.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : ord.status === "review"
                              ? "bg-amber-100 text-amber-900"
                              : ord.status === "pending"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ord.status === "review" ? "Verifying UTR" : ord.status}
                        </span>
                      </div>
                      <div className="text-[#252923]/75">
                        {ord.subjectTitle} · ₹{(ord.amountPaise / 100).toFixed(2)}
                        {(ord.utr || ord.customerUtr) ? (
                          <span className="ml-2 font-mono text-[11px] text-[#252923]">
                            UTR: {ord.utr || ord.customerUtr}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <Link
                      href={`/pay/${ord.orderNo}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F3EFE6] hover:bg-[#34483C] hover:text-[#F3EFE6] border border-[#D8D5C8] text-[#252923] font-semibold transition-colors self-start sm:self-auto"
                    >
                      <span>
                        {ord.status === "pending"
                          ? "Complete UPI Payment"
                          : ord.status === "review"
                          ? "Track Verification"
                          : "View Order"}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* ROW 5: Help & Institutional Guidance Desk                                */}
        {/* ========================================================================= */}
        <section aria-labelledby="help-heading" className="space-y-5">
          <div className="space-y-1">
            <span className="font-sans uppercase tracking-wider text-xs uppercase tracking-[0.2em] text-[#252923]/65 block">
              Mentorship Support
            </span>
            <h2
              id="help-heading"
              className="font-heading font-medium text-2xl sm:text-3xl font-light text-[#252923]"
            >
              Help &amp; Guidance Desk
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Free Consultation Card */}
            <div className="p-6 rounded-2xl bg-white border border-[#D8D5C8] flex flex-col justify-between space-y-5 shadow-md">
              <div className="space-y-2">
                <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                  1-on-1 Mentorship Session
                </span>
                <h3 className="font-heading font-medium text-xl font-light text-[#252923]">
                  Book a Free 20-Min Guidance Call
                </h3>
                <p className="text-xs text-[#252923]/65 font-sans font-light leading-relaxed">
                  Need personalized advice on your preparation roadmap or study routine? Schedule a free 1-on-1 strategy call with our mentors.
                </p>
              </div>

              <div>
                <Link
                  href="/book-orientation"
                  className="w-full py-2.5 rounded-xl bg-[#34483C] hover:bg-[#252923] text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Book Free Consultation</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Direct Admissions & Contact Card */}
            <div className="p-6 rounded-2xl bg-white border border-[#D8D5C8] flex flex-col justify-between space-y-5 shadow-md">
              <div className="space-y-2">
                <span className="font-sans uppercase tracking-wider uppercase text-[10px] tracking-wider text-[#252923]/65 block">
                  Direct Institutional Reach
                </span>
                <h3 className="font-heading font-medium text-xl font-light text-[#252923]">
                  Admissions &amp; Academic Help
                </h3>
                <p className="text-xs text-[#252923]/65 font-sans font-light leading-relaxed">
                  Have an enquiry regarding syllabus access or enrollment? Connect directly with our mentorship desk via WhatsApp or Email.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://wa.me/918969634656"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-[#F3EFE6] hover:bg-white border border-[#D8D5C8] text-[#252923] hover:text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp Desk</span>
                </a>
                <Link
                  href="/contact"
                  className="flex-1 py-2.5 rounded-xl bg-[#F3EFE6] hover:bg-white border border-[#D8D5C8] text-[#252923] hover:text-[#252923] font-sans uppercase tracking-wider uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-[#252923]/65" />
                  <span>Send Enquiry</span>
                </Link>
              </div>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}
