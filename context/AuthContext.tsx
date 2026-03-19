'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
import { auth, firestore } from '@/lib/firebase';
import type { UserProfile, GameResult } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, playerName: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updatePlayerName: (name: string) => Promise<void>;
  saveGameResult: (totalBuyin: number, finalStack: number, roomId: string) => Promise<void>;
  addFriend: (friendUid: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  setActiveRoom: (roomId: string | null) => Promise<void>;
  getFriendProfiles: () => Promise<Array<{ uid: string; playerName: string; activeRoomId: string | null }>>;
  getGameResults: () => Promise<GameResult[]>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function buildInitialProfile(uid: string, email: string, playerName: string): Omit<UserProfile, 'createdAt' | 'updatedAt'> {
  return {
    uid,
    email,
    playerName,
    lifetimeProfit: 0,
    friendIds: [],
    activeRoomId: null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const snap = await getDoc(doc(firestore, 'users', uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setAuthLoading(false);
        return;
      }
      await loadProfile(u.uid);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [loadProfile]);

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
      await loadProfile(cred.user.uid);
    },
    [loadProfile]
  );

  const logIn = useCallback(
    async (email: string, password: string) => {
      setAuthLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    },
    []
  );

  const logOut = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
  }, []);

  const updatePlayerName = useCallback(async (name: string) => {
    if (!user) return;
    const now = Date.now();
    await updateDoc(doc(firestore, 'users', user.uid), { playerName: name, updatedAt: now });
    setProfile((prev) => prev ? { ...prev, playerName: name, updatedAt: now } : prev);
  }, [user]);

  const addFriend = useCallback(async (friendUid: string) => {
    if (!user || !profile) return;
    if (profile.friendIds.includes(friendUid)) return;
    const now = Date.now();
    const newIds = [...profile.friendIds, friendUid];

    await updateDoc(doc(firestore, 'users', user.uid), { friendIds: newIds, updatedAt: now });

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

    await updateDoc(doc(firestore, 'users', user.uid), { friendIds: newIds, updatedAt: now });

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

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfile(user.uid);
  }, [user, loadProfile]);

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

  const getGameResults = useCallback(async () => {
    if (!user) return [];
    const snap = await getDocs(collection(firestore, 'users', user.uid, 'gameResults'));
    return snap.docs
      .map((d) => d.data() as GameResult)
      .sort((a, b) => a.savedAt - b.savedAt);
  }, [user]);

  // ゲーム結果を保存し lifetimeProfit を更新する（GameContext から呼ばれる）
  const saveGameResult = useCallback(async (totalBuyin: number, finalStack: number, roomId: string) => {
    if (!user) return;
    const gameDelta = finalStack - totalBuyin;
    const now = Date.now();
    const result: GameResult = { roomId, totalBuyin, finalStack, gameDelta, savedAt: now };
    await addDoc(collection(firestore, 'users', user.uid, 'gameResults'), result);
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data() as { lifetimeProfit?: number };
      await updateDoc(doc(firestore, 'users', user.uid), {
        lifetimeProfit: (data.lifetimeProfit ?? 0) + gameDelta,
        activeRoomId: null,
        updatedAt: now,
      });
      setProfile((prev) => prev ? { ...prev, lifetimeProfit: (prev.lifetimeProfit ?? 0) + gameDelta, activeRoomId: null, updatedAt: now } : prev);
    }
  }, [user]);

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
        saveGameResult,
        addFriend,
        removeFriend,
        setActiveRoom,
        getFriendProfiles,
        getGameResults,
        refreshProfile,
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
