interface LogoProps {
  size?: number;
}

function Logo({ size = 28 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="img"
      aria-label="NForce logo"
    >
      <rect width="28" height="28" rx="6" fill="var(--color-accent)" />
      <text
        x="50%"
        y="53%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="13"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#ffffff"
      >
        NF
      </text>
    </svg>
  );
}

export default Logo;
