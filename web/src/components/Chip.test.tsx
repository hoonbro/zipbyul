import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Chip from './Chip'

describe('Chip', () => {
  it('fires onClick when enabled', () => {
    const fn = vi.fn()
    render(
      <Chip selected={false} onClick={fn}>
        마포구
      </Chip>,
    )
    screen.getByText('마포구').click()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('does not fire when disabled', () => {
    const fn = vi.fn()
    render(
      <Chip selected={false} onClick={fn} disabled>
        강남구
      </Chip>,
    )
    screen.getByText('강남구').click()
    expect(fn).not.toHaveBeenCalled()
  })
})
