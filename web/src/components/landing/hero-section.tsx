export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-24 pt-36">
      {/* Large radial red glow from top center */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-[#ff3333]/[0.12] blur-[120px]" />

      {/* Subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: `linear-gradient(rgba(255,51,51,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,51,51,0.5) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        {/* Glowing cloud icon with brain-like neural design */}
        <div className="mb-12 flex justify-center">
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute -inset-12 rounded-full bg-[#ff3333]/25 blur-[60px]" />
            <div className="absolute -inset-6 rounded-full bg-[#ff3333]/15 blur-[30px]" />
            <svg width="100" height="80" viewBox="0 0 100 80" fill="none" className="relative drop-shadow-[0_0_30px_rgba(255,51,51,0.5)]">
              {/* Cloud shape */}
              <path d="M80 42c0-15.464-12.536-28-28-28-12.85 0-23.68 8.663-26.96 20.47C10.79 35.67 0 47.24 0 61c0 10.493 8.507 19 19 19h60c11.598 0 21-9.402 21-21 0-10.264-7.366-18.812-17.1-20.643C82.3 36.557 81.3 39.2 80 42z" fill="url(#cloudGrad)" />
              {/* Brain/neural network paths inside cloud */}
              <circle cx="50" cy="48" r="6" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.5"/>
              <circle cx="38" cy="52" r="4" fill="none" stroke="#fff" strokeWidth="1" opacity="0.4"/>
              <circle cx="62" cy="52" r="4" fill="none" stroke="#fff" strokeWidth="1" opacity="0.4"/>
              <circle cx="44" cy="40" r="3.5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.4"/>
              <circle cx="56" cy="40" r="3.5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.4"/>
              <circle cx="50" cy="60" r="3" fill="none" stroke="#fff" strokeWidth="1" opacity="0.3"/>
              {/* Connecting lines */}
              <line x1="44" y1="40" x2="50" y2="48" stroke="#fff" strokeWidth="0.8" opacity="0.3"/>
              <line x1="56" y1="40" x2="50" y2="48" stroke="#fff" strokeWidth="0.8" opacity="0.3"/>
              <line x1="38" y1="52" x2="50" y2="48" stroke="#fff" strokeWidth="0.8" opacity="0.3"/>
              <line x1="62" y1="52" x2="50" y2="48" stroke="#fff" strokeWidth="0.8" opacity="0.3"/>
              <line x1="50" y1="48" x2="50" y2="60" stroke="#fff" strokeWidth="0.8" opacity="0.3"/>
              <line x1="44" y1="40" x2="56" y2="40" stroke="#fff" strokeWidth="0.6" opacity="0.2"/>
              <line x1="38" y1="52" x2="62" y2="52" stroke="#fff" strokeWidth="0.6" opacity="0.2"/>
              {/* Small dots at nodes */}
              <circle cx="50" cy="48" r="2" fill="#fff" opacity="0.6"/>
              <circle cx="38" cy="52" r="1.5" fill="#fff" opacity="0.4"/>
              <circle cx="62" cy="52" r="1.5" fill="#fff" opacity="0.4"/>
              <circle cx="44" cy="40" r="1.5" fill="#fff" opacity="0.4"/>
              <circle cx="56" cy="40" r="1.5" fill="#fff" opacity="0.4"/>
              <defs>
                <linearGradient id="cloudGrad" x1="50" y1="14" x2="50" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ff4444" />
                  <stop offset="0.5" stopColor="#cc2222" />
                  <stop offset="1" stopColor="#991111" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
          Your Personal AI Agent
          <br />
          Built for What&apos;s Next
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-[#888] sm:text-lg">
          MEDO is an intelligent personal assistant with memory, skills, and proactive insights.
          Deploy locally, own your data, and experience AI that truly knows you.
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
            href="#features"
            className="rounded-lg border border-[#333] bg-transparent px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-[#ff3333]/30 hover:bg-[#ff3333]/5 hover:shadow-[0_0_15px_rgba(255,51,51,0.1)] active:scale-[0.97]"
          >
            Learn More
          </a>
        </div>

        {/* Red horizontal line divider */}
        <div className="mx-auto mt-16 h-px w-full max-w-3xl bg-gradient-to-r from-transparent via-[#ff3333]/40 to-transparent" />

        {/* Feature highlights */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
          {[
            { name: "Memory System", icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
            )},
            { name: "Smart Skills", icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            )},
            { name: "Proactive AI", icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            )},
            { name: "Multi-Channel", icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            )},
            { name: "Privacy First", icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )},
          ].map((item) => (
            <a
              key={item.name}
              href="#features"
              className="group flex items-center gap-2 text-[#666] transition-all duration-300 hover:text-[#ff3333]"
            >
              <span className="transition-all duration-300 group-hover:drop-shadow-[0_0_6px_rgba(255,51,51,0.4)]">
                {item.icon}
              </span>
              <span className="text-sm font-semibold tracking-wider transition-all duration-300 group-hover:text-[#ff3333]">
                {item.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
