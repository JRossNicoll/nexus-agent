const stats = [
  { value: "100%", label: "Privacy — Your Data Stays Local" },
  { value: "∞", label: "Persistent Memory" },
  { value: "<2s", label: "Average Response Time" },
  { value: "24/7", label: "Proactive Intelligence" },
]

export default function CtaSection() {
  return (
    <section className="relative py-24">
      {/* Top divider */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#222] to-transparent" />
      {/* Background tint */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0f0808] to-[#0a0a0a]" />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">
          Ready to meet your AI agent?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-[#888] sm:text-base">
          Start using NEXUS today. Set up in under 5 minutes, connect your preferred AI provider,
          and experience an assistant that learns and grows with you.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#app"
            className="rounded-lg bg-[#ff3333] px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#e62e2e] hover:shadow-[0_0_30px_rgba(255,51,51,0.4)] active:scale-[0.97]"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "#app";
              window.dispatchEvent(new HashChangeEvent("hashchange"));
            }}
          >
            Get Started
          </a>
          <a
            href="https://github.com/JRossNicoll/nexus-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[#333] bg-transparent px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-[#ff3333]/30 hover:bg-[#ff3333]/5 hover:shadow-[0_0_15px_rgba(255,51,51,0.1)] active:scale-[0.97]"
          >
            View on GitHub
          </a>
        </div>

        {/* Stats row */}
        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-y-10 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <div key={i} className="group relative cursor-default text-center">
              <div className="text-4xl font-bold text-[#ff3333] transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(255,51,51,0.4)] lg:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-xs tracking-wide text-[#777] sm:text-sm">{stat.label}</div>
              {i < stats.length - 1 && (
                <div className="absolute right-0 top-1/2 hidden h-10 w-px -translate-y-1/2 bg-[#222] sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
