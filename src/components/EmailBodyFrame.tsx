import { useEffect, useMemo, useRef } from 'react'
import { jmapClient } from '../api/jmap'
import { logger } from '../utils/logger'
import { useFontPreference } from '../hooks/useFontPreference'

interface EmailBodyFrameProps {
  html: string
  darkMode?: boolean
}

const structuralTags = new Set([
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
])

export function stripDisplayArtifacts(root: ParentNode): void {
  root.querySelectorAll?.('title, meta, link').forEach(node => node.remove())

  const isWhitespaceText = (node: ChildNode | null): boolean => (
    node?.nodeType === Node.TEXT_NODE && !node.textContent?.replace(/\u00a0/g, '').trim()
  )

  const isBreak = (node: ChildNode | null): node is HTMLBRElement => (
    !!node && node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR'
  )

  const isStructuralNode = (node: ChildNode | null): boolean => (
    !!node && node.nodeType === Node.ELEMENT_NODE && structuralTags.has((node as Element).tagName)
  )

  const getPreviousMeaningfulNode = (nodes: ChildNode[], startIndex: number): ChildNode | null => {
    for (let index = startIndex; index >= 0; index -= 1) {
      if (!isWhitespaceText(nodes[index])) return nodes[index]
    }

    return null
  }

  const getNextMeaningfulNode = (nodes: ChildNode[], startIndex: number): ChildNode | null => {
    for (let index = startIndex; index < nodes.length; index += 1) {
      if (!isWhitespaceText(nodes[index])) return nodes[index]
    }

    return null
  }

  const parents = [root, ...Array.from(root.querySelectorAll?.('*') || [])]
  parents.forEach(parent => {
    const childNodes = Array.from(parent.childNodes)

    for (let index = 0; index < childNodes.length; index += 1) {
      if (!isBreak(childNodes[index])) continue

      const breakRun: HTMLBRElement[] = [childNodes[index] as HTMLBRElement]
      let nextIndex = index + 1

      while (nextIndex < childNodes.length) {
        const candidate = childNodes[nextIndex]
        if (isWhitespaceText(candidate)) {
          nextIndex += 1
          continue
        }

        if (!isBreak(candidate)) break
        breakRun.push(candidate)
        nextIndex += 1
      }

      const previousMeaningfulNode = getPreviousMeaningfulNode(childNodes, index - 1)
      const nextMeaningfulNode = getNextMeaningfulNode(childNodes, nextIndex)
      const shouldRemoveEntireRun = (
        !previousMeaningfulNode
        || !nextMeaningfulNode
        || isStructuralNode(previousMeaningfulNode)
        || isStructuralNode(nextMeaningfulNode)
      )

      if (shouldRemoveEntireRun) {
        breakRun.forEach(node => node.remove())
      } else {
        breakRun.slice(2).forEach(node => node.remove())
      }

      index = nextIndex - 1
    }
  })
}

export function normalizeDisplayHtml(html: string): string {
  if (!html) return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  stripDisplayArtifacts(doc.body)
  return doc.body.innerHTML
}

export function buildSrcDoc(
  html: string,
  darkMode = false,
  monospaceFontFamily?: string
): string {
  const displayHtml = normalizeDisplayHtml(html)

  const darkModeStyles = darkMode ? `
      color-scheme: dark;
      background: #434349;
      color: rgba(255, 255, 255, 0.98);

      /* Fix form elements in dark mode */
      input, textarea, select {
        color-scheme: dark;
      }

      /* Ensure links use accent color but don't clobber custom link colors */
      a:not([style*="color"]) {
        color: #009aff;
      }

      a:hover:not([style*="color"]) {
        color: #33b5ff;
      }

      /* Pre/code blocks need explicit dark styling */
      pre, code {
        background-color: #2c2c2e;
        color: rgba(255, 255, 255, 0.92);
      }

      /* Quoted text - subtle styling */
      blockquote {
        border-left: 2px solid #48484a;
        color: rgba(255, 255, 255, 0.66);
        margin: 0 0 8px 0;
        padding: 0 0 0 12px;
      }

      /* Tables often have hardcoded light borders */
      table {
        border-color: #48484a;
      }
  ` : `
      color-scheme: light;
      background: #ffffff;
      color: rgba(0, 0, 0, 0.88);
  `

  const monoFont = monospaceFontFamily || 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

  return `<!doctype html>
<html${darkMode ? ' class="dark"' : ''}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      :root {
        --icloud-text-primary: ${darkMode ? 'rgba(255, 255, 255, 0.98)' : 'rgba(0, 0, 0, 0.88)'};
        --icloud-text-secondary: ${darkMode ? 'rgba(255, 255, 255, 0.66)' : 'rgba(0, 0, 0, 0.56)'};
        --icloud-text-tertiary: ${darkMode ? 'rgba(255, 255, 255, 0.50)' : 'rgba(0, 0, 0, 0.48)'};
        --icloud-accent: ${darkMode ? '#009aff' : '#0071e3'};
        --icloud-border: ${darkMode ? '#343436' : '#d1d1d6'};
        --icloud-red: ${darkMode ? '#ff2d55' : '#e30000'};
        --icloud-green: ${darkMode ? '#32d158' : '#03a10e'};
      }

      *, *::before, *::after { box-sizing: border-box; }

      html, body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', sans-serif;
        font-size: 16px;
        line-height: 1.5;
        overflow-wrap: anywhere;
        word-break: break-word;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      body {
        ${darkModeStyles}
      }

      /* Ensure heading hierarchy works when email content doesn't specify */
      h1 { font-size: 1.375em; }
      h2 { font-size: 1.25em; }
      h3 { font-size: 1.125em; }
      h4 { font-size: 1em; }

      pre, code, kbd, samp {
        font-family: ${monoFont};
      }
    </style>
  </head>
  <body>${displayHtml}</body>
</html>`
}

