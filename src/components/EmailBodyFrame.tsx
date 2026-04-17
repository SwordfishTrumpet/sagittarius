import { useEffect, useMemo, useRef } from 'react'
import { jmapClient } from '../api/jmap'
import { logger } from '../utils/logger'
import { getCsrfToken, getCsrfHeaderName } from '../utils/csrf'

interface EmailBodyFrameProps {
  html: string
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

export function buildSrcDoc(html: string): string {
  const displayHtml = normalizeDisplayHtml(html)

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
      }

      body {
        color: #1C1C1E;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
        font-size: 15px;
        line-height: 1.625;
        overflow-wrap: anywhere;
        word-break: break-word;
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

export function EmailBodyFrame({ html }: EmailBodyFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const srcDoc = useMemo(() => buildSrcDoc(html), [html])

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
        const downloadUrl = img.getAttribute('src')
        if (!downloadUrl || downloadUrl.startsWith('blob:') || !isTrustedJmapDownloadUrl(downloadUrl)) return

        img.style.opacity = '0.5'

        fetch(downloadUrl, {
          headers: { 
            Authorization: authHeader,
            [getCsrfHeaderName()]: getCsrfToken(), // CSRF protection (VULN-006)
          },
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
