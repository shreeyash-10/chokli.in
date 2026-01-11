import LandingSlideshow from "../components/LandingSlideshow"
import { readdir } from "node:fs/promises"
import path from "node:path"

async function getSlides() {
  const dir = path.join(process.cwd(), "public", "slides")
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name))
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({
        src: `/slides/${name}`,
        alt: `Slide ${index + 1}`,
      }))
  } catch {
    return []
  }
}

export default async function Page() {
  const slides = await getSlides()
  return <LandingSlideshow slides={slides} />
}
