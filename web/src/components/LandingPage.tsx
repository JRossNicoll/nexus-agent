"use client";

import Header from "@/components/landing/header";
import HeroSection from "@/components/landing/hero-section";
import WorkloadsSection from "@/components/landing/workloads-section";
import WhyChooseSection from "@/components/landing/why-choose-section";
import AktSection from "@/components/landing/akt-section";
import AppsSection from "@/components/landing/apps-section";
import CtaSection from "@/components/landing/cta-section";
import Footer from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <Header />
      <HeroSection />
      <div id="workloads"><WorkloadsSection /></div>
      <WhyChooseSection />
      <AktSection />
      <div id="apps"><AppsSection /></div>
      <CtaSection />
      <Footer />
    </main>
  );
}
