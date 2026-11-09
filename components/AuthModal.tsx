"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { Logo } from "./Logo";
import {
  X,
  EnvelopeSimple,
  User,
  ArrowRight,
  Key,
  WarningCircle,
  CheckCircle
} from "@phosphor-icons/react";

export function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authMode,
    setAuthMode,
    signInEmail,
    signUpEmail,
    resetPassword,
    signInGoogle
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter your email address in the field above, then click 'Forgot password?'.");
      return;
    }
    setResettingPassword(true);
    try {
      await resetPassword(cleanEmail);
      setSuccess("Password reset instructions have been sent to your email. Please check your inbox and spam folder.");
    } catch (err: any) {
      setError(err?.message || "Failed to send password reset email.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (authMode === "signin") {
        await signInEmail(email, password);
      } else {
        if (!name.trim()) {
          setError("Please enter your full name.");
          setLoading(false);
          return;
        }
        await signUpEmail(email, password, name.trim());
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252923]/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Container */}
      <div
        className="relative w-full max-w-md bg-[#F3EFE6] border border-[#D8D5C8] rounded-2xl shadow-soft-xl p-6 sm:p-8 text-[#252923] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 text-[#252923]/60 hover:text-[#252923] p-1.5 rounded-lg hover:bg-[#D8D5C8]/40 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" weight="bold" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D8D5C8] flex items-center justify-center shadow-soft-sm p-1.5">
            <Logo size="xs" showText={false} variant="sage" />
          </div>
          <div>
            <h3 className="heading-3 text-[#252923]">
              {authMode === "signin" ? "Student Sign In" : "Create Account"}
            </h3>
            <p className="caption-3 text-[#B18A58] uppercase tracking-wider font-semibold">
              Officium Supremum Academy
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-white rounded-xl border border-[#D8D5C8] mb-4 caption-3 uppercase tracking-wider">
          <button
            type="button"
            onClick={() => {
              setAuthMode("signin");
              setError("");
              setSuccess("");
            }}
            className={`py-2 rounded-lg transition-all font-semibold ${
              authMode === "signin"
                ? "bg-[#34483C] text-[#F3EFE6] shadow-soft-sm"
                : "text-[#252923]/70 hover:text-[#252923]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("signup");
              setError("");
              setSuccess("");
            }}
            className={`py-2 rounded-lg transition-all font-semibold ${
              authMode === "signup"
                ? "bg-[#34483C] text-[#F3EFE6] shadow-soft-sm"
                : "text-[#252923]/70 hover:text-[#252923]"
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-white border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
            <WarningCircle className="w-4 h-4 shrink-0 text-rose-600" weight="bold" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" weight="bold" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {authMode === "signup" && (
            <div>
              <label className="block caption-3 uppercase tracking-wider text-[#252923] font-semibold mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#252923]/50 absolute left-3.5 top-3" weight="bold" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-white border border-[#D8D5C8] focus:border-[#34483C] focus:ring-1 focus:ring-[#34483C] rounded-xl pl-10 pr-3.5 py-2 text-sm text-[#252923] placeholder:text-[#252923]/40 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block caption-3 uppercase tracking-wider text-[#252923] font-semibold mb-1">
              Email Address
            </label>
            <div className="relative">
              <EnvelopeSimple className="w-4 h-4 text-[#252923]/50 absolute left-3.5 top-3" weight="bold" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full bg-white border border-[#D8D5C8] focus:border-[#34483C] focus:ring-1 focus:ring-[#34483C] rounded-xl pl-10 pr-3.5 py-2 text-sm text-[#252923] placeholder:text-[#252923]/40 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="caption-3 uppercase tracking-wider text-[#252923] font-semibold">
                Password
              </label>
              {authMode === "signin" && (
                <button
                  type="button"
                  disabled={resettingPassword || loading}
                  onClick={handleForgotPassword}
                  className="text-xs text-[#34483C] hover:text-[#252923] hover:underline font-medium transition-colors cursor-pointer"
                >
                  {resettingPassword ? "Sending link..." : "Forgot password?"}
                </button>
              )}
            </div>
            <div className="relative">
              <Key className="w-4 h-4 text-[#252923]/50 absolute left-3.5 top-3" weight="bold" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-[#D8D5C8] focus:border-[#34483C] focus:ring-1 focus:ring-[#34483C] rounded-xl pl-10 pr-3.5 py-2 text-sm text-[#252923] placeholder:text-[#252923]/40 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-[#34483C] hover:bg-[#252923] disabled:opacity-70 text-[#F3EFE6] button-sm uppercase tracking-wider rounded-xl transition-all shadow-soft-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading
              ? authMode === "signin"
                ? "Signing In..."
                : "Creating Account..."
              : authMode === "signin"
              ? "Sign In to Library"
              : "Create Account & Continue"}
            <ArrowRight className="w-4 h-4 text-[#F3EFE6]" weight="bold" />
          </button>
        </form>

        {/* Google Sign-in */}
        <div className="mt-4 pt-3.5 border-t border-[#D8D5C8]">
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError("");
              setLoading(true);
              try {
                await signInGoogle();
              } catch (err: any) {
                setError(err?.message || "Google sign-in could not be completed.");
              } finally {
                setLoading(false);
              }
            }}
            className="w-full py-2.5 bg-white hover:bg-[#F3EFE6] border border-[#D8D5C8] rounded-xl caption-3 uppercase tracking-wider text-[#252923] font-semibold transition-colors flex items-center justify-center gap-2 shadow-soft-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{loading ? "Connecting..." : "Continue with Google"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
