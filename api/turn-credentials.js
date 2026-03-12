// Vercel Serverless Function
// TURN認証情報を安全に提供

export default async function handler(req, res) {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // 環境変数から取得
        const turnServer = process.env.TURN_SERVER_URL;
        const turnUsername = process.env.TURN_USERNAME;
        const turnCredential = process.env.TURN_CREDENTIAL;
        
        if (!turnServer || !turnUsername || !turnCredential) {
            return res.status(500).json({ error: 'TURN server not configured' });
        }
        
        // 一時的な認証情報を生成（オプション: 時間制限付き）
        const ttl = 24 * 3600; // 24時間
        const timestamp = Math.floor(Date.now() / 1000) + ttl;
        const username = `${timestamp}:${turnUsername}`;
        
        // ICE Servers設定を返す
        const iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: `turn:${turnServer}:3478`,
                username: username,
                credential: turnCredential
            },
            {
                urls: `turn:${turnServer}:3478?transport=tcp`,
                username: username,
                credential: turnCredential
            },
            {
                urls: `turns:${turnServer}:5349`,
                username: username,
                credential: turnCredential
            }
        ];
        
        res.status(200).json({ iceServers });
    } catch (error) {
        console.error('TURN credentials error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
