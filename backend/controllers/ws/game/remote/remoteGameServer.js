import {
    FPS, FIELD_WIDTH, FIELD_HEIGHT,
    PADDLE_HEIGHT, PADDLE_WIDTH, BALL_SIZE
} from '../local/gameConfig.js';

const sessions = new Map();

function generateId() {
    return Math.random().toString(36).slice(2);
}

// --- GAMELOOP ---

function findOrCreateSessionForPlayer(playerId, socket) {
    // 1. Szukaj sesji, gdzie gracz już istnieje (reconnect)
    for (const session of sessions.values()) {
        const idx = session.players.findIndex(p => p.id === playerId);
        if (idx !== -1) {
            return session;
        }
    }
    // 2. Szukaj sesji z jednym graczem
    for (const session of sessions.values()) {
        if (session.players.length === 1 && session.players[0].connected) {
            return session;
        }
    }
    // 3. Brak sesji z jednym graczem, twórz nową
    const sessionId = generateId();
    const session = {
        id: sessionId,
        players: [],
        gameState: {}
    };
    sessions.set(sessionId, session);
    return session;
}

/*
    1. Funkcja jest wywoływana przy nowym połączeniu WebSocket do /ws/remoteGame
    2. Wysyła zapytanie do startRemoteGameLoop do jakiej sesji ma dołączyć
    3. Otrzymuje ID sesji i informacje o graczu (1 lub 2)
    4. Przy odświeżeniu strony/zerwaniu połączenia wysyła informację o rozłączeniu do startRemoteGameLoop -> startRemoteGameLoop czeka 5 sekund na ponowne połączenie jeżeli nie nastąpi to usuwa gracza
*/
export function handleRemoteConnection(connection, req) {
    const socket = connection.socket || connection;
    const playerId = req.query.playerId;

    // Zapytaj game loop o sesję do dołączenia
    let session = findOrCreateSessionForPlayer(playerId, socket);

    // Sprawdź, czy gracz już jest w tej sesji (reconnect)
    const existingIdx = session.players.findIndex(p => p.id === playerId);
    if (existingIdx !== -1) {
        // Reconnect
        const player = session.players[existingIdx];
        player.socket = socket;
        player.connected = true;
        player.lastDisconnect = null;
        socket.playerId = existingIdx + 1;
        socket.send(JSON.stringify({
            type: "reconnected",
            message: "Reconnected to session.",
            players: session.players.length,
            playerId: socket.playerId,
            sessionId: session.id
        }));
        return;
    }

    // Dodaj nowego gracza
    if (session.players.length < 2) {
        session.players.push({ id: playerId, socket, connected: true, lastDisconnect: null });
        socket.playerId = session.players.length;
        if (session.players.length === 1) {
            socket.send(JSON.stringify({
                type: "waiting",
                message: "Czekam na przeciwnika",
                players: 1,
                playerId: 1,
                sessionId: session.id
            }));
        } else if (session.players.length === 2) {
            session.players.forEach((p, idx) => {
                p.socket.send(JSON.stringify({
                    type: "ready",
                    message: "Znalazłem przeciwnika! Możesz zacząć grę.",
                    players: 2,
                    playerId: idx + 1,
                    sessionId: session.id
                }));
            });
        }
    } else {
        socket.send(JSON.stringify({ type: "error", message: "Session full or not found" }));
        socket.close();
        return;
    }

    // Rozłączenie: tylko ustaw flagę i czas
    socket.on('close', () => {
        const idx = session.players.findIndex(p => p.id === playerId);
        if (idx !== -1) {
            session.players[idx].connected = false;
            session.players[idx].lastDisconnect = Date.now();
            console.log(`[DEBUG] Player ${playerId} disconnected from session ${session.id}`);
        }
    });
}

/*
    1. Funkcja jest wywoływana w pętli co 1000/FPS ms od początku programu
    2. Odpowiada za stan sesji oraz informuje graczy do których sesji dołączyć
    3. Przechodzi przez wszystkie sesje i wykonuje logikę gry (fizyka, AI, scoring)
    4. Wysyła aktualizacje stanu gry do obu graczy w sesji
*/
// --- GAMELOOP ---
export function startRemoteGameLoop() {
    setInterval(() => {
        for (const [sessionId, session] of sessions.entries()) {
            // Usuwanie rozłączonych graczy po timeout
            session.players = session.players.filter(p => {
                if (!p.connected && p.lastDisconnect && Date.now() - p.lastDisconnect > 5000) {
                    console.log(`[DEBUG] Usuwam gracza ${p.id} z sesji ${sessionId} po timeout`);
                    return false;
                }
                return true;
            });

            // Usuwanie pustych sesji
            if (session.players.length === 0) {
                sessions.delete(sessionId);
                console.log(`[DEBUG] Usunięto pustą sesję: ${sessionId}`);
                continue;
            }

            // --- LOGIKA GRY ---
            // if (session.players.length === 2 && session.players.every(p => p.connected)) {
            //     const gameState = session.gameState || {};
            //     session.players.forEach(p => {
            //         p.socket.send(JSON.stringify({
            //             type: "state",
            //             state: gameState
            //         }));
            //     });
            // }
        }
    }, 1000 / FPS);
}
