import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, onValue, remove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export class WebRTCManager {
    constructor(isHost) {
        this.isHost = isHost;
        this.pc = null;
        this.dataChannel = null;
        this.onMessage = null;
        this.onConnected = null;
        this.onStatusChange = null;
    }

    async createRoom() {
        const roomId = Math.random().toString(36).substring(2, 8);
        
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.dataChannel = this.pc.createDataChannel('poker');
        this.setupDataChannel();

        this.pc.onicecandidate = (e) => {
            if (e.candidate) {
                set(ref(db, `rooms/${roomId}/host/ice`), JSON.stringify(e.candidate));
            }
        };

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await set(ref(db, `rooms/${roomId}/offer`), JSON.stringify(offer));

        onValue(ref(db, `rooms/${roomId}/answer`), async (snapshot) => {
            if (snapshot.val() && this.pc.remoteDescription === null) {
                await this.pc.setRemoteDescription(JSON.parse(snapshot.val()));
            }
        });

        onValue(ref(db, `rooms/${roomId}/guest/ice`), async (snapshot) => {
            if (snapshot.val()) {
                await this.pc.addIceCandidate(JSON.parse(snapshot.val()));
            }
        });

        return roomId;
    }

    async joinRoom(roomId) {
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.pc.ondatachannel = (e) => {
            this.dataChannel = e.channel;
            this.setupDataChannel();
        };

        this.pc.onicecandidate = (e) => {
            if (e.candidate) {
                set(ref(db, `rooms/${roomId}/guest/ice`), JSON.stringify(e.candidate));
            }
        };

        onValue(ref(db, `rooms/${roomId}/offer`), async (snapshot) => {
            if (snapshot.val() && this.pc.remoteDescription === null) {
                await this.pc.setRemoteDescription(JSON.parse(snapshot.val()));
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                await set(ref(db, `rooms/${roomId}/answer`), JSON.stringify(answer));
            }
        });

        onValue(ref(db, `rooms/${roomId}/host/ice`), async (snapshot) => {
            if (snapshot.val()) {
                await this.pc.addIceCandidate(JSON.parse(snapshot.val()));
            }
        });
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => {
            if (this.onStatusChange) this.onStatusChange('接続完了');
            if (this.onConnected) this.onConnected();
        };

        this.dataChannel.onmessage = (e) => {
            if (this.onMessage) this.onMessage(e.data);
        };

        this.dataChannel.onclose = () => {
            if (this.onStatusChange) this.onStatusChange('切断');
        };
    }

    send(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(typeof data === 'string' ? data : JSON.stringify(data));
        }
    }
}
