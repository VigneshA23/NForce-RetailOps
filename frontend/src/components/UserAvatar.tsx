import './UserAvatar.css';

interface UserAvatarProps {
  initials: string;
  size?: number;
}

function UserAvatar({ initials, size = 36 }: UserAvatarProps) {
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
