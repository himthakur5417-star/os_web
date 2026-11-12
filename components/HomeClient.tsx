"use client";

import React from "react";
import { useModals } from "@/components/ModalContext";
import { HomepageHero } from "@/components/home/journey/HomepageHero";
import { TaglineRevealSection } from "@/components/home/TaglineRevealSection";
import { MentorStorySection } from "@/components/home/mentor/MentorStorySection";
import { ProgramJourney } from "@/components/home/programs/ProgramJourney";
import { CoreBeliefSection } from "@/components/home/belief/CoreBeliefSection";
import { TestimonialsSection } from "@/components/home/testimonials/TestimonialsSection";
import { FaqSection } from "@/components/home/faq/FaqSection";
import { ClosingCtaSection } from "@/components/home/cta/ClosingCtaSection";

export default function HomeClient() {
  const { openOrientation } = useModals();

  return (
    <div className="os-theme bg-[#F3EFE6] text-[#252923] overflow-x-clip selection:bg-[#34483C] selection:text-[#F3EFE6]">
      {/* ========================================================================= */}
      {/* A. HERO SECTION (Headline: DISCIPLINE CREATES EXCELLENCE + Typewriter)    */}
      {/* ========================================================================= */}
      <HomepageHero onBookCall={() => openOrientation("general")} />

      {/* ========================================================================= */}
      {/* B. BRAND PHILOSOPHY: WORD-BY-WORD SCROLL REVEAL                           */}
      {/* ========================================================================= */}
      <TaglineRevealSection />

      {/* ========================================================================= */}
      {/* C. WHY GUIDANCE MATTERS (Visual Storytelling + Mentor-Student Narrative)  */}
      {/* ========================================================================= */}
      <MentorStorySection onBookCall={() => openOrientation("general")} />

      {/* ========================================================================= */}
      {/* D. PROGRAMS SECTION (Juniors 7–10, Scholars 11–12, Defence NDA/CDS/AFCAT) */}
      {/* ========================================================================= */}
      <ProgramJourney />

      {/* ========================================================================= */}
      {/* E. MENTORSHIP EXPERIENCE & FOUNDER (Manifesto & Verified Background)      */}
      {/* ========================================================================= */}
      <CoreBeliefSection />

      {/* ========================================================================= */}
      {/* F. TESTIMONIALS (Student & Parent Voices in animated grid)               */}
      {/* ========================================================================= */}
      <TestimonialsSection />

      {/* ========================================================================= */}
      {/* G. FREQUENTLY ASKED QUESTIONS (Accordion in Ivory Mist & Stone Grey)      */}
      {/* ========================================================================= */}
      <FaqSection onBookCall={() => openOrientation("general")} />

      {/* ========================================================================= */}
      {/* G. CALM CLOSING CALL TO ACTION (Forest Sage Anchor)                       */}
      {/* ========================================================================= */}
      <ClosingCtaSection onBookCall={() => openOrientation("general")} />
    </div>
  );
}
