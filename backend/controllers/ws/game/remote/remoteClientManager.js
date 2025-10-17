export function broadcastRemoteGameState(gameState, session) {
    session.players.forEach(p => {
        if (p.connected && !p.removed && p.socket && p.socket.readyState === 1) {
            try {
                p.socket.send(JSON.stringify({ type: "state", state: gameState }));
            } catch (err) {
                // Można obsłużyć błąd
            }
        }
    });
}
