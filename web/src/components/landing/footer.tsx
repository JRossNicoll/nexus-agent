import Link from "next/link"

const footerLinks: Record<string, string[]> = {
  Product: ["Deploy", "Providers", "Pricing", "GPU Marketplace", "Status"],
  Developers: ["Documentation", "CLI Guide", "API Reference", "SDL Guide", "GitHub"],
  Community: ["Discord", "Twitter", "Telegram", "Forum", "Blog"],
  Company: ["About", "Careers", "Brand", "Press", "Contact"],
}

export default function Footer() {
  return (
    <footer className="relative border-t border-[#1a1a1a] bg-gradient-to-b from-[#0a0a0a] to-[#0e0808]">
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff3333]/25 to-transparent" />
      <div className="absolute left-1/2 top-0 h-20 w-96 -translate-x-1/2 bg-[#ff3333]/5 blur-[60px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/" className="group flex items-center gap-2 transition-opacity hover:opacity-90">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 22h20L12 2z" fill="#ff3333" />
                <path d="M12 9l-3 6h6l-3-6z" fill="#0a0a0a" />
              </svg>
              <span className="text-lg font-bold text-white">NEXUS</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#555]">
              The world&apos;s first decentralized cloud computing marketplace, powering the future of AI infrastructure.
            </p>
            <div className="mt-6 flex gap-3">
              <SocialIcon label="Twitter">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </SocialIcon>
              <SocialIcon label="Discord">
                <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.618-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.11 13.11 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.099.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.076.076 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.078.078 0 00.032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.029z"/>
              </SocialIcon>
              <SocialIcon label="GitHub">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </SocialIcon>
              <SocialIcon label="Telegram">
                <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </SocialIcon>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 text-sm font-semibold text-white">{category}</h3>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link}>
                    <Link href="#" className="text-sm text-[#555] transition-colors duration-200 hover:text-[#ff3333]">
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[#1a1a1a] pt-8 sm:flex-row">
          <p className="text-xs text-[#444]">
            {"NEXUS Network \u00A9 2024. The NEXUS Network Authors. All rights reserved."}
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-xs text-[#444] transition-colors duration-200 hover:text-[#ff3333]">Privacy Policy</Link>
            <Link href="#" className="text-xs text-[#444] transition-colors duration-200 hover:text-[#ff3333]">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SocialIcon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <a
      href="#"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1f1f1f] text-[#555] transition-all duration-200 hover:border-[#ff3333]/30 hover:text-[#ff3333] hover:shadow-[0_0_12px_rgba(255,51,51,0.15)]"
      aria-label={label}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        {children}
      </svg>
    </a>
  )
}
