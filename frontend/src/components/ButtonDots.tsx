import LatticeLoader from './LatticeLoader';

interface ButtonDotsProps {
  label?: string;
}

// Drop-in replacement for a button's label while its action is in flight --
// `color="currentColor"` (LatticeLoader's default) makes it auto-match whichever
// .btn--* variant it's used inside, so no per-caller color wiring is needed.
function ButtonDots({ label = 'Loading' }: ButtonDotsProps) {
  return <LatticeLoader label={label} grid={3} cellSize={4} gap={2} showTimer={false} hideLabel />;
}

export default ButtonDots;
