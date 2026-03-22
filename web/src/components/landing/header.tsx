"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Workloads", href: "#workloads" },
  { label: "Apps", href: "#apps" },
  { label: "Docs", href: "#" },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-2xl">
      {/* Thin red embedded bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ff3333]/30 to-transparent" />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="group flex items-center gap-1.5 transition-opacity hover:opacity-90">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 22h20L12 2z" fill="#ff3333" />
            <path d="M12 9l-3 6h6l-3-6z" fill="#0a0a0a" />
          </svg>
          <span className="text-base font-bold tracking-tight text-white">NEXUS</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="relative text-[13px] text-[#888] transition-colors duration-200 hover:text-white after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-[#ff3333]/50 after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="#get-started"
            className="rounded-md bg-[#ff3333] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-[#e62e2e] hover:shadow-[0_0_20px_rgba(255,51,51,0.3)] active:scale-[0.97]"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "#app";
              window.dispatchEvent(new HashChangeEvent("hashchange"));
            }}
          >
            Get Started
          </Link>
        </div>

        <button
          className="text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#ff3333]/10 bg-[#0a0a0a]/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-[#888] transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="#app"
              className="mt-2 rounded-md bg-[#ff3333] px-4 py-2 text-center text-sm font-semibold text-white"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = "#app";
                window.dispatchEvent(new HashChangeEvent("hashchange"));
              }}
            >
              Get Started
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
