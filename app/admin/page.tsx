"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/components/AuthContext";
import {
  Users,
  Shield,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  LogOut,
  ExternalLink,
  ChevronDown,
  Trash2,
  FileText,
  UserCheck,
  Zap,
  Globe,
  KeyRound,
  MessageCircle,
  Copy,
  Check,
  Inbox,
  User as UserIcon,
  Activity,
  ArrowUpRight,
  QrCode
} from "lucide-react";
import AdminUpiGatewayPanel, { type AdminUpiOverviewData } from "@/components/AdminUpiGatewayPanel";

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  program: string;
  source: string;
  message: string;
  status: "new" | "contacted" | "in_progress" | "enrolled" | "archived" | string;
  notes?: string;
  createdAt: string;
}

interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "user" | string;
  rollNumber: string;
  authProvider?: "google.com" | "password" | string;
  phone?: string;
  targetExam?: string;
  createdAt: string;
  lastLogin: string;
}

interface LoginLog {
  id: string;
  email: string;
  role: string;
  status: "success" | "failed" | string;
  authProvider?: string;
  userAgent?: string;
  ip?: string;
  timestamp: string;
}

interface TrafficLog {
  id: string;
  path: string;
  userEmail?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  timestamp: string;
}

interface Stats {
  totalEnquiries: number;
  newEnquiries: number;
  contactedEnquiries: number;
  enrolledEnquiries: number;
  orientationBookings: number;
  contactMessages: number;
  totalAccounts?: number;
  totalUsers: number;
  totalAdmins: number;
  totalStandardUsers: number;
  googleUsersCount?: number;
  emailPasswordUsersCount?: number;
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  recentLoginsCount: number;
  totalPageViews?: number;
  recentPageViews?: number;
}


