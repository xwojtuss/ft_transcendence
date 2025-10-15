// Zarządza klientami WebSocket w sesjach remote
const clients = [];

export function addRemoteClient(socket) {
    clients.push(socket);
}

export function removeRemoteClient(socket) {
    const idx = clients.indexOf(socket);
    if (idx !== -1) clients.splice(idx, 1);
}

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

export function getRemoteClientCount() {
    return clients.length;
}