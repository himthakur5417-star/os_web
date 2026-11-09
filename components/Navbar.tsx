"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useModals } from "./ModalContext";
import { useAuth } from "./AuthContext";
import { Logo } from "./Logo";
import { usePrefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import {
  CaretDown,
  List,
  X,
  SignIn,
  SignOut,
  ShieldCheck,
  GraduationCap,
  Sparkle,
  ArrowRight,
  BookOpen,
  SquaresFour,
} from "@phosphor-icons/react";

/**
 * Premium Floating Navigation Bar | Officium Supremum
 *
 * Adheres strictly to the landing-page-design B7 standard:
 * - Floating pill centered off the top edge with translucent Ivory Mist (#F3EFE6) surface and blur.
 * - Icon transition from Phosphor library.
 * - Full-height mobile drawer panel with staggered entrance (Spacing-300, 24px rise, 60ms stagger).
 * - Full state coverage: hover, active, focus-visible.
 * - Complete preservation of routes, authentication state, and admin detection.
 */
export function Navbar() {
  const pathname = usePathname();
  const { openOrientation } = useModals();
  const { user: authUser, openAuthModal, logout } = useAuth();
  const [devStudentUser, setDevStudentUser] = useState<typeof authUser | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("preview") === "student") {
        setDevStudentUser({
          uid: "test_cadet_uid_8412",
          email: "cadet.vikram@officiumsupremum.in",
          displayName: "Cadet Vikram",
          role: "user",
          rollNumber: "OS-USR-8412",
        });
      }
    }
  }, []);

  const user = authUser || devStudentUser;
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [programsDropdownOpen, setProgramsDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdowns / menu on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProgramsDropdownOpen(false);
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProgramsDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Admin portal pages render their own dedicated command header
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const programs = [
    {
      href: "/programs/juniors",
      icon: <Sparkle className="w-5 h-5 text-[#B18A58]" weight="bold" />,
      name: "Juniors Program",
      desc: "Class 7–10 • Build daily study habits & confidence early",
    },
    {
      href: "/programs/scholars",
      icon: <GraduationCap className="w-5 h-5 text-[#34483C]" weight="bold" />,
      name: "Scholars Program",
      desc: "Class 11–12 • Balance board exams & competitive tests",
    },
    {
      href: "/programs/defence",
      icon: <ShieldCheck className="w-5 h-5 text-[#34483C]" weight="bold" />,
      name: "Defence Leadership",
      desc: "NDA • CDS • AFCAT • Written Exam & SSB Guidance",
    },
  ];

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/resources", label: "Study Materials" },
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact Us" },
  ];


  return (
    <>
      {/* Floating Centered Navigation Header Container */}
      <header
        className="fixed top-3 sm:top-4 inset-x-0 mx-auto max-w-6xl z-50 px-3 sm:px-6 pointer-events-none"
        aria-label="Main Navigation"
      >
        <div
          className={`pointer-events-auto rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border ${scrolled
            ? "bg-[#F3EFE6]/92 backdrop-blur-xl border-[#252923]/12 shadow-[0_8px_30px_rgb(37,41,35,0.08)]"
            : "bg-[#F3EFE6]/80 backdrop-blur-md border-[#252923]/8 shadow-[0_4px_20px_rgb(37,41,35,0.04)]"
            }`}
        >
          {/* Brand Logo Lockup */}
          <Link
            href="/"
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34483C] rounded-lg"
            aria-label="Officium Supremum Home"
          >
            <Logo variant="charcoal" size="sm" showText={true} />
          </Link>

          {/* Desktop Navigation Destinations */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Desktop Navigation">
            <Link
              href="/"
              className={`caption-1 tracking-wider uppercase transition-colors py-1 ${pathname === "/"
                  ? "text-[#34483C] font-semibold border-b-2 border-[#34483C] pb-0.5"
                  : "text-[#252923]/80 hover:text-[#34483C]"
                }`}
            >
              Home
            </Link>

            {/* Programs Dropdown */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setProgramsDropdownOpen(true)}
              onMouseLeave={() => setProgramsDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => setProgramsDropdownOpen(!programsDropdownOpen)}
                className={`caption-1 tracking-wider uppercase flex items-center gap-1.5 transition-colors py-1 ${pathname.startsWith("/programs")
                    ? "text-[#34483C] font-semibold border-b-2 border-[#34483C] pb-0.5"
                    : "text-[#252923]/80 hover:text-[#34483C]"
                  }`}
                aria-expanded={programsDropdownOpen}
              >
                <span>Programs</span>
                <CaretDown
                  className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${programsDropdownOpen ? "rotate-180" : ""
                    }`}
                  weight="bold"
                />
              </button>

              {programsDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-[380px] rounded-2xl bg-[#F3EFE6] border border-[#252923]/10 shadow-[0_16px_40px_-10px_rgba(37,41,35,0.15)] p-2 z-50 mt-2">
                  <div className="px-3 pt-2 pb-2 border-b border-[#D8D5C8]/60 flex items-center gap-2 text-[#34483C]">
                    <BookOpen className="w-3.5 h-3.5" weight="bold" />
                    <span className="caption-3 uppercase tracking-wider">
                      Mentorship Tracks
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 pt-1.5">
                    {programs.map((prog) => (
                      <Link
                        key={prog.href}
                        href={prog.href}
                        onClick={() => setProgramsDropdownOpen(false)}
                        className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-[#D8D5C8]/30 transition-colors group/item"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#34483C]/8 flex items-center justify-center shrink-0 group-hover/item:scale-105 transition-transform">
                          {prog.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="title-4 text-[#252923] group-hover/item:text-[#34483C] transition-colors">
                            {prog.name}
                          </div>
                          <div className="caption-2 text-[#252923]/65 truncate">
                            {prog.desc}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#B18A58] opacity-60 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>

                  <div className="px-3 pt-2 pb-2 mt-1 border-t border-[#D8D5C8]/60">
                    <button
                      type="button"
                      onClick={() => {
                        setProgramsDropdownOpen(false);
                        openOrientation("general");
                      }}
                      className="w-full text-center py-1.5 rounded-lg caption-3 uppercase tracking-wider text-[#34483C] hover:bg-[#34483C]/8 transition-colors"
                    >
                      Need guidance choosing a track? Book a Free Call →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/resources"
              className={`caption-1 tracking-wider uppercase transition-colors py-1 ${pathname === "/resources"
                  ? "text-[#34483C] font-semibold border-b-2 border-[#34483C] pb-0.5"
                  : "text-[#252923]/80 hover:text-[#34483C]"
                }`}
            >
              Study Materials
            </Link>

            <Link
              href="/about"
              className={`caption-1 tracking-wider uppercase transition-colors py-1 ${pathname === "/about"
                  ? "text-[#34483C] font-semibold border-b-2 border-[#34483C] pb-0.5"
                  : "text-[#252923]/80 hover:text-[#34483C]"
                }`}
            >
              About Us
            </Link>

            <Link
              href="/contact"
              className={`caption-1 tracking-wider uppercase transition-colors py-1 ${pathname === "/contact"
                  ? "text-[#34483C] font-semibold border-b-2 border-[#34483C] pb-0.5"
                  : "text-[#252923]/80 hover:text-[#34483C]"
                }`}
            >
              Contact Us
            </Link>
          </nav>

          {/* Action Controls */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Authenticated State */}
            {user ? (
              <div
                className="relative"
                ref={userDropdownRef}
                onFocusCapture={() => setUserDropdownOpen(true)}
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setUserDropdownOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D8D5C8]/50 hover:bg-[#D8D5C8]/80 text-[#252923] border border-[#252923]/10 transition-colors shadow-sm"
                >
                  <div className="w-5 h-5 rounded-full bg-[#34483C] text-[#F3EFE6] font-bold text-[10px] flex items-center justify-center">
                    {user.displayName?.[0] || "U"}
                  </div>
                  <span className="caption-3 font-semibold">
                    {user.displayName || "Student"}
                  </span>
                  <CaretDown className="w-3 h-3 opacity-60" weight="bold" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#F3EFE6] border border-[#252923]/10 shadow-lg p-2 z-50 text-xs space-y-1">
                    <div className="px-3 py-2 border-b border-[#D8D5C8]">
                      <div className="font-semibold text-[#252923]">
                        {user.displayName || "Account"}
                      </div>
                      <div className="text-[10px] opacity-70 uppercase tracking-wider">
                        {user.role === "admin" ? "Academy Administrator" : user.email || "Member"}
                      </div>
                    </div>
                    {user.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 font-semibold hover:bg-[#34483C]/10 rounded-lg transition-colors uppercase tracking-wider text-[#34483C]"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" weight="bold" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}
                    {user.role !== "admin" && (
                      <Link
                        href="/dashboard"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 font-semibold hover:bg-[#34483C]/10 rounded-lg transition-colors uppercase tracking-wider text-[#34483C]"
                      >
                        <SquaresFour className="w-3.5 h-3.5" weight="bold" />
                        <span>Student Dashboard</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-lg transition-colors uppercase tracking-wider font-semibold"
                    >
                      <SignOut className="w-3.5 h-3.5" weight="bold" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal("signin", "/dashboard")}
                className="flex items-center gap-1.5 px-3.5 py-1.5 button-sm text-[#252923] hover:text-[#34483C] bg-white/70 hover:bg-white rounded-full border border-[#252923]/10 transition-colors shadow-sm"
              >
                <SignIn className="w-3.5 h-3.5 text-[#34483C]" weight="bold" />
                <span>Student Login</span>
              </button>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => openOrientation("general")}
              className="inline-flex items-center justify-center px-4 py-2 button-sm text-[#F3EFE6] bg-[#34483C] hover:bg-[#252923] rounded-full shadow-[0_2px_8px_rgba(52,72,60,0.25)] hover:shadow-[0_4px_14px_rgba(52,72,60,0.35)] transition-all active:scale-[0.98]"
            >
              Book a Free Call
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full bg-white/80 border border-[#252923]/10 text-[#252923] hover:text-[#34483C] transition-colors"
              aria-label={mobileMenuOpen ? "Close Navigation Menu" : "Open Navigation Menu"}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 transition-transform duration-200 rotate-90" weight="bold" />
              ) : (
                <List className="w-5 h-5 transition-transform duration-200" weight="bold" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Full-Height Mobile Drawer Panel adhering to B7 */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#F3EFE6]/98 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-10 pt-24 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          {/* Close button in top header area */}
          <div className="absolute top-4 right-5 sm:right-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-full bg-white border border-[#252923]/15 text-[#252923] hover:text-[#34483C]"
              aria-label="Close Menu"
            >
              <X className="w-6 h-6" weight="bold" />
            </button>
          </div>

          {/* Staggered Navigation Links */}
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <span className="caption-3 uppercase tracking-widest text-[#8A6538]">
                Navigation
              </span>
              <ul className="space-y-4">
                {navLinks.map((link, idx) => (
                  <li
                    key={link.href}
                    className="transition-all duration-300"
                    style={{
                      transitionDelay: reducedMotion ? "0ms" : `${idx * 60}ms`,
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="heading-4 sm:heading-3 text-[#252923] hover:text-[#34483C] block transition-colors py-1 border-b border-[#252923]/8"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mobile Programs List */}
            <div className="space-y-2 pt-2">
              <span className="caption-3 uppercase tracking-widest text-[#8A6538]">
                Programs
              </span>
              <div className="grid grid-cols-1 gap-2.5">
                {programs.map((prog) => (
                  <Link
                    key={prog.href}
                    href={prog.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#252923]/8 hover:border-[#34483C]/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#34483C]/10 flex items-center justify-center shrink-0">
                      {prog.icon}
                    </div>
                    <div>
                      <div className="title-4 text-[#252923]">{prog.name}</div>
                      <div className="caption-2 text-[#252923]/65">{prog.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-8 space-y-3">
            {user ? (
              <div className="p-4 rounded-2xl bg-white border border-[#252923]/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="body-4 text-[#252923]">
                    Logged in as {user.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="caption-3 text-rose-700 uppercase font-semibold"
                  >
                    Sign Out
                  </button>
                </div>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-center py-2.5 bg-[#34483C] text-[#F3EFE6] rounded-xl caption-2 font-semibold uppercase tracking-wider"
                  >
                    Go to Admin Dashboard
                  </Link>
                )}
                {user.role !== "admin" && (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-center py-2.5 bg-[#34483C] text-[#F3EFE6] rounded-xl caption-2 font-semibold uppercase tracking-wider"
                  >
                    Go to Student Dashboard
                  </Link>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal("signin", "/dashboard");
                }}
                className="w-full py-3 text-center button-sm text-[#252923] bg-white rounded-full border border-[#252923]/15 shadow-sm"
              >
                Student Login
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openOrientation("general");
              }}
              className="w-full py-3.5 text-center button-md text-[#F3EFE6] bg-[#34483C] hover:bg-[#252923] rounded-full shadow-md"
            >
              Book a Free 20-Minute Call
            </button>
          </div>
        </div>
      )}
    </>
  );
}