export function isTrustedJmapDownloadUrl(downloadUrl: string): boolean {
  const session = jmapClient.getSession()
  if (!session?.downloadUrl) return false

  try {
    const candidate = new URL(downloadUrl, window.location.href)
    const template = new URL(
      session.downloadUrl
        .replace('{accountId}', '__ACCOUNT__')
        .replace('{blobId}', '__BLOB__')
        .replace('{name}', '__NAME__')
        .replace('{type}', '__TYPE__'),
      window.location.href,
    )

    if (candidate.origin !== template.origin) return false

    const [pathPrefix] = template.pathname.split('__ACCOUNT__')
    if (pathPrefix && !candidate.pathname.startsWith(pathPrefix)) return false

    return true
  } catch {
    return false
  }
}

export function EmailBodyFrame({ html, darkMode = false }: EmailBodyFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { font } = useFontPreference()
  const srcDoc = useMemo(() => buildSrcDoc(html, darkMode, font.family), [html, darkMode, font.family])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    let cancelled = false
    const objectUrls: string[] = []
    const cleanups: Array<() => void> = []
    let resizeObserver: ResizeObserver | null = null

    const setHeight = () => {
      const doc = iframe.contentDocument
      if (!doc) return

      const body = doc.body
      const root = doc.documentElement
      const nextHeight = Math.max(
        body?.scrollHeight || 0,
        body?.offsetHeight || 0,
        root?.scrollHeight || 0,
        root?.offsetHeight || 0,
      )

      iframe.style.height = `${Math.max(nextHeight, 1)}px`
    }

    const hydrateFrame = () => {
      const doc = iframe.contentDocument
      if (!doc) return

      if (doc.body) {
        stripDisplayArtifacts(doc.body)
      }

      setHeight()

      const images = Array.from(doc.images)
      images.forEach(img => {
        const onLoad = () => setHeight()
        const onError = () => setHeight()
        img.addEventListener('load', onLoad)
        img.addEventListener('error', onError)
        cleanups.push(() => {
          img.removeEventListener('load', onLoad)
          img.removeEventListener('error', onError)
        })
      })

      if (typeof ResizeObserver !== 'undefined' && doc.body) {
        resizeObserver = new ResizeObserver(() => setHeight())
        resizeObserver.observe(doc.body)
      }

      const authHeader = jmapClient.getAuthHeader()
      if (!authHeader) return

      const cidImages = Array.from(doc.querySelectorAll<HTMLImageElement>('img[data-cid-src]'))
      cidImages.forEach(img => {
        const downloadUrl = img.getAttribute('data-cid-src')
        if (!downloadUrl || downloadUrl.startsWith('blob:') || !isTrustedJmapDownloadUrl(downloadUrl)) return

        img.style.opacity = '0.5'

        // Note: CSRF token is NOT included here - blob download uses Basic Auth only
        fetch(downloadUrl, {
          headers: { Authorization: authHeader },
        })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.blob()
          })
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob)
            objectUrls.push(blobUrl)
            if (cancelled) return
            img.src = blobUrl
            img.style.opacity = ''
            setHeight()
          })
          .catch((err) => {
            if (cancelled) return
            logger.warn('[EmailBodyFrame] Failed to load CID image:', { src: downloadUrl, error: err })
            img.style.opacity = ''
            setHeight()
          })
      })
    }

    const onLoad = () => hydrateFrame()
    iframe.addEventListener('load', onLoad)

    if (iframe.contentDocument?.readyState === 'complete') {
      hydrateFrame()
    }

    return () => {
      cancelled = true
      iframe.removeEventListener('load', onLoad)
      resizeObserver?.disconnect()
      cleanups.forEach(fn => fn())
      objectUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [srcDoc])

  // Use srcDoc as key to force iframe remount when content changes.
  // Browsers don't reliably re-render iframe content when srcDoc attribute
  // changes on an existing element - this ensures fresh render.
  return (
    <iframe
      key={srcDoc}
      ref={iframeRef}
      title="Email body"
      sandbox="allow-same-origin allow-popups"
      srcDoc={srcDoc}
      className="w-full border-0 bg-transparent"
      scrolling="no"
    />
  )
}
