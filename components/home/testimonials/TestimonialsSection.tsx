"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { usePrefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import { testimonials } from "@/lib/testimonials";

/* ------------------------------------------------------------------ */
/* Animation variants (disabled under prefers-reduced-motion)          */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

type TestimonialCardProps = {
  t: (typeof testimonials)[number];
};

function TestimonialCard({ t }: TestimonialCardProps) {
  const [flipped, setFlipped] = useState(false);

  const nameTrack = (
    <div className="flex items-center gap-3.5">
      <div className="relative h-16 w-16 rounded-full shrink-0 overflow-hidden bg-[#E5DFD3] ring-2 ring-[#252923]/10">
        <Image
          src={t.image}
          alt={`${t.name} — photo`}
          fill
          sizes="64px"
          className="object-cover object-top"
        />
      </div>
      <div className="min-w-0">
        <p className="title-4 text-[#252923] truncate">{t.name}</p>
        <p className="caption-4 text-[#252923]/60 truncate">{t.track}</p>
      </div>
    </div>
  );

  return (
    <motion.article
      variants={cardVariants}
      className="group h-[440px] relative"
      style={{ perspective: "1200px" }}
    >
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        animate={{ rotateY: flipped ? 180 : 0 }}
      >
        {/* ================= FRONT ================= */}
        <div className="absolute inset-0 bg-white/60 border border-[#252923]/8 rounded-3xl p-7 sm:p-8 flex flex-col gap-5 [backface-visibility:hidden] transition-all duration-500 hover:bg-white hover:shadow-[0_18px_50px_rgba(37,41,35,0.10)]">
          <div className="font-cormorant text-4xl leading-none text-[#B18A58]/80 select-none" aria-hidden="true">
            &ldquo;
          </div>

          {nameTrack}

          {/* Preview: 3-4 lines */}
          <p className="body-3 text-[#252923]/85 leading-relaxed text-pretty line-clamp-4 flex-1">
            {t.quote}
          </p>

          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="self-start mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[#34483C] hover:text-[#B18A58] transition-colors cursor-pointer group/btn"
            aria-label={`Read full testimonial from ${t.name}`}
          >
            Read more
            <svg
              className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ================= BACK ================= */}
        <div
          className="absolute inset-0 bg-white border border-[#252923]/8 rounded-3xl p-7 sm:p-8 flex flex-col gap-5 [backface-visibility:hidden] shadow-[0_18px_50px_rgba(37,41,35,0.10)]"
          style={{ transform: "rotateY(180deg)" }}
        >
          {nameTrack}

          <p className="body-3 text-[#252923]/85 leading-relaxed text-pretty flex-1 min-h-0 overflow-y-auto pr-1">
            {t.quote}
          </p>

          <button
            type="button"
            onClick={() => setFlipped(false)}
            className="self-start inline-flex items-center gap-2 text-sm font-semibold text-[#34483C] hover:text-[#B18A58] transition-colors cursor-pointer group/btn"
            aria-label={`Collapse testimonial from ${t.name}`}
          >
            Read less
            <svg
              className="size-4 transition-transform duration-300 group-hover/btn:-translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </motion.div>
    </motion.article>
  );
}

export function TestimonialsSection() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section
      id="testimonials"
      className="relative bg-[#F3EFE6] text-[#252923] pt-24 sm:pt-32 pb-24 sm:pb-32 overflow-hidden border-t border-[#D8D5C8]"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        {/* ================================================================= */}
        {/* SECTION HEADER                                                     */}
        {/* ================================================================= */}
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16 space-y-4">
          <p className="caption-3 uppercase tracking-wider text-[#B18A58] font-semibold">
            Student &amp; Parent Voices
          </p>
          <h2
            id="testimonials-heading"
            className="heading-2 sm:heading-1 text-[#252923] text-balance"
          >
            Trusted by Aspirants{" "}
            <span className="italic font-normal text-[#34483C]">and their families.</span>
          </h2>
          <p className="body-4 sm:body-2 text-[#252923]/75 max-w-xl mx-auto leading-relaxed text-pretty">
            Real words from students and parents across the Juniors, Scholars, and Defence
            tracks — about discipline, consistency, and quiet progress.
          </p>
        </div>

        {/* ================================================================= */}
        {/* TESTIMONIAL GRID                                                  */}
        {/* ================================================================= */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
        >
          {testimonials.map((t) => (
            <TestimonialCard key={t.name} t={t} />
          ))}
        </motion.div>

        {/* ================================================================= */}
        {/* CLOSING TOUCHPOINT                                                */}
        {/* ================================================================= */}
        {!reducedMotion ? (
          <motion.div
            className="mt-14 sm:mt-16 text-center space-y-2"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="caption-3 uppercase tracking-wider text-[#34483C] font-semibold">
              — Mentorship Team, Officium Supremum
            </p>
            <p className="caption-2 text-[#252923]/60">
              Join a growing family of aspirants building discipline, one day at a time.
            </p>
          </motion.div>
        ) : (
          <div className="mt-14 sm:mt-16 text-center space-y-2">
            <p className="caption-3 uppercase tracking-wider text-[#34483C] font-semibold">
              — Mentorship Team, Officium Supremum
            </p>
            <p className="caption-2 text-[#252923]/60">
              Join a growing family of aspirants building discipline, one day at a time.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
