import { visibleName } from './profileIdentity.ts';
import type { Session, User } from '@supabase/supabase-js';
import { getRoleFromUser, type AppRole } from '@/types/roles';

export type AuthSnapshot = {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
};

export function authSnapshotFromUser(user: User): AuthSnapshot {
  const email = user.email ?? '';

  return {
    id: user.id,
    email,
    displayName: visibleName(user.user_metadata, email.split('@')[0] || 'Usuario'),
    role: getRoleFromUser(user),
  };
}

export function authSnapshotFromSession(session: Session | null): AuthSnapshot | null {
  return session ? authSnapshotFromUser(session.user) : null;
}
