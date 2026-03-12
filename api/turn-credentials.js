export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: [
                'stun:a.relay.metered.ca:80',
                'turn:a.relay.metered.ca:80',
                'turn:a.relay.metered.ca:443',
                'turns:a.relay.metered.ca:443'
            ],
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_CREDENTIAL
        }
    ];
    
    res.status(200).json({ iceServers });
}
