'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AccountType, AppNotification, Profile, SubscriptionTier, UserContact } from '@/lib/types';
import { DEMO_PROFILE, DEMO_PHONE_CONTACTS, DEMO_NETWORK_USERS, isSupabaseConfigured } from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ACCOUNT_TYPES, accountTypeDefaults } from '@/lib/accountTiers';

interface SignUpInput {
  name: string;
  username: string;
  emailOrPhone: string;
  role?: string;
  bio?: string;
  city?: string;
  avatarUrl?: string;
  accountType?: AccountType;
}

interface JournalistVerificationInput {
  pressCredentialId: string;
  employer: string;
  proofNote?: string;
}

interface SessionCtx {
  demo: boolean;
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  notifications: AppNotification[];
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithDigiLocker: (aadhaarLast4?: string) => Promise<{ error?: string }>;
  signInWithOtpMock: (identifier: string, code: string) => Promise<{ error?: string }>;
  signInPreset: (preset: Profile) => void;
  signUp: (input: SignUpInput) => Promise<{ error?: string }>;
  requestJournalistVerification: (input: JournalistVerificationInput) => Promise<{ error?: string }>;
  activateSubscription: (tier: SubscriptionTier) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => void;
  verifyIdentity: (idNumber: string, idType: 'aadhaar' | 'pan') => Promise<{ success: boolean; hash: string }>;
  patchDemoProfile: (patch: Partial<Profile>) => void;
  followingIds: string[];
  toggleFollow: (userId: string) => void;
  contacts: UserContact[];
  inviteContact: (contactId: string) => void;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
}

const Ctx = createContext<SessionCtx | null>(null);

const STORAGE_KEY_PROFILE = 'veripulse_profile_v1';
const STORAGE_KEY_FOLLOWING = 'veripulse_following_v1';
const STORAGE_KEY_LOGGED_OUT = 'veripulse_logged_out_v1';

