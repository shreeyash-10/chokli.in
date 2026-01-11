"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { cls } from "./utils"

const SLIDE_INTERVAL_MS = 6000

export default function LandingSlideshow({ slides = [] }) {
  const [index, setIndex] = useState(0)
  const total = slides.length
  const progressWidth = useMemo(() => {
    if (total <= 1) return "100%"
    return `${((index + 1) / total) * 100}%`
  }, [index, total])

  useEffect(() => {
    if (total <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % total)
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [total])

  return (
    <main className="relative h-screen w-full overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0">
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.src}
            className={cls(
              "absolute inset-0 transition-opacity duration-1000 ease-in-out",
              slideIndex === index ? "opacity-100" : "opacity-0",
            )}
          >
            <img src={slide.src} alt={slide.alt} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

      <div className="relative z-10 flex h-full w-full flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-200">chokli.in</div>
          <Link
            href="/chat"
            className="rounded-full border border-white/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 transition hover:border-white hover:text-white"
          >
            Enter chat
          </Link>
        </header>

        <div className="flex flex-1 items-center px-6 md:px-10">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-200">Savage edition</div>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
              Stats get checked here.
            </h1>
            <p className="mt-4 max-w-xl text-sm text-zinc-200 sm:text-base">
              Debunking Kohli stats one agenda at a time. Context wins. Receipts only.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                className="rounded-full bg-white px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-900 transition hover:bg-zinc-200"
              >
                Enter Chokli AI
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 md:px-10">
          <div className="mb-2 text-[11px] uppercase tracking-[0.35em] text-zinc-300">
            {total ? "Current slide" : "No slides detected"}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white/90 transition-all duration-500" style={{ width: progressWidth }} />
          </div>
          {!total && (
            <div className="mt-3 text-xs text-zinc-300">
              Add images to <span className="font-semibold">/public/slides</span> to enable the slideshow.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
