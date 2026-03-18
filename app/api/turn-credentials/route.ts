import { NextResponse } from 'next/server';

export function GET() {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'stun:a.relay.metered.ca:80',
        'turn:a.relay.metered.ca:80',
        'turn:a.relay.metered.ca:443',
        'turns:a.relay.metered.ca:443',
      ],
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    },
  ];

  return NextResponse.json({ iceServers });
}
