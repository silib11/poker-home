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
    name: string,
    buyin: number,
    sb: number,
    bb: number
  ) => Promise<void>;
  joinRoom: (roomId: string, name: string) => Promise<void>;
  startGame: () => void;
  sendAction: (action: string, amount?: number) => void;
  readyNextHand: () => void;
  restartGame: () => void;
  updateBlinds: (sb: number, bb: number) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('setup');
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
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

  // ゲームオーバー
  const showGameOver = useCallback(() => {
    setScreen('gameover');
    if (isHostRef.current && rtcRef.current) {
      rtcRef.current.broadcast({ type: 'game_over' });
    }
  }, []);

  // 相互参照が必要な関数を ref で保持
  const startNextHandRef = useRef<() => void>(() => {});
  const checkAllReadyRef = useRef<() => void>(() => {});

  // useEffect で最新の実装を ref に詰める
  React.useEffect(() => {
    startNextHandRef.current = () => {
      const game = gameRef.current;
      if (!game) return;

      const activePlayers = game.players
        .filter((p) => p.chips > 0)
        .map((p) => ({ id: p.id, name: p.name, chips: p.chips }));

      if (activePlayers.length < 2) {
        showGameOver();
        return;
      }

      const nextDealerIndex = (game.dealerIndex + 1) % activePlayers.length;
      const newGame = new PokerGame(activePlayers, sbRef.current, bbRef.current);
      newGame.dealerIndex = nextDealerIndex;
      newGame.start();
      gameRef.current = newGame;

      const state = newGame.getState() as PokerState;
      rtcRef.current?.broadcast({ type: 'game_start', state });
      setPokerState(state);
      setScreen('playing');
    };

    checkAllReadyRef.current = () => {
      const game = gameRef.current;
      if (!game) return;

      const activePlayers = game.players.filter((p) => p.chips > 0);
      if (nextHandReadyRef.current.size >= activePlayers.length) {
        nextHandReadyRef.current.clear();
        startNextHandRef.current();
        return;
      }

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

      case 'game_over':
        setScreen('gameover');
        break;

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
    async (name: string, buyinVal: number, sbVal: number, bbVal: number) => {
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

      const hostPlayer: Player = { id: playerId, name, chips: buyinVal };
      allPlayersRef.current = [hostPlayer];
      setRoomPlayersSync([hostPlayer]);
      setScreen('waiting');
    },
    [handleMessage]
  );

  // ルーム参加
  const joinRoom = useCallback(
    async (roomId: string, name: string) => {
      setMyPlayerNameSync(name);
      setIsHostSync(false);
      setCurrentRoomId(roomId);

      const { WebRTCManager } = await import('@/lib/webrtc');
      const rtc = new WebRTCManager(false);
      rtcRef.current = rtc;
      rtc.onMessage = handleMessage;
      rtc.onConnected = () => rtc.send({ type: 'join', name });

      await rtc.joinRoom(roomId);
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

  // ゲーム再スタート
  const restartGame = useCallback(() => {
    const allPlayers = allPlayersRef.current.map((p) => ({
      id: p.id,
      name: p.name,
      chips: buyinRef.current,
    }));

    const game = new PokerGame(allPlayers, sbRef.current, bbRef.current);
    gameRef.current = game;
    game.start();

    const state = game.getState() as PokerState;
    setRoomPlayersSync(allPlayers);
    rtcRef.current?.broadcast({
      type: 'game_restart',
      state,
      buyin: buyinRef.current,
      allPlayers,
    });
    setPokerState(state);
    setScreen('playing');
  }, []);

  // ブラインド更新
  const updateBlinds = useCallback((newSb: number, newBb: number) => {
    setSbSync(newSb);
    setBbSync(newBb);
    rtcRef.current?.broadcast({ type: 'blinds', sb: newSb, bb: newBb });
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
