"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { 
  auth, 
  googleProvider,
  getFirebaseAuth,
  getGoogleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User as FirebaseUser
} from "@/lib/firebase";
import { useRouter } from "next/navigation";

export interface CustomUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "admin" | "user" | "cadet" | "scholar" | "junior" | "parent";
  rollNumber?: string;
  isDemo?: boolean;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  authMode: "signin" | "signup";
  setAuthMode: (mode: "signin" | "signup") => void;
  authRedirectPath: string | null;
  openAuthModal: (mode?: "signin" | "signup", redirectPath?: string) => void;
  closeAuthModal: () => void;
  signInEmail: (email: string, pass: string) => Promise<{ role: string; redirectTo: string }>;
  signUpEmail: (email: string, pass: string, name: string) => Promise<{ role: string; redirectTo: string }>;
  resetPassword: (email: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  loginDemo: (role?: "cadet" | "scholar" | "parent") => void;
  logout: (redirectTo?: string | unknown) => Promise<void>;
  syncAdminSession: (admin: { email: string; displayName?: string }, token?: string) => void;
  verifyAdminSession: () => Promise<{ authenticated: boolean; admin?: { email: string; displayName?: string } }>;
  /**
   * Runs `action` immediately for signed-in users. For guests it opens the
   * login popup and replays `action` right after a successful sign-in
   * (the user stays on the current page).
   */
  requireAuth: (action?: () => void, mode?: "signin" | "signup") => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authRedirectPath, setAuthRedirectPath] = useState<string | null>(null);
  const router = useRouter();
  // Action blocked behind login (e.g. open a resource folder / orientation form)
  const pendingActionRef = useRef<(() => void) | null>(null);
  const isGoogleSigningInRef = useRef(false);
  const isEmailAuthInProgressRef = useRef(false);
  const syncInProgressRef = useRef<string | null>(null);
  const adminVerifyPromiseRef = useRef<Promise<{ authenticated: boolean; admin?: { email: string; displayName?: string } }> | null>(null);
  const adminSessionHandledRef = useRef(false);

  // Helper to detect mobile browsers
  const isMobileDevice = useCallback(() => {
    if (typeof window === "undefined" || !navigator) return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  // Helper to format friendly Google auth errors
  const formatGoogleAuthError = useCallback((error: any) => {
    const code = error?.code || "";
    switch (code) {
      case "auth/operation-not-allowed":
        return "Google Sign-In is not enabled yet in your Firebase Project. Please enable Google under Firebase Console > Authentication > Sign-in method, or sign in using your Email & Password.";
      case "auth/unauthorized-domain": {
        const currentHost = typeof window !== "undefined" ? window.location.hostname : "this domain";
        return `Domain '${currentHost}' is not authorized in Firebase Console. Please add it to Firebase Console > Authentication > Settings > Authorized Domains.`;
      }
      case "auth/popup-blocked":
        return "Popup was blocked by your browser. Please allow popups or use the redirect method.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled.";
      case "auth/account-exists-with-different-credential":
        return "An account already exists with the same email using a different login method. Please sign in with email and password.";
      case "auth/invalid-api-key":
        return "Invalid Firebase API configuration. Please verify environment keys.";
      case "auth/network-request-failed":
        return "Network connection failed. Please check your internet connection.";
      default:
        return error?.message || "Google sign-in could not be completed. Please try again.";
    }
  }, []);

  // Helper to format friendly Email/Password auth errors
  const formatEmailAuthError = useCallback((error: any, isSignUp = false) => {
    const code = String(error?.code || "");
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password. Please verify your credentials or create an account.";
      case "auth/email-already-in-use":
        return "An account with this email already exists. Please sign in instead.";
      case "auth/weak-password":
        return "Password is too weak. Please choose a password with at least 6 characters.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact academy support.";
      case "auth/too-many-requests":
        return "Too many unsuccessful attempts. Please wait a moment and try again.";
      case "auth/operation-not-allowed":
        return "Email/Password authentication is not enabled in Firebase Console. Please contact support or sign in with Google.";
      case "auth/network-request-failed":
        return "Network connection failed. Please check your internet connection and try again.";
      default:
        return error?.message || (isSignUp ? "Registration failed. Please check your details and try again." : "Authentication failed. Please verify your credentials.");
    }
  }, []);

  const checkRedirect = useCallback(
    (defaultPath = "/") => {
      // If the user signed in to unlock something on the current page,
      // stay here and run that action instead of navigating away.
      const pending = pendingActionRef.current;
      if (pending) {
        pendingActionRef.current = null;
        setAuthRedirectPath(null);
        // Let the auth state commit before replaying the action
        setTimeout(pending, 0);
        return;
      }
      const target = authRedirectPath || defaultPath;
      setAuthRedirectPath(null);
      router.push(target);
    },
    [authRedirectPath, router]
  );

  // Synchronize authenticated Firebase user profile with backend
  const syncFirebaseUser = useCallback(
    async (firebaseUser: FirebaseUser, provider = "google.com", isSessionRestore = false, explicitName?: string) => {
      if (syncInProgressRef.current === firebaseUser.uid) {
        return;
      }
      syncInProgressRef.current = firebaseUser.uid;

      try {
        const idToken = await firebaseUser.getIdToken();
        const displayName =
          explicitName ||
          firebaseUser.displayName ||
          (firebaseUser.email ? firebaseUser.email.split("@")[0] : "Cadet");

        const isPasswordProvider = provider === "password";
        const endpoint = isPasswordProvider ? "/api/auth/unified" : "/api/auth/google-sync";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        };

        const bodyPayload = isPasswordProvider
          ? {
              email: firebaseUser.email,
              name: displayName,
              isSessionRestore,
            }
          : {
              idToken,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName,
              provider,
              isSessionRestore,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to synchronize profile.");
        }

        if (data.token) {
          localStorage.setItem("os_admin_token", data.token);
        }

        setUser(data.user);
        localStorage.setItem("os_active_user", JSON.stringify(data.user));
        setIsAuthModalOpen(false);

        if (!isSessionRestore) {
          if (data.role === "admin") {
            pendingActionRef.current = null;
            router.push("/admin");
          } else {
            checkRedirect(data.redirectTo || "/");
          }
        }
        return data;
      } catch (err: any) {
        console.error("Profile sync error:", err);
        throw err;
      } finally {
        syncInProgressRef.current = null;
      }
    },
    [checkRedirect, router]
  );

  const syncAdminSession = useCallback(
    (admin: { email: string; displayName?: string }, token?: string) => {
      const cleanEmail = String(admin.email || "").trim().toLowerCase();
      if (!cleanEmail) return;
      adminSessionHandledRef.current = true;
      const adminUser: CustomUser = {
        uid: `admin-${cleanEmail}`,
        email: cleanEmail,
        displayName: admin.displayName || cleanEmail.split("@")[0].toUpperCase(),
        role: "admin",
      };
      if (typeof window !== "undefined") {
        if (token) {
          localStorage.setItem("os_admin_token", token);
        }
        localStorage.setItem("os_active_user", JSON.stringify(adminUser));
      }
      setUser(adminUser);
      setLoading(false);
    },
    []
  );

  const verifyAdminSession = useCallback(async (): Promise<{
    authenticated: boolean;
    admin?: { email: string; displayName?: string };
  }> => {
    adminSessionHandledRef.current = true;
    if (adminVerifyPromiseRef.current) {
      return adminVerifyPromiseRef.current;
    }

    const runVerify = (async () => {
      try {
        let adminToken = typeof window !== "undefined" ? localStorage.getItem("os_admin_token") : null;
        let candidateFbToken: string | null = null;

        if (!adminToken && typeof window !== "undefined") {
          const firebaseAuth = auth || getFirebaseAuth();
          if (firebaseAuth?.currentUser) {
            try {
              candidateFbToken = await firebaseAuth.currentUser.getIdToken();
              if (candidateFbToken) {
                adminToken = candidateFbToken;
              }
            } catch {}
          }
        }

        const headers: Record<string, string> = {};
        if (adminToken) {
          headers.Authorization = `Bearer ${adminToken}`;
          headers["x-admin-token"] = adminToken;
        }

        const res = await fetch("/api/admin/auth", {
          method: "GET",
          headers,
          credentials: "include",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated && data?.admin?.email) {
            if (typeof window !== "undefined" && !localStorage.getItem("os_admin_token") && candidateFbToken) {
              localStorage.setItem("os_admin_token", candidateFbToken);
            }
            syncAdminSession({
              email: data.admin.email,
              displayName: data.admin.displayName,
            });
            return {
              authenticated: true,
              admin: {
                email: data.admin.email,
                displayName: data.admin.displayName,
              },
            };
          }
        }

        if (typeof window !== "undefined") {
          localStorage.removeItem("os_admin_token");
          const storedActiveRaw = localStorage.getItem("os_active_user");
          if (storedActiveRaw) {
            try {
              const parsed = JSON.parse(storedActiveRaw);
              if (parsed?.role === "admin") {
                localStorage.removeItem("os_active_user");
              }
            } catch {
              localStorage.removeItem("os_active_user");
            }
          }
        }
        setUser((prev) => (prev?.role === "admin" ? null : prev));
        setLoading(false);
        return { authenticated: false };
      } catch {
        setLoading(false);
        return { authenticated: false };
      } finally {
        adminVerifyPromiseRef.current = null;
      }
    })();

    adminVerifyPromiseRef.current = runVerify;
    return runVerify;
  }, [syncAdminSession]);

  // Synchronize AuthContext.user strictly with actual Firebase Auth session (or verified server admin session)
  useEffect(() => {
    let isMounted = true;

    // Never trust or restore demo/unverified sessions from localStorage alone
    if (typeof window !== "undefined") {
      localStorage.removeItem("os_demo_user");
    }

    const firebaseAuth = auth || getFirebaseAuth();

    if (!firebaseAuth) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("os_active_user");
      }
      setUser(null);
      setLoading(false);
      return;
    }

    // Handle redirect result from Google sign-in (critical for mobile browsers)
    import("@/lib/firebase").then(({ getRedirectResult }) => {
      const activeAuth = auth || getFirebaseAuth();
      if (activeAuth) {
        getRedirectResult(activeAuth)
          .then(async (result) => {
            if (!isMounted) return;
            const wasPending = sessionStorage.getItem("os_auth_pending_redirect");
            if (result?.user) {
              sessionStorage.removeItem("os_auth_pending_redirect");
              const redirectPath = sessionStorage.getItem("os_auth_redirect_target");
              sessionStorage.removeItem("os_auth_redirect_target");
              if (redirectPath) setAuthRedirectPath(redirectPath);
              await syncFirebaseUser(result.user, "google.com", false);
            } else if (wasPending) {
              sessionStorage.removeItem("os_auth_pending_redirect");
            }
          })
          .catch((err) => {
            console.error("Google redirect result error:", err);
            sessionStorage.removeItem("os_auth_pending_redirect");
          });
      }
    });

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      if (!isMounted) return;
      // Let explicit sign-in flows complete their own backend sync and redirect handling
      if (isGoogleSigningInRef.current || isEmailAuthInProgressRef.current) return;

      if (firebaseUser) {
        const providerId = firebaseUser.providerData?.[0]?.providerId || "password";
        try {
          await syncFirebaseUser(firebaseUser, providerId, true);
        } catch (e) {
          if (!isMounted) return;
          const fallbackUser: CustomUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split("@")[0] : "Cadet"),
            role: "user",
          };
          setUser(fallbackUser);
          localStorage.setItem("os_active_user", JSON.stringify(fallbackUser));
        }
        if (isMounted) setLoading(false);
        return;
      }

      // If an admin route or login flow is already verifying (or has verified) the admin session, avoid firing a duplicate /api/admin/auth call
      if (adminVerifyPromiseRef.current) {
        try {
          await adminVerifyPromiseRef.current;
        } catch {}
        if (isMounted) setLoading(false);
        return;
      }
      if (adminSessionHandledRef.current) {
        if (isMounted) setLoading(false);
        return;
      }

      // No active Firebase session: verify if there is a valid server-verified Admin session token or cookie
      const adminToken = typeof window !== "undefined" ? localStorage.getItem("os_admin_token") : null;
      const storedActiveRaw = typeof window !== "undefined" ? localStorage.getItem("os_active_user") : null;
      let hasCandidateAdminSession = Boolean(adminToken);
      if (!hasCandidateAdminSession && storedActiveRaw) {
        try {
          const parsed = JSON.parse(storedActiveRaw);
          if (parsed?.role === "admin") hasCandidateAdminSession = true;
        } catch {}
      }

      if (hasCandidateAdminSession) {
        const result = await verifyAdminSession();
        if (isMounted && result.authenticated) {
          setLoading(false);
          return;
        }
      }

      // Clear any unverified localStorage state so a user is never logged in via localStorage alone
      if (typeof window !== "undefined") {
        localStorage.removeItem("os_active_user");
        localStorage.removeItem("os_demo_user");
        localStorage.removeItem("os_admin_token");
      }
      if (isMounted) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [syncFirebaseUser, verifyAdminSession]);

  const openAuthModal = (mode: "signin" | "signup" = "signin", redirectPath?: string) => {
    pendingActionRef.current = null;
    setAuthMode(mode);
    if (redirectPath) setAuthRedirectPath(redirectPath);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const requireAuth = useCallback(
    (action?: () => void, mode: "signin" | "signup" = "signin") => {
      const firebaseAuth = auth || getFirebaseAuth();
      const hasValidSession = Boolean(user && (firebaseAuth?.currentUser || user.role === "admin"));
      if (hasValidSession) {
        action?.();
        return true;
      }
      pendingActionRef.current = action || null;
      setAuthMode(mode);
      setIsAuthModalOpen(true);
      return false;
    },
    [user]
  );

  const signInEmail = async (email: string, pass: string) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPass = String(pass || "");

    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (!cleanPass) {
      throw new Error("Please enter your password.");
    }

    const firebaseAuth = auth || getFirebaseAuth();
    if (!firebaseAuth) {
      throw new Error("Authentication service is not available. Please refresh the page.");
    }

    isEmailAuthInProgressRef.current = true;
    try {
      let credential;
      try {
        credential = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, cleanPass);
      } catch (fbErr: any) {
        // Check if this is an authorized administrator signing in with the dedicated admin security passkey
        const adminRes = await fetch("/api/auth/unified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password: cleanPass, isSignUp: false }),
        });

        if (adminRes.ok) {
          const adminData = await adminRes.json();
          if (adminData.role === "admin" && adminData.token) {
            localStorage.setItem("os_admin_token", adminData.token);
            setUser(adminData.user);
            localStorage.setItem("os_active_user", JSON.stringify(adminData.user));
            setIsAuthModalOpen(false);
            pendingActionRef.current = null;
            router.push("/admin");
            return { role: adminData.role, redirectTo: adminData.redirectTo || "/admin" };
          }
        } else {
          const adminErrData = await adminRes.json().catch(() => ({}));
          if (adminErrData?.error === "Invalid admin password.") {
            throw new Error(adminErrData.error);
          }
        }

        // Do not swallow Firebase authentication errors for students
        throw new Error(formatEmailAuthError(fbErr, false));
      }

      const idToken = await credential.user.getIdToken(true);
      const res = await fetch("/api/auth/unified", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          isSignUp: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        await firebaseSignOut(firebaseAuth).catch(() => {});
        throw new Error(data.error || "Authentication verification failed. Please try again.");
      }

      if (data.token) {
        localStorage.setItem("os_admin_token", data.token);
      }

      setUser(data.user);
      localStorage.setItem("os_active_user", JSON.stringify(data.user));
      setIsAuthModalOpen(false);

      if (data.role === "admin") {
        pendingActionRef.current = null;
        router.push("/admin");
      } else {
        checkRedirect(data.redirectTo || "/");
      }

      return { role: data.role, redirectTo: data.redirectTo };
    } finally {
      isEmailAuthInProgressRef.current = false;
    }
  };

  const signUpEmail = async (email: string, pass: string, name: string) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPass = String(pass || "");
    const cleanName = String(name || "").trim();

    if (!cleanName) {
      throw new Error("Please enter your full name.");
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (cleanPass.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const firebaseAuth = auth || getFirebaseAuth();
    if (!firebaseAuth) {
      throw new Error("Authentication service is not available. Please refresh the page.");
    }

    isEmailAuthInProgressRef.current = true;
    try {
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, cleanPass);
      } catch (fbErr: any) {
        // Never swallow Firebase registration errors
        throw new Error(formatEmailAuthError(fbErr, true));
      }

      try {
        await updateProfile(credential.user, { displayName: cleanName });
      } catch (profileErr) {
        console.warn("Could not update Firebase profile displayName:", profileErr);
      }

      const idToken = await credential.user.getIdToken(true);
      const res = await fetch("/api/auth/unified", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          name: cleanName,
          isSignUp: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        await firebaseSignOut(firebaseAuth).catch(() => {});
        throw new Error(data.error || "Registration verification failed. Please try again.");
      }

      if (data.token) {
        localStorage.setItem("os_admin_token", data.token);
      }

      setUser(data.user);
      localStorage.setItem("os_active_user", JSON.stringify(data.user));
      setIsAuthModalOpen(false);

      if (data.role === "admin") {
        pendingActionRef.current = null;
        router.push("/admin");
      } else {
        checkRedirect(data.redirectTo || "/");
      }

      return { role: data.role, redirectTo: data.redirectTo };
    } finally {
      isEmailAuthInProgressRef.current = false;
    }
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address to receive password reset instructions.");
    }
    const firebaseAuth = auth || getFirebaseAuth();
    if (!firebaseAuth) {
      throw new Error("Authentication service is not available. Please refresh the page.");
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, cleanEmail);
    } catch (err: any) {
      const code = String(err?.code || "");
      if (code === "auth/user-not-found") {
        throw new Error("No account found with this email. Please check your spelling or create an account.");
      }
      throw new Error(err?.message || "Failed to send password reset email. Please try again.");
    }
  };

  const signInGoogle = async () => {
    if (isGoogleSigningInRef.current) return;
    const firebaseAuth = auth || getFirebaseAuth();
    const activeGoogleProvider = googleProvider || getGoogleProvider();
    if (!firebaseAuth || !activeGoogleProvider) {
      throw new Error("Google authentication is initializing. Please try again in a moment.");
    }

    isGoogleSigningInRef.current = true;

    try {
      const isMobile = isMobileDevice();

      if (isMobile) {
        // Mobile browsers: execute redirect-based flow to avoid popup blocking
        sessionStorage.setItem("os_auth_pending_redirect", "true");
        if (authRedirectPath) {
          sessionStorage.setItem("os_auth_redirect_target", authRedirectPath);
        }
        const { signInWithRedirect } = await import("@/lib/firebase");
        await signInWithRedirect(firebaseAuth, activeGoogleProvider);
        return;
      }

      // Desktop browsers: attempt popup, fallback to redirect if blocked
      try {
        const result = await signInWithPopup(firebaseAuth, activeGoogleProvider);
        if (result?.user) {
          try {
            await syncFirebaseUser(result.user, "google.com");
          } catch (syncErr: any) {
            console.warn("Backend profile sync notice:", syncErr?.message);
            // Google authentication succeeded! Fall back to client session if backend sync had an issue
            const userObj: CustomUser = {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName || (result.user.email ? result.user.email.split("@")[0] : "Cadet"),
              role: "user",
            };
            setUser(userObj);
            localStorage.setItem("os_active_user", JSON.stringify(userObj));
            setIsAuthModalOpen(false);
            checkRedirect("/");
          }
          return;
        }
      } catch (popupError: any) {
        if (popupError?.code === "auth/popup-blocked") {
          // Fallback to redirect when popup is blocked
          sessionStorage.setItem("os_auth_pending_redirect", "true");
          if (authRedirectPath) {
            sessionStorage.setItem("os_auth_redirect_target", authRedirectPath);
          }
          const { signInWithRedirect } = await import("@/lib/firebase");
          await signInWithRedirect(firebaseAuth, activeGoogleProvider);
          return;
        }
        if (popupError?.code === "auth/popup-closed-by-user") {
          return; // User cancelled without error
        }
        throw popupError;
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      throw new Error(formatGoogleAuthError(error));
    } finally {
      isGoogleSigningInRef.current = false;
    }
  };

  const loginDemo = () => {
    // Unauthenticated demo sessions are disabled for security; prompt real sign-in instead.
    openAuthModal("signin");
  };

  const logout = async (redirectTo?: string | unknown) => {
    const targetPath = typeof redirectTo === "string" && redirectTo.startsWith("/") ? redirectTo : "/";
    const adminToken = typeof window !== "undefined" ? localStorage.getItem("os_admin_token") : null;
    adminSessionHandledRef.current = false;
    adminVerifyPromiseRef.current = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("os_active_user");
      localStorage.removeItem("os_demo_user");
      localStorage.removeItem("os_admin_token");
    }
    try {
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
        headers["x-admin-token"] = adminToken;
      }
      await fetch("/api/admin/auth", {
        method: "DELETE",
        headers,
        credentials: "include",
      });
    } catch (e) {}
    try {
      const firebaseAuth = auth || getFirebaseAuth();
      if (firebaseAuth) {
        await firebaseSignOut(firebaseAuth);
      }
    } catch (e) {}
    setUser(null);
    router.push(targetPath);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        authMode,
        setAuthMode,
        authRedirectPath,
        openAuthModal,
        closeAuthModal,
        signInEmail,
        signUpEmail,
        resetPassword,
        signInGoogle,
        loginDemo,
        logout,
        syncAdminSession,
        verifyAdminSession,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
