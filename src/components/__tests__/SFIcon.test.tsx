import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  SFReply,
  SFReplyAll,
  SFForward,
  SFFlag,
  SFArchive,
  SFTrash,
  SFStar,
} from '../SFIcon'

describe('SFIcon', () => {
  it('renders SFReply with correct attributes', () => {
    render(<SFReply className="reply-icon" />)
    const svg = document.querySelector('svg.reply-icon')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.querySelectorAll('path')).toHaveLength(2)
  })

  it('renders SFReplyAll with correct attributes', () => {
    render(<SFReplyAll className="reply-all-icon" />)
    const svg = document.querySelector('svg.reply-all-icon')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelectorAll('path')).toHaveLength(3)
  })

  it('renders SFForward with correct attributes', () => {
    render(<SFForward className="forward-icon" />)
    const svg = document.querySelector('svg.forward-icon')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelectorAll('path')).toHaveLength(2)
  })

  it('renders SFFlag unfilled by default', () => {
    render(<SFFlag className="flag-icon" />)
    const svg = document.querySelector('svg.flag-icon')
    expect(svg).toHaveAttribute('fill', 'none')
  })

  it('renders SFFlag filled when filled=true', () => {
    render(<SFFlag className="flag-filled-icon" filled />)
    const svg = document.querySelector('svg.flag-filled-icon')
    expect(svg).toHaveAttribute('fill', 'currentColor')
  })

  it('renders SFArchive with correct elements', () => {
    render(<SFArchive className="archive-icon" />)
    const svg = document.querySelector('svg.archive-icon')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelectorAll('path')).toHaveLength(2)
    expect(svg?.querySelector('rect')).toBeInTheDocument()
  })

  it('renders SFTrash with correct elements', () => {
    render(<SFTrash className="trash-icon" />)
    const svg = document.querySelector('svg.trash-icon')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelectorAll('path')).toHaveLength(3)
    expect(svg?.querySelectorAll('line')).toHaveLength(2)
  })

  it('renders SFStar unfilled by default', () => {
    render(<SFStar className="star-icon" />)
    const svg = document.querySelector('svg.star-icon')
    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg?.querySelector('polygon')).toBeInTheDocument()
  })

  it('renders SFStar filled when filled=true', () => {
    render(<SFStar className="star-filled-icon" filled />)
    const svg = document.querySelector('svg.star-filled-icon')
    expect(svg).toHaveAttribute('fill', 'currentColor')
  })

  it('applies custom className', () => {
    render(<SFReply className="my-icon" />)
    const svg = document.querySelector('svg.my-icon')
    expect(svg).toBeInTheDocument()
  })

  it('applies custom strokeWidth', () => {
    render(<SFReply className="stroke-icon" strokeWidth={2.5} />)
    const svg = document.querySelector('svg.stroke-icon')
    expect(svg).toHaveAttribute('stroke-width', '2.5')
  })

  it('has round line caps and joins', () => {
    render(<SFReply className="round-icon" />)
    const svg = document.querySelector('svg.round-icon')
    expect(svg).toHaveAttribute('stroke-linecap', 'round')
    expect(svg).toHaveAttribute('stroke-linejoin', 'round')
  })
})
