import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MissedTasksBanner from './MissedTasksBanner'

describe('MissedTasksBanner', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(<MissedTasksBanner count={0} onClick={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count and navigates on click', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<MissedTasksBanner count={3} onClick={onClick} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})
