import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EndOfDaySkippedBadge from './EndOfDaySkippedBadge';

const mockIsMobile = vi.fn();
vi.mock('../hooks/useMediaQuery', () => ({ useIsMobile: () => mockIsMobile() }));

const REASON = 'the freezer failed overnight and every tub had already melted so nothing could be counted safely';

describe('EndOfDaySkippedBadge', () => {
  beforeEach(() => mockIsMobile.mockReset());

  it('labels the state and carries the reason as a tooltip on desktop', () => {
    mockIsMobile.mockReturnValue(false);
    render(<EndOfDaySkippedBadge reason={REASON} byName="Ananya" />);
    expect(screen.getByText('EOD Not Counted')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent(REASON);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ananya');
  });

  it('opens the reason in a popup when the icon is tapped on mobile', async () => {
    mockIsMobile.mockReturnValue(true);
    render(<EndOfDaySkippedBadge reason={REASON} byName="Ananya" />);
    expect(screen.queryByText(REASON)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Why End of Day was not counted' }));
    expect(await screen.findByText(REASON)).toBeInTheDocument();
  });

  it('says so when no reason was recorded', () => {
    mockIsMobile.mockReturnValue(false);
    render(<EndOfDaySkippedBadge reason={null} />);
    expect(screen.getByRole('tooltip')).toHaveTextContent('No reason was recorded.');
  });
});
