"use client";

import React from "react";
import { LiquidAccordion } from "@/components/ui/liquid-glass-accordion";
import { homeFaqs } from "@/lib/faqData";

interface FaqSectionProps {
  onBookCall?: () => void;
}

export function FaqSection({ onBookCall }: FaqSectionProps) {
  return (
    <section
      id="faq"
      className="scroll-mt-24 sm:scroll-mt-32 pt-24 sm:pt-32 pb-24 sm:pb-32 bg-[#F3EFE6] text-[#252923] relative overflow-hidden border-t border-[#D8D5C8]"
      aria-labelledby="faq-heading"
    >
      <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        {/* ========================================================================= */}
        {/* SECTION HEADER                                                            */}
        {/* ========================================================================= */}
        <div className="text-center mb-14 sm:mb-16 space-y-3.5">
          <h2 id="faq-heading" className="heading-2 sm:heading-1 text-[#252923] text-balance">
            Frequently Asked Questions
          </h2>

          <p className="body-4 sm:body-2 text-[#252923]/75 max-w-xl mx-auto leading-relaxed text-pretty">
            Clear guidance on our daily study discipline, evening progress checks, and personalized mentorship tracks for students and parents.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* ACCORDION ITEMS (liquid glass)                                          */}
        {/* ========================================================================= */}
        <div className="flex justify-center">
          <LiquidAccordion
            items={homeFaqs.map((f) => ({ question: f.q, answer: f.a }))}
            defaultOpen={0}
            tone="light"
            style={{ maxWidth: 640 }}
          />
        </div>

        {/* ========================================================================= */}
        {/* TEAM ATTRIBUTION & CLOSING TOUCHPOINT                                     */}
        {/* ========================================================================= */}
        <div className="mt-12 sm:mt-14 pt-8 border-t border-[#D8D5C8] text-center space-y-2">
          <p className="caption-1 text-[#252923]/70">
            Have a specific question about your preparation routine? We are glad to guide you.
          </p>
          <p className="caption-3 uppercase tracking-wider text-[#34483C] font-semibold">
            — Mentorship Team, Officium Supremum
          </p>
        </div>

      </div>
    </section>
  );
}
