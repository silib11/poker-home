'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import { PokerGame as PokerGameBase } from '../core/poker.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PokerGame = PokerGameBase as any as new (...args: unknown[]) => InstanceType<typeof PokerGameBase>;
import type {
  Player,
  PokerState,
  Screen,
  TournamentConfig,
  TournamentProgress,
  TournamentRank,
} from '@/types';
import { useAuth } from '@/context/AuthContext';

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
  tournamentConfig: TournamentConfig | null;
  tournamentProgress: TournamentProgress | null;
  spectatorIds: string[];
  rankList: TournamentRank[];
  showTournamentResult: boolean;
  createRoom: (
    buyin: number,
    sb: number,
    bb: number,
    tournamentConfig?: TournamentConfig
  ) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  startGame: () => void;
  sendAction: (action: string, amount?: number) => void;
  readyNextHand: () => void;
  restartGame: () => void;
  updateBlinds: (sb: number, bb: number) => void;
  leaveGame: () => Promise<void>;
  requestReentry: () => void;
  dismissTournamentResult: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { refreshProfile, saveGameResult } = useAuth();
  const refreshProfileRef = useRef<() => Promise<void>>(() => Promise.resolve());
  refreshProfileRef.current = refreshProfile;
  const saveGameResultRef = useRef<(totalBuyin: number, finalStack: number, roomId: string) => Promise<void>>(() => Promise.resolve());
  saveGameResultRef.current = saveGameResult;

  const [screen, setScreen] = useState<Screen>('setup');
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

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
  const [roomBuyin, setRoomBuyin] = useState(1000);
  const [sb, setSb] = useState(10);
  const [bb, setBb] = useState(20);
  const [pokerState, setPokerState] = useState<PokerState | null>(null);

  // トーナメント関連ステート
  const [tournamentConfig, setTournamentConfig] = useState<TournamentConfig | null>(null);
  const [tournamentProgress, setTournamentProgress] = useState<TournamentProgress | null>(null);
  const [spectatorIds, setSpectatorIds] = useState<string[]>([]);
  const [rankList, setRankList] = useState<TournamentRank[]>([]);
  const [showTournamentResult, setShowTournamentResult] = useState(false);

  // ref（コールバック内で最新値を参照するため）
  const isHostRef = useRef(false);
  const myPlayerIdRef = useRef<string | null>(null);
  const myPlayerNameRef = useRef<string | null>(null);
  const sbRef = useRef(10);
  const bbRef = useRef(20);
  const roomBuyinRef = useRef(1000);
  const playerTotalBuyinRef = useRef(0);
  const rtcRef = useRef<import('@/lib/webrtc').WebRTCManager | null>(null);
  const gameRef = useRef<InstanceType<typeof PokerGame> | null>(null);
  const nextHandReadyRef = useRef<Set<string>>(new Set());
  const allPlayersRef = useRef<Player[]>([]);
  const roomPlayersRef = useRef<Player[]>([]);
  const myLastChipsRef = useRef<number>(0);
  const pendingJoinsRef = useRef<Array<{ id: string; name: string; chips: number }>>([]);
  const pendingReentriesRef = pendingJoinsRef;
  const isPlayingRef = useRef(false);

  // トーナメント専用 ref
  const tournamentConfigRef = useRef<TournamentConfig | null>(null);
  const tournamentProgressRef = useRef<TournamentProgress | null>(null);
  const spectatorIdsRef = useRef<Set<string>>(new Set());
  const bustOrderRef = useRef<number>(0);
  const rankListRef = useRef<TournamentRank[]>([]);
  const handNumberRef = useRef<number>(0);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // state と ref を同時更新
  const setIsHostSync = (v: boolean) => { isHostRef.current = v; setIsHost(v); };
  const setMyPlayerIdSync = (v: string | null) => { myPlayerIdRef.current = v; setMyPlayerId(v); };
  const setMyPlayerNameSync = (v: string | null) => { myPlayerNameRef.current = v; setMyPlayerName(v); };
  const setSbSync = (v: number) => { sbRef.current = v; setSb(v); };
  const setBbSync = (v: number) => { bbRef.current = v; setBb(v); };
  const setRoomBuyinSync = (v: number) => { roomBuyinRef.current = v; setRoomBuyin(v); };
  const setRoomPlayersSync = (v: Player[]) => { roomPlayersRef.current = v; setRoomPlayers(v); };
  const setTournamentProgressSync = (v: TournamentProgress | null) => {
    tournamentProgressRef.current = v;
    setTournamentProgress(v);
  };
  const setSpectatorIdsSync = (ids: Set<string>) => {
    spectatorIdsRef.current = ids;
    setSpectatorIds([...ids]);
  };
  const setRankListSync = (list: TournamentRank[]) => {
    rankListRef.current = list;
    setRankList([...list]);
  };

  // ゲーム終了時の精算処理
  async function settleGameResult(finalStack: number) {
    try {
      await saveGameResultRef.current(
        playerTotalBuyinRef.current,
        finalStack,
        rtcRef.current?.roomId ?? ''
      );
    } catch {
      // 精算失敗はゲーム進行をブロックしない
    }
  }

  // アクションタイマーをクリア
  function clearActionTimer() {
    if (actionTimerRef.current !== null) {
      clearTimeout(actionTimerRef.current);
      actionTimerRef.current = null;
    }
  }

  // レベルタイマーをクリア
  function clearLevelTimer() {
    if (levelTimerRef.current !== null) {
      clearTimeout(levelTimerRef.current);
      levelTimerRef.current = null;
    }
  }

  // ブラインドレベルを次に進める（ホスト専用）
  const advanceLevelRef = useRef<() => void>(() => {});
  const scheduleLevelTimerRef = useRef<() => void>(() => {});

  React.useEffect(() => {
    advanceLevelRef.current = () => {
      const config = tournamentConfigRef.current;
      const progress = tournamentProgressRef.current;
      if (!config || !progress) return;

      const nextLevel = progress.currentLevel + 1;
      if (nextLevel >= config.blindLevels.length) return;

      const nextBlind = config.blindLevels[nextLevel];
      const newProgress: TournamentProgress = {
        currentLevel: nextLevel,
        levelStartedAt: Date.now(),
        isPaused: false,
        pausedRemaining: 0,
      };
      setTournamentProgressSync(newProgress);
      setSbSync(nextBlind.sb);
      setBbSync(nextBlind.bb);
      rtcRef.current?.broadcast({
        type: 'blinds',
        sb: nextBlind.sb,
        bb: nextBlind.bb,
      });
      rtcRef.current?.broadcast({
        type: 'tournament_progress',
        progress: newProgress,
      });
      scheduleLevelTimerRef.current();
    };

    scheduleLevelTimerRef.current = () => {
      clearLevelTimer();
      const config = tournamentConfigRef.current;
      const progress = tournamentProgressRef.current;
      if (!config || !progress) return;
      if (progress.currentLevel >= config.blindLevels.length - 1) return;

      const levelDef = config.blindLevels[progress.currentLevel];
      const elapsed = Date.now() - progress.levelStartedAt;
      const totalMs = levelDef.durationMinutes * 60 * 1000;
      const remaining = Math.max(totalMs - elapsed, 0);

      levelTimerRef.current = setTimeout(() => {
        advanceLevelRef.current();
      }, remaining);
    };
  }, []);

  // アクションタイマーをスケジュール（ホスト専用）
  const scheduleActionTimerRef = useRef<(deadline: number, turnIdx: number) => void>(() => {});

  React.useEffect(() => {
    scheduleActionTimerRef.current = (deadline: number, turnIdx: number) => {
      clearActionTimer();
      const delay = Math.max(deadline - Date.now(), 0);
      actionTimerRef.current = setTimeout(() => {
        const game = gameRef.current;
        if (!game) return;
        const g = game as unknown as { turnIndex: number; phase: string; currentBet: number };
        if (g.turnIndex !== turnIdx) return;
        if (g.phase === 'SHOWDOWN' || g.phase === 'WINNER') return;

        const player = game.players[turnIdx];
        if (!player || player.folded || player.chips === 0) return;

        const currentBet = g.currentBet;
        const playerBet = player.bet ?? 0;
        if (currentBet > playerBet) {
          game.fold(turnIdx);
        } else {
          game.check(turnIdx);
        }

        const newState = game.getState() as PokerState;
        attachTournamentState(newState);
        rtcRef.current?.broadcast({ type: 'game_update', state: newState });
        setPokerState({ ...newState });

        const me = newState.players.find((p: Player) => p.id === myPlayerIdRef.current);
        if (me) myLastChipsRef.current = me.chips;

        if (newState.phase !== 'SHOWDOWN' && newState.phase !== 'WINNER') {
          const nextDeadline = Date.now() + 25000;
          newState.turnDeadlineAt = nextDeadline;
          rtcRef.current?.broadcast({ type: 'game_update', state: newState });
          setPokerState({ ...newState });
          scheduleActionTimerRef.current(nextDeadline, newState.turnIndex);
        }
      }, delay);
    };
  }, []);

  // PokerState にトーナメント情報を付加
  function attachTournamentState(state: PokerState) {
    state.spectatorIds = [...spectatorIdsRef.current];
    state.handNumber = handNumberRef.current;
    state.tournamentProgress = tournamentProgressRef.current ?? undefined;
  }

  // ゲームオーバー
  const showGameOver = useCallback(() => {
    clearActionTimer();
    isPlayingRef.current = false;
    setScreen('gameover');
    if (isHostRef.current && rtcRef.current) {
      rtcRef.current.broadcast({ type: 'game_over' });
    }
    settleGameResult(myLastChipsRef.current).finally(() => {
      refreshProfileRef.current();
    });
  }, []);

  const startNextHandRef = useRef<() => void>(() => {});
  const checkAllReadyRef = useRef<() => void>(() => {});

  React.useEffect(() => {
    startNextHandRef.current = () => {
      const game = gameRef.current;
      if (!game) return;

      handNumberRef.current += 1;

      const config = tournamentConfigRef.current;
      const progress = tournamentProgressRef.current;

      // バスト検知：トーナメントModeの場合は観戦者 or リエントリー判定
      const bustedPlayers = game.players.filter((p) => p.chips === 0 && !spectatorIdsRef.current.has(p.id));
      for (const busted of bustedPlayers) {
        if (config?.enabled) {
          const currentLevel = progress?.currentLevel ?? 0;
          if (currentLevel < config.reentryUntilLevel) {
            // リエントリー可能レベル内 → 既存リエントリーフローに任せる（pendingJoinsに入っていれば継続）
          } else {
            // リエントリー締め切り後 → 観戦者として登録
            const newSpectators = new Set(spectatorIdsRef.current);
            newSpectators.add(busted.id);
            setSpectatorIdsSync(newSpectators);
            bustOrderRef.current += 1;
            const newRank: TournamentRank = {
              rank: 0,
              playerId: busted.id,
              playerName: busted.name,
              bustLevel: currentLevel + 1,
              bustHandNumber: handNumberRef.current,
            };
            const newList = [newRank, ...rankListRef.current];
            setRankListSync(newList);
            rtcRef.current?.broadcast({ type: 'spectator_update', spectatorIds: [...newSpectators] });
          }
        }
      }

      // chips > 0 の継続プレイヤー
      const continuingPlayers = game.players
        .filter((p) => p.chips > 0)
        .map((p) => ({ id: p.id, name: p.name, chips: p.chips }));

      // 待機キューを処理（重複除去）
      const pending = pendingJoinsRef.current.filter(
        (j) => !continuingPlayers.find((p) => p.id === j.id)
      );
      pendingJoinsRef.current = [];

      const tentativeDealer = (game.dealerIndex + 1) % Math.max(continuingPlayers.length, 1);
      const utgInsertPos = (tentativeDealer + 3) % (continuingPlayers.length + pending.length || 1);

      const reversed = [...pending].reverse();
      let players = [...continuingPlayers];
      for (const newcomer of reversed) {
        const pos = Math.min(utgInsertPos, players.length);
        players = [...players.slice(0, pos), newcomer, ...players.slice(pos)];
      }

      if (players.length < 2) {
        // トーナメント終了処理
        if (config?.enabled && players.length >= 1) {
          const winner = players[0];
          const finalRanks: TournamentRank[] = [
            { rank: 1, playerId: winner.id, playerName: winner.name, bustLevel: (progress?.currentLevel ?? 0) + 1, bustHandNumber: handNumberRef.current },
            ...rankListRef.current.map((r, i) => ({ ...r, rank: i + 2 })),
          ];
          setRankListSync(finalRanks);
          setShowTournamentResult(true);
          rtcRef.current?.broadcast({ type: 'tournament_end', rankList: finalRanks });
          clearLevelTimer();
        }
        showGameOver();
        return;
      }

      const firstContinuing = continuingPlayers[0];
      const newDealerIndex = firstContinuing
        ? (players.findIndex((p) => p.id === continuingPlayers[tentativeDealer % continuingPlayers.length]?.id) + players.length) % players.length
        : 0;

      // アンティを取得（現在のレベルから）
      const currentBlindLevel = config?.enabled && progress
        ? config.blindLevels[progress.currentLevel]
        : null;
      const ante = currentBlindLevel?.ante ?? 0;

      const newGame = new PokerGame(players, sbRef.current, bbRef.current, { ante });
      newGame.dealerIndex = newDealerIndex;
      newGame.start();
      gameRef.current = newGame;

      const hostPlayer = players.find((p) => p.id === myPlayerIdRef.current);
      if (hostPlayer) myLastChipsRef.current = hostPlayer.chips;

      const state = newGame.getState() as PokerState;
      attachTournamentState(state);

      const deadline = Date.now() + 25000;
      state.turnDeadlineAt = deadline;

      rtcRef.current?.broadcast({ type: 'game_start', state });
      setPokerState(state);
      setScreen('playing');

      scheduleActionTimerRef.current(deadline, state.turnIndex);
    };

    checkAllReadyRef.current = () => {
      const game = gameRef.current;
      if (!game) return;

      const activePlayers = game.players.filter((p) => p.chips > 0);

      if (nextHandReadyRef.current.size >= Math.max(activePlayers.length, 1)) {
        nextHandReadyRef.current.clear();
        startNextHandRef.current();
        return;
      }

      const state = game.getState() as PokerState;
      attachTournamentState(state);
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

      clearActionTimer();

      const playerIndex = game.players.findIndex((p) => p.id === data.playerId);
      if (playerIndex === -1) return;

      if (data.action === 'fold') game.fold(playerIndex);
      else if (data.action === 'check') game.check(playerIndex);
      else if (data.action === 'call') game.call(playerIndex);
      else if (data.action === 'bet') game.bet(playerIndex, data.amount ?? 0);

      const newState = game.getState() as PokerState;
      attachTournamentState(newState);

      if (newState.phase !== 'SHOWDOWN' && newState.phase !== 'WINNER') {
        const deadline = Date.now() + 25000;
        newState.turnDeadlineAt = deadline;
        scheduleActionTimerRef.current(deadline, newState.turnIndex);
      }

      rtcRef.current?.broadcast({ type: 'game_update', state: newState });
      setPokerState(newState);

      const me = newState.players.find((p: Player) => p.id === myPlayerIdRef.current);
      if (me) myLastChipsRef.current = me.chips;
    },
    []
  );

  // WebRTC メッセージハンドラ
  const handleMessageImpl = (message: string) => {
    const data = JSON.parse(message) as { type: string; [key: string]: unknown };

    switch (data.type) {
      case 'join': {
        if (!isHostRef.current) return;
        const name = data.name as string;
        const playerId = Date.now().toString();
        const newPlayer: Player = { id: playerId, name, chips: roomBuyinRef.current };

        if (isPlayingRef.current) {
          pendingJoinsRef.current = [...pendingJoinsRef.current, { id: playerId, name, chips: roomBuyinRef.current }];
          allPlayersRef.current = [...allPlayersRef.current, newPlayer];
          rtcRef.current?.broadcast({ type: 'player_id', playerId, name });
          const currentState = gameRef.current?.getState() as PokerState | undefined;
          if (currentState) {
            attachTournamentState(currentState);
            rtcRef.current?.broadcast({ type: 'game_update', state: currentState });
          }
        } else {
          const updated = [...roomPlayersRef.current, newPlayer];
          allPlayersRef.current = [...allPlayersRef.current, newPlayer];
          setRoomPlayersSync(updated);
          rtcRef.current?.broadcast({
            type: 'state',
            state: {
              players: updated,
              buyin: roomBuyinRef.current,
              sb: sbRef.current,
              bb: bbRef.current,
              tournamentConfig: tournamentConfigRef.current,
            },
          });
          rtcRef.current?.broadcast({ type: 'player_id', playerId, name });
        }
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
          tournamentConfig?: TournamentConfig;
        };
        setRoomPlayersSync(rs.players);
        if (rs.buyin) {
          setRoomBuyinSync(rs.buyin);
          if (playerTotalBuyinRef.current === 0) {
            playerTotalBuyinRef.current = rs.buyin;
          }
        }
        if (rs.sb) setSbSync(rs.sb);
        if (rs.bb) setBbSync(rs.bb);
        if (rs.tournamentConfig) {
          tournamentConfigRef.current = rs.tournamentConfig;
          setTournamentConfig(rs.tournamentConfig);
        }
        break;
      }

      case 'blinds':
        setSbSync(data.sb as number);
        setBbSync(data.bb as number);
        break;

      case 'tournament_progress': {
        const prog = data.progress as TournamentProgress;
        setTournamentProgressSync(prog);
        break;
      }

      case 'spectator_update': {
        const ids = data.spectatorIds as string[];
        const newSet = new Set(ids);
        setSpectatorIdsSync(newSet);
        break;
      }

      case 'tournament_end': {
        const ranks = data.rankList as TournamentRank[];
        setRankListSync(ranks);
        setShowTournamentResult(true);
        break;
      }

      case 'game_start':
        isPlayingRef.current = true;
        nextHandReadyRef.current.clear();
        {
          const gs = data.state as PokerState;
          if (gs.spectatorIds) setSpectatorIdsSync(new Set(gs.spectatorIds));
          if (gs.tournamentProgress) setTournamentProgressSync(gs.tournamentProgress);
          if (gs.handNumber !== undefined) handNumberRef.current = gs.handNumber;
          setPokerState(gs);
          setScreen('playing');
        }
        break;

      case 'game_update': {
        const gs = data.state as PokerState;
        if (gs.spectatorIds) setSpectatorIdsSync(new Set(gs.spectatorIds));
        if (gs.tournamentProgress) setTournamentProgressSync(gs.tournamentProgress);
        if (gs.handNumber !== undefined) handNumberRef.current = gs.handNumber;
        setPokerState(gs);
        if (gs.players) {
          setRoomPlayersSync(
            gs.players.map((p: Player) => ({
              id: p.id,
              name: p.name,
              chips: p.chips,
            }))
          );
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
        clearActionTimer();
        isPlayingRef.current = false;
        setScreen('gameover');
        settleGameResult(myLastChipsRef.current).finally(() => {
          refreshProfileRef.current();
        });
        break;
      }

      case 'return_to_lobby': {
        clearActionTimer();
        clearLevelTimer();
        isPlayingRef.current = false;
        setPokerState(null);
        setCurrentRoomId(null);
        setRoomPlayersSync([]);
        allPlayersRef.current = [];
        pendingJoinsRef.current = [];
        playerTotalBuyinRef.current = 0;
        setIsHostSync(false);
        setMyPlayerIdSync(null);
        setMyPlayerNameSync(null);
        tournamentConfigRef.current = null;
        setTournamentConfig(null);
        setTournamentProgressSync(null);
        setSpectatorIdsSync(new Set());
        setRankListSync([]);
        handNumberRef.current = 0;
        bustOrderRef.current = 0;
        setShowTournamentResult(false);
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
            const gamePhase = (game as unknown as { phase: string }).phase;
            if (!player.folded && gamePhase !== 'WINNER' && gamePhase !== 'SHOWDOWN') {
              if ((game as unknown as { turnIndex: number }).turnIndex === idx) {
                player.chips = 0;
                clearActionTimer();
                game.fold(idx);
              } else {
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
          attachTournamentState(newState);
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

        // トーナメントModeでリエントリー締め切り後はリジェクト
        const config = tournamentConfigRef.current;
        const progress = tournamentProgressRef.current;
        if (config?.enabled && progress && progress.currentLevel >= config.reentryUntilLevel) {
          rtcRef.current?.broadcast({ type: 'reentry_rejected', playerId });
          return;
        }

        const reentryChips = roomBuyinRef.current;
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
          playerTotalBuyinRef.current += addedChips;
          myLastChipsRef.current = addedChips;
        }
        break;
      }

      case 'reentry_rejected': {
        const rejectedId = data.playerId as string;
        if (rejectedId === myPlayerIdRef.current) {
          // 観戦者として登録（自身側の処理）
          const newSet = new Set(spectatorIdsRef.current);
          newSet.add(rejectedId);
          setSpectatorIdsSync(newSet);
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
    async (buyinVal: number, sbVal: number, bbVal: number, tConfig?: TournamentConfig) => {
      const name = await getPlayerName();
      setMyPlayerNameSync(name);
      setIsHostSync(true);
      setRoomBuyinSync(buyinVal);
      setSbSync(sbVal);
      setBbSync(bbVal);

      if (tConfig) {
        tournamentConfigRef.current = tConfig;
        setTournamentConfig(tConfig);
        const initialProgress: TournamentProgress = {
          currentLevel: 0,
          levelStartedAt: 0,
          isPaused: false,
          pausedRemaining: 0,
        };
        setTournamentProgressSync(initialProgress);
      }

      const { WebRTCManager } = await import('@/lib/webrtc');
      const rtc = new WebRTCManager(true);
      rtcRef.current = rtc;
      rtc.onMessage = handleMessage;

      const roomId = await rtc.createRoom();
      const playerId = Date.now().toString();
      setMyPlayerIdSync(playerId);
      setCurrentRoomId(roomId);

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
          ...(tConfig ? { tournamentConfig: tConfig } : {}),
        });
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

      playerTotalBuyinRef.current = buyinVal;
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

    myLastChipsRef.current = roomBuyinRef.current;
    isPlayingRef.current = true;
    handNumberRef.current = 1;

    const config = tournamentConfigRef.current;
    const currentBlindLevel = config?.enabled ? config.blindLevels[0] : null;
    const ante = currentBlindLevel?.ante ?? 0;

    const game = new PokerGame(players, sbRef.current, bbRef.current, { ante });
    gameRef.current = game;
    game.start();

    // トーナメントタイマー開始
    if (config?.enabled) {
      const initialProgress: TournamentProgress = {
        currentLevel: 0,
        levelStartedAt: Date.now(),
        isPaused: false,
        pausedRemaining: 0,
      };
      setTournamentProgressSync(initialProgress);
      rtcRef.current?.broadcast({ type: 'tournament_progress', progress: initialProgress });
      // タイマーは次のtickで scheduleLevelTimerRef.current() を呼ぶ
      setTimeout(() => scheduleLevelTimerRef.current(), 0);
    }

    const state = game.getState() as PokerState;
    attachTournamentState(state);
    const deadline = Date.now() + 25000;
    state.turnDeadlineAt = deadline;

    rtcRef.current?.broadcast({ type: 'game_start', state });
    setPokerState(state);
    setScreen('playing');

    scheduleActionTimerRef.current(deadline, state.turnIndex);
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

  // ゲーム再スタート（ロビーへ戻す）
  const restartGame = useCallback(() => {
    clearActionTimer();
    clearLevelTimer();
    if (isHostRef.current && rtcRef.current) {
      rtcRef.current.broadcast({ type: 'return_to_lobby' });
    }
    import('@/lib/firebase').then(({ db }) => {
      import('firebase/database').then(({ ref, remove }) => {
        if (currentRoomId) remove(ref(db, `roomMeta/${currentRoomId}`));
      });
    }).catch(() => {});
    setPokerState(null);
    setCurrentRoomId(null);
    setRoomPlayersSync([]);
    allPlayersRef.current = [];
    pendingReentriesRef.current = [];
    playerTotalBuyinRef.current = 0;
    setIsHostSync(false);
    setMyPlayerIdSync(null);
    setMyPlayerNameSync(null);
    tournamentConfigRef.current = null;
    setTournamentConfig(null);
    setTournamentProgressSync(null);
    setSpectatorIdsSync(new Set());
    setRankListSync([]);
    handNumberRef.current = 0;
    bustOrderRef.current = 0;
    setShowTournamentResult(false);
    setScreen('setup');
  }, [currentRoomId]);

  // ブラインド更新
  const updateBlinds = useCallback((newSb: number, newBb: number) => {
    setSbSync(newSb);
    setBbSync(newBb);
    rtcRef.current?.broadcast({ type: 'blinds', sb: newSb, bb: newBb });
  }, []);

  // 途中退席
  const leaveGame = useCallback(async () => {
    clearActionTimer();
    clearLevelTimer();
    await settleGameResult(myLastChipsRef.current);
    refreshProfileRef.current();
    if (!isHostRef.current) {
      rtcRef.current?.send({
        type: 'leave_game',
        playerId: myPlayerIdRef.current,
      });
    }
    setPokerState(null);
    setCurrentRoomId(null);
    setRoomPlayersSync([]);
    allPlayersRef.current = [];
    pendingReentriesRef.current = [];
    playerTotalBuyinRef.current = 0;
    setIsHostSync(false);
    setMyPlayerIdSync(null);
    setMyPlayerNameSync(null);
    tournamentConfigRef.current = null;
    setTournamentConfig(null);
    setTournamentProgressSync(null);
    setSpectatorIdsSync(new Set());
    setRankListSync([]);
    handNumberRef.current = 0;
    bustOrderRef.current = 0;
    setShowTournamentResult(false);
    setScreen('setup');
  }, []);

  // リエントリー / 途中参加リクエスト
  const requestReentry = useCallback(() => {
    if (isHostRef.current) {
      const id = myPlayerIdRef.current;
      const name = myPlayerNameRef.current;
      if (!id || !name) return;

      // トーナメントModeでリエントリー締め切り後は観戦者へ
      const config = tournamentConfigRef.current;
      const progress = tournamentProgressRef.current;
      if (config?.enabled && progress && progress.currentLevel >= config.reentryUntilLevel) {
        const newSet = new Set(spectatorIdsRef.current);
        newSet.add(id);
        setSpectatorIdsSync(newSet);
        rtcRef.current?.broadcast({ type: 'spectator_update', spectatorIds: [...newSet] });
        return;
      }

      if (!pendingJoinsRef.current.find((p) => p.id === id)) {
        pendingJoinsRef.current = [
          ...pendingJoinsRef.current,
          { id, name, chips: roomBuyinRef.current },
        ];
      }
      playerTotalBuyinRef.current += roomBuyinRef.current;
      myLastChipsRef.current = roomBuyinRef.current;
    } else {
      rtcRef.current?.send({
        type: 'reentry_request',
        playerId: myPlayerIdRef.current,
        name: myPlayerNameRef.current,
      });
    }
  }, []);

  const dismissTournamentResult = useCallback(() => {
    setShowTournamentResult(false);
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
        buyin: roomBuyin,
        sb,
        bb,
        pokerState,
        tournamentConfig,
        tournamentProgress,
        spectatorIds,
        rankList,
        showTournamentResult,
        createRoom,
        joinRoom,
        startGame,
        sendAction,
        readyNextHand,
        restartGame,
        updateBlinds,
        leaveGame,
        requestReentry,
        dismissTournamentResult,
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
