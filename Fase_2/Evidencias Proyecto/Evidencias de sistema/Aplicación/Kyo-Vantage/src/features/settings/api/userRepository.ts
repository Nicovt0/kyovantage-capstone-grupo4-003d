import { visibleName } from '@/features/auth/model/profileIdentity';
import { User } from "@/types";
import { mockUser } from "@/mockdata/user";
import { USE_MOCKS } from "@/shared/lib/serviceConfig";
import { createClient } from "@/utils/supabase/client";

export type AccountUser = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type SecuritySettings = {
  usePin: boolean;
  useBiometrics: boolean;
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  usePin: true,
  useBiometrics: false,
};

export async function getUser(): Promise<User | null> {
  if (USE_MOCKS) {
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockUser), 50);
    });
  }

  // Real Supabase Fetch
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Map Supabase user to our internal User type
    return {
      id: user.id,
      name: visibleName(user.user_metadata, user.email?.split('@')[0] || 'Usuario'),
      email: user.email || '',
      avatar: user.user_metadata?.avatar_url || '',
      settings: user.user_metadata?.settings || {
        currency: 'CLP',
        language: 'es',
        theme: 'dark',
        isCashAccountEnabled: true,
        fixedIncomes: [],
        fixedExpenses: []
      }
    } as User;
  } catch (err) {
    console.error("Error fetching user:", err);
    return null;
  }
}

export async function updateUserSettings(settings: Partial<User['settings']>): Promise<void> {
  if (USE_MOCKS) {
    Object.assign(mockUser.settings, settings);
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    data: { settings }
  });
  if (error) throw error;
}

export async function getAccountUser(): Promise<AccountUser | null> {
  if (USE_MOCKS) {
    return {
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      created_at: new Date().toISOString(),
    };
  }

  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;

  return {
    id: user.id,
    name: visibleName(user.user_metadata, user.email?.split('@')[0] || 'Usuario'),
    email: user.email || '',
    created_at: user.created_at || new Date().toISOString(),
  };
}

export async function updateProfileName(name: string): Promise<void> {
  const displayName = name.trim();
  if (!displayName) throw new Error('Indica un nombre visible o apodo.');
  if (USE_MOCKS) {
    mockUser.name = displayName;
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ data: { name: displayName, full_name: displayName } });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  if (USE_MOCKS) return;

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (USE_MOCKS) {
    const stored = mockUser.settings as Partial<SecuritySettings>;
    return {
      usePin: stored.usePin ?? DEFAULT_SECURITY_SETTINGS.usePin,
      useBiometrics: stored.useBiometrics ?? DEFAULT_SECURITY_SETTINGS.useBiometrics,
    };
  }

  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  const stored = user?.user_metadata?.settings as Partial<SecuritySettings> | undefined;

  return {
    usePin: stored?.usePin ?? DEFAULT_SECURITY_SETTINGS.usePin,
    useBiometrics: stored?.useBiometrics ?? DEFAULT_SECURITY_SETTINGS.useBiometrics,
  };
}

export async function updateSecuritySettings(settings: SecuritySettings): Promise<void> {
  if (USE_MOCKS) {
    Object.assign(mockUser.settings, settings);
    return;
  }

  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const currentSettings = (user?.user_metadata?.settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase.auth.updateUser({
    data: { settings: { ...currentSettings, ...settings } },
  });
  if (error) throw error;
}
