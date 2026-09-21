interface ButtonDotsProps {
  label?: string;
}

// Drop-in replacement for a button's label while its action is in flight --
// `background: currentColor` (see buttons.css) makes it auto-match whichever
// .btn--* variant it's used inside, so no per-caller color wiring is needed.
function ButtonDots({ label = 'Loading' }: ButtonDotsProps) {
  return (
    <span className="btn__dots" role="status" aria-label={label}>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </span>
  );
}

export default ButtonDots;
