import { ExternalLink } from "lucide-react"

const apps = [
  {
    title: "Run AI Inference Instantly",
    description: "Access powerful GPU compute for real-time AI inference without the overhead of traditional cloud providers.",
    link: "#",
  },
  {
    title: "Deploy with NEXUS Deploy",
    description: "Simplified deployment experience with one-click templates and an intuitive dashboard for managing workloads.",
    link: "#",
  },
  {
    title: "Create DApps on NEXUS",
    description: "Build and deploy decentralized applications with persistent storage, custom domains, and scalable infrastructure.",
    link: "#",
  },
]

function NexusFanLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 22h20L12 2z" fill="#ff3333" />
        <path d="M12 9l-3 6h6l-3-6z" fill="#1a0808" />
      </svg>
      <span className="text-sm font-bold text-white">nexus<span className="text-[#ff3333]">.</span>fan</span>
    </div>
  )
}

export default function AppsSection() {
  return (
    <section className="relative py-24">
      {/* Top divider */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#222] to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">
            NEXUS Apps
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-[#888] sm:text-base">
            Explore the suite of apps for deploying, managing, and monitoring your
            decentralized cloud infrastructure.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app, i) => (
            <div key={i} className="group overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] transition-all duration-300 hover:border-[#ff3333]/25 hover:shadow-[0_0_30px_rgba(255,51,51,0.06)]">
              {/* Card header image area */}
              <div className="relative h-44 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#180a0a] via-[#120808] to-[#0d0d0d]" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
                  backgroundImage: `linear-gradient(rgba(255,51,51,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,51,51,0.5) 1px, transparent 1px)`,
                  backgroundSize: '28px 28px'
                }} />
                <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{
                  backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,51,51,0.1) 3px, rgba(255,51,51,0.1) 4px)`,
                }} />
                <div className="absolute left-1/2 top-1/2 h-20 w-40 -translate-x-1/2 -translate-y-1/2 bg-[#ff3333]/12 blur-[50px] transition-all duration-500 group-hover:bg-[#ff3333]/[0.16]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <NexusFanLogo />
                </div>
                <div className="absolute bottom-0 left-1/2 z-10 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#ff3333]/25 to-transparent" />
              </div>

              <div className="p-6">
                <h3 className="mb-2 text-base font-semibold text-white transition-colors duration-300 group-hover:text-[#ff5555]">{app.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-[#777]">{app.description}</p>
                <a
                  href={app.link}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ff3333] transition-all duration-200 hover:text-[#ff5555] hover:gap-2"
                >
                  Learn more <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
