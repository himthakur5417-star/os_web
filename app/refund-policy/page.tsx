import type { Metadata } from "next";
import Link from "next/link";
import {
  Receipt,
  RotateCcw,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  HelpCircle,
  CreditCard,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Officium Supremum",
  description:
    "Refund and cancellation guidelines for Officium Supremum mentorship programs, digital study resources, and academic consultations.",
  alternates: {
    canonical: "https://www.officiumsupremum.in/refund-policy",
  },
  openGraph: {
    title: "Refund & Cancellation Policy | Officium Supremum",
    description:
      "Refund and cancellation guidelines for Officium Supremum mentorship programs, digital study resources, and academic consultations.",
    url: "https://www.officiumsupremum.in/refund-policy",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Officium Supremum — Modern Discipline-First Learning Academy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Refund & Cancellation Policy | Officium Supremum",
    description:
      "Refund and cancellation guidelines for Officium Supremum mentorship programs, digital study resources, and academic consultations.",
    images: ["/og-image.png"],
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="bg-[#F3EFE6] text-[#252923] min-h-screen">
      {/* Hero Header */}
      <section className="relative pt-24 pb-14 lg:pt-32 lg:pb-18 bg-[#F3EFE6] border-b border-[#D8D5C8]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight text-[#252923] leading-tight text-balance">
            Refund &amp; Cancellation Policy
          </h1>

          <p className="body-2 text-[#252923]/75 font-sans leading-relaxed max-w-2xl mx-auto text-pretty">
            We believe in honest relationships with students and parents. This policy explains our refund standards, cancellation windows, and payment processing procedures.
          </p>

          <div className="pt-2 flex items-center justify-center gap-3 text-xs text-[#252923]/60 font-mono">
            <span>Last Updated: November 2026</span>
            <span>•</span>
            <span>Applicable across All Programs</span>
          </div>
        </div>
      </section>

      {/* Main Content Sections */}
      <section className="py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          {/* 1. Free Orientation Commitment */}
          <div className="p-6 sm:p-8 bg-white border border-[#D8D5C8] rounded-2xl shadow-soft-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#34483C]/10 border border-[#34483C]/20 flex items-center justify-center text-[#34483C]">
                <CheckCircle2 className="w-5 h-5 text-[#34483C]" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#252923]">
                1. 100% Free Initial Consultations
              </h2>
            </div>

            <p className="body-3 sm:body-2 text-[#252923]/80 leading-relaxed font-sans">
              Our initial 20-minute guidance call is entirely free of charge. We do not ask for credit card or payment information to book an orientation. You are never obligated to purchase a mentorship plan or resource during or after this call.
            </p>
          </div>

          {/* 2. Mentorship Programs (Juniors, Scholars, Defence Track) */}
          <div className="p-6 sm:p-8 bg-white border border-[#D8D5C8] rounded-2xl shadow-soft-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B18A58]/15 border border-[#B18A58]/30 flex items-center justify-center text-[#B18A58]">
                <RotateCcw className="w-5 h-5 text-[#B18A58]" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#252923]">
                2. Mentorship Programs Cancellation &amp; Refunds
              </h2>
            </div>

            <div className="space-y-3 body-3 sm:body-2 text-[#252923]/80 leading-relaxed font-sans">
              <p>
                Because our mentorship cohorts have strictly capped student-to-mentor ratios (to maintain genuine daily personal review), admissions are reserved on a first-come, verified basis.
              </p>

              <div className="p-4 bg-[#F3EFE6] rounded-xl border border-[#D8D5C8] space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="font-semibold text-[#34483C] shrink-0">•</span>
                  <div>
                    <strong className="text-[#252923]">Cancellation Before Program Start:</strong> If you cancel your enrollment at least 48 hours prior to your scheduled commencement date, you are entitled to a <span className="font-semibold text-[#34483C]">100% full refund</span>.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-semibold text-[#34483C] shrink-0">•</span>
                  <div>
                    <strong className="text-[#252923]">7-Day Adjustment Window:</strong> If within the first 7 calendar days of starting the program, you or your child find that the daily routine and discipline schedule is not suited to your circumstances, you may request a refund. We will refund your fee on a prorated basis (deducting only the days already delivered).
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-semibold text-[#34483C] shrink-0">•</span>
                  <div>
                    <strong className="text-[#252923]">After the 7-Day Window:</strong> Once the initial 7 days have passed, mentorship slots cannot be reassigned mid-cohort. Fees become non-refundable, though students facing documented medical or family emergencies may request a temporary program pause (up to 60 days) upon approval.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Digital Study Materials & Library Vault */}
          <div className="p-6 sm:p-8 bg-white border border-[#D8D5C8] rounded-2xl shadow-soft-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#34483C]/10 border border-[#34483C]/20 flex items-center justify-center text-[#34483C]">
                <Receipt className="w-5 h-5 text-[#34483C]" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#252923]">
                3. Digital Materials &amp; Study Notes
              </h2>
            </div>

            <p className="body-3 sm:body-2 text-[#252923]/80 leading-relaxed font-sans">
              All official syllabi blueprints, sample preview notes, and past year question papers in our Study Library are completely free. For any premium digital study packs:
            </p>

            <ul className="list-disc pl-5 space-y-2 body-3 sm:body-2 text-[#252923]/80 font-sans">
              <li>
                Because digital goods are immediately downloadable and accessible, digital purchases are generally non-refundable once accessed.
              </li>
              <li>
                <strong>Duplicate Charges:</strong> In the event of an accidental duplicate transaction or technical error resulting in multiple debits for the same material, the duplicate amount will be refunded in full immediately.
              </li>
              <li>
                <strong>Access Failure:</strong> If a technical issue on our website prevents you from accessing purchased material and our support team cannot resolve it within 48 hours, you are entitled to a full refund.
              </li>
            </ul>
          </div>

          {/* 4. Refund Request Procedure */}
          <div className="p-6 sm:p-8 bg-white border border-[#D8D5C8] rounded-2xl shadow-soft-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B18A58]/15 border border-[#B18A58]/30 flex items-center justify-center text-[#B18A58]">
                <Mail className="w-5 h-5 text-[#B18A58]" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#252923]">
                4. How to Request a Refund
              </h2>
            </div>

            <p className="body-3 sm:body-2 text-[#252923]/80 leading-relaxed font-sans">
              To initiate a cancellation or refund request, please contact our administrative desk with your registration details:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 bg-[#F3EFE6] rounded-xl border border-[#D8D5C8] space-y-1">
                <span className="caption-3 uppercase tracking-wider text-[#34483C] font-semibold block">
                  Via Email
                </span>
                <p className="text-xs text-[#252923]/70 font-sans">
                  Send an email with Subject line <br />
                  <code className="text-[#34483C] font-semibold font-mono text-[11px]">Refund Request - [Student Name]</code>
                </p>
                <a
                  href="mailto:osupremum@gmail.com"
                  className="inline-block pt-1 font-mono text-sm text-[#252923] font-bold hover:text-[#34483C] underline"
                >
                  osupremum@gmail.com
                </a>
              </div>

              <div className="p-4 bg-[#F3EFE6] rounded-xl border border-[#D8D5C8] space-y-1">
                <span className="caption-3 uppercase tracking-wider text-[#34483C] font-semibold block">
                  Via WhatsApp
                </span>
                <p className="text-xs text-[#252923]/70 font-sans">
                  Message our official mentorship desk with your payment receipt or Order ID:
                </p>
                <a
                  href="https://wa.me/918969634656"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block pt-1 font-mono text-sm text-[#252923] font-bold hover:text-[#34483C] underline"
                >
                  +91 8969634656
                </a>
              </div>
            </div>
          </div>

          {/* 5. Processing Timeline & Banking Partners */}
          <div className="p-6 sm:p-8 bg-white border border-[#D8D5C8] rounded-2xl shadow-soft-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#34483C]/10 border border-[#34483C]/20 flex items-center justify-center text-[#34483C]">
                <Clock className="w-5 h-5 text-[#34483C]" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#252923]">
                5. Processing Timelines &amp; Payout Method
              </h2>
            </div>

            <ul className="list-disc pl-5 space-y-2 body-3 sm:body-2 text-[#252923]/80 font-sans">
              <li>
                <strong>Review Window:</strong> Once received, your request will be reviewed and acknowledged within 24 to 48 business hours.
              </li>
              <li>
                <strong>Payment Method:</strong> Approved refunds are credited directly back to the original UPI source account verified with your transaction UTR. We do not issue cash refunds or unverified third-party transfers.
              </li>
              <li>
                <strong>Bank Settlement:</strong> After we initiate the refund, funds typically appear in your bank account or card statement within <span className="font-semibold text-[#34483C]">5 to 7 business days</span>, in accordance with Reserve Bank of India (RBI) and card network operating standards.
              </li>
            </ul>
          </div>

          {/* 6. Administrative Contact Information */}
          <div className="p-6 sm:p-8 bg-white border border-[#D8D5C8] rounded-2xl shadow-soft-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B18A58]/15 border border-[#B18A58]/30 flex items-center justify-center text-[#B18A58]">
                <MapPin className="w-5 h-5 text-[#B18A58]" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#252923]">
                6. Operating Entity &amp; Official Address
              </h2>
            </div>

            <p className="body-3 sm:body-2 text-[#252923]/80 leading-relaxed font-sans">
              Officium Supremum operates as an independent educational and personal mentorship institution.
            </p>

            <div className="p-4 bg-[#F3EFE6] rounded-xl border border-[#D8D5C8] text-xs space-y-2 font-sans">
              <span className="caption-3 uppercase tracking-wider text-[#34483C] font-semibold block">
                Official Correspondence Address
              </span>
              <p className="text-[#252923] leading-relaxed">
                Ward No.-4, Vill./P.O.- Daldal, P.S.- Bheja, Block- Madhepur, Dist.- Madhubani, State- Bihar, Pincode- 847408, India
              </p>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-[#252923]/80">
                <div>
                  Email:{" "}
                  <a href="mailto:osupremum@gmail.com" className="font-mono font-bold text-[#252923] hover:underline">
                    osupremum@gmail.com
                  </a>
                </div>
                <div>
                  WhatsApp / Desk:{" "}
                  <a href="https://wa.me/918969634656" className="font-mono font-bold text-[#252923] hover:underline">
                    +91 8969634656
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links Back to Legal Suite */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-sans text-[#252923]/70">
            <Link href="/terms" className="hover:text-[#34483C] hover:underline">
              Terms &amp; Conditions
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-[#34483C] hover:underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-[#34483C] hover:underline">
              Contact Desk
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-[#34483C] hover:underline">
              Return to Home
            </Link>
          </div>

        </div>
      </section>
    </div>
  );
}

