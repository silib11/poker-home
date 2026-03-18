'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import { PokerGame } from '../core/poker.js';
import type { Player, PokerState, Screen } from '@/types';

interface GameContextType {
  screen: Screen;
  isHost: boolean;
  myPlayerId: string | null;
  myPlayerName: string | null;
  currentRoomId: string | null;
  roomPlayers: Player[];
  buyin: number;
  sb: number;
  bb: number;
  pokerState: PokerState | null;
  createRoom: (
    buyin: number,
    sb: number,
    bb: number
  ) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  startGame: () => void;
  sendAction: (action: string, amount?: number) => void;
  readyNextHand: () => void;
  restartGame: () => void;
  updateBlinds: (sb: number, bb: number) => void;
  leaveGame: () => Promise<void>;
  requestReentry: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('setup');
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  // AuthContext は GameProvider の外側にあるため、動的 import で循環を避ける
  async function getPlayerName(): Promise<string> {
    try {
      const { auth } = await import('@/lib/firebase');
      const { getDoc, doc } = await import('firebase/firestore');
      const { firestore } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('not authenticated');
      const snap = await getDoc(doc(firestore, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data() as { playerName?: string };
        if (data.playerName) return data.playerName;
      }
    } catch {
      // フォールバック
    }
    return '名無し';
  }
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [buyin, setBuyin] = useState(1000);
  const [sb, setSb] = useState(10);
  const [bb, setBb] = useState(20);
  const [pokerState, setPokerState] = useState<PokerState | null>(null);

  // コールバック内で最新値を参照するための ref
  const isHostRef = useRef(false);
  const myPlayerIdRef = useRef<string | null>(null);
  const myPlayerNameRef = useRef<string | null>(null);
  const sbRef = useRef(10);
  const bbRef = useRef(20);
  const buyinRef = useRef(1000);
  const rtcRef = useRef<import('@/lib/webrtc').WebRTCManager | null>(null);
  const gameRef = useRef<InstanceType<typeof PokerGame> | null>(null);
  const nextHandReadyRef = useRef<Set<string>>(new Set());
  const allPlayersRef = useRef<Player[]>([]);
  const roomPlayersRef = useRef<Player[]>([]);

  // 自分の最新チップ数を追跡（bustで roomPlayersRef から消えても精算できるよう）
  const myLastChipsRef = useRef<number>(0);

  // リエントリー待ちプレイヤー（ホスト側で管理）
  const pendingReentriesRef = useRef<Array<{ id: string; name: string; chips: number }>>([]);

  // state と ref を同時に更新
  const setIsHostSync = (v: boolean) => {
    isHostRef.current = v;
    setIsHost(v);
  };
  const setMyPlayerIdSync = (v: string | null) => {
    myPlayerIdRef.current = v;
    setMyPlayerId(v);
  };
  const setMyPlayerNameSync = (v: string | null) => {
    myPlayerNameRef.current = v;
    setMyPlayerName(v);
  };
  const setSbSync = (v: number) => {
    sbRef.current = v;
    setSb(v);
  };
  const setBbSync = (v: number) => {
    bbRef.current = v;
    setBb(v);
  };
  const setBuyinSync = (v: number) => {
    buyinRef.current = v;
    setBuyin(v);
  };
  const setRoomPlayersSync = (v: Player[]) => {
    roomPlayersRef.current = v;
    setRoomPlayers(v);
  };

  // ゲーム終了時の精算処理
  async function settleGameResult(finalStack: number) {
    try {
      const { auth, firestore } = await import('@/lib/firebase');
      const { doc, updateDoc, collection, addDoc } = await import('firebase/firestore');
      const user = auth.currentUser;
      if (!user) return;
      const totalBuyin = buyinRef.current;
      const gameDelta = finalStack - totalBuyin;
      const now = Date.now();
      await addDoc(collection(firestore, 'users', user.uid, 'gameResults'), {
        roomId: rtcRef.current?.roomId ?? '',
        buyin: totalBuyin,
        finalStack,
        gameDelta,
        savedAt: now,
      });
      const snap = await import('firebase/firestore').then(({ getDoc }) =>
        getDoc(doc(firestore, 'users', user.uid))
      );
      if (snap.exists()) {
        const data = snap.data() as { chipBalance: number; lifetimeProfit: number };
        await updateDoc(doc(firestore, 'users', user.uid), {
          chipBalance: (data.chipBalance ?? 0) + gameDelta,
          lifetimeProfit: (data.lifetimeProfit ?? 0) + gameDelta,
          activeRoomId: null,
          updatedAt: now,
        });
      }
    } catch {
      // 精算失敗はゲーム進行をブロックしない
    }
  }

  // ゲームオーバー
  const showGameOver = useCallback(() => {
    setScreen('gameover');
    if (isHostRef.current && rtcRef.current) {
      rtcRef.current.broadcast({ type: 'game_over' });
    }
    // myLastChipsRef で精算（roomPlayersRef は bust 後に更新されるため参照しない）
    settleGameResult(myLastChipsRef.current);
  }, []);

  // 相互参照が必要な関数を ref で保持
  const startNextHandRef = useRef<() => void>(() => {});
  const checkAllReadyRef = useRef<() => void>(() => {});

  // useEffect で最新の実装を ref に詰める
  React.useEffect(() => {
    startNextHandRef.current = () => {
      const game = gameRef.current;
      if (!game) return;

      let activePlayers = game.players
        .filter((p) => p.chips > 0)
        .map((p) => ({ id: p.id, name: p.name, chips: p.chips }));

      // リエントリー待ちのプレイヤーを追加
      for (const reentry of pendingReentriesRef.current) {
        if (!activePlayers.find((p) => p.id === reentry.id)) {
          activePlayers = [...activePlayers, { id: reentry.id, name: reentry.name, chips: reentry.chips }];
        }
      }
      pendingReentriesRef.current = [];

      if (activePlayers.length < 2) {
        showGameOver();
        return;
      }

      const nextDealerIndex = (game.dealerIndex + 1) % activePlayers.length;
      const newGame = new PokerGame(activePlayers, sbRef.current, bbRef.current);
      newGame.dealerIndex = nextDealerIndex;
      newGame.start();
      gameRef.current = newGame;

      // ホスト自身のチップを更新
      const hostPlayer = activePlayers.find((p) => p.id === myPlayerIdRef.current);
      if (hostPlayer) myLastChipsRef.current = hostPlayer.chips;

      const state = newGame.getState() as PokerState;
      rtcRef.current?.broadcast({ type: 'game_start', state });
      setPokerState(state);
      setScreen('playing');
    };

    checkAllReadyRef.current = () => {
      const game = gameRef.current;
      if (!game) return;

      const activePlayers = game.players.filter((p) => p.chips > 0);
      const totalExpected = activePlayers.length + pendingReentriesRef.current.length;
      if (nextHandReadyRef.current.size >= Math.max(activePlayers.length, 1)) {
        // リエントリー待ちは ready 不要（まだゲームに参加していないため）
        if (nextHandReadyRef.current.size >= activePlayers.length) {
          nextHandReadyRef.current.clear();
          startNextHandRef.current();
          return;
        }
      }

      void totalExpected; // 未使用変数の警告抑制

      const state = game.getState() as PokerState;
      state.nextHandReady = Array.from(nextHandReadyRef.current);
      rtcRef.current?.broadcast({ type: 'game_update', state });
      setPokerState({ ...state });
    };
  }, [showGameOver]);

  // プレイヤーアクション（ホスト側）
  const processAction = useCallback(
    (data: { playerId: string; action: string; amount?: number }) => {
      const game = gameRef.current;
      if (!game) return;

      const playerIndex = game.players.findIndex(
        (p) => p.id === data.playerId
      );
      if (playerIndex === -1) return;

      if (data.action === 'fold') game.fold(playerIndex);
      else if (data.action === 'check') game.check(playerIndex);
      else if (data.action === 'call') game.call(playerIndex);
      else if (data.action === 'bet') game.bet(playerIndex, data.amount ?? 0);

      const newState = game.getState() as PokerState;
      rtcRef.current?.broadcast({ type: 'game_update', state: newState });
      setPokerState(newState);

      // ホストは自分の broadcast を受け取らないため、ここでチップを更新
      const me = newState.players.find((p: Player) => p.id === myPlayerIdRef.current);
      if (me) myLastChipsRef.current = me.chips;
    },
    []
  );

  // WebRTC メッセージハンドラ（ref 経由で常に最新を参照）
  const handleMessageImpl = (message: string) => {
    const data = JSON.parse(message) as {
      type: string;
      [key: string]: unknown;
    };

    switch (data.type) {
      case 'join': {
        if (!isHostRef.current) return;
        const name = data.name as string;
        const playerId = Date.now().toString();
        const newPlayer: Player = { id: playerId, name, chips: buyinRef.current };
        const updated = [...roomPlayersRef.current, newPlayer];
        allPlayersRef.current = [...allPlayersRef.current, newPlayer];
        setRoomPlayersSync(updated);
        rtcRef.current?.broadcast({
          type: 'state',
          state: {
            players: updated,
            buyin: buyinRef.current,
            sb: sbRef.current,
            bb: bbRef.current,
          },
        });
        rtcRef.current?.broadcast({ type: 'player_id', playerId, name });
        break;
      }

      case 'player_id':
        if ((data.name as string) === myPlayerNameRef.current) {
          setMyPlayerIdSync(data.playerId as string);
        }
        break;

      case 'state': {
        const rs = data.state as {
          players: Player[];
          buyin?: number;
          sb?: number;
          bb?: number;
        };
        setRoomPlayersSync(rs.players);
        if (rs.buyin) setBuyinSync(rs.buyin);
        if (rs.sb) setSbSync(rs.sb);
        if (rs.bb) setBbSync(rs.bb);
        break;
      }

      case 'blinds':
        setSbSync(data.sb as number);
        setBbSync(data.bb as number);
        break;

      case 'game_start':
        nextHandReadyRef.current.clear();
        setPokerState(data.state as PokerState);
        setScreen('playing');
        break;

      case 'game_update': {
        const gs = data.state as PokerState;
        setPokerState(gs);
        if (gs.players) {
          setRoomPlayersSync(
            gs.players.map((p: Player) => ({
              id: p.id,
              name: p.name,
              chips: p.chips,
            }))
          );
          // 自分のチップ数を別途保持（bust後もroomPlayersRefから消えるため）
          const me = gs.players.find((p: Player) => p.id === myPlayerIdRef.current);
          if (me) myLastChipsRef.current = me.chips;
        }
        break;
      }

      case 'game_restart': {
        const allP = data.allPlayers as Player[] | undefined;
        if (allP) setRoomPlayersSync(allP);
        setPokerState(data.state as PokerState);
        setScreen('playing');
        break;
      }

      case 'game_over': {
        setScreen('gameover');
        // myLastChipsRef で精算（roomPlayersRef は bust 後更新されるため使わない）
        settleGameResult(myLastChipsRef.current);
        break;
      }

      case 'return_to_lobby': {
        setPokerState(null);
        setCurrentRoomId(null);
        setRoomPlayersSync([]);
        allPlayersRef.current = [];
        setIsHostSync(false);
        setMyPlayerIdSync(null);
        setMyPlayerNameSync(null);
        setScreen('setup');
        break;
      }

      case 'ready_next_hand':
        if (!isHostRef.current) return;
        nextHandReadyRef.current.add(data.playerId as string);
        checkAllReadyRef.current();
        break;

      case 'action':
        if (isHostRef.current) {
          processAction({
            playerId: data.playerId as string,
            action: data.action as string,
            amount: data.amount as number | undefined,
          });
        }
        break;

      case 'leave_game': {
        if (!isHostRef.current) return;
        const leavingId = data.playerId as string;
        const game = gameRef.current;
        if (game) {
          const idx = game.players.findIndex((p) => p.id === leavingId);
          if (idx !== -1) {
            const player = game.players[idx];
            if (!player.folded && game.phase !== 'WINNER' && game.phase !== 'SHOWDOWN') {
              if (game.turnIndex === idx) {
                // 自分のターンならフォールド処理（turn を正しく進める）
                player.chips = 0;
                game.fold(idx);
              } else {
                // 自分のターン以外：直接フォールド済みにする
                player.folded = true;
                player.acted = true;
                player.chips = 0;
              }
            } else {
              player.chips = 0;
            }
          }
        }
        const newState = game?.getState() as PokerState | undefined;
        if (newState && game) {
          rtcRef.current?.broadcast({ type: 'game_update', state: newState });
          setPokerState(newState);
          const remaining = game.players.filter((p) => p.chips > 0);
          if (remaining.length < 2) {
            showGameOver();
          }
        }
        break;
      }

      case 'reentry_request': {
        if (!isHostRef.current) return;
        const playerId = data.playerId as string;
        const playerName = data.name as string;
        const reentryChips = buyinRef.current;
        pendingReentriesRef.current = [
          ...pendingReentriesRef.current,
          { id: playerId, name: playerName, chips: reentryChips },
        ];
        rtcRef.current?.broadcast({
          type: 'reentry_approved',
          playerId,
          chips: reentryChips,
        });
        break;
      }

      case 'reentry_approved': {
        const approvedId = data.playerId as string;
        if (approvedId === myPlayerIdRef.current) {
          const addedChips = data.chips as number;
          // 累積バイイン更新（精算時に正しい損益を計算するため）
          buyinRef.current += addedChips;
          setBuyin(buyinRef.current);
          myLastChipsRef.current = addedChips;
        }
        break;
      }
    }
  };

  const handleMessageRef = useRef(handleMessageImpl);
  handleMessageRef.current = handleMessageImpl;
  const handleMessage = useCallback(
    (msg: string) => handleMessageRef.current(msg),
    []
  );

  // ルーム作成
  const createRoom = useCallback(
    async (buyinVal: number, sbVal: number, bbVal: number) => {
      const name = await getPlayerName();
      setMyPlayerNameSync(name);
      setIsHostSync(true);
      setBuyinSync(buyinVal);
      setSbSync(sbVal);
      setBbSync(bbVal);

      const { WebRTCManager } = await import('@/lib/webrtc');
      const rtc = new WebRTCManager(true);
      rtcRef.current = rtc;
      rtc.onMessage = handleMessage;

      const roomId = await rtc.createRoom();
      const playerId = Date.now().toString();
      setMyPlayerIdSync(playerId);
      setCurrentRoomId(roomId);

      // ルームメタ情報を RTDB に保存
      try {
        const { ref, set } = await import('firebase/database');
        const { db } = await import('@/lib/firebase');
        const { auth } = await import('@/lib/firebase');
        await set(ref(db, `roomMeta/${roomId}`), {
          buyin: buyinVal,
          sb: sbVal,
          bb: bbVal,
          hostUid: auth.currentUser?.uid ?? '',
          hostName: name,
          createdAt: Date.now(),
        });
        // プロフィールの activeRoomId を更新
        const { firestore } = await import('@/lib/firebase');
        const { doc, updateDoc } = await import('firebase/firestore');
        const uid = auth.currentUser?.uid;
        if (uid) {
          await updateDoc(doc(firestore, 'users', uid), {
            activeRoomId: roomId,
            updatedAt: Date.now(),
          });
        }
      } catch {
        // メタ保存失敗はゲーム進行をブロックしない
      }

      const hostPlayer: Player = { id: playerId, name, chips: buyinVal };
      allPlayersRef.current = [hostPlayer];
      setRoomPlayersSync([hostPlayer]);
      setScreen('waiting');
    },
    [handleMessage]
  );

  // ルーム参加
  const joinRoom = useCallback(
    async (roomId: string) => {
      const name = await getPlayerName();
      setMyPlayerNameSync(name);
      setIsHostSync(false);
      setCurrentRoomId(roomId);

      const { WebRTCManager } = await import('@/lib/webrtc');
      const rtc = new WebRTCManager(false);
      rtcRef.current = rtc;
      rtc.onMessage = handleMessage;
      rtc.onConnected = () => rtc.send({ type: 'join', name });

      await rtc.joinRoom(roomId);

      // プロフィールの activeRoomId を更新
      try {
        const { auth, firestore } = await import('@/lib/firebase');
        const { doc, updateDoc } = await import('firebase/firestore');
        const uid = auth.currentUser?.uid;
        if (uid) {
          await updateDoc(doc(firestore, 'users', uid), {
            activeRoomId: roomId,
            updatedAt: Date.now(),
          });
        }
      } catch {
        // activeRoomId 更新失敗はゲーム進行をブロックしない
      }

      setScreen('waiting');
    },
    [handleMessage]
  );

  // ゲーム開始
  const startGame = useCallback(() => {
    const players = roomPlayersRef.current;
    if (players.length < 2) {
      alert('最低2人必要です');
      return;
    }

    // 初期チップを記録
    myLastChipsRef.current = buyinRef.current;

    const game = new PokerGame(players, sbRef.current, bbRef.current);
    gameRef.current = game;
    game.start();

    const state = game.getState() as PokerState;
    rtcRef.current?.broadcast({ type: 'game_start', state });
    setPokerState(state);
    setScreen('playing');
  }, []);

  // アクション送信
  const sendAction = useCallback(
    (action: string, amount?: number) => {
      const amountNum = amount ?? 0;
      if (isHostRef.current) {
        processAction({ playerId: myPlayerIdRef.current!, action, amount: amountNum });
      } else {
        rtcRef.current?.send({
          type: 'action',
          playerId: myPlayerIdRef.current,
          action,
          amount: amountNum,
        });
      }
    },
    [processAction]
  );

  // 次ハンド準備
  const readyNextHand = useCallback(() => {
    if (isHostRef.current) {
      nextHandReadyRef.current.add(myPlayerIdRef.current!);
      checkAllReadyRef.current();
    } else {
      rtcRef.current?.send({
        type: 'ready_next_hand',
        playerId: myPlayerIdRef.current,
      });
    }
  }, []);

  // ゲーム再スタート（アカウント残高制のため精算後にトップへ戻す）
  const restartGame = useCallback(() => {
    if (isHostRef.current && rtcRef.current) {
      rtcRef.current.broadcast({ type: 'return_to_lobby' });
    }
    // ルームメタを削除
    import('@/lib/firebase').then(({ db, auth }) => {
      import('firebase/database').then(({ ref, remove }) => {
        if (currentRoomId) remove(ref(db, `roomMeta/${currentRoomId}`));
      });
    }).catch(() => {});
    setPokerState(null);
    setCurrentRoomId(null);
    setRoomPlayersSync([]);
    allPlayersRef.current = [];
    pendingReentriesRef.current = [];
    setIsHostSync(false);
    setMyPlayerIdSync(null);
    setMyPlayerNameSync(null);
    setScreen('setup');
  }, [currentRoomId]);

  // ブラインド更新
  const updateBlinds = useCallback((newSb: number, newBb: number) => {
    setSbSync(newSb);
    setBbSync(newBb);
    rtcRef.current?.broadcast({ type: 'blinds', sb: newSb, bb: newBb });
  }, []);

  // 途中退席（非ホスト用）
  const leaveGame = useCallback(async () => {
    await settleGameResult(myLastChipsRef.current);
    rtcRef.current?.send({
      type: 'leave_game',
      playerId: myPlayerIdRef.current,
    });
    setPokerState(null);
    setCurrentRoomId(null);
    setRoomPlayersSync([]);
    allPlayersRef.current = [];
    setIsHostSync(false);
    setMyPlayerIdSync(null);
    setMyPlayerNameSync(null);
    setScreen('setup');
  }, []);

  // リエントリー申請
  const requestReentry = useCallback(() => {
    rtcRef.current?.send({
      type: 'reentry_request',
      playerId: myPlayerIdRef.current,
      name: myPlayerNameRef.current,
    });
  }, []);

  return (
    <GameContext.Provider
      value={{
        screen,
        isHost,
        myPlayerId,
        myPlayerName,
        currentRoomId,
        roomPlayers,
        buyin,
        sb,
        bb,
        pokerState,
        createRoom,
        joinRoom,
        startGame,
        sendAction,
        readyNextHand,
        restartGame,
        updateBlinds,
        leaveGame,
        requestReentry,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
