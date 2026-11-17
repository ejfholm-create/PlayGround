#!/usr/bin/env bash
set -euo pipefail

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to the evidence output directory}"
RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
PLAYWRIGHT_HOME="${HOME}/.local/share/omgithub-playwright"

run() { /usr/bin/time -p "$@"; }
run mkdir -p "$CAPTURE_DIR"

run node --input-type=module - <<'NODE'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const output = process.env.CAPTURE_DIR
const rawUrl = process.env.CAPTURE_URL
const runtime = process.env.RUNTIME_DIR || '/home/runner/work/_temp/omgithub-runtime'
const home = process.env.HOME
const infra = error => Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: 75 })
let url
let browser
let exitCode = 0

try {
  url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('CAPTURE_URL must use HTTP or HTTPS.')
  const playwrightHome = join(home, '.local/share/omgithub-playwright')
  const require = createRequire(join(playwrightHome, 'package.json'))
  const { chromium } = require('playwright')
  const configPath = join(playwrightHome, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  if (process.platform === 'linux') process.env.DISPLAY ||= ':' + readFileSync(join(playwrightHome, 'display'), 'utf8').trim()
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(infra)

  for (const [name, width, height, isMobile] of [
    ['desktop', 1280, 800, false],
    ['mobile', 390, 844, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: isMobile ? 1 : 1,
      isMobile,
      hasTouch: isMobile,
    }).catch(infra)
    const page = await context.newPage().catch(infra)
    page.setDefaultTimeout(30000)
    const defects = []
    page.on('pageerror', error => defects.push(`page error: ${error.message}`))
    page.on('response', response => {
      try {
        if (response.status() >= 400 && new URL(response.url()).origin === url.origin) {
          defects.push(`HTTP ${response.status()}: ${response.url()}`)
        }
      } catch {}
    })

    let response
    try {
      response = await page.goto(rawUrl, { waitUntil: 'load', timeout: 45000 })
    } catch (error) {
      throw infra(error)
    }
    if (!response?.ok()) {
      const status = response?.status()
      const transient = !response || [408, 429, 500, 502, 503, 504].includes(status)
      throw Object.assign(new Error(`Unable to load ${rawUrl} (HTTP ${status ?? 'no response'}).`), { exitCode: transient ? 75 : 1 })
    }

    try {
      await page.locator(process.env.CAPTURE_READY_SELECTOR || 'body').waitFor({ state: 'visible' })
      await page.evaluate(() => document.fonts?.ready)
      await page.waitForTimeout(1000)
      const rendered = await page.evaluate(() => {
        const body = document.body
        if (!body) return false
        const text = (body.innerText || '').trim()
        const canvas = [...document.querySelectorAll('canvas')].some(element => {
          const box = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        })
        const visibleImage = [...document.images].some(image => image.complete && image.naturalWidth > 0)
        return Boolean(text || canvas || visibleImage)
      })
      if (!rendered) throw new Error(`Rendering defect: ${name} page has no visible text, canvas, or loaded image.`)
      if (defects.length) throw new Error(`Rendering defect: ${defects.join('; ')}`)
      await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 })
      console.log(`Captured ${name} view (${width}x${height}) at ${rawUrl}`)
    } catch (error) {
      if (error?.name === 'TimeoutError' || !browser.isConnected()) throw infra(error)
      throw error
    } finally {
      await context.close().catch(error => { throw infra(error) })
    }
  }
} catch (error) {
  console.error(error)
  exitCode = error?.exitCode || 1
} finally {
  if (browser) {
    try { await browser.close() }
    catch (error) { console.error(error); exitCode ||= 75 }
  }
}
process.exitCode = exitCode
NODE
