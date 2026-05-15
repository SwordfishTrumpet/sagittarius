import DOMPurify from 'dompurify'
import type { IdentityData } from '../hooks/useIdentityActions'

type SignatureIdentity = Pick<IdentityData, 'textSignature' | 'htmlSignature'> & {
  id?: string | null
}

const SIGNATURE_SELECTOR = '[data-sagittarius-signature="1"]'
const SIGNATURE_SPACER_SELECTOR = '[data-sagittarius-signature-spacer="1"]'
const QUOTE_SELECTOR = '[data-sagittarius-quote="1"]'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildIdentitySignatureMarkup(identity?: SignatureIdentity | null): string {
  const htmlSignature = identity?.htmlSignature?.trim()
  if (htmlSignature) {
    return DOMPurify.sanitize(htmlSignature)
  }

  const textSignature = identity?.textSignature?.trim()
  if (!textSignature) {
    return ''
  }

  return textSignature
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br/>')
}

function hasMeaningfulContentBefore(container: HTMLDivElement, referenceNode: Element | null): boolean {
  for (const node of Array.from(container.childNodes)) {
    if (referenceNode && node === referenceNode) {
      return false
    }

    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true
    }

    if (node instanceof HTMLElement) {
      if (node.matches(SIGNATURE_SELECTOR) || node.matches(SIGNATURE_SPACER_SELECTOR)) {
        continue
      }

      if (node.textContent?.trim()) {
        return true
      }
    }
  }

  return false
}

export function upsertIdentitySignature(bodyHtml: string, identity?: SignatureIdentity | null): string {
  // Use globalThis.document to get the current value (not cached at module load)
  const doc = globalThis.document
  if (!doc) {
    return bodyHtml
  }

  const documentForParsing = doc.implementation.createHTMLDocument('signature')
  const container = documentForParsing.createElement('div')
  container.innerHTML = bodyHtml || ''

  container.querySelectorAll(`${SIGNATURE_SELECTOR}, ${SIGNATURE_SPACER_SELECTOR}`).forEach((node) => node.remove())

  const signatureMarkup = buildIdentitySignatureMarkup(identity)
  const quoteNode = container.querySelector(QUOTE_SELECTOR)

  if (!hasMeaningfulContentBefore(container, quoteNode)) {
    const spacer = documentForParsing.createElement('p')
    spacer.setAttribute('data-sagittarius-signature-spacer', '1')
    spacer.appendChild(documentForParsing.createElement('br'))

    if (quoteNode) {
      container.insertBefore(spacer, quoteNode)
    } else {
      container.appendChild(spacer)
    }
  }

  if (!signatureMarkup) {
    return container.innerHTML
  }

  const signature = documentForParsing.createElement('div')
  signature.setAttribute('data-sagittarius-signature', '1')
  if (identity?.id) {
    signature.setAttribute('data-identity-id', identity.id)
  }
  signature.style.margin = '12px 0 16px'
  signature.innerHTML = signatureMarkup

  const insertionPoint = container.querySelector(QUOTE_SELECTOR)
  if (insertionPoint) {
    container.insertBefore(signature, insertionPoint)
  } else {
    container.appendChild(signature)
  }

  return container.innerHTML
}
