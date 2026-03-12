import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, onValue, remove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyCc_I2QJWLdeVsaTW_g9Cs3SNK6KRnULeA",
    authDomain: "poker-home-62fab.firebaseapp.com",
    databaseURL: "https://poker-home-62fab-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "poker-home-62fab",
    storageBucket: "poker-home-62fab.firebasestorage.app",
    messagingSenderId: "619012333652",
    appId: "1:619012333652:web:2fa9678ba423d7f6b10dc1"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export class WebRTCManager {
    constructor(isHost) {
        this.isHost = isHost;
        this.connections = [];
        this.onMessage = null;
        this.onConnected = null;
        this.onStatusChange = null;
        this.iceServers = null;
    }

    async getIceServers() {
        if (this.iceServers) {
            return this.iceServers;
        }
        
        try {
            // Vercel Serverless Functionから取得
            const response = await fetch('/api/turn-credentials');
            if (!response.ok) {
                throw new Error('Failed to fetch TURN credentials');
            }
            const data = await response.json();
            this.iceServers = data.iceServers;
            return this.iceServers;
        } catch (error) {
            console.error('TURN credentials fetch error:', error);
            // フォールバック: STUNのみ
            this.iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ];
            return this.iceServers;
        }
    }

    async createRoom() {
        // アルファベットのみのルームID生成（6文字）
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let roomId = '';
        for (let i = 0; i < 6; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.roomId = roomId;
        
        // Listen for new players
        onValue(ref(db, `rooms/${roomId}/players`), (snapshot) => {
            const players = snapshot.val();
            if (players) {
                Object.keys(players).forEach(playerId => {
                    if (!this.connections.find(c => c.id === playerId)) {
                        this.connectToPlayer(roomId, playerId);
                    }
                });
            }
        });

        return roomId;
    }

    async connectToPlayer(roomId, playerId) {
        const iceServers = await this.getIceServers();
        const pc = new RTCPeerConnection({ iceServers });

        const dataChannel = pc.createDataChannel('poker');
        const conn = { id: playerId, pc, dataChannel };
        this.connections.push(conn);

        this.setupDataChannel(dataChannel);

        // 接続状態の監視
        pc.onconnectionstatechange = () => {
            console.log(`[Host→${playerId}] 接続状態: ${pc.connectionState}`);
            if (this.onStatusChange) {
                this.onStatusChange(`接続状態: ${pc.connectionState}`);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[Host→${playerId}] ICE状態: ${pc.iceConnectionState}`);
        };

        // ICE候補を配列で保存
        let iceIndex = 0;
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                console.log(`[Host→${playerId}] ICE候補送信: ${iceIndex}`);
                set(ref(db, `rooms/${roomId}/ice/host_${playerId}/${iceIndex++}`), JSON.stringify(e.candidate));
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await set(ref(db, `rooms/${roomId}/offers/${playerId}`), JSON.stringify(offer));
        console.log(`[Host→${playerId}] Offer送信完了`);

        onValue(ref(db, `rooms/${roomId}/answers/${playerId}`), async (snapshot) => {
            if (snapshot.val() && pc.remoteDescription === null) {
                console.log(`[Host→${playerId}] Answer受信`);
                await pc.setRemoteDescription(JSON.parse(snapshot.val()));
            }
        });

        // ICE候補を配列で受信
        onValue(ref(db, `rooms/${roomId}/ice/player_${playerId}`), async (snapshot) => {
            if (snapshot.val()) {
                const candidates = snapshot.val();
                for (const key in candidates) {
                    try {
                        await pc.addIceCandidate(JSON.parse(candidates[key]));
                        console.log(`[Host→${playerId}] ICE候補追加: ${key}`);
                    } catch (err) {
                        console.error(`[Host→${playerId}] ICE候補追加エラー:`, err);
                    }
                }
            }
        });
    }

    async joinRoom(roomId) {
        const playerId = Math.random().toString(36).substring(2, 8);
        this.playerId = playerId;
        
        console.log(`[Player ${playerId}] ルーム参加: ${roomId}`);
        await set(ref(db, `rooms/${roomId}/players/${playerId}`), true);

        const iceServers = await this.getIceServers();
        const pc = new RTCPeerConnection({ iceServers });

        pc.ondatachannel = (e) => {
            console.log(`[Player ${playerId}] DataChannel受信`);
            this.dataChannel = e.channel;
            this.setupDataChannel(this.dataChannel);
        };

        // 接続状態の監視
        pc.onconnectionstatechange = () => {
            console.log(`[Player ${playerId}] 接続状態: ${pc.connectionState}`);
            if (this.onStatusChange) {
                this.onStatusChange(`接続状態: ${pc.connectionState}`);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[Player ${playerId}] ICE状態: ${pc.iceConnectionState}`);
        };

        // ICE候補を配列で保存
        let iceIndex = 0;
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                console.log(`[Player ${playerId}] ICE候補送信: ${iceIndex}`);
                set(ref(db, `rooms/${roomId}/ice/player_${playerId}/${iceIndex++}`), JSON.stringify(e.candidate));
            }
        };

        onValue(ref(db, `rooms/${roomId}/offers/${playerId}`), async (snapshot) => {
            if (snapshot.val() && pc.remoteDescription === null) {
                console.log(`[Player ${playerId}] Offer受信`);
                await pc.setRemoteDescription(JSON.parse(snapshot.val()));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await set(ref(db, `rooms/${roomId}/answers/${playerId}`), JSON.stringify(answer));
                console.log(`[Player ${playerId}] Answer送信完了`);
            }
        });

        // ICE候補を配列で受信
        onValue(ref(db, `rooms/${roomId}/ice/host_${playerId}`), async (snapshot) => {
            if (snapshot.val()) {
                const candidates = snapshot.val();
                for (const key in candidates) {
                    try {
                        await pc.addIceCandidate(JSON.parse(candidates[key]));
                        console.log(`[Player ${playerId}] ICE候補追加: ${key}`);
                    } catch (err) {
                        console.error(`[Player ${playerId}] ICE候補追加エラー:`, err);
                    }
                }
            }
        });

        this.pc = pc;
    }

    setupDataChannel(channel) {
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

    send(data) {
        const msg = typeof data === 'string' ? data : JSON.stringify(data);
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(msg);
        }
    }

    broadcast(data) {
        const msg = typeof data === 'string' ? data : JSON.stringify(data);
        this.connections.forEach(conn => {
            if (conn.dataChannel && conn.dataChannel.readyState === 'open') {
                conn.dataChannel.send(msg);
            }
        });
    }
}
