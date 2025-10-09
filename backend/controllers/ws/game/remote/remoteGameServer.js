import { createRemoteSession, getSession, getAllSessions } from '../local/sessionManager.js';

// Obsługa połączenia WebSocket dla gry online
export function handleRemoteConnection(connection, req) {
    console.log('Nowe połączenie WebSocket dla gry online');
    const socket = connection.socket || connection;
    let sessionId = req.query.sessionId;
    let session;

    // Szukaj otwartej sesji z jednym graczem
    if (!sessionId) {
        for (const [id, s] of getAllSessions()) {
            if (s.players && s.players.length === 1) {
                sessionId = id;
                session = s;
                break;
            }
        }
    }

    // Jeśli nie znaleziono, utwórz nową sesję
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

            // Wyślij info do obu graczy, że jest komplet
            session.players.forEach((ws, idx) => {
                ws.send(JSON.stringify({
                    type: "ready",
                    message: "Found enemy! You can start the game.",
                    players: session.players.length,
                    playerId: idx + 1
                }));
            });
        } else {
            socket.send(JSON.stringify({ type: "error", message: "Session full or not found" }));
            socket.close();
            return;
        }
    }

    // Jeśli tylko jeden gracz, wyślij info o oczekiwaniu
    if (session.players.length === 1) {
        socket.send(JSON.stringify({ type: "waiting", message: "Waiting for second player..." }));
        console.log("Waiting for second player...");
    }
}
