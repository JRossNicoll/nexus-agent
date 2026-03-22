export default function WhyChooseSection() {
  return (
    <section id="features" className="relative py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0f0808] to-[#0a0a0a]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">
            Why Choose MEDO?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-[#888] sm:text-base">
            An AI assistant that remembers, learns, and acts on your behalf — with complete privacy.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <FeatureCard
            title="Persistent Memory"
            description="MEDO remembers your preferences, past conversations, and important details. Memories are stored locally and visualized in a force-directed graph."
            iconType="brain"
          />
          <FeatureCard
            title="Smart Skills"
            description="Create custom skills using plain English. MEDO generates the automation, installs it, and runs it on schedule or on demand."
            iconType="rocket"
          />
          <FeatureCard
            title="Proactive Intelligence"
            description="MEDO doesn't wait to be asked. It detects patterns, surfaces insights, and sends you briefings — all grounded in your actual data."
            iconType="shield"
          />
          <FeatureCard
            title="LLM Agnostic"
            description="Works with Anthropic, OpenAI, OpenRouter, and Ollama. Bring your own API key, switch providers anytime, with automatic failover."
            iconType="code"
          />
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ title, description, iconType }: { title: string; description: string; iconType: string }) {
  return (
    <div className="group overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] transition-all duration-300 hover:border-[#ff3333]/25 hover:shadow-[0_0_30px_rgba(255,51,51,0.06)]">
      <div className="relative h-52 overflow-hidden sm:h-56">
        {/* Dark atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0505] via-[#180a0a] to-[#150808]" />
        {/* Red atmospheric glow */}
        <div className="absolute left-1/2 top-1/2 h-32 w-64 -translate-x-1/2 -translate-y-1/2 bg-[#ff3333]/10 blur-[60px] transition-all duration-500 group-hover:bg-[#ff3333]/[0.14] group-hover:blur-[70px]" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0d0d0d] to-transparent" />
        {/* Grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: `linear-gradient(rgba(255,51,51,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,51,51,0.5) 1px, transparent 1px)`,
          backgroundSize: '35px 35px'
        }} />

        {/* Central icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {iconType === "brain" && (
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-xl border border-[#ff3333]/25 bg-[#ff3333]/10 backdrop-blur-sm transition-all duration-300 group-hover:border-[#ff3333]/40 group-hover:bg-[#ff3333]/[0.15] group-hover:shadow-[0_0_20px_rgba(255,51,51,0.2)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff3333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
            </div>
          )}
          {iconType === "rocket" && (
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-xl border border-[#ff3333]/25 bg-[#ff3333]/10 backdrop-blur-sm transition-all duration-300 group-hover:border-[#ff3333]/40 group-hover:bg-[#ff3333]/[0.15] group-hover:shadow-[0_0_20px_rgba(255,51,51,0.2)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff3333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          )}
          {iconType === "shield" && (
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-xl border border-[#ff3333]/25 bg-[#ff3333]/10 backdrop-blur-sm transition-all duration-300 group-hover:border-[#ff3333]/40 group-hover:bg-[#ff3333]/[0.15] group-hover:shadow-[0_0_20px_rgba(255,51,51,0.2)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff3333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          )}
          {iconType === "code" && (
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-xl border border-[#ff3333]/25 bg-[#ff3333]/10 backdrop-blur-sm transition-all duration-300 group-hover:border-[#ff3333]/40 group-hover:bg-[#ff3333]/[0.15] group-hover:shadow-[0_0_20px_rgba(255,51,51,0.2)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff3333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
          )}
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-1/2 z-10 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#ff3333]/30 to-transparent transition-opacity duration-300 group-hover:via-[#ff3333]/50" />
      </div>

      <div className="p-6 sm:px-8 sm:pb-8">
        <h3 className="mb-2 text-lg font-semibold text-white transition-colors duration-300 group-hover:text-[#ff5555]">{title}</h3>
        <p className="text-sm leading-relaxed text-[#777]">{description}</p>
      </div>
    </div>
  )
}
