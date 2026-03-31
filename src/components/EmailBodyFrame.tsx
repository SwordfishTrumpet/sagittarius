import { useEffect, useMemo, useRef } from 'react'
import { jmapClient } from '../api/jmap'

interface EmailBodyFrameProps {
  html: string
}

export function buildSrcDoc(html: string): string {
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
  <body>${html}</body>
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
          .catch(() => {
            if (cancelled) return
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

  return (
    <iframe
      ref={iframeRef}
      title="Email body"
      sandbox="allow-same-origin allow-popups"
      srcDoc={srcDoc}
      className="w-full border-0 bg-transparent"
      scrolling="no"
    />
  )
}
