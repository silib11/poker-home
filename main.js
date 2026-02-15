import { WebRTCManager } from './webrtc.js';

const status = document.getElementById('status');
const createBtn = document.getElementById('create-room');
const joinBtn = document.getElementById('join-room');
const roomIdDisplay = document.getElementById('room-id-display');
const roomIdInput = document.getElementById('room-id-input');
const testSection = document.getElementById('test-section');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-message');
const messagesDiv = document.getElementById('messages');

let rtc;

function addMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = `${new Date().toLocaleTimeString()}: ${text}`;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

createBtn.addEventListener('click', async () => {
    status.textContent = 'ルーム作成中...';
    rtc = new WebRTCManager(true);
    
    rtc.onStatusChange = (s) => status.textContent = s;
    rtc.onMessage = (msg) => addMessage(`受信: ${msg}`);
    rtc.onConnected = () => {
        testSection.style.display = 'block';
        addMessage('接続成功！');
    };
    
    const roomId = await rtc.createRoom();
    roomIdDisplay.textContent = `ルームID: ${roomId}`;
    addMessage(`ルーム作成: ${roomId}`);
});

joinBtn.addEventListener('click', async () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) return;
    
    status.textContent = '接続中...';
    rtc = new WebRTCManager(false);
    
    rtc.onStatusChange = (s) => status.textContent = s;
    rtc.onMessage = (msg) => addMessage(`受信: ${msg}`);
    rtc.onConnected = () => {
        testSection.style.display = 'block';
        addMessage('接続成功！');
    };
    
    await rtc.joinRoom(roomId);
});

sendBtn.addEventListener('click', () => {
    const msg = messageInput.value.trim();
    if (!msg) return;
    
    rtc.send(msg);
    addMessage(`送信: ${msg}`);
    messageInput.value = '';
});
