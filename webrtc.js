// WebRTC Manager with TURN server support
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, onValue, remove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// Debug logger
const debugLog = (msg) => {
    console.log(msg);
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        const time = new Date().toLocaleTimeString();
        logEl.innerHTML += `[${time}] ${msg}<br>`;
        logEl.scrollTop = logEl.scrollHeight;
        // Keep only last 50 lines
        const lines = logEl.innerHTML.split('<br>');
        if (lines.length > 50) {
            logEl.innerHTML = lines.slice(-50).join('<br>');
        }
    }
};

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
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
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
        debugLog('[Host] Connecting to player: ' + playerId);
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                },
                {
                    urls: 'turn:192.158.29.39:3478?transport=udp',
                    username: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    credential: '28224511:1379330808'
                },
                {
                    urls: 'turn:192.158.29.39:3478?transport=tcp',
                    username: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    credential: '28224511:1379330808'
                }
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10
        });

        const iceCandidateQueue = [];

        pc.oniceconnectionstatechange = () => {
            debugLog('[Host] ICE state: ' + pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
            debugLog('[Host] Connection state: ' + pc.connectionState);
        };

        const dataChannel = pc.createDataChannel('poker');
        const conn = { id: playerId, pc, dataChannel };
        this.connections.push(conn);

        this.setupDataChannel(dataChannel);

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                debugLog('[Host] ICE: ' + e.candidate.type + ' ' + e.candidate.protocol + ' ' + e.candidate.address);
                const iceRef = ref(db, `rooms/${roomId}/ice/host_${playerId}/${Date.now()}`);
                set(iceRef, JSON.stringify(e.candidate));
            } else {
                debugLog('[Host] ICE gathering complete');
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        // Wait for ICE gathering to complete
        await new Promise((resolve) => {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                pc.addEventListener('icegatheringstatechange', () => {
                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    }
                });
            }
        });
        
        debugLog('[Host] ICE gathering complete, sending offer');
        await set(ref(db, `rooms/${roomId}/offers/${playerId}`), JSON.stringify(pc.localDescription));

        onValue(ref(db, `rooms/${roomId}/answers/${playerId}`), async (snapshot) => {
            if (snapshot.val() && pc.remoteDescription === null) {
                debugLog('[Host] Received answer from: ' + playerId);
                await pc.setRemoteDescription(JSON.parse(snapshot.val()));
                
                // Process queued candidates
                debugLog('[Host] Processing ' + iceCandidateQueue.length + ' queued candidates');
                for (const candidate of iceCandidateQueue) {
                    try {
                        await pc.addIceCandidate(candidate);
                    } catch (e) {
                        debugLog('ERROR [Host] queued candidate: ' + e);
                    }
                }
                iceCandidateQueue.length = 0;
            }
        });

        onValue(ref(db, `rooms/${roomId}/ice/player_${playerId}`), async (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
                for (const candidateStr of Object.values(candidates)) {
                    const candidate = JSON.parse(candidateStr);
                    if (pc.remoteDescription) {
                        debugLog('[Host] Adding ICE candidate from player');
                        try {
                            await pc.addIceCandidate(candidate);
                        } catch (e) {
                            debugLog('ERROR [Host] ICE candidate: ' + e);
                        }
                    } else {
                        iceCandidateQueue.push(candidate);
                    }
                }
            }
        });
    }

    async joinRoom(roomId) {
        const playerId = Math.random().toString(36).substring(2, 8);
        this.playerId = playerId;
        
        debugLog('[Player] Joining: ' + roomId + ' as ' + playerId);
        await set(ref(db, `rooms/${roomId}/players/${playerId}`), true);

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                },
                {
                    urls: 'turn:192.158.29.39:3478?transport=udp',
                    username: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    credential: '28224511:1379330808'
                },
                {
                    urls: 'turn:192.158.29.39:3478?transport=tcp',
                    username: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                    credential: '28224511:1379330808'
                }
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10
        });

        const iceCandidateQueue = [];

        pc.oniceconnectionstatechange = () => {
            debugLog('[Player] ICE state: ' + pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
            debugLog('[Player] Connection state: ' + pc.connectionState);
        };

        pc.ondatachannel = (e) => {
            debugLog('[Player] Data channel received');
            this.dataChannel = e.channel;
            this.setupDataChannel(this.dataChannel);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                debugLog('[Player] ICE: ' + e.candidate.type + ' ' + e.candidate.protocol + ' ' + e.candidate.address);
                const iceRef = ref(db, `rooms/${roomId}/ice/player_${playerId}/${Date.now()}`);
                set(iceRef, JSON.stringify(e.candidate));
            } else {
                debugLog('[Player] ICE gathering complete');
            }
        };

        onValue(ref(db, `rooms/${roomId}/offers/${playerId}`), async (snapshot) => {
            if (snapshot.val() && pc.remoteDescription === null) {
                debugLog('[Player] Received offer');
                await pc.setRemoteDescription(JSON.parse(snapshot.val()));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                // Wait for ICE gathering to complete
                await new Promise((resolve) => {
                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    } else {
                        pc.addEventListener('icegatheringstatechange', () => {
                            if (pc.iceGatheringState === 'complete') {
                                resolve();
                            }
                        });
                    }
                });
                
                debugLog('[Player] ICE gathering complete, sending answer');
                await set(ref(db, `rooms/${roomId}/answers/${playerId}`), JSON.stringify(pc.localDescription));
                
                // Process queued candidates
                debugLog('[Player] Processing ' + iceCandidateQueue.length + ' queued candidates');
                for (const candidate of iceCandidateQueue) {
                    try {
                        await pc.addIceCandidate(candidate);
                    } catch (e) {
                        debugLog('ERROR [Player] queued candidate: ' + e);
                    }
                }
                iceCandidateQueue.length = 0;
            }
        });

        onValue(ref(db, `rooms/${roomId}/ice/host_${playerId}`), async (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
                for (const candidateStr of Object.values(candidates)) {
                    const candidate = JSON.parse(candidateStr);
                    if (pc.remoteDescription) {
                        debugLog('[Player] Adding ICE candidate from host');
                        try {
                            await pc.addIceCandidate(candidate);
                        } catch (e) {
                            debugLog('ERROR [Player] ICE candidate: ' + e);
                        }
                    } else {
                        iceCandidateQueue.push(candidate);
                    }
                }
            }
        });

        this.pc = pc;
    }

    setupDataChannel(channel) {
        channel.onopen = () => {
            debugLog('[DataChannel] Opened');
            if (this.onStatusChange) this.onStatusChange('接続完了');
            if (this.onConnected) this.onConnected();
        };

        channel.onmessage = (e) => {
            debugLog('[DataChannel] Message received');
            if (this.onMessage) this.onMessage(e.data);
        };

        channel.onclose = () => {
            debugLog('[DataChannel] Closed');
            if (this.onStatusChange) this.onStatusChange('切断');
        };

        channel.onerror = (e) => {
            debugLog('ERROR: ' + '[DataChannel] Error:', e);
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
