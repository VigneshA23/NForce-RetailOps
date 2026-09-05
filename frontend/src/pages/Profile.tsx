import { type ChangeEvent, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Briefcase, Camera, Clock, Eye, EyeOff, Mail, Pencil, Phone,
  ShieldCheck, Store as StoreIcon, Trash2, X,
} from 'lucide-react';
import { getMe, updateMe, updateAvatar, type MeResponse } from '../api/me';
import { changePassword } from '../api/auth';
import { ApiError } from '../api/client';
import UserAvatar from '../components/UserAvatar';
import { nfToast } from '../utils/toast';
import { getInitials } from '../utils/initials';
import './Profile.css';

interface ProfileProps {
  initials: string;
  avatarUrl?: string | null;
  onAvatarChange?: (url: string | null) => void;
}

const ROLE_LABELS: Record<MeResponse['role'], string> = {
  OWNER_ADMIN: 'Owner / Admin',
  EMPLOYEE: 'Employee',
  SUPER_ADMIN: 'Super Admin',
};

const ROLE_BADGE_CLASS: Record<MeResponse['role'], string> = {
  SUPER_ADMIN: 'profile-role-badge--super-admin',
  OWNER_ADMIN: 'profile-role-badge--owner-admin',
  EMPLOYEE: 'profile-role-badge--employee',
};

function passwordStrength(pwd: string): { label: string; level: 0 | 1 | 2 | 3 } {
  if (pwd.length < 8) return { label: 'Too short', level: 0 };
  let score = 0;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score === 0) return { label: 'Weak', level: 1 };
  if (score === 1) return { label: 'Fair', level: 2 };
  return { label: 'Strong', level: 3 };
}

