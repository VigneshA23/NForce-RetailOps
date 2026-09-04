import './UserAvatar.css';

interface UserAvatarProps {
  initials: string;
  size?: number;
  src?: string | null;
}

function UserAvatar({ initials, size = 36, src }: UserAvatarProps) {
  if (src) {
    return (
      <img
        className="user-avatar user-avatar--img"
        src={src}
        alt={initials}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="user-avatar"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default UserAvatar;