export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({
    enquiries: false,
    upi: false,
    logins: false,
    users: false,
    traffic: false,
  });
  const [activeAdminEmail, setActiveAdminEmail] = useState<string>("admin@officium.academy");

  // Data states
  const [stats, setStats] = useState<Stats | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [upiOverview, setUpiOverview] = useState<AdminUpiOverviewData | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLog[]>([]);

  // Active Tab: "enquiries" | "upi" | "logins" | "users" | "traffic" | "new-lead"
  const [activeTab, setActiveTab] = useState<"enquiries" | "upi" | "logins" | "users" | "traffic" | "new-lead">("enquiries");

  // Search and Filter states
  const [enquirySearch, setEnquirySearch] = useState("");
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState("all");
  const [enquiryProgramFilter, setEnquiryProgramFilter] = useState("all");

  const [loginSearch, setLoginSearch] = useState("");
  const [loginRoleFilter, setLoginRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [loginStatusFilter, setLoginStatusFilter] = useState<"all" | "success" | "failed">("all");

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admin" | "user">("all");

  // Notes Modal state
  const [editingNoteEnquiry, setEditingNoteEnquiry] = useState<Enquiry | null>(null);
  const [currentNote, setCurrentNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Lead state
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newProgram, setNewProgram] = useState("defence");
  const [newMessage, setNewMessage] = useState("");
  const [newStatus, setNewStatus] = useState("new");
  const [leadCreatedSuccess, setLeadCreatedSuccess] = useState(false);
  const { logout, verifyAdminSession } = useAuth();
  const isMountedRef = useRef(true);
  const initialDashboardLoadRef = useRef<Promise<void> | null>(null);
  const inFlightTabLoadRef = useRef<Record<string, boolean>>({});

  const getAdminHeaders = (extra: Record<string, string> = {}) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("os_admin_token") : null;
    const headers: Record<string, string> = { ...extra };
    if (token) {
      headers["x-admin-token"] = token;
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const loadDashboardData = async () => {
    try {
      // 1. Verify session immediately (coalesced across Strict Mode & AuthContext)
      const authResult = await verifyAdminSession();
      if (!isMountedRef.current) return;

      if (!authResult.authenticated) {
        router.push("/admin/login");
        return;
      }
      if (authResult.admin?.email) {
        setActiveAdminEmail(authResult.admin.email);
      }

      // Session verified: Reveal admin shell immediately for progressive UX
      setLoading(false);

      // 2. Concurrently fetch high-level stats, default active tab (enquiries), and UPI review queue badge
      const [statsRes, enqRes, upiRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: getAdminHeaders(), credentials: "include" }),
        fetch("/api/admin/enquiries", { headers: getAdminHeaders(), credentials: "include" }),
        fetch("/api/admin/upi/overview", { headers: getAdminHeaders(), credentials: "include" }),
      ]);
      if (!isMountedRef.current) return;

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (isMountedRef.current) {
          setStats(statsData.stats);
        }
      }

      if (enqRes.ok) {
        const enqData = await enqRes.json();
        if (isMountedRef.current) {
          setEnquiries(enqData.enquiries || []);
          setLoadedTabs((prev) => ({ ...prev, enquiries: true }));
        }
      }

      if (upiRes.ok) {
        const upiData = await upiRes.json();
        if (isMountedRef.current) {
          setUpiOverview(upiData);
          setLoadedTabs((prev) => ({ ...prev, upi: true }));
        }
      }
    } catch (e) {
      if (isMountedRef.current) {
        router.push("/admin/login");
      }
    }
  };

  const reloadUpiOverview = async () => {
    try {
      const upiRes = await fetch("/api/admin/upi/overview", {
        headers: getAdminHeaders(),
        credentials: "include",
      });
      if (upiRes.ok && isMountedRef.current) {
        const upiData = await upiRes.json();
        setUpiOverview(upiData);
        setLoadedTabs((prev) => ({ ...prev, upi: true }));
      }
    } catch (e) {
      console.error("Failed to reload UPI overview:", e);
    }
  };

  const loadTabData = async (tab: string) => {
    if (inFlightTabLoadRef.current[tab]) return;

    if (tab === "upi" && !loadedTabs.upi) {
      inFlightTabLoadRef.current[tab] = true;
      setTabLoading(true);
      try {
        await reloadUpiOverview();
      } finally {
        inFlightTabLoadRef.current[tab] = false;
        if (isMountedRef.current) setTabLoading(false);
      }
    } else if (tab === "logins" && !loadedTabs.logins) {
      inFlightTabLoadRef.current[tab] = true;
      setTabLoading(true);
      try {
        const logsRes = await fetch("/api/admin/logs?limit=100", { headers: getAdminHeaders(), credentials: "include" });
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          if (isMountedRef.current) {
            setLogs(logsData.logs || []);
            setLoadedTabs((prev) => ({ ...prev, logins: true }));
          }
        }
      } catch (e) {
        console.error("Failed to load logins tab:", e);
      } finally {
        inFlightTabLoadRef.current[tab] = false;
        if (isMountedRef.current) setTabLoading(false);
      }
    } else if (tab === "users" && !loadedTabs.users) {
      inFlightTabLoadRef.current[tab] = true;
      setTabLoading(true);
      try {
        const usersRes = await fetch("/api/admin/users", { headers: getAdminHeaders(), credentials: "include" });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          if (isMountedRef.current) {
            setUsers(usersData.users || []);
            setLoadedTabs((prev) => ({ ...prev, users: true }));
          }
        }
      } catch (e) {
        console.error("Failed to load users tab:", e);
      } finally {
        inFlightTabLoadRef.current[tab] = false;
        if (isMountedRef.current) setTabLoading(false);
      }
    } else if (tab === "traffic" && !loadedTabs.traffic) {
      inFlightTabLoadRef.current[tab] = true;
      setTabLoading(true);
      try {
        const trfRes = await fetch("/api/admin/traffic?limit=100", { headers: getAdminHeaders(), credentials: "include" });
        if (trfRes.ok) {
          const trfData = await trfRes.json();
          if (isMountedRef.current) {
            setTrafficLogs(trfData.traffic || []);
            setLoadedTabs((prev) => ({ ...prev, traffic: true }));
          }
        }
      } catch (e) {
        console.error("Failed to load traffic tab:", e);
      } finally {
        inFlightTabLoadRef.current[tab] = false;
        if (isMountedRef.current) setTabLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (!initialDashboardLoadRef.current) {
      initialDashboardLoadRef.current = loadDashboardData().finally(() => {
        initialDashboardLoadRef.current = null;
      });
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      loadTabData(activeTab);
    }
  }, [activeTab, loading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const statsRes = await fetch("/api/admin/stats", { headers: getAdminHeaders() });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (activeTab === "enquiries") {
        const enqRes = await fetch("/api/admin/enquiries", { headers: getAdminHeaders(), credentials: "include" });
        if (enqRes.ok) {
          const enqData = await enqRes.json();
          setEnquiries(enqData.enquiries || []);
        }
      } else if (activeTab === "upi") {
        await reloadUpiOverview();
      } else if (activeTab === "logins") {
        const logsRes = await fetch("/api/admin/logs?limit=100", { headers: getAdminHeaders() });
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData.logs || []);
        }
      } else if (activeTab === "users") {
        const usersRes = await fetch("/api/admin/users", { headers: getAdminHeaders() });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users || []);
        }
      } else if (activeTab === "traffic") {
        const trfRes = await fetch("/api/admin/traffic?limit=100", { headers: getAdminHeaders() });
        if (trfRes.ok) {
          const trfData = await trfRes.json();
          setTrafficLogs(trfData.traffic || []);
        }
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logout("/admin/login");
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/enquiries", {
        method: "PATCH",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setEnquiries((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
        const statsRes = await fetch("/api/admin/stats", {
          headers: getAdminHeaders(),
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.stats);
        }
      }
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const handleSaveNotes = async () => {
    if (!editingNoteEnquiry) return;
    try {
      const res = await fetch("/api/admin/enquiries", {
        method: "PATCH",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          id: editingNoteEnquiry.id,
          status: editingNoteEnquiry.status,
          notes: currentNote,
        }),
      });

      if (res.ok) {
        setEnquiries((prev) =>
          prev.map((item) =>
            item.id === editingNoteEnquiry.id ? { ...item, notes: currentNote } : item
          )
        );
        setEditingNoteEnquiry(null);
      }
    } catch (e) {
      console.error("Failed to save notes", e);
    }
  };

  const handleDeleteEnquiry = async (id: string) => {
    if (!confirm("Are you sure you want to delete this enquiry record?")) return;
    try {
      const res = await fetch(`/api/admin/enquiries?id=${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        setEnquiries((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete enquiry", e);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Clear all login history logs? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/logs", {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        setLogs([]);
        await handleRefresh();
      }
    } catch (e) {
      console.error("Failed to clear logs", e);
    }
  };

  const handleClearTraffic = async () => {
    if (!confirm("Clear all website traffic history logs?")) return;
    try {
      const res = await fetch("/api/admin/traffic", {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        setTrafficLogs([]);
        await handleRefresh();
      }
    } catch (e) {
      console.error("Failed to clear traffic", e);
    }
  };

  const handleCreateManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;

    try {
      const res = await fetch("/api/admin/enquiries", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          email: newEmail,
          program: newProgram,
          message: newMessage || "Manual entry recorded by administrator",
          status: newStatus,
        }),
      });

      if (res.ok) {
        setLeadCreatedSuccess(true);
        setNewName("");
        setNewPhone("");
        setNewEmail("");
        setNewMessage("");
        await loadDashboardData();
        setTimeout(() => {
          setLeadCreatedSuccess(false);
          setActiveTab("enquiries");
        }, 1200);
      }
    } catch (e) {
      console.error("Failed to create manual lead", e);
    }
  };

  const handleExportCSV = () => {
    if (!enquiries.length) return;

    const headers = ["Lead ID", "Candidate Name", "Phone", "Email", "Program Track", "Source", "Status", "Candidate Inquiry", "Admin Notes", "Submitted Date"];
    const rows = filteredEnquiries.map((e) => {
      const formattedDate =
        e.createdAt && !isNaN(new Date(e.createdAt).getTime())
          ? new Date(e.createdAt).toLocaleString()
          : "Date Unknown";

      return [
        `"${e.id || "N/A"}"`,
        `"${(e.name || "Unknown Candidate").replace(/"/g, '""')}"`,
        `"${e.phone || ""}"`,
        `"${e.email || ""}"`,
        `"${e.program || "Unspecified"}"`,
        `"${e.source || "Unknown"}"`,
        `"${e.status || "new"}"`,
        `"${(e.message || "").replace(/"/g, '""')}"`,
        `"${(e.notes || "").replace(/"/g, '""')}"`,
        `"${formattedDate}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `officium-enquiries-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Enquiries
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((e) => {
      const q = enquirySearch.toLowerCase();
      const matchesSearch =
        !q ||
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.phone && String(e.phone).includes(q)) ||
        (e.id && e.id.toLowerCase().includes(q)) ||
        (e.program && e.program.toLowerCase().includes(q)) ||
        (e.message && e.message.toLowerCase().includes(q));

      const matchesStatus =
        enquiryStatusFilter === "all" || (e.status || "new") === enquiryStatusFilter;
      const matchesProgram =
        enquiryProgramFilter === "all" ||
        (Boolean(e.program) &&
          (enquiryProgramFilter === "defence" || enquiryProgramFilter === "defense"
            ? (e.program.toLowerCase() === "defence" || e.program.toLowerCase() === "defense")
            : e.program.toLowerCase() === enquiryProgramFilter.toLowerCase()));

      return matchesSearch && matchesStatus && matchesProgram;
    });
  }, [enquiries, enquirySearch, enquiryStatusFilter, enquiryProgramFilter]);

  // Filtered Logins
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const q = loginSearch.toLowerCase();
      const matchesSearch =
        !q ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.ip && l.ip.includes(q)) ||
        (l.userAgent && l.userAgent.toLowerCase().includes(q));

      const isLogAdmin = l.role === "admin";
      const matchesRole =
        loginRoleFilter === "all" ||
        (loginRoleFilter === "admin" && isLogAdmin) ||
        (loginRoleFilter === "user" && !isLogAdmin);

      const matchesStatus =
        loginStatusFilter === "all" ||
        l.status === loginStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [logs, loginSearch, loginRoleFilter, loginStatusFilter]);

  // Filtered Users (Strictly Admin vs User)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.toLowerCase();
      const matchesSearch =
        !q ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.rollNumber && u.rollNumber.toLowerCase().includes(q));

      const isAdmin = u.role === "admin";
      const matchesRole =
        userRoleFilter === "all" ||
        (userRoleFilter === "admin" && isAdmin) ||
        (userRoleFilter === "user" && !isAdmin);

      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, userRoleFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#C8A84E] mx-auto animate-pulse">
            <Shield className="w-7 h-7" />
          </div>
          <p className="text-sm font-label uppercase tracking-widest text-slate-500 font-semibold">
            Checking Administrator Access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F172A] flex flex-col selection:bg-[#C8A84E]/20">
      {/* Top Command Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-soft-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="transition-transform hover:scale-[1.02]">
              <Logo variant="light" size="sm" />
            </Link>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100/80 border border-amber-300 text-amber-900 font-mono text-[11px] font-bold tracking-wider uppercase">
                Academy Admin
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                Live Secure
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Admin Profile Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/70 text-xs">
              <Shield className="w-3.5 h-3.5 text-[#C8A84E]" />
              <span className="font-mono text-slate-700 hidden md:inline font-medium">
                {activeAdminEmail}
              </span>
              <span className="text-[10px] font-label font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[#0B192C] text-white rounded">
                Admin
              </span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 transition-all active:scale-95"
              title="Refresh All Records"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#C8A84E]" : ""}`} />
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-label font-semibold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-7 space-y-7 flex-1">
        {/* Executive Overview KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Website Inquiries */}
          <div 
            onClick={() => setActiveTab("enquiries")}
            className={`p-5 rounded-2xl bg-white border cursor-pointer transition-all hover:shadow-soft-md ${
              activeTab === "enquiries" ? "border-amber-400 ring-2 ring-amber-100 shadow-sm" : "border-slate-200/80 shadow-soft-xs"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label uppercase tracking-wider text-slate-500 font-bold">
                Website Enquiries
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-[#C8A84E]">
                <Inbox className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-[#0B192C]">
                {stats?.totalEnquiries || 0}
              </span>
              <span className="text-xs text-slate-500">total leads</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold">
                {stats?.newEnquiries || 0} New
              </span>
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                {stats?.contactedEnquiries || 0} In Progress
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {stats?.enrolledEnquiries || 0} Enrolled
              </span>
            </div>
          </div>

          {/* Card 2: Logins Recorded */}
          <div 
            onClick={() => setActiveTab("logins")}
            className={`p-5 rounded-2xl bg-white border cursor-pointer transition-all hover:shadow-soft-md ${
              activeTab === "logins" ? "border-amber-400 ring-2 ring-amber-100 shadow-sm" : "border-slate-200/80 shadow-soft-xs"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label uppercase tracking-wider text-slate-500 font-bold">
                Logins Recorded
              </span>
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200/70 flex items-center justify-center text-sky-600">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-[#0B192C]">
                {stats?.totalLogins || 0}
              </span>
              <span className="text-xs text-slate-500">auth logs</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {stats?.successfulLogins || 0} Success
              </span>
              <span className="text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {stats?.failedLogins || 0} Failed
              </span>
            </div>
          </div>

          {/* Card 3: Registered Accounts (Admin vs User) */}
          <div 
            onClick={() => setActiveTab("users")}
            className={`p-5 rounded-2xl bg-white border cursor-pointer transition-all hover:shadow-soft-md ${
              activeTab === "users" ? "border-amber-400 ring-2 ring-amber-100 shadow-sm" : "border-slate-200/80 shadow-soft-xs"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label uppercase tracking-wider text-slate-500 font-bold">
                Registered Accounts
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/70 flex items-center justify-center text-indigo-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-[#0B192C]">
                {stats?.totalAccounts || users.length}
              </span>
              <span className="text-xs text-slate-500">accounts</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/80">
                {stats?.totalAdmins || 0} Admins
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {stats?.totalStandardUsers || 0} Users
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                {stats?.googleUsersCount ?? 0} Google
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                {stats?.emailPasswordUsersCount ?? 0} Password
              </span>
            </div>
          </div>

          {/* Card 4: Live Website Traffic */}
          <div 
            onClick={() => setActiveTab("traffic")}
            className={`p-5 rounded-2xl bg-white border cursor-pointer transition-all hover:shadow-soft-md ${
              activeTab === "traffic" ? "border-amber-400 ring-2 ring-amber-100 shadow-sm" : "border-slate-200/80 shadow-soft-xs"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label uppercase tracking-wider text-slate-500 font-bold">
                Website Visitors
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-[#0B192C]">
                {stats?.totalPageViews || 0}
              </span>
              <span className="text-xs text-slate-500">page views</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>{stats?.recentPageViews || 0} views past 24h</span>
              <span className="text-[#C8A84E] font-medium flex items-center gap-0.5">
                View <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </section>

        {/* Action Alert for Pending UPI UTR Reviews */}
        {(upiOverview?.counts?.review || 0) > 0 && activeTab !== "upi" && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-amber-950">
              <QrCode className="w-5 h-5 text-amber-700 shrink-0" />
              <span>
                <strong>{upiOverview?.counts?.review}</strong> UPI payment{(upiOverview?.counts?.review || 0) === 1 ? "" : "s"} awaiting 12-digit UTR verification.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("upi")}
              className="px-4 py-2 rounded-xl bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-label uppercase tracking-wider font-bold shrink-0"
            >
              Review UTR Queue →
            </button>
          </div>
        )}

        {/* Primary Navigation Tabs */}
        <section className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-inner">
            <button
              onClick={() => setActiveTab("enquiries")}
              className={`px-4 py-2.5 rounded-xl font-label text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === "enquiries"
                  ? "bg-[#0B192C] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Inbox className="w-3.5 h-3.5 text-[#C8A84E]" />
              <span>Student Enquiries</span>
              <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-md text-[10px]">
                {stats?.totalEnquiries ?? enquiries.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("upi")}
              className={`px-4 py-2.5 rounded-xl font-label text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === "upi"
                  ? "bg-[#0B192C] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-[#C8A84E]" />
              <span>UPI Gateway</span>
              {(upiOverview?.counts?.review || 0) > 0 ? (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-400 text-[#0B192C] font-bold rounded-md text-[10px]">
                  {upiOverview?.counts?.review} Review
                </span>
              ) : (
                <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-md text-[10px]">
                  {upiOverview?.counts?.paid ?? 0}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("logins")}
              className={`px-4 py-2.5 rounded-xl font-label text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === "logins"
                  ? "bg-[#0B192C] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#C8A84E]" />
              <span>Login History</span>
              <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-md text-[10px]">
                {stats?.totalLogins ?? logs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2.5 rounded-xl font-label text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === "users"
                  ? "bg-[#0B192C] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#C8A84E]" />
              <span>Registered Students & Staff</span>
              <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-md text-[10px]">
                {stats?.totalAccounts ?? users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("traffic")}
              className={`px-4 py-2.5 rounded-xl font-label text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === "traffic"
                  ? "bg-[#0B192C] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-[#C8A84E]" />
              <span>Website Visitors</span>
            </button>

            <button
              onClick={() => setActiveTab("new-lead")}
              className={`px-4 py-2.5 rounded-xl font-label text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "new-lead"
                  ? "bg-[#0B192C] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-[#C8A84E]" />
              <span>+ Add Enquiry Manually</span>
            </button>
          </div>

          {activeTab === "enquiries" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-label uppercase tracking-wider transition-all shadow-soft-xs flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-[#C8A84E]" />
                <span>Download Enquiries CSV</span>
              </button>
            </div>
          )}

          {activeTab === "logins" && (
            <button
              onClick={handleClearLogs}
              className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-label uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Login History</span>
            </button>
          )}

          {activeTab === "traffic" && (
            <button
              onClick={handleClearTraffic}
              className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-label uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Traffic History</span>
            </button>
          )}
        </section>

        {/* ========================================================================= */}
        {/* TAB 1: WEBSITE ENQUIRIES SECTION */}
        {/* ========================================================================= */}
        {activeTab === "enquiries" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Search and Filters Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by name, phone, email, lead ID..."
                  value={enquirySearch}
                  onChange={(e) => setEnquirySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Status Filter */}
                <select
                  value={enquiryStatusFilter}
                  onChange={(e) => setEnquiryStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-label uppercase tracking-wider focus:outline-none focus:border-[#C8A84E]"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="archived">Archived</option>
                </select>

                {/* Program Filter */}
                <select
                  value={enquiryProgramFilter}
                  onChange={(e) => setEnquiryProgramFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-label uppercase tracking-wider focus:outline-none focus:border-[#C8A84E]"
                >
                  <option value="all">All Programs</option>
                  <option value="defence">Defence</option>
                  <option value="nda">NDA</option>
                  <option value="cds">CDS</option>
                  <option value="afcat">AFCAT</option>
                  <option value="scholars">Scholars</option>
                  <option value="juniors">Juniors</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            {/* Enquiries List */}
            {filteredEnquiries.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-heading text-lg font-semibold text-slate-700">No Inquiries Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {enquirySearch || enquiryStatusFilter !== "all" || enquiryProgramFilter !== "all"
                    ? "Try adjusting your search criteria or filters."
                    : "Website inquiries submitted via contact forms or orientation booking will appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredEnquiries.map((enq, index) => {
                  const cleanPhone = (enq.phone || "").replace(/[^0-9]/g, "");
                  const candidateName = enq.name || "Candidate";
                  const programTrack = (enq.program || "").trim();
                  const programUpper = programTrack ? programTrack.toUpperCase() : "GENERAL";
                  const whatsappMessage = `Hello ${candidateName}, Greetings from Officium Supremum Academy regarding your enquiry${programTrack ? ` for the ${programUpper} program` : ""}.`;
                  const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
                  const enqEffectiveStatus = enq.status || "new";

                  return (
                    <div
                      key={enq.id || `enquiry-${index}`}
                      className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs hover:shadow-soft-sm transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {enq.id ? (
                            <button
                              onClick={() => copyToClipboard(enq.id, enq.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-bold text-slate-800 transition-colors flex items-center gap-1.5"
                              title="Click to copy Reference ID"
                            >
                              <span>{enq.id}</span>
                              {copiedId === enq.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-[11px] font-medium text-slate-400">
                              REF PENDING
                            </span>
                          )}

                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 font-label text-[11px] font-bold uppercase tracking-wider text-amber-900">
                            {enq.program || "Unspecified"}
                          </span>

                          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {enq.createdAt && !isNaN(new Date(enq.createdAt).getTime())
                              ? new Date(enq.createdAt).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "Date Unknown"}
                          </span>
                        </div>

                        {/* Status Change Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-label uppercase tracking-wider">Status:</span>
                          <select
                            value={enqEffectiveStatus}
                            onChange={(e) => {
                              if (enq.id) {
                                handleStatusChange(enq.id, e.target.value);
                              }
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-label font-bold uppercase tracking-wider border focus:outline-none cursor-pointer ${
                              enqEffectiveStatus === "new"
                                ? "bg-amber-50 text-amber-900 border-amber-300"
                                : enqEffectiveStatus === "enrolled"
                                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                                : enqEffectiveStatus === "in_progress" || enqEffectiveStatus === "contacted"
                                ? "bg-sky-50 text-sky-900 border-sky-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="in_progress">In Progress</option>
                            <option value="enrolled">Enrolled</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>

                      {/* Candidate Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <div className="text-[10px] font-label uppercase text-slate-400 tracking-wider">Student Name</div>
                          <div className="font-heading font-semibold text-sm text-[#0B192C]">
                            {enq.name || "Unknown Candidate"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-label uppercase text-slate-400 tracking-wider">Phone / WhatsApp</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-medium text-slate-800">
                              {enq.phone || "Not provided"}
                            </span>
                            {cleanPhone && (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-label uppercase text-slate-400 tracking-wider">Email Address</div>
                          {enq.email ? (
                            <a
                              href={`mailto:${enq.email}`}
                              className="font-mono text-slate-800 hover:text-[#C8A84E] underline decoration-slate-300"
                            >
                              {enq.email}
                            </a>
                          ) : (
                            <span className="font-mono text-slate-400">Not provided</span>
                          )}
                        </div>
                      </div>

                      {/* Inquiry Message */}
                      {enq.message && (
                        <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100 leading-relaxed">
                          <span className="font-semibold text-slate-900">Message: </span>
                          {enq.message}
                        </div>
                      )}

                      {/* Internal Notes Preview */}
                      {enq.notes && (
                        <div className="text-xs bg-amber-50/70 border border-amber-200/60 p-3 rounded-xl text-amber-900">
                          <span className="font-bold">Follow-up Notes: </span>
                          {enq.notes}
                        </div>
                      )}

                      {/* Bottom Actions */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-slate-400 text-[11px] font-label uppercase tracking-wider">
                          Source:{" "}
                          {enq.source === "orientation_modal"
                            ? "Orientation Booking"
                            : enq.source === "contact_page"
                            ? "Contact Page"
                            : enq.source === "manual_entry"
                            ? "Manual Entry"
                            : enq.source || "Website Enquiry"}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingNoteEnquiry(enq);
                              setCurrentNote(enq.notes || "");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 font-medium"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#C8A84E]" />
                            <span>{enq.notes ? "Edit Notes" : "+ Add Note"}</span>
                          </button>

                          {enq.id && (
                            <button
                              onClick={() => handleDeleteEnquiry(enq.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LOGINS RECORDED SECTION */}
        {/* ========================================================================= */}
        {activeTab === "logins" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Top Logins Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs">
              <div className="p-3 bg-slate-50/80 rounded-xl">
                <div className="text-[11px] font-label uppercase tracking-wider text-slate-500 font-bold">Total Logins</div>
                <div className="text-2xl font-heading font-bold text-[#0B192C] mt-1">{stats?.totalLogins || logs.length}</div>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/40">
                <div className="text-[11px] font-label uppercase tracking-wider text-amber-800 font-bold">Admin Logins</div>
                <div className="text-2xl font-heading font-bold text-amber-900 mt-1">
                  {logs.filter((l) => l.role === "admin").length}
                </div>
              </div>
              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200/40">
                <div className="text-[11px] font-label uppercase tracking-wider text-sky-800 font-bold">User Logins</div>
                <div className="text-2xl font-heading font-bold text-sky-900 mt-1">
                  {logs.filter((l) => l.role !== "admin").length}
                </div>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/40">
                <div className="text-[11px] font-label uppercase tracking-wider text-rose-800 font-bold">Failed Attempts</div>
                <div className="text-2xl font-heading font-bold text-rose-900 mt-1">
                  {logs.filter((l) => l.status === "failed").length}
                </div>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Filter by account email, IP, device..."
                  value={loginSearch}
                  onChange={(e) => setLoginSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={loginRoleFilter}
                  onChange={(e) => setLoginRoleFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-label uppercase tracking-wider focus:outline-none focus:border-[#C8A84E]"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins Only</option>
                  <option value="user">Users Only</option>
                </select>

                <select
                  value={loginStatusFilter}
                  onChange={(e) => setLoginStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-label uppercase tracking-wider focus:outline-none focus:border-[#C8A84E]"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success Only</option>
                  <option value="failed">Failed Only</option>
                </select>
              </div>
            </div>

            {/* Logins Table */}
            {tabLoading && !loadedTabs.logins ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
                <RefreshCw className="w-8 h-8 text-[#C8A84E] animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-label uppercase tracking-wider font-semibold">
                  Loading Login Activity...
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
                <KeyRound className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-heading text-lg font-semibold text-slate-700">No Login Activity Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  New logins from members and administrators will automatically be recorded and tracked here in real-time.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-label uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 font-semibold">Timestamp</th>
                        <th className="py-3 px-4 font-semibold">Account Email</th>
                        <th className="py-3 px-4 font-semibold">Role</th>
                        <th className="py-3 px-4 font-semibold">Result</th>
                        <th className="py-3 px-4 font-semibold">IP Address</th>
                        <th className="py-3 px-4 font-semibold">Device / Client</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLogs.map((log) => {
                        const isAdmin = log.role === "admin";
                        const isSuccess = log.status === "success";

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                              {log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                                ? new Date(log.timestamp).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })
                                : "Unknown"}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900 font-mono">
                              {log.email || "Unknown"}
                            </td>
                            <td className="py-3 px-4">
                              {isAdmin ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/80 border border-amber-300 text-amber-900 font-bold text-[10px] font-label uppercase tracking-wider">
                                  <Shield className="w-3 h-3 text-amber-700" />
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[10px] font-label uppercase tracking-wider">
                                  <UserIcon className="w-3 h-3 text-slate-500" />
                                  User
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isSuccess ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Success
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
                                  <AlertCircle className="w-3 h-3" />
                                  Failed
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {log.ip || "Local / Host"}
                            </td>
                            <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={log.userAgent}>
                              {log.userAgent || "Standard Browser"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: USER & ACCOUNT DIRECTORY (ADMIN vs USER ONLY) */}
        {/* ========================================================================= */}
        {activeTab === "users" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* User Search & Role Filter */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search accounts by name, email, roll number..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-label uppercase tracking-wider">
                <button
                  onClick={() => setUserRoleFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    userRoleFilter === "all" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setUserRoleFilter("admin")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    userRoleFilter === "admin" ? "bg-white text-amber-900 font-bold shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Admins ({users.filter((u) => u.role === "admin").length})
                </button>
                <button
                  onClick={() => setUserRoleFilter("user")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    userRoleFilter === "user" ? "bg-white text-blue-900 font-bold shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Users ({users.filter((u) => u.role !== "admin").length})
                </button>
              </div>
            </div>

            {/* Users Table */}
            {tabLoading && !loadedTabs.users ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
                <RefreshCw className="w-8 h-8 text-[#C8A84E] animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-label uppercase tracking-wider font-semibold">
                  Loading User Directory...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-heading text-lg font-semibold text-slate-700">No Accounts Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Registered accounts will appear here, separated cleanly into Administrators and Standard Users.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-label uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 font-semibold">Account Member</th>
                        <th className="py-3 px-4 font-semibold">Classification</th>
                        <th className="py-3 px-4 font-semibold">Auth Method</th>
                        <th className="py-3 px-4 font-semibold">Reference Number</th>
                        <th className="py-3 px-4 font-semibold">Registered</th>
                        <th className="py-3 px-4 font-semibold">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => {
                        const isAdmin = user.role === "admin";
                        const isGoogle = user.authProvider === "google.com";

                        return (
                          <tr key={user.uid} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-heading font-semibold text-sm text-[#0B192C]">
                                {user.displayName || "Unknown Member"}
                              </div>
                              <div className="font-mono text-slate-500 text-[11px]">
                                {user.email || "No email recorded"}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {isAdmin ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 font-bold text-[11px] font-label uppercase tracking-wider">
                                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px] font-label uppercase tracking-wider">
                                  <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                                  User
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {isGoogle ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-medium text-[10px] font-label uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                  Google
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium text-[10px] font-label uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  Password
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                              {user.rollNumber || (isAdmin ? "OS-ADMIN" : "OS-USER")}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {user.createdAt && !isNaN(new Date(user.createdAt).getTime())
                                ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "Unknown"}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {user.lastLogin && !isNaN(new Date(user.lastLogin).getTime())
                                ? new Date(user.lastLogin).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "Recently"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: LIVE TRAFFIC MONITORING */}
        {/* ========================================================================= */}
        {activeTab === "traffic" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft-xs flex items-center justify-between">
              <div>
                <h4 className="font-heading font-semibold text-sm text-[#0B192C]">Live Visitor Activity Stream</h4>
                <p className="text-xs text-slate-500">Track which routes and public pages visitors are browsing in real-time.</p>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {trafficLogs.length} recent stream records {stats?.totalPageViews ? `(Total: ${stats.totalPageViews})` : ""}
              </div>
            </div>

            {tabLoading && !loadedTabs.traffic ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
                <RefreshCw className="w-8 h-8 text-[#C8A84E] animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-label uppercase tracking-wider font-semibold">
                  Loading Visitor Stream...
                </p>
              </div>
            ) : trafficLogs.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs space-y-3">
                <Globe className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-heading text-lg font-semibold text-slate-700">No Visitor Logs</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Visitor page navigation will automatically be logged here.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-soft-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-label uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 font-semibold">Timestamp</th>
                        <th className="py-3 px-4 font-semibold">Page Path</th>
                        <th className="py-3 px-4 font-semibold">User Account</th>
                        <th className="py-3 px-4 font-semibold">Referrer</th>
                        <th className="py-3 px-4 font-semibold">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trafficLogs.slice(0, 100).map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {t.timestamp && !isNaN(new Date(t.timestamp).getTime())
                              ? new Date(t.timestamp).toLocaleTimeString()
                              : "Unknown"}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">
                            {t.path}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {t.userEmail || "Anonymous Guest"}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {t.referrer || "Direct"}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {t.ip || "Local"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: RECORD MANUAL LEAD */}
        {/* ========================================================================= */}
        {activeTab === "upi" && (
          <AdminUpiGatewayPanel
            overview={upiOverview}
            loading={tabLoading}
            getAdminHeaders={getAdminHeaders}
            onReload={reloadUpiOverview}
          />
        )}

        {activeTab === "new-lead" && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200/80 rounded-3xl p-7 sm:p-9 shadow-soft-sm space-y-6 animate-in fade-in duration-200">
            <div>
              <h3 className="font-heading font-semibold text-2xl text-[#0B192C]">Record Walk-In or Telephone Lead</h3>
              <p className="text-xs text-slate-500 mt-1">
                Directly add an inquiry to the admissions desk from telephone calls or campus visits.
              </p>
            </div>

            {leadCreatedSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Enquiry successfully added to the database!</span>
              </div>
            )}

            <form onSubmit={handleCreateManualLead} className="space-y-4">
              <div>
                <label className="block text-xs font-label uppercase tracking-wider text-slate-700 mb-1 font-semibold">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Singh"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-label uppercase tracking-wider text-slate-700 mb-1 font-semibold">
                    Phone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-label uppercase tracking-wider text-slate-700 mb-1 font-semibold">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-label uppercase tracking-wider text-slate-700 mb-1 font-semibold">
                    Program Selected
                  </label>
                  <select
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                  >
                    <option value="defence">Defence Leadership (NDA / CDS / AFCAT)</option>
                    <option value="nda">NDA Mentorship</option>
                    <option value="cds">CDS Mentorship</option>
                    <option value="afcat">AFCAT Mentorship</option>
                    <option value="scholars">OS Scholars (Classes 11-12)</option>
                    <option value="juniors">OS Juniors (Classes 7-10)</option>
                    <option value="general">General Enquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-label uppercase tracking-wider text-slate-700 mb-1 font-semibold">
                    Initial Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="enrolled">Enrolled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-label uppercase tracking-wider text-slate-700 mb-1 font-semibold">
                  Enquiry Notes / Background
                </label>
                <textarea
                  rows={3}
                  placeholder="Write call notes or key student details..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0B192C] hover:bg-[#1E293B] text-white font-label font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Save Enquiry
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("enquiries")}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-xs font-label uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Internal Notes Modal */}
      {editingNoteEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-heading font-semibold text-lg text-[#0B192C]">
                  Mentor Follow-up Notes
                </h4>
                <p className="text-xs text-slate-500">
                  Student: {editingNoteEnquiry.name || "Student"} ({editingNoteEnquiry.id || "Pending ID"})
                </p>
              </div>
              <button
                onClick={() => setEditingNoteEnquiry(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={5}
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Write mentor notes, call outcome, or admission status..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#C8A84E] focus:bg-white transition-all"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setEditingNoteEnquiry(null)}
                className="px-4 py-2 text-xs font-label uppercase tracking-wider text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-5 py-2 bg-[#0B192C] hover:bg-[#1E293B] text-white font-label font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