async function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 400;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (SIZE - sw) / 2, (SIZE - sh) / 2, sw, sh);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Profile({ initials, avatarUrl: propAvatarUrl, onAvatarChange }: ProfileProps) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Avatar
  const [localAvatar, setLocalAvatar] = useState<string | null>(propAvatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Personal info — separate saved vs. in-progress values for clean Cancel
  const [infoEditing, setInfoEditing] = useState(false);
  const [savedInfo, setSavedInfo] = useState({ fullName: '', email: '', phone: '' });
  const [infoValues, setInfoValues] = useState({ fullName: '', email: '', phone: '' });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Change password — gated behind a button
  const [pwExpanded, setPwExpanded] = useState(false);
  const [pwValues, setPwValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwShow, setPwShow] = useState({ current: false, new: false, confirm: false });
  const [pwCurrentError, setPwCurrentError] = useState<string | null>(null);
  const [pwSubmitError, setPwSubmitError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    getMe()
      .then((data) => {
        if (!mounted) return;
        setMe(data);
        const info = { fullName: data.fullName, email: data.email, phone: data.phone ?? '' };
        setInfoValues(info);
        setSavedInfo(info);
        if (data.avatarUrl && !localAvatar) {
          setLocalAvatar(data.avatarUrl);
          onAvatarChange?.(data.avatarUrl);
        }
      })
      .catch(() => {
        if (mounted) setFetchError('Unable to load your profile. Please refresh the page.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (propAvatarUrl !== undefined) setLocalAvatar(propAvatarUrl);
  }, [propAvatarUrl]);

  // Escape to close preview modal
  useEffect(() => {
    if (!previewOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePreview();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  // ── Avatar handlers ──────────────────────────────────────────────────────

  function closePreview() {
    setPreviewOpen(false);
    setDeleteConfirming(false);
  }

  function handleAvatarBodyClick() {
    if (localAvatar) {
      setPreviewOpen(true);
    } else if (canUploadAvatar) {
      fileInputRef.current?.click();
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    if (file.size > 5 * 1024 * 1024) {
      nfToast.error('Image too large. Please choose a file under 5 MB.');
      return;
    }

    setAvatarUploading(true);
    const previousAvatar = localAvatar;
    try {
      const dataUrl = await resizeImageToBase64(file);
      setLocalAvatar(dataUrl);
      await updateAvatar(dataUrl);
      onAvatarChange?.(dataUrl);
      nfToast.success('Profile photo updated.');
    } catch (err) {
      setLocalAvatar(previousAvatar);
      if (err instanceof ApiError && err.status === 403) {
        nfToast.error('Avatar upload is not available for this account type.');
      } else {
        nfToast.error('Failed to upload photo. Please try again.');
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true);
    try {
      await updateAvatar(null);
      setLocalAvatar(null);
      onAvatarChange?.(null);
      setPreviewOpen(false);
      setDeleteConfirming(false);
      nfToast.success('Profile photo removed.');
    } catch {
      nfToast.error('Failed to remove photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Personal info handlers ───────────────────────────────────────────────

  function handleInfoCancel() {
    setInfoValues(savedInfo);
    setInfoEditing(false);
    setInfoError(null);
  }

  async function handleInfoSave(event: FormEvent) {
    event.preventDefault();
    setInfoError(null);
    setInfoSaving(true);
    try {
      const updated = await updateMe({
        fullName: infoValues.fullName.trim(),
        email: infoValues.email.trim(),
        phone: me?.role === 'EMPLOYEE' ? infoValues.phone.trim() : undefined,
      });
      setMe(updated);
      const newInfo = { fullName: updated.fullName, email: updated.email, phone: updated.phone ?? '' };
      setInfoValues(newInfo);
      setSavedInfo(newInfo);
      setInfoEditing(false);
      nfToast.success('Profile info updated.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      setInfoError(msg);
      nfToast.error(msg);
    } finally {
      setInfoSaving(false);
    }
  }

  // ── Password handlers ────────────────────────────────────────────────────

  function handlePwCancel() {
    setPwValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPwShow({ current: false, new: false, confirm: false });
    setPwCurrentError(null);
    setPwSubmitError(null);
    setPwExpanded(false);
  }

  const pwStrength = pwValues.newPassword ? passwordStrength(pwValues.newPassword) : null;
  const pwMismatch = pwValues.confirmPassword.length > 0 && pwValues.newPassword !== pwValues.confirmPassword;
  const pwNewTooShort = pwValues.newPassword.length > 0 && pwValues.newPassword.length < 8;

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPwSubmitError(null);
    setPwCurrentError(null);

    if (!pwValues.currentPassword) { setPwSubmitError('Current password is required.'); return; }
    if (pwValues.newPassword.length < 8) { setPwSubmitError('New password must be at least 8 characters.'); return; }
    if (pwValues.newPassword !== pwValues.confirmPassword) return;

    setPwSubmitting(true);
    try {
      await changePassword(pwValues.currentPassword, pwValues.newPassword);
      setPwValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwShow({ current: false, new: false, confirm: false });
      setPwExpanded(false);
      nfToast.success('Password changed successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to change password.';
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
        setPwCurrentError('Current password is incorrect.');
      } else {
        setPwSubmitError(msg);
      }
    } finally {
      setPwSubmitting(false);
    }
  }

  if (isLoading) return <div className="profile-page__empty">Loading profile...</div>;
  if (fetchError || !me) return <div className="profile-page__empty">{fetchError ?? 'Profile unavailable.'}</div>;

  const displayInitials = getInitials(me.fullName) || initials;
  const canUploadAvatar = me.role !== 'SUPER_ADMIN';

  return (
    <div className="profile-page">

      {/* ── Avatar preview lightbox ──────────────────────────────────────── */}
      {previewOpen && localAvatar && (
        <div
          className="avatar-preview-backdrop"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo preview"
        >
          <div className="avatar-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="avatar-preview-close"
              onClick={closePreview}
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
            <img src={localAvatar} alt="Profile photo" className="avatar-preview-img" />
            {canUploadAvatar && (
              <div className="avatar-preview-actions">
                {!deleteConfirming ? (
                  <div className="avatar-preview-icon-row">
                    <button
                      type="button"
                      className="avatar-preview-upload-icon"
                      onClick={() => { setPreviewOpen(false); fileInputRef.current?.click(); }}
                      aria-label="Upload new profile photo"
                      disabled={avatarUploading}
                    >
                      <Camera size={15} />
                    </button>
                    <button
                      type="button"
                      className="avatar-preview-delete-icon"
                      onClick={() => setDeleteConfirming(true)}
                      aria-label="Delete profile photo"
                      disabled={avatarUploading}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="avatar-delete-confirm">
                    <p className="avatar-delete-confirm__msg">Remove this photo permanently?</p>
                    <div className="avatar-delete-confirm__btns">
                      <button
                        type="button"
                        className="btn btn--secondary avatar-delete-confirm__cancel"
                        onClick={() => setDeleteConfirming(false)}
                        disabled={avatarUploading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger avatar-delete-confirm__remove"
                        onClick={handleRemoveAvatar}
                        disabled={avatarUploading}
                      >
                        {avatarUploading ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Identity card ────────────────────────────────────────────────── */}
      <section className="profile-section profile-section--identity">
        <div className="profile-identity-avatar-col">
          <div className="profile-avatar-anchor">
            <div
              className="profile-avatar-wrap"
              role={localAvatar || (!localAvatar && canUploadAvatar) ? 'button' : undefined}
              tabIndex={localAvatar || (!localAvatar && canUploadAvatar) ? 0 : undefined}
              aria-label={localAvatar ? 'View profile photo' : (canUploadAvatar ? 'Upload profile photo' : undefined)}
              onClick={handleAvatarBodyClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAvatarBodyClick(); }
              }}
            >
              <UserAvatar initials={displayInitials} size={88} src={localAvatar} />
              {canUploadAvatar && !avatarUploading && (
                <div className="profile-avatar-overlay" aria-hidden="true" />
              )}
              {avatarUploading && (
                <div className="profile-avatar-spinner" aria-hidden="true" />
              )}
            </div>
            {canUploadAvatar && !avatarUploading && (
              <button
                type="button"
                className="profile-camera-badge"
                aria-label="Upload new profile photo"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                <Camera size={11} />
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="profile-avatar-input"
            onChange={handleAvatarFileChange}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        <div className="profile-identity-info">
          <h2 className="profile-identity-name">{me.fullName}</h2>
          <span className={`profile-role-badge ${ROLE_BADGE_CLASS[me.role]}`}>
            {ROLE_LABELS[me.role]}
          </span>
          <div className="profile-identity-meta">
            <span><Mail size={13} />{me.email}</span>
            {me.storeNames.length > 0 && (
              <span><StoreIcon size={13} />{me.storeNames.join(', ')}</span>
            )}
            {me.shift && <span><Clock size={13} />{me.shift} shift</span>}
            {me.employeeType && <span><Briefcase size={13} />{me.employeeType}</span>}
          </div>
        </div>
      </section>

      {/* ── Personal info ────────────────────────────────────────────────── */}
      <section className="profile-section">
        <div className="profile-section__header">
          <h3 className="profile-section__title">Personal info</h3>
          {!infoEditing && (
            <button
              type="button"
              className="profile-edit-btn"
              onClick={() => setInfoEditing(true)}
              aria-label="Edit personal info"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        {infoEditing ? (
          <form onSubmit={handleInfoSave} noValidate>
            <div className="profile-field">
              <label htmlFor="pf-name" className="profile-field__label">Full name</label>
              <input
                id="pf-name"
                type="text"
                className="input"
                value={infoValues.fullName}
                onChange={(e) => setInfoValues((v) => ({ ...v, fullName: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="profile-field">
              <label htmlFor="pf-email" className="profile-field__label">Email</label>
              <input
                id="pf-email"
                type="email"
                className="input"
                value={infoValues.email}
                onChange={(e) => setInfoValues((v) => ({ ...v, email: e.target.value }))}
                required
              />
            </div>
            {me.role === 'EMPLOYEE' && (
              <div className="profile-field">
                <label htmlFor="pf-phone" className="profile-field__label">
                  Phone <span className="profile-field__opt">optional</span>
                </label>
                <div className="profile-field__icon-wrap">
                  <Phone size={15} className="profile-field__icon" />
                  <input
                    id="pf-phone"
                    type="tel"
                    className="input profile-field__input--icon"
                    value={infoValues.phone}
                    onChange={(e) => setInfoValues((v) => ({ ...v, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            )}
            {infoError && <p className="profile-field__error">{infoError}</p>}
            <div className="profile-section__actions">
              <button type="button" className="btn btn--ghost" onClick={handleInfoCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={infoSaving}>
                {infoSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-fields-readonly">
            <div className="profile-field-row">
              <div className="profile-field__label">Full name</div>
              <div className="profile-field-value">{savedInfo.fullName || '—'}</div>
            </div>
            <div className="profile-field-row">
              <div className="profile-field__label">Email</div>
              <div className="profile-field-value">{savedInfo.email || '—'}</div>
            </div>
            {me.role === 'EMPLOYEE' && (
              <div className="profile-field-row">
                <div className="profile-field__label">Phone</div>
                <div className="profile-field-value">{savedInfo.phone || '—'}</div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Security / Change password ───────────────────────────────────── */}
      {me.role !== 'SUPER_ADMIN' && (
        <section className="profile-section">
          <div className="profile-section__header">
            <h3 className="profile-section__title">
              <ShieldCheck size={15} />
              Security
            </h3>
          </div>

          {pwExpanded ? (
            <form onSubmit={handlePasswordSubmit} noValidate>
              <div className="profile-field">
                <label htmlFor="pw-current" className="profile-field__label">Current password</label>
                {pwCurrentError && <p className="profile-field__error">{pwCurrentError}</p>}
                <div className="rp-input-wrap">
                  <input
                    id="pw-current"
                    type={pwShow.current ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="input"
                    value={pwValues.currentPassword}
                    autoFocus
                    onChange={(e) => {
                      setPwValues((v) => ({ ...v, currentPassword: e.target.value }));
                      setPwCurrentError(null);
                    }}
                  />
                  <button
                    type="button"
                    className="rp-eye"
                    onClick={() => setPwShow((s) => ({ ...s, current: !s.current }))}
                    aria-label={pwShow.current ? 'Hide password' : 'Show password'}
                  >
                    {pwShow.current ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="profile-field">
                <label htmlFor="pw-new" className="profile-field__label">New password</label>
                {pwNewTooShort && <p className="profile-field__error">At least 8 characters required.</p>}
                <div className="rp-input-wrap">
                  <input
                    id="pw-new"
                    type={pwShow.new ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="input"
                    value={pwValues.newPassword}
                    onChange={(e) => setPwValues((v) => ({ ...v, newPassword: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rp-eye"
                    onClick={() => setPwShow((s) => ({ ...s, new: !s.new }))}
                    aria-label={pwShow.new ? 'Hide password' : 'Show password'}
                  >
                    {pwShow.new ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwStrength && (
                  <div className="rp-strength" aria-live="polite">
                    <div className="rp-strength__bars">
                      {([1, 2, 3] as const).map((lvl) => (
                        <div
                          key={lvl}
                          className={`rp-strength__bar rp-strength__bar--${pwStrength.level >= lvl ? ['', 'weak', 'fair', 'strong'][pwStrength.level] : 'empty'}`}
                        />
                      ))}
                    </div>
                    <span className="rp-strength__label">{pwStrength.label}</span>
                  </div>
                )}
              </div>

              <div className="profile-field">
                <label htmlFor="pw-confirm" className="profile-field__label">Confirm new password</label>
                {pwMismatch && <p className="profile-field__error">Passwords do not match.</p>}
                <div className="rp-input-wrap">
                  <input
                    id="pw-confirm"
                    type={pwShow.confirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="input"
                    value={pwValues.confirmPassword}
                    onChange={(e) => setPwValues((v) => ({ ...v, confirmPassword: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rp-eye"
                    onClick={() => setPwShow((s) => ({ ...s, confirm: !s.confirm }))}
                    aria-label={pwShow.confirm ? 'Hide password' : 'Show password'}
                  >
                    {pwShow.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {pwSubmitError && <p className="profile-field__error">{pwSubmitError}</p>}
              <div className="profile-section__actions">
                <button type="button" className="btn btn--ghost" onClick={handlePwCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={pwSubmitting}>
                  {pwSubmitting ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-pw-gate">
              <p className="profile-pw-gate__desc">
                Update your password to keep your account secure.
              </p>
              <button
                type="button"
                className="btn btn--secondary profile-pw-gate__btn"
                onClick={() => setPwExpanded(true)}
              >
                Change password
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Profile;
