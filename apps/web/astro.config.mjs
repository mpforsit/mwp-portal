// @ts-check
import { defineConfig } from 'astro/config'

// SSG-first: vollständiger Content muss im Initial-HTML stehen
// (KI-Crawler rendern kein JS) — kein Server-Output ohne ADR.
export default defineConfig({
  output: 'static',
})