/**
 * Auth + live profile. In live mode the profile row and the user's
 * notifications are kept current over Supabase Realtime (wallet credits,
 * trust changes, retraction notices). In demo mode it serves DEMO_PROFILE
 * or locally persisted profile state.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const demo = !isSupabaseConfigured();
  const [ready, setReady] = useState(demo);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(demo ? DEMO_PROFILE : null);
  const [followingIds, setFollowingIds] = useState<string[]>(() =>
    DEMO_NETWORK_USERS.filter((u) => u.isFollowing).map((u) => u.id),
  );

  // Restore client-side saved profile and following IDs after hydration
  useEffect(() => {
    if (!demo) return;
    try {
      if (typeof window !== 'undefined') {
        if (localStorage.getItem(STORAGE_KEY_LOGGED_OUT) === 'true') {
          setProfile(null);
        } else {
          const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              setProfile(parsed);
            }
          }
        }

        const savedFollowing = localStorage.getItem(STORAGE_KEY_FOLLOWING);
        if (savedFollowing) {
          const parsedFollowing = JSON.parse(savedFollowing);
          if (Array.isArray(parsedFollowing)) {
            setFollowingIds(parsedFollowing);
          }
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
  }, [demo]);

  const [contacts, setContacts] = useState<UserContact[]>(DEMO_PHONE_CONTACTS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [authOpen, setAuthOpen] = useState(false);

  // Sync profile to localStorage in demo mode
  const persistProfile = useCallback((p: Profile | null) => {
    setProfile(p);
    if (typeof window !== 'undefined') {
      if (p) {
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(p));
        localStorage.removeItem(STORAGE_KEY_LOGGED_OUT);
      } else {
        localStorage.removeItem(STORAGE_KEY_PROFILE);
        localStorage.setItem(STORAGE_KEY_LOGGED_OUT, 'true');
      }
    }
  }, []);

  const loadProfile = useCallback(
    async (uid: string) => {
      const sb = getSupabaseBrowserClient();
      const [{ data: prof }, { data: notes }] = await Promise.all([
        sb.from('profiles').select('*').eq('id', uid).single(),
        sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      setProfile((prof as Profile) ?? null);
      setNotifications((notes as AppNotification[]) ?? []);
    },
    [],
  );

  useEffect(() => {
    if (demo) return;
    const sb = getSupabaseBrowserClient();
    sb.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) await loadProfile(data.user.id);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else {
        setProfile(null);
        setNotifications([]);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [demo, loadProfile]);

  // Realtime: own profile row + own notifications.
  useEffect(() => {
    if (demo || !user) return;
    const sb = getSupabaseBrowserClient();
    const channel = sb
      .channel(`me:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => setProfile(payload.new as Profile),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((n) => [payload.new as AppNotification, ...n].slice(0, 20)),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [demo, user]);

  const value: SessionCtx = {
    demo,
    ready,
    user,
    profile,
    notifications,
    authOpen,
    setAuthOpen,
    followingIds,
    contacts,

    async signInWithEmail(email) {
      if (demo) {
        // Mock email sign in
        const newProf: Profile = {
          ...DEMO_PROFILE,
          id: `usr-${Date.now().toString(36)}`,
          username: email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
          full_name: email.split('@')[0],
          wallet_balance_inr: 250,
          trust_score: 75.0,
          auth_provider: 'email',
        };
        persistProfile(newProf);
        return {};
      }
      const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof location !== 'undefined' ? location.origin : undefined },
      });
      return error ? { error: error.message } : {};
    },

    async signInWithGoogle() {
      if (demo) {
        // Simulated Google sign-in: synthesise a Reader profile.
        const stub = Math.random().toString(36).slice(2, 7);
        const prof: Profile = {
          ...DEMO_PROFILE,
          id: `usr-g-${Date.now().toString(36)}`,
          username: `google_${stub}`,
          full_name: 'Google Signed-in User',
          avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=240&q=80',
          badge: 'Registered Citizen',
          wallet_balance_inr: 50,
          trust_score: 70,
          is_journalist_verified: false,
          is_press_pass_paid: false,
          is_id_verified: false,
          is_ownership_verified: false,
          is_sentinel_verified: false,
          journalist_verification_status: 'none',
          journalist_earnings_inr: 0,
          auth_provider: 'google',
          ...accountTypeDefaults('reader'),
        };
        persistProfile(prof);
        return {};
      }
      const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof location !== 'undefined' ? `${location.origin}/auth/callback` : undefined,
        },
      });
      return error ? { error: error.message } : {};
    },

    async signInWithDigiLocker(aadhaarLast4 = '0000') {
      // DigiLocker production flow needs a Meri Pehchaan client registration
      // + redirect to accounts.digitallocker.gov.in; here we simulate the
      // callback so the UI can be exercised end-to-end in demo mode. In live
      // mode this is still a stub until the integration is approved — we
      // mark the profile as ID-verified and record the method.
      const stub = aadhaarLast4.replace(/\D/g, '').slice(-4).padStart(4, '0');
      const prof: Profile = {
        ...DEMO_PROFILE,
        id: `usr-dl-${Date.now().toString(36)}`,
        username: `citizen_${stub}`,
        full_name: `DigiLocker Citizen ${stub}`,
        wallet_balance_inr: 100,
        trust_score: 82,
        badge: 'DigiLocker-verified Citizen',
        is_id_verified: true,
        is_ownership_verified: false,
        is_sentinel_verified: false,
        is_journalist_verified: false,
        is_press_pass_paid: false,
        journalist_verification_status: 'none',
        auth_provider: 'digilocker',
        ...accountTypeDefaults('citizen_reporter'),
      };
      persistProfile(prof);
      return {};
    },

    async signInWithOtpMock(identifier, _code) {
      const clean = identifier.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      const existing = profile && profile.username === clean ? profile : null;
      const prof: Profile = existing ?? {
        ...DEMO_PROFILE,
        id: `user-${Date.now()}`,
        username: clean.length > 2 ? clean : 'verified_citizen',
        full_name: identifier.includes('@') ? identifier.split('@')[0] : `Citizen ${identifier.slice(-4)}`,
        trust_score: 80.0,
        tier: 'validator_t2',
        badge: 'Verified Citizen',
        wallet_balance_inr: 300,
      };
      persistProfile(prof);
      return {};
    },

    signInPreset(preset) {
      persistProfile({ ...preset });
    },

    async signUp(input) {
      const cleanUsername = input.username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'citizen';
      const accountType: AccountType = input.accountType ?? 'citizen_reporter';
      const meta = ACCOUNT_TYPES[accountType];
      const needsJournalistReview = accountType === 'journalist';
      const needsProPayment = accountType === 'pro_reporter';
      const newProf: Profile = {
        id: `usr-${Date.now().toString(36)}`,
        username: cleanUsername,
        full_name: input.name.trim() || cleanUsername,
        avatar_url: input.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80',
        bio: input.bio?.trim() || `${meta.name} on VeriPulse.`,
        city: input.city?.trim() || 'India',
        trust_score: 75.0,
        tier: 'public',
        badge: meta.name,
        correct_votes: 0,
        total_votes: 0,
        wallet_balance_inr: 50.0, // Welcome grant
        upi_id: input.emailOrPhone.includes('@') ? `${cleanUsername}@okhdfc` : null,
        home_lat: 22.5726,
        home_lng: 88.3639,
        preferred_lang: 'en',
        is_id_verified: false,
        is_ownership_verified: false,
        is_sentinel_verified: false,
        is_journalist_verified: false,
        is_press_pass_paid: false,
        journalist_verification_status: needsJournalistReview ? 'pending' : 'none',
        account_type: accountType,
        subscription_tier: needsProPayment ? 'free' : meta.requiredSubscription,
        daily_post_limit: meta.dailyPostLimit,
        posts_today: 0,
        auth_provider: input.emailOrPhone.includes('@') ? 'email' : 'phone',
        followers_count: 0,
        following_count: 2,
        social_links: {
          twitter: `@${cleanUsername}`,
          whatsapp: input.emailOrPhone.includes('@') ? undefined : input.emailOrPhone,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      persistProfile(newProf);
      return {};
    },

    async requestJournalistVerification({ pressCredentialId, employer, proofNote }) {
      if (!profile) return { error: 'Not signed in.' };
      // Demo: mark pending — real flow queues a review ticket for an admin.
      const updated: Profile = {
        ...profile,
        account_type: 'journalist',
        journalist_verification_status: 'pending',
        press_credential_id: pressCredentialId.trim(),
        journalist_employer: employer.trim(),
        bio: profile.bio ?? (proofNote?.trim() || `Journalist · ${employer}`),
        badge: 'Journalist (pending review)',
      };
      persistProfile(updated);
      return {};
    },

    async activateSubscription(tier) {
      if (!profile) return { error: 'Not signed in.' };
      // Demo: assume payment succeeded. Live mode wires Razorpay subscription.
      const nextMeta = tier === 'pro' ? ACCOUNT_TYPES.pro_reporter : null;
      const expires = new Date(Date.now() + 30 * 86400_000).toISOString();
      const updated: Profile = {
        ...profile,
        subscription_tier: tier,
        subscription_expires_at: expires,
        account_type: tier === 'pro' ? 'pro_reporter' : profile.account_type ?? 'reader',
        daily_post_limit: nextMeta ? nextMeta.dailyPostLimit : profile.daily_post_limit,
        badge: tier === 'pro' ? 'Pro Reporter' : profile.badge,
      };
      persistProfile(updated);
      return {};
    },

    async signOut() {
      if (!demo) {
        await getSupabaseBrowserClient().auth.signOut();
      }
      persistProfile(null);
    },

    async deleteAccount() {
      if (!demo && user) {
        // live mode
        await getSupabaseBrowserClient().auth.signOut();
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_PROFILE);
        localStorage.removeItem(STORAGE_KEY_FOLLOWING);
        localStorage.setItem(STORAGE_KEY_LOGGED_OUT, 'true');
      }
      setProfile(null);
      setFollowingIds([]);
    },

    async refreshProfile() {
      if (user) await loadProfile(user.id);
    },

    updateProfile(patch) {
      if (profile) {
        const updated = { ...profile, ...patch, updated_at: new Date().toISOString() };
        persistProfile(updated);
      }
    },

    patchDemoProfile(patch) {
      if (profile) {
        const updated = { ...profile, ...patch };
        persistProfile(updated);
      }
    },

    async verifyIdentity(idNumber, idType) {
      // Cryptographic hash simulation for Aadhaar / PAN
      const raw = `${idType.toUpperCase()}:${idNumber.trim().toUpperCase()}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
      }
      const hexHash = Math.abs(hash).toString(16).padStart(16, '0') + 'c2pa89fa';

      if (profile) {
        const updated: Profile = {
          ...profile,
          is_id_verified: true,
          trust_score: Math.min(99, +(profile.trust_score + 5.0).toFixed(1)),
          badge: profile.badge.includes('Verified') ? profile.badge : `Verified ${profile.badge}`,
        };
        persistProfile(updated);
      }
      return { success: true, hash: hexHash };
    },

    toggleFollow(userId: string) {
      setFollowingIds((prev) => {
        const exists = prev.includes(userId);
        const next = exists ? prev.filter((id) => id !== userId) : [...prev, userId];
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_FOLLOWING, JSON.stringify(next));
        }
        if (profile) {
          const delta = exists ? -1 : 1;
          const updated = {
            ...profile,
            following_count: Math.max(0, (profile.following_count ?? 0) + delta),
          };
          persistProfile(updated);
        }
        return next;
      });
    },

    inviteContact(contactId: string) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, isInvited: true } : c)),
      );
      // Credit ₹25 referral bonus to user wallet
      if (profile) {
        persistProfile({
          ...profile,
          wallet_balance_inr: +(profile.wallet_balance_inr + 25.0).toFixed(2),
        });
      }
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/**
 * Wraps an action that needs a signed-in user: in live mode, opens the
 * sign-in sheet instead of running it when signed out.
 */
export function useRequireAuth() {
  const { demo, user, profile, setAuthOpen } = useSession();
  return useCallback(
    <T,>(fn: () => T): T | undefined => {
      if (!demo && !user) {
        setAuthOpen(true);
        return undefined;
      }
      if (demo && !profile) {
        setAuthOpen(true);
        return undefined;
      }
      return fn();
    },
    [demo, user, profile, setAuthOpen],
  );
}
