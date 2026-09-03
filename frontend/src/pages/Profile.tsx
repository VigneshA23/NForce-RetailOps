import { useState } from 'react';
import { Briefcase, Clock, Mail, Pencil, Phone, ShieldCheck, Store as StoreIcon } from 'lucide-react';
import type { MeResponse } from '../api/me';
import UserAvatar from '../components/UserAvatar';
import EditProfileForm from '../components/EditProfileForm';
import ResetPasswordModal from '../components/ResetPasswordModal';
import './Profile.css';

interface ProfileProps {
  initials: string;
  me: MeResponse | null;
  isLoading: boolean;
  error: string | null;
  onMeUpdated: (me: MeResponse) => void;
}

const ROLE_LABELS: Record<MeResponse['role'], string> = {
  OWNER_ADMIN: 'Owner / Admin',
  EMPLOYEE: 'Employee',
  SUPER_ADMIN: 'Super Admin',
};

function Profile({ initials, me, isLoading, error, onMeUpdated }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

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
          {!isEditing && (
            <button
              type="button"
              className="btn btn--secondary profile-card__edit-btn"
              onClick={() => setIsEditing(true)}
            >
              <Pencil size={14} />
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <EditProfileForm
            me={me}
            onSaved={(updated) => {
              // Reflects immediately in the display below, without a reload.
              onMeUpdated(updated);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
            onOpenResetPassword={() => setIsResetPasswordOpen(true)}
          />
        ) : (
          <div className="profile-card__details">
            <div className="profile-card__row">
              <Mail size={16} />
              <span>{me.email}</span>
            </div>
            {me.phone && (
              <div className="profile-card__row">
                <Phone size={16} />
                <span>{me.phone}</span>
              </div>
            )}
            <div className="profile-card__row">
              <ShieldCheck size={16} />
              <span>{ROLE_LABELS[me.role]}</span>
            </div>
            <div className="profile-card__row">
              <StoreIcon size={16} />
              <span>{me.storeNames.length > 0 ? me.storeNames.join(', ') : 'No stores assigned'}</span>
            </div>
            {me.shift && (
              <div className="profile-card__row">
                <Clock size={16} />
                <span>{me.shift} shift</span>
              </div>
            )}
            {me.employeeType && (
              <div className="profile-card__row">
                <Briefcase size={16} />
                <span>{me.employeeType}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <ResetPasswordModal isOpen={isResetPasswordOpen} onClose={() => setIsResetPasswordOpen(false)} />
    </div>
  );
}

export default Profile;
