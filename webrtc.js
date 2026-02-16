// WebRTC Manager with TURN server support
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
    }

    async createRoom() {
        const roomId = Math.random().toString(36).substring(2, 8);
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
        console.log('[Host] Connecting to player:', playerId);
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                {
                    urls: 'turn:turn.cloudflare.com:3478',
                    username: 'cloudflare',
                    credential: 'cloudflare'
                }
            ]
        });

        pc.oniceconnectionstatechange = () => {
            console.log('[Host] ICE state:', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
            console.log('[Host] Connection state:', pc.connectionState);
        };

        const dataChannel = pc.createDataChannel('poker');
        const conn = { id: playerId, pc, dataChannel };
        this.connections.push(conn);

        this.setupDataChannel(dataChannel);

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                console.log('[Host] Sending ICE candidate:', e.candidate.type);
                const iceRef = ref(db, `rooms/${roomId}/ice/host_${playerId}/${Date.now()}`);
                set(iceRef, JSON.stringify(e.candidate));
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await set(ref(db, `rooms/${roomId}/offers/${playerId}`), JSON.stringify(offer));

        onValue(ref(db, `rooms/${roomId}/answers/${playerId}`), async (snapshot) => {
            if (snapshot.val() && pc.remoteDescription === null) {
                console.log('[Host] Received answer from player:', playerId);
                await pc.setRemoteDescription(JSON.parse(snapshot.val()));
            }
        });

        onValue(ref(db, `rooms/${roomId}/ice/player_${playerId}`), async (snapshot) => {
            const candidates = snapshot.val();
            if (candidates && pc.remoteDescription) {
                Object.values(candidates).forEach(async (candidateStr) => {
                    console.log('[Host] Received ICE candidate from player');
                    try {
                        await pc.addIceCandidate(JSON.parse(candidateStr));
                    } catch (e) {
                        console.error('[Host] Error adding ICE candidate:', e);
                    }
                });
            }
        });
    }

    async joinRoom(roomId) {
        const playerId = Math.random().toString(36).substring(2, 8);
        this.playerId = playerId;
        
        console.log('[Player] Joining room:', roomId, 'as', playerId);
        await set(ref(db, `rooms/${roomId}/players/${playerId}`), true);

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                {
                    urls: 'turn:turn.cloudflare.com:3478',
                    username: 'cloudflare',
                    credential: 'cloudflare'
                }
            ]
        });

        pc.oniceconnectionstatechange = () => {
            console.log('[Player] ICE state:', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
            console.log('[Player] Connection state:', pc.connectionState);
        };

        pc.ondatachannel = (e) => {
            console.log('[Player] Data channel received');
            this.dataChannel = e.channel;
            this.setupDataChannel(this.dataChannel);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                console.log('[Player] Sending ICE candidate:', e.candidate.type);
                const iceRef = ref(db, `rooms/${roomId}/ice/player_${playerId}/${Date.now()}`);
                set(iceRef, JSON.stringify(e.candidate));
            }
        };

        onValue(ref(db, `rooms/${roomId}/offers/${playerId}`), async (snapshot) => {
            if (snapshot.val() && pc.remoteDescription === null) {
                console.log('[Player] Received offer');
                await pc.setRemoteDescription(JSON.parse(snapshot.val()));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                console.log('[Player] Sending answer');
                await set(ref(db, `rooms/${roomId}/answers/${playerId}`), JSON.stringify(answer));
            }
        });

        onValue(ref(db, `rooms/${roomId}/ice/host_${playerId}`), async (snapshot) => {
            const candidates = snapshot.val();
            if (candidates && pc.remoteDescription) {
                Object.values(candidates).forEach(async (candidateStr) => {
                    console.log('[Player] Received ICE candidate from host');
                    try {
                        await pc.addIceCandidate(JSON.parse(candidateStr));
                    } catch (e) {
                        console.error('[Player] Error adding ICE candidate:', e);
                    }
                });
            }
        });

        this.pc = pc;
    }

    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('[DataChannel] Opened');
            if (this.onStatusChange) this.onStatusChange('接続完了');
            if (this.onConnected) this.onConnected();
        };

        channel.onmessage = (e) => {
            console.log('[DataChannel] Message received');
            if (this.onMessage) this.onMessage(e.data);
        };

        channel.onclose = () => {
            console.log('[DataChannel] Closed');
            if (this.onStatusChange) this.onStatusChange('切断');
        };

        channel.onerror = (e) => {
            console.error('[DataChannel] Error:', e);
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
