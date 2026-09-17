-- Remember Me & Session Management: sessions now carry an absolute expiry
-- fixed at login time (30 min standard / 4h remember-me), instead of relying
-- solely on the sliding last_active_at inactivity check. Existing rows (all
-- short-lived, transient session state) are backfilled to expire 30 minutes
-- after their last activity so nothing is left permanently valid.
alter table active_sessions add column expires_at timestamp(6) with time zone;

update active_sessions set expires_at = last_active_at + interval '30 minutes' where expires_at is null;

alter table active_sessions alter column expires_at set not null;
