import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MissedEndOfDayPanel from './MissedEndOfDayPanel';
import type { MissedEndOfDay, MissedEndOfDayItem } from '../types/notification';

const FIFTEEN_WORDS = 'the freezer failed overnight and every tub had already melted so nothing could be counted safely';

function item(overrides: Partial<MissedEndOfDayItem> = {}): MissedEndOfDayItem {
  return {
    storeInventoryItemId: 1,
    itemName: 'Butter',
    unitOfMeasurement: 'g',
    startOfDayUsable: 300,
    status: 'PENDING',
    endOfDayAvailable: null,
    endOfDayDeadStock: null,
    answeredByName: null,
    answeredAt: null,
    reason: null,
    ...overrides,
  };
}

function renderPanel(items: MissedEndOfDayItem[], onAnswer = vi.fn()) {
  const missed: MissedEndOfDay = { date: '2026-10-14', items };
  const onAnswered = vi.fn();
  render(<MissedEndOfDayPanel missedEod={missed} onAnswer={onAnswer} onAnswered={onAnswered} />);
  return { onAnswer, onAnswered };
}

describe('MissedEndOfDayPanel', () => {
  it('lists every item and says how many still need an answer', () => {
    renderPanel([item(), item({ storeInventoryItemId: 2, itemName: 'Milk', status: 'COUNTED', endOfDayAvailable: 4, answeredByName: 'Rahul' })]);
    expect(screen.getByText('Butter')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 still need an End of Day/)).toBeInTheDocument();
  });

  it('shows who answered an item and what they entered', () => {
    renderPanel([item({ status: 'COUNTED', endOfDayAvailable: 120, endOfDayDeadStock: 0, answeredByName: 'Rahul' })]);
    expect(screen.getByText(/Counted 120 g/)).toBeInTheDocument();
    expect(screen.getByText(/Rahul/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save End of Day' })).not.toBeInTheDocument();
  });

  it('shows the reason on an item that could not be counted', () => {
    renderPanel([item({ status: 'COULD_NOT_COUNT', reason: FIFTEEN_WORDS, answeredByName: 'Ananya' })]);
    expect(screen.getByText(/Could not be counted/)).toBeInTheDocument();
    expect(screen.getByText(FIFTEEN_WORDS)).toBeInTheDocument();
  });

  it('sends the count and reports the saved item', async () => {
    const saved = item({ status: 'COUNTED', endOfDayAvailable: 150, endOfDayDeadStock: 10, answeredByName: 'Me' });
    const { onAnswer, onAnswered } = renderPanel([item()], vi.fn().mockResolvedValue(saved));

    await userEvent.type(screen.getByLabelText(/Available/), '150');
    await userEvent.clear(screen.getByLabelText(/Dead/));
    await userEvent.type(screen.getByLabelText(/Dead/), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Save End of Day' }));

    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(saved));
    expect(onAnswer).toHaveBeenCalledWith({ storeInventoryItemId: 1, available: 150, deadStock: 10 });
  });

  it('refuses dead stock above available without calling the server', async () => {
    const { onAnswer } = renderPanel([item()]);
    await userEvent.type(screen.getByLabelText(/Available/), '5');
    await userEvent.clear(screen.getByLabelText(/Dead/));
    await userEvent.type(screen.getByLabelText(/Dead/), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save End of Day' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Dead stock cannot be more/);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('needs an available figure before saving a count', async () => {
    const { onAnswer } = renderPanel([item()]);
    await userEvent.click(screen.getByRole('button', { name: 'Save End of Day' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('blocks a reason under 15 words and counts the words', async () => {
    const { onAnswer } = renderPanel([item()]);
    await userEvent.click(screen.getByRole('button', { name: /Couldn.t count/ }));
    await userEvent.type(screen.getByLabelText(/Why could it not be counted/), 'the freezer failed overnight');
    expect(screen.getByText('4 / 15 words minimum')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit reason' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 15 words/);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('sends a reason of 15 words or more', async () => {
    const saved = item({ status: 'COULD_NOT_COUNT', reason: FIFTEEN_WORDS });
    const { onAnswer, onAnswered } = renderPanel([item()], vi.fn().mockResolvedValue(saved));
    await userEvent.click(screen.getByRole('button', { name: /Couldn.t count/ }));
    await userEvent.type(screen.getByLabelText(/Why could it not be counted/), FIFTEEN_WORDS);
    await userEvent.click(screen.getByRole('button', { name: 'Submit reason' }));
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(saved));
    expect(onAnswer).toHaveBeenCalledWith({ storeInventoryItemId: 1, couldNotCount: true, reason: FIFTEEN_WORDS });
  });

  it('shows the server message when someone else answered first', async () => {
    const { onAnswered } = renderPanel([item()], vi.fn().mockRejectedValue(new Error('This End of Day was already answered by Rahul.')));
    await userEvent.type(screen.getByLabelText(/Available/), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save End of Day' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already answered by Rahul');
    expect(onAnswered).not.toHaveBeenCalled();
  });
});
