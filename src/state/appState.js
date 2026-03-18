export const appState = {
    rtc: null,
    isHost: false,
    game: null,
    myPlayerId: null,
    myPlayerName: null,
    currentRoomId: null,
    nextHandReady: new Set(),
    allPlayers: [],
    lastRenderedState: null,
    gameState: {
        players: [],
        buyin: 1000,
        sb: 10,
        bb: 20
    }
};
