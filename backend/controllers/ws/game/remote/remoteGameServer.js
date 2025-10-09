import { createRemoteSession, getSession } from '../local/sessionManager.js';

// Handle WebSocket connection for online game
export function handleRemoteConnection(connection, req) {
    console.log('Nowe połączenie WebSocket dla gry online');
    const socket = connection.socket || connection;
    let sessionId = req.query.sessionId;
    let session;

    // If no sessionId provided, create a new session
    if (!sessionId) {
        sessionId = createRemoteSession();
        session = getSession(sessionId);
        session.players = [socket];
        socket.playerId = 1;
        console.log(`Utworzono nową sesję ${sessionId}. Liczba graczy: ${session.players.length}`);
    } else {
        session = getSession(sessionId);
        if (session && session.players.length < 2) {
            session.players.push(socket);
            socket.playerId = session.players.length;
            console.log(`Gracz dołączył do sesji ${sessionId}. Liczba graczy: ${session.players.length}`);
        } else {
            // Send error message and close connection
            socket.send(JSON.stringify({ type: "error", message: "Session full or not found" }));
            socket.close();
            return;
        }
    }

    // If only one player, send waiting info
    if (session.players.length === 1) {
        socket.send(JSON.stringify({ type: "waiting", message: "Waiting for second player..." }));
        console.log("Waiting for second player...");
    }
}
