'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { runTransaction, ref, set, get, remove, onDisconnect } from 'firebase/database';
import { auth, firestore, db } from '@/lib/firebase';
import type { UserProfile, GameResult, UserSession } from '@/types';
import {
  SESSION_TTL_MS as TTL,
  SESSION_HEARTBEAT_INTERVAL_MS as HEARTBEAT_INTERVAL,
  ERROR_ALREADY_LOGGED_IN as ALREADY_LOGGED_IN,
} from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, playerName: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updatePlayerName: (name: string) => Promise<void>;
  topUpChips: (amount: number) => Promise<void>;
  saveGameResult: (roomId: string, buyin: number, finalStack: number) => Promise<void>;
  addFriend: (friendUid: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  setActiveRoom: (roomId: string | null) => Promise<void>;
  getFriendProfiles: () => Promise<Array<{ uid: string; playerName: string; activeRoomId: string | null }>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INITIAL_CHIPS = 5000;

const SESSION_STORAGE_KEY_PREFIX = 'poker_session_';
const DEVICE_STORAGE_KEY = 'poker_device_id';
const PERMISSION_RETRY_DELAY_MS = 500;
const inFlightSessionClaims = new Map<string, Promise<{ success: true; sessionId: string } | { success: false }>>();
const AUTH_DEBUG_PREFIX = '[AuthContext]';

function sessionStorageKey(uid: string): string {
  return `${SESSION_STORAGE_KEY_PREFIX}${uid}`;
}

function getStoredSessionId(uid: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(sessionStorageKey(uid));
}

function storeSessionId(uid: string, sessionId: string): void {
  sessionStorage?.setItem(sessionStorageKey(uid), sessionId);
}

function clearSessionStorage(uid: string): void {
  sessionStorage?.removeItem(sessionStorageKey(uid));
}

function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'server';
  const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(DEVICE_STORAGE_KEY, next);
  return next;
}

function sessionRef(uid: string) {
  return ref(db, `userSessions/${uid}`);
}

function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === 'PERMISSION_DENIED' || /permission_denied/i.test(String(e?.message ?? ''));
}

function authDebug(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`${AUTH_DEBUG_PREFIX} ${message}`);
    return;
  }
  console.log(`${AUTH_DEBUG_PREFIX} ${message}`, details);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAuthToken(uid: string): Promise<void> {
  if (auth.currentUser?.uid !== uid) return;
  await auth.currentUser.getIdToken();
}

/** 既存セッションが有効なら取得せず失敗。期限切れか空なら自セッションで取得。 */
async function claimSession(uid: string, deviceId: string): Promise<{ success: true; sessionId: string } | { success: false }> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const result = await runTransaction(sessionRef(uid), (current: UserSession | null) => {
    if (current && current.lastSeen && now - current.lastSeen < TTL && current.deviceId !== deviceId) {
      return undefined; // abort transaction → we treat as "already active"
    }
    const next: UserSession = {
      sessionId: current?.deviceId === deviceId ? current.sessionId : sessionId,
      deviceId,
      lastSeen: now,
      activeRoomId: current?.deviceId === deviceId ? current.activeRoomId : null,
      status: 'online',
    };
    return next;
  });
  if (result.committed) {
    const data = result.snapshot.val() as UserSession | null;
    return { success: true, sessionId: data?.sessionId ?? sessionId };
  }
  return { success: false };
}

/** ログイン直後は Realtime Database に認証が伝播するまで一瞬かかることがあるため、permission_denied 時に1回だけリトライする。 */
async function claimSessionWithRetry(uid: string, deviceId: string): Promise<{ success: true; sessionId: string } | { success: false }> {
  try {
    return await claimSession(uid, deviceId);
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    await sleep(PERMISSION_RETRY_DELAY_MS);
    return await claimSession(uid, deviceId);
  }
}

/**
 * signInWithEmailAndPassword() と onAuthStateChanged() が同時に走るため、
 * 同じ UID へのセッション確保トランザクションは 1 本にまとめる。
 */
async function claimSessionForUser(user: User): Promise<{ success: true; sessionId: string } | { success: false }> {
  const existing = inFlightSessionClaims.get(user.uid);
  if (existing) return existing;

  const promise = (async () => {
    await ensureAuthToken(user.uid);
    return await claimSessionWithRetry(user.uid, getDeviceId());
  })().finally(() => {
    inFlightSessionClaims.delete(user.uid);
  });

  inFlightSessionClaims.set(user.uid, promise);
  return await promise;
}

