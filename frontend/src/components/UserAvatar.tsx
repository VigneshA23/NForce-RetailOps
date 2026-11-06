import './UserAvatar.css';

interface UserAvatarProps {
  initials: string;
  size?: number;
  src?: string | null;
}

// Picks one of six tinted badge colors (frontend/src/styles/tokens.css),
// deterministically from the initials, so the same person always gets the
// same color instead of one flat fallback color for everyone.
const AVATAR_VARIANTS = ['primary', 'success', 'warning', 'info', 'purple', 'slate'];

function getAvatarVariant(initials: string): string {
  const sum = [...initials].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_VARIANTS[sum % AVATAR_VARIANTS.length];
}

function UserAvatar({ initials, size = 36, src }: UserAvatarProps) {
  const variantClass = `user-avatar--${getAvatarVariant(initials)}`;

  if (src) {
    return (
      <img
        className={`user-avatar user-avatar--img ${variantClass}`}
        src={src}
        alt={initials}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`user-avatar ${variantClass}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default UserAvatar;
