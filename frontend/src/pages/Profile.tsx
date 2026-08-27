import { useEffect, useState } from 'react';
import { Mail, ShieldCheck, Store as StoreIcon } from 'lucide-react';
import { getMe, type MeResponse } from '../api/me';
import UserAvatar from '../components/UserAvatar';
import './Profile.css';

interface ProfileProps {
  token: string;
  initials: string;
}

const ROLE_LABELS: Record<MeResponse['role'], string> = {
  OWNER_ADMIN: 'Owner / Admin',
  EMPLOYEE: 'Employee',
};

function Profile({ token, initials }: ProfileProps) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getMe(token)
      .then((data) => {
        if (isMounted) setMe(data);
      })
      .catch(() => {
        if (isMounted) setError('Unable to load your profile. Please refresh the page.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isLoading) {
    return <div className="profile-page__empty">Loading profile...</div>;
  }

  if (error || !me) {
    return <div className="profile-page__empty">{error ?? 'Profile unavailable.'}</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card__header">
          <UserAvatar initials={initials} size={64} />
          <div>
            <div className="profile-card__name">{me.fullName}</div>
            <span className="badge badge--solid">{ROLE_LABELS[me.role]}</span>
          </div>
        </div>

        <div className="profile-card__details">
          <div className="profile-card__row">
            <Mail size={16} />
            <span>{me.email}</span>
          </div>
          <div className="profile-card__row">
            <ShieldCheck size={16} />
            <span>{ROLE_LABELS[me.role]}</span>
          </div>
          <div className="profile-card__row">
            <StoreIcon size={16} />
            <span>{me.storeNames.length > 0 ? me.storeNames.join(', ') : 'No stores assigned'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