function buildInitialProfile(uid: string, email: string, playerName: string): Omit<UserProfile, 'createdAt' | 'updatedAt'> {
  return {
    uid,
    email,
    playerName,
    chipBalance: INITIAL_CHIPS,
    lifetimeProfit: 0,
    totalTopUp: 0,
    friendIds: [],
    activeRoomId: null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    authDebug('loadProfile:start', { uid });
    try {
      await ensureAuthToken(uid);
      let snap;
      try {
        snap = await getDoc(doc(firestore, 'users', uid));
      } catch (err) {
        authDebug('loadProfile:first_attempt_failed', err);
        if (!isPermissionDenied(err)) throw err;
        await sleep(PERMISSION_RETRY_DELAY_MS);
        await ensureAuthToken(uid);
        snap = await getDoc(doc(firestore, 'users', uid));
      }
      if (snap.exists()) {
        authDebug('loadProfile:success', { uid });
        setProfile(snap.data() as UserProfile);
      } else {
        authDebug('loadProfile:not_found', { uid });
      }
    } catch (err) {
      authDebug('loadProfile:error', err);
      throw err;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const clearSessionOnServer = useCallback(async (uid: string) => {
    try {
      await remove(sessionRef(uid));
    } catch {
      // ignore
    }
  }, []);

  const setupOnDisconnect = useCallback((uid: string) => {
    onDisconnect(sessionRef(uid)).remove().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      authDebug('onAuthStateChanged', { uid: u?.uid ?? null });
      setUser(u);
      if (!u) {
        authDebug('onAuthStateChanged:signed_out');
        currentSessionIdRef.current = null;
        setProfile(null);
        setAuthLoading(false);
        return;
      }
      const uid = u.uid;
      try {
        const storedId = getStoredSessionId(uid);
        authDebug('sessionStorage:read', { uid, storedId });
        if (storedId) {
          try {
            authDebug('sessionStorage:validate:start', { uid, storedId });
            const snap = await get(sessionRef(uid));
            const data = snap.val() as UserSession | null;
            const now = Date.now();
            authDebug('sessionStorage:validate:snapshot', { uid, data });
            if (
              data &&
              data.sessionId === storedId &&
              data.lastSeen &&
              now - data.lastSeen < TTL
            ) {
              authDebug('sessionStorage:validate:matched', { uid, storedId });
              currentSessionIdRef.current = storedId;
              await loadProfile(uid);
              setAuthLoading(false);
              return;
            }
            if (
              data &&
              data.deviceId === getDeviceId() &&
              data.lastSeen &&
              now - data.lastSeen < TTL
            ) {
              authDebug('sessionStorage:validate:recover_same_device', { uid, sessionId: data.sessionId });
              storeSessionId(uid, data.sessionId);
              currentSessionIdRef.current = data.sessionId;
              await loadProfile(uid);
              setAuthLoading(false);
              return;
            }
          } catch (getErr) {
            authDebug('sessionStorage:validate:error', getErr);
            if (!isPermissionDenied(getErr)) throw getErr;
          }
          // 古い sessionStorage が残っていても、即ログアウトせず新しいセッションを取り直す。
          authDebug('sessionStorage:validate:stale_or_denied', { uid, storedId });
          clearSessionStorage(uid);
          currentSessionIdRef.current = null;
        }
        authDebug('session:claim:start', { uid });
        const result = await claimSessionForUser(u);
        authDebug('session:claim:result', { uid, result });
        if (!result.success) {
          authDebug('session:claim:already_logged_in', { uid });
          await signOut(auth);
          clearSessionStorage(uid);
          currentSessionIdRef.current = null;
          setProfile(null);
          setAuthLoading(false);
          return;
        }
        storeSessionId(uid, result.sessionId);
        currentSessionIdRef.current = result.sessionId;
        authDebug('session:claim:stored', { uid, sessionId: result.sessionId });
        setupOnDisconnect(uid);
        await loadProfile(uid);
        setAuthLoading(false);
      } catch (err) {
        authDebug('onAuthStateChanged:error', err);
        if (isPermissionDenied(err)) {
          clearSessionStorage(uid);
          currentSessionIdRef.current = null;
          await loadProfile(uid);
          setAuthLoading(false);
          return;
        }
        setAuthLoading(false);
        throw err;
      }
    });
    return unsubscribe;
  }, [loadProfile, setupOnDisconnect]);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const tick = () => {
      const sid = currentSessionIdRef.current ?? getStoredSessionId(uid);
      if (!sid) return;
      const now = Date.now();
      const payload: UserSession = {
        sessionId: sid,
        deviceId: getDeviceId(),
        lastSeen: now,
        activeRoomId: profile?.activeRoomId ?? null,
        status: 'online',
      };
      set(sessionRef(uid), payload).catch(() => {});
    };
    const id = setInterval(tick, HEARTBEAT_INTERVAL);
    tick();
    return () => clearInterval(id);
  }, [user?.uid, profile?.activeRoomId]);

  const signUp = useCallback(
    async (email: string, password: string, playerName: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const now = Date.now();
      const initial = {
        ...buildInitialProfile(cred.user.uid, email, playerName),
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(firestore, 'users', cred.user.uid), initial);
      // DB に書いた直後に loadProfile で反映（onAuthStateChanged の loadProfile より先に確定させる）
      await loadProfile(cred.user.uid);
    },
    [loadProfile]
  );

  const logIn = useCallback(
    async (email: string, password: string) => {
      authDebug('logIn:start', { email });
      setAuthLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      authDebug('logIn:signInWithEmailAndPassword:success');
      // ログイン後のセッション確保とプロフィール読込は onAuthStateChanged 側に一本化する。
    },
    []
  );

  const logOut = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    authDebug('logOut:start', { uid: uid ?? null });
    if (uid) {
      await clearSessionOnServer(uid);
      clearSessionStorage(uid);
      currentSessionIdRef.current = null;
    }
    await signOut(auth);
    setProfile(null);
  }, [clearSessionOnServer]);

  const updatePlayerName = useCallback(async (name: string) => {
    if (!user) return;
    const now = Date.now();
    await updateDoc(doc(firestore, 'users', user.uid), { playerName: name, updatedAt: now });
    setProfile((prev) => prev ? { ...prev, playerName: name, updatedAt: now } : prev);
  }, [user]);

  const topUpChips = useCallback(async (amount: number) => {
    if (!user || !profile) return;
    const now = Date.now();
    const updated = {
      chipBalance: profile.chipBalance + amount,
      totalTopUp: profile.totalTopUp + amount,
      lifetimeProfit: profile.lifetimeProfit - amount,
      updatedAt: now,
    };
    await updateDoc(doc(firestore, 'users', user.uid), updated);
    setProfile((prev) => prev ? { ...prev, ...updated } : prev);
  }, [user, profile]);

  const saveGameResult = useCallback(async (roomId: string, buyin: number, finalStack: number) => {
    if (!user || !profile) return;
    const gameDelta = finalStack - buyin;
    const now = Date.now();
    const result: GameResult = { roomId, buyin, finalStack, gameDelta, savedAt: now };
    await addDoc(collection(firestore, 'users', user.uid, 'gameResults'), result);
    const updated = {
      chipBalance: profile.chipBalance + gameDelta,
      lifetimeProfit: profile.lifetimeProfit + gameDelta,
      updatedAt: now,
    };
    await updateDoc(doc(firestore, 'users', user.uid), updated);
    setProfile((prev) => prev ? { ...prev, ...updated } : prev);
  }, [user, profile]);

  const addFriend = useCallback(async (friendUid: string) => {
    if (!user || !profile) return;
    if (profile.friendIds.includes(friendUid)) return;
    const now = Date.now();
    const newIds = [...profile.friendIds, friendUid];

    // 自分のリストに相手を追加
    await updateDoc(doc(firestore, 'users', user.uid), { friendIds: newIds, updatedAt: now });

    // 相手のリストにも自分を追加（firestore.rules で許可）
    try {
      const friendSnap = await getDoc(doc(firestore, 'users', friendUid));
      if (friendSnap.exists()) {
        const friendData = friendSnap.data() as UserProfile;
        if (!friendData.friendIds.includes(user.uid)) {
          await updateDoc(doc(firestore, 'users', friendUid), {
            friendIds: [...friendData.friendIds, user.uid],
            updatedAt: now,
          });
        }
      }
    } catch {
      // 相手側の更新失敗は自分側の登録をブロックしない
    }

    setProfile((prev) => prev ? { ...prev, friendIds: newIds, updatedAt: now } : prev);
  }, [user, profile]);

  const removeFriend = useCallback(async (friendUid: string) => {
    if (!user || !profile) return;
    const now = Date.now();
    const newIds = profile.friendIds.filter((id) => id !== friendUid);

    // 自分のリストから相手を削除
    await updateDoc(doc(firestore, 'users', user.uid), { friendIds: newIds, updatedAt: now });

    // 相手のリストからも自分を削除（firestore.rules で許可）
    try {
      const friendSnap = await getDoc(doc(firestore, 'users', friendUid));
      if (friendSnap.exists()) {
        const friendData = friendSnap.data() as UserProfile;
        if (friendData.friendIds.includes(user.uid)) {
          await updateDoc(doc(firestore, 'users', friendUid), {
            friendIds: friendData.friendIds.filter((id) => id !== user.uid),
            updatedAt: now,
          });
        }
      }
    } catch {
      // 相手側の更新失敗は自分側の削除をブロックしない
    }

    setProfile((prev) => prev ? { ...prev, friendIds: newIds, updatedAt: now } : prev);
  }, [user, profile]);

  const setActiveRoom = useCallback(async (roomId: string | null) => {
    if (!user) return;
    const now = Date.now();
    await updateDoc(doc(firestore, 'users', user.uid), { activeRoomId: roomId, updatedAt: now });
    setProfile((prev) => prev ? { ...prev, activeRoomId: roomId, updatedAt: now } : prev);
  }, [user]);

  const getFriendProfiles = useCallback(async () => {
    if (!profile || profile.friendIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < profile.friendIds.length; i += 10) {
      chunks.push(profile.friendIds.slice(i, i + 10));
    }
    const results: Array<{ uid: string; playerName: string; activeRoomId: string | null }> = [];
    for (const chunk of chunks) {
      const q = query(collection(firestore, 'users'), where('uid', 'in', chunk));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data() as UserProfile;
        results.push({ uid: data.uid, playerName: data.playerName, activeRoomId: data.activeRoomId });
      });
    }
    return results;
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authLoading,
        profileLoading,
        signUp,
        logIn,
        logOut,
        updatePlayerName,
        topUpChips,
        saveGameResult,
        addFriend,
        removeFriend,
        setActiveRoom,
        getFriendProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
