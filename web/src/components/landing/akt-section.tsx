export default function AktSection() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="group relative overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] transition-all duration-300 hover:border-[#ff3333]/20 hover:shadow-[0_0_40px_rgba(255,51,51,0.05)]">
          {/* Top image area with token visual */}
          <div className="relative flex h-56 items-center justify-center overflow-hidden sm:h-64">
            <div className="absolute inset-0 bg-gradient-to-b from-[#180a0a] via-[#120808] to-[#0d0d0d]" />
            <div className="absolute left-1/2 top-1/2 h-40 w-80 -translate-x-1/2 -translate-y-1/2 bg-[#ff3333]/12 blur-[80px] transition-all duration-500 group-hover:bg-[#ff3333]/[0.16]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(rgba(255,51,51,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,51,51,0.4) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }} />
            <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,51,51,0.1) 3px, rgba(255,51,51,0.1) 4px)`,
            }} />

            {/* NXT Token visual */}
            <div className="relative z-10">
              <div className="absolute -inset-8 rounded-full bg-[#ff3333]/20 blur-[40px] transition-all duration-500 group-hover:bg-[#ff3333]/25" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#ff3333]/40 bg-gradient-to-b from-[#ff3333]/20 to-[#ff3333]/5 shadow-[0_0_40px_rgba(255,51,51,0.3)] transition-all duration-300 group-hover:border-[#ff3333]/60 group-hover:shadow-[0_0_50px_rgba(255,51,51,0.4)]">
                <span className="text-3xl font-bold text-[#ff3333]">N</span>
              </div>
            </div>

            <div className="absolute bottom-0 left-1/2 z-10 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#ff3333]/30 to-transparent" />
          </div>

          {/* Text content */}
          <div className="relative px-8 pb-12 pt-8 text-center sm:px-16">
            <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">
              NXT: The Fuel Behind MEDO
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-[#888] sm:text-base">
              NXT is the native utility token of the MEDO Network, used for governance, staking,
              and as the primary settlement currency for cloud compute resources. It powers the
              decentralized marketplace and incentivizes network participants.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#"
                className="rounded-lg bg-[#ff3333] px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#e62e2e] hover:shadow-[0_0_30px_rgba(255,51,51,0.4)] active:scale-[0.97]"
              >
                Get NXT
              </a>
              <a
                href="#"
                className="rounded-lg border border-[#333] bg-transparent px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-[#ff3333]/30 hover:bg-[#ff3333]/5 hover:shadow-[0_0_15px_rgba(255,51,51,0.1)] active:scale-[0.97]"
              >
                Token Economics
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
