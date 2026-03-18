import { ref, set, onValue } from 'firebase/database';
import { db } from './firebase';

export class WebRTCManager {
  private isHost: boolean;
  public connections: Array<{
    id: string;
    pc: RTCPeerConnection;
    dataChannel: RTCDataChannel;
  }>;
  public dataChannel?: RTCDataChannel;
  public pc?: RTCPeerConnection;
  public roomId?: string;
  public playerId?: string;
  private iceServersCache: RTCIceServer[] | null = null;

  onMessage: ((message: string) => void) | null = null;
  onConnected: (() => void) | null = null;
  onStatusChange: ((status: string) => void) | null = null;

  constructor(isHost: boolean) {
    this.isHost = isHost;
    this.connections = [];
  }

  async getIceServers(): Promise<RTCIceServer[]> {
    if (this.iceServersCache) return this.iceServersCache;

    try {
      const response = await fetch('/api/turn-credentials');
      if (!response.ok) throw new Error('Failed to fetch TURN credentials');
      const data = await response.json();
      this.iceServersCache = data.iceServers;
      return this.iceServersCache!;
    } catch {
      this.iceServersCache = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];
      return this.iceServersCache;
    }
  }

  async createRoom(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.roomId = roomId;

    onValue(ref(db, `rooms/${roomId}/players`), (snapshot) => {
      const players = snapshot.val();
      if (players) {
        Object.keys(players).forEach((playerId) => {
          if (!this.connections.find((c) => c.id === playerId)) {
            this.connectToPlayer(roomId, playerId);
          }
        });
      }
    });

    return roomId;
  }

  async connectToPlayer(roomId: string, playerId: string): Promise<void> {
    const iceServers = await this.getIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    const dataChannel = pc.createDataChannel('poker');
    const conn = { id: playerId, pc, dataChannel };
    this.connections.push(conn);

    this.setupDataChannel(dataChannel);

    pc.onconnectionstatechange = () => {
      console.log(`[Host→${playerId}] 接続状態: ${pc.connectionState}`);
      if (this.onStatusChange)
        this.onStatusChange(`接続状態: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Host→${playerId}] ICE状態: ${pc.iceConnectionState}`);
    };

    let iceIndex = 0;
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        set(
          ref(db, `rooms/${roomId}/ice/host_${playerId}/${iceIndex++}`),
          JSON.stringify(e.candidate)
        );
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await set(
      ref(db, `rooms/${roomId}/offers/${playerId}`),
      JSON.stringify(offer)
    );

    onValue(
      ref(db, `rooms/${roomId}/answers/${playerId}`),
      async (snapshot) => {
        if (snapshot.val() && pc.remoteDescription === null) {
          await pc.setRemoteDescription(JSON.parse(snapshot.val()));
        }
      }
    );

    onValue(
      ref(db, `rooms/${roomId}/ice/player_${playerId}`),
      async (snapshot) => {
        if (snapshot.val()) {
          const candidates = snapshot.val();
          for (const key in candidates) {
            try {
              await pc.addIceCandidate(JSON.parse(candidates[key]));
            } catch (err) {
              console.error(`ICE候補追加エラー:`, err);
            }
          }
        }
      }
    );
  }

  async joinRoom(roomId: string): Promise<void> {
    const playerId = Math.random().toString(36).substring(2, 8);
    this.playerId = playerId;

    await set(ref(db, `rooms/${roomId}/players/${playerId}`), true);

    const iceServers = await this.getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    pc.ondatachannel = (e) => {
      this.dataChannel = e.channel;
      this.setupDataChannel(this.dataChannel);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Player ${playerId}] 接続状態: ${pc.connectionState}`);
      if (this.onStatusChange)
        this.onStatusChange(`接続状態: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Player ${playerId}] ICE状態: ${pc.iceConnectionState}`);
    };

    let iceIndex = 0;
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        set(
          ref(db, `rooms/${roomId}/ice/player_${playerId}/${iceIndex++}`),
          JSON.stringify(e.candidate)
        );
      }
    };

    onValue(
      ref(db, `rooms/${roomId}/offers/${playerId}`),
      async (snapshot) => {
        if (snapshot.val() && pc.remoteDescription === null) {
          await pc.setRemoteDescription(JSON.parse(snapshot.val()));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(
            ref(db, `rooms/${roomId}/answers/${playerId}`),
            JSON.stringify(answer)
          );
        }
      }
    );

    onValue(
      ref(db, `rooms/${roomId}/ice/host_${playerId}`),
      async (snapshot) => {
        if (snapshot.val()) {
          const candidates = snapshot.val();
          for (const key in candidates) {
            try {
              await pc.addIceCandidate(JSON.parse(candidates[key]));
            } catch (err) {
              console.error(`ICE候補追加エラー:`, err);
            }
          }
        }
      }
    );

    this.pc = pc;
  }

  setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('[DataChannel] 接続完了');
      if (this.onStatusChange) this.onStatusChange('接続完了');
      if (this.onConnected) this.onConnected();
    };

    channel.onmessage = (e) => {
      if (this.onMessage) this.onMessage(e.data);
    };

    channel.onclose = () => {
      console.log('[DataChannel] 切断');
      if (this.onStatusChange) this.onStatusChange('切断');
    };

    channel.onerror = (err) => {
      console.error('[DataChannel] エラー:', err);
      if (this.onStatusChange) this.onStatusChange('エラー');
    };
  }

  send(message: object): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    }
  }

  broadcast(message: object): void {
    const data = JSON.stringify(message);
    this.connections.forEach((conn) => {
      if (conn.dataChannel && conn.dataChannel.readyState === 'open') {
        conn.dataChannel.send(data);
      }
    });
  }
}
