const workloads = [
  {
    title: "Real-time AI Inference",
    description: "Deploy and scale AI inference workloads with high-performance GPU resources at a fraction of the cost.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="14" y="14" width="20" height="20" rx="3" stroke="#ff3333" strokeWidth="1.5" fill="none"/>
        <rect x="18" y="18" width="12" height="12" rx="1.5" stroke="#ff3333" strokeWidth="1" fill="none" opacity="0.6"/>
        <line x1="18" y1="14" x2="18" y2="10" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="24" y1="14" x2="24" y2="10" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="30" y1="14" x2="30" y2="10" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="18" y1="34" x2="18" y2="38" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="24" y1="34" x2="24" y2="38" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="30" y1="34" x2="30" y2="38" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="14" y1="18" x2="10" y2="18" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="14" y1="24" x2="10" y2="24" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="14" y1="30" x2="10" y2="30" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="34" y1="18" x2="38" y2="18" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="34" y1="24" x2="38" y2="24" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="34" y1="30" x2="38" y2="30" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <circle cx="24" cy="24" r="2" fill="#ff3333" opacity="0.7"/>
      </svg>
    ),
  },
  {
    title: "Generative AI Applications",
    description: "Build and deploy generative AI applications with access to scalable compute resources on demand.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="10" y="8" width="28" height="22" rx="3" stroke="#ff3333" strokeWidth="1.5" fill="none"/>
        <line x1="18" y1="30" x2="18" y2="36" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="30" y1="30" x2="30" y2="36" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <line x1="15" y1="36" x2="33" y2="36" stroke="#ff3333" strokeWidth="1.2" opacity="0.5"/>
        <circle cx="20" cy="18" r="1.5" fill="#ff3333" opacity="0.6"/>
        <circle cx="28" cy="18" r="1.5" fill="#ff3333" opacity="0.6"/>
        <path d="M20 23c0 0 2 2 4 2s4-2 4-2" stroke="#ff3333" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round"/>
        <line x1="24" y1="8" x2="24" y2="5" stroke="#ff3333" strokeWidth="1" opacity="0.5"/>
        <circle cx="24" cy="4" r="1" fill="#ff3333" opacity="0.5"/>
      </svg>
    ),
  },
  {
    title: "Large Language Models",
    description: "Train and fine-tune large language models with distributed GPU clusters on the decentralized cloud.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 8c-4 0-7 2-8.5 4.5C13 13 11 15 11 18c0 2.5 1 4.5 2.5 6-1 1.5-1.5 3.5-1.5 5.5 0 4 3 7.5 7 8v-3" stroke="#ff3333" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M24 8c4 0 7 2 8.5 4.5C35 13 37 15 37 18c0 2.5-1 4.5-2.5 6 1 1.5 1.5 3.5 1.5 5.5 0 4-3 7.5-7 8v-3" stroke="#ff3333" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <line x1="24" y1="10" x2="24" y2="37" stroke="#ff3333" strokeWidth="0.8" opacity="0.3"/>
        <path d="M18 16h12M16 22h16M18 28h12" stroke="#ff3333" strokeWidth="0.8" opacity="0.3" strokeLinecap="round"/>
        <circle cx="24" cy="16" r="1.5" fill="#ff3333" opacity="0.5"/>
        <circle cx="24" cy="22" r="1.5" fill="#ff3333" opacity="0.5"/>
        <circle cx="24" cy="28" r="1.5" fill="#ff3333" opacity="0.5"/>
      </svg>
    ),
  },
]

export default function WorkloadsSection() {
  return (
    <section className="relative py-24">
      {/* Top divider */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#222] to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">
            Optimized for AI & Data Workloads
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-[#888] sm:text-base">
            NEXUS is a Decentralized Cloud that provides fast, efficient, and low-cost
            compute resources for AI/ML, data analytics, and more.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {workloads.map((item, i) => (
            <div
              key={i}
              className="group cursor-default text-center transition-all duration-300"
            >
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_rgba(255,51,51,0.3)]">
                  {item.icon}
                </div>
              </div>
              <h3 className="mb-3 text-lg font-semibold text-white transition-colors duration-300 group-hover:text-[#ff5555]">{item.title}</h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-[#777]">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
