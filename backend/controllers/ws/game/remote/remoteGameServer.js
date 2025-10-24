import { getUserSession } from '../../../view/viewUtils.js';

import {
    FPS, FIELD_WIDTH, FIELD_HEIGHT
} from '../local/gameConfig.js';

import { createRemoteGameState } from './remoteGameState.js';
import { broadcastRemoteGameState } from './remoteClientManager.js';
import { startGame, updateGame } from '../local/gameLogic.js';

const sessions = new Map();

const SEND_TIMEOUT_MS = 5000;
const BROADCAST_INTERVAL = 2; // broadcast co N ticków (zmniejsz, żeby oszczędzić CPU)

// --- Utilities --------------------------------------------------------------

function generateId() {
    return Math.random().toString(36).slice(2);
}

function sendSafe(socket, payload) {
    try {
        socket.send(JSON.stringify(payload));
    } catch (err) { /* ignore */ }
}

function sendConfig(socket) {
    sendSafe(socket, { type: "config", FIELD_WIDTH, FIELD_HEIGHT });
}

function sendState(socket, state) {
    sendSafe(socket, { type: "state", state });
}

function now() {
    return Date.now();
}

// --- Session helpers -------------------------------------------------------

function findSessionByPlayer(playerId) {
    for (const session of sessions.values()) {
        if (session.players.some(p => p.id === playerId)) return session;
    }
    return null;
}

function findWaitingSession() {
    for (const session of sessions.values()) {
        if (session.players.length === 1 && session.players[0].connected) return session;
    }
    return null;
}

function createSession() {
    const id = generateId();
    const session = { id, players: [], gameState: {}, lastUpdate: now() };
    sessions.set(id, session);
    return session;
}

function findOrCreateSessionForPlayer(playerId) {
    return findSessionByPlayer(playerId) || findWaitingSession() || createSession();
}

// --- Socket handlers -------------------------------------------------------

function setupSocketHandlers(socket, session, playerId) {
    // remove previously attached listeners (prevents duplicate handlers / MaxListenersExceededWarning)
    try {
        if (typeof socket.removeAllListeners === 'function') {
            socket.removeAllListeners('message');
            socket.removeAllListeners('close');
        }
        // allow unlimited listeners on this socket (optional)
        if (typeof socket.setMaxListeners === 'function') {
            socket.setMaxListeners(0);
        }
    } catch (e) { /* ignore */ }

    socket.on('message', (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch (err) {
            return;
        }

        const idx = session.players.findIndex(p => p.id === playerId);

        if (data.type === "clientDisconnecting") {
            if (idx !== -1) {
                session.players[idx].connected = false;
                session.players[idx].lastDisconnect = now();
            }
            return;
        }

        if ((data.type === 'keydown' || data.type === 'keyup') && idx !== -1) {
            handlePlayerInput(session, idx, data);
        }
    });

    socket.on('close', () => {
        const idx = session.players.findIndex(p => p.id === playerId);
        if (idx !== -1) {
            session.players[idx].connected = false;
            session.players[idx].lastDisconnect = now();
        }
    });
}

function handlePlayerInput(session, playerIndex, data) {
    const sessionPlayer = session.players[playerIndex];
    const playerNumber = sessionPlayer.playerNumber;

    if (!session.gameState || !session.gameState.players || !session.gameState.players[playerNumber]) return;

    const gsPlayer = session.gameState.players[playerNumber];
    if (!gsPlayer.keyState) gsPlayer.keyState = { up: false, down: false };

    const isDown = data.type === 'keydown';
    if (data.key === 'w' || data.key === 'ArrowUp') {
        gsPlayer.keyState.up = isDown;
    } else if (data.key === 's' || data.key === 'ArrowDown') {
        gsPlayer.keyState.down = isDown;
    }

    const up = gsPlayer.keyState.up ? 1 : 0;
    const down = gsPlayer.keyState.down ? 1 : 0;
    gsPlayer.dy = (down - up);
}

// --- Player lifecycle ------------------------------------------------------

function reconnectPlayer(session, socket, playerId, existingIdx) {
    const player = session.players[existingIdx];
    player.socket = socket;
    player.connected = true;
    player.lastDisconnect = null;
    player.removed = false;

    socket.playerId = existingIdx + 1;
    socket.playerNumber = player.playerNumber;

    setupSocketHandlers(socket, session, playerId);

    sendSafe(socket, {
        type: "reconnected",
        message: "Reconnected to session.",
        players: session.players.filter(p => !p.removed).length,
        playerId: socket.playerNumber,
        sessionId: session.id
    });

    if (session.gameState) {
        sendState(socket, session.gameState);
        sendConfig(socket);
    }

    // If after reconnect the player is alone in the session, inform them to wait for opponent
    try {
        const presentPlayers = session.players.filter(p => !p.removed).length;
        if (presentPlayers === 1) {
            sendSafe(socket, {
                type: "waiting",
                message: "Waiting for opponent to join...",
                players: presentPlayers,
                playerId: socket.playerNumber,
                sessionId: session.id
            });
        }
    } catch (e) { /* ignore */ }

    // Notify all other connected players that this player reconnected
    try {
        for (const other of session.players) {
            if (other === player) continue;
            if (other.socket && other.connected && !other.removed) {
                sendSafe(other.socket, {
                    type: "reconnected",
                    message: "Opponent reconnected.",
                    players: session.players.filter(p => !p.removed).length,
                    playerId: other.playerNumber,
                    sessionId: session.id
                });
            }
        }
    } catch (e) { /* ignore notification errors */ }
}

function addNewPlayer(session, socket, playerId, fastify, providedNick) {
    const playerNumber = session.players.length + 1;
    const playerNick = providedNick ?? getUserSession(fastify).nickname;

    const player = {
        id: playerId,
        socket,
        connected: true,
        lastDisconnect: null,
        playerNumber,
        removed: false,
        nick: playerNick
    };
    session.players.push(player);

    socket.playerId = session.players.length;
    socket.playerNumber = playerNumber;

    setupSocketHandlers(socket, session, playerId);

    if (session.players.length === 1) {
        // inform the sole player that they are waiting for an opponent
        try {
            // send config early so frontend can initialize canvas/dimensions
            sendConfig(socket);
            sendSafe(socket, {
                type: "waiting",
                message: "Waiting for opponent to join...",
                players: 1,
                playerId: playerNumber,
                sessionId: session.id
            });
        } catch (e) { /* ignore */ }
        return;
    }

    // two players -> notify, init state and auto-start
    notifyAllReady(session);
    sendConfigToAll(session);

    try {
        session.gameState = createRemoteGameState();
        session.players.forEach((p, idx) => {
            const playerNumber = idx + 1;
            if (session.gameState.players[playerNumber]) {
                session.gameState.players[playerNumber].connected = !!p.connected;
                session.gameState.players[playerNumber].removed = !!p.removed;
                session.gameState.players[playerNumber].nick = p.nick;
            }
        });

        broadcastRemoteGameState(session.gameState, session);

        setTimeout(() => {
            try { notifyAllReady(session); } catch (e) { /* ignore */ }
        }, 50);

        setTimeout(() => {
            if (!session.gameState) return;
            startGame(session.gameState);
            broadcastRemoteGameState(session.gameState, session);
        }, 3000);
    } catch (err) { /* ignore */ }
}

function handleSessionFull(socket) {
    sendSafe(socket, { type: "error", message: "Session full or not found" });
    try { socket.close(); } catch (e) { /* ignore */ }
}

// --- Notifications ---------------------------------------------------------

function notifyAllReady(session) {
    session.players.forEach((p, idx) => {
        if (!p.socket) return;
        const playersNick = p.nick || '';
        const opponent = session.players.find(x => x !== p);
        const opponentNick = opponent ? (opponent.nick || '') : null;
        sendSafe(p.socket, {
            type: "ready",
            message: "Enemy found! Starting game...",
            players: 2,
            playerId: idx + 1,
            sessionId: session.id,
            you: playersNick,
            opponent: opponentNick
        });
    });
}

function sendConfigToAll(session) {
    session.players.forEach(p => { if (p.socket) sendConfig(p.socket); });
}

// --- Game loop helpers ----------------------------------------------------

function markTimedOutPlayers(session) {
    session.players.forEach(p => {
        if (!p.connected && p.lastDisconnect && (now() - p.lastDisconnect > SEND_TIMEOUT_MS) && !p.removed) {
            p.removed = true;
            // If a player is removed -> end the game and notify clients
            try {
                if (session.gameState && !session.gameState.gameEnded) {
                    session.gameState.gameEnded = true;
                    const other = session.players.find(x => x !== p && !x.removed);
                    session.gameState.winner = other ? other.playerNumber || null : null;
                    session.gameState.winnerNick = other ? other.nick || null : null;
                    try { broadcastRemoteGameState(session.gameState, session); } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
        }
    });
}

function pruneEmptySession(sessionId, session) {
    if (session.players.every(p => p.removed)) {
        sessions.delete(sessionId);
        return true;
    }
    return false;
}

function sendWaitingOrReadyInfo(sessionId, session) {
    const activePlayers = session.players.filter(p => p.connected && !p.removed);
    const disconnectedPlayers = session.players.filter(p => !p.connected && !p.removed);
    const presentPlayersCount = session.players.filter(p => !p.removed).length;

    if (activePlayers.length === 1 && disconnectedPlayers.length === 1) {
        const player = activePlayers[0];
        if (player.socket) {
            sendSafe(player.socket, {
                type: "waitForRec",
                message: "Opponent disconnected. Waiting for reconnection...",
                players: presentPlayersCount,
                playerId: player.playerNumber,
                sessionId
            });
        }
    }
}

function migrateEndedGame(sessionId, session) {
    if (!session.gameState || !session.gameState.gameEnded) return false;

    try {
        const newSessionId = generateId();
        const newSession = { id: newSessionId, players: [], gameState: {}, lastUpdate: now() };
        sessions.set(newSessionId, newSession);

        for (const oldP of session.players) {
            if (!oldP.removed && oldP.connected && oldP.socket) {
                const playerId = oldP.id;
                const socket = oldP.socket;
                const playerNumber = newSession.players.length + 1;

                const newPlayer = {
                    id: playerId,
                    socket,
                    connected: true,
                    lastDisconnect: null,
                    playerNumber,
                    removed: false,
                    nick: oldP.nick
                };

                newSession.players.push(newPlayer);

                socket.playerId = playerId;
                socket.playerNumber = playerNumber;

                setupSocketHandlers(socket, newSession, playerId);
            }
        }

        if (newSession.players.length === 1) {
            const p = newSession.players[0];
            sendSafe(p.socket, { type: "waiting", message: "Waiting for opponent to join...", players: 1, playerId: 1, sessionId: newSession.id });
            sendConfig(p.socket);
        } else if (newSession.players.length === 2) {
            notifyAllReady(newSession);
            sendConfigToAll(newSession);

            newSession.gameState = createRemoteGameState();
            newSession.players.forEach((p, idx) => {
                const playerNumber = idx + 1;
                if (newSession.gameState.players[playerNumber]) {
                    newSession.gameState.players[playerNumber].connected = !!p.connected;
                    newSession.gameState.players[playerNumber].removed = !!p.removed;
                    newSession.gameState.players[playerNumber].nick = p.nick;
                }
            });
            broadcastRemoteGameState(newSession.gameState, newSession);

            // resend ready info after broadcasting state to avoid client-side race conditions
            setTimeout(() => {
                try { notifyAllReady(newSession); } catch (e) { /* ignore */ }
            }, 50);

            setTimeout(() => {
                if (!newSession.gameState) return;
                startGame(newSession.gameState);
                broadcastRemoteGameState(newSession.gameState, newSession);
            }, 3000);
        }

        sessions.delete(sessionId);
        return true;
    } catch (err) {
        return false;
    }
}

// --- Public API ------------------------------------------------------------

export function handleRemoteConnection(connection, req, fastify) {
    const socket = connection.socket || connection;
    const playerId = req.query.playerId;

    const session = findOrCreateSessionForPlayer(playerId);

    const existingIdx = session.players.findIndex(p => p.id === playerId);
    if (existingIdx !== -1) {
        reconnectPlayer(session, socket, playerId, existingIdx);
        return;
    }

    // pass optional nickname from query to addNewPlayer
    const providedNick = req.query && req.query.nickname ? req.query.nickname : null;

    if (session.players.filter(p => !p.removed).length < 2) {
        addNewPlayer(session, socket, playerId, fastify, providedNick);
    } else {
        handleSessionFull(socket);
    }
}

export function startRemoteGameLoop() {
    setInterval(() => {
        for (const [sessionId, session] of sessions.entries()) {
            markTimedOutPlayers(session);

            if (pruneEmptySession(sessionId, session)) continue;

            sendWaitingOrReadyInfo(sessionId, session);

            if (!session.gameState) continue;

            // --- pause if any player is temporarily disconnected ---
            const hasTempDisconnected = session.players.some(p =>
                p.connected === false && p.removed === false && p.lastDisconnect != null
            );

            if (hasTempDisconnected) {
                if (!session.gameState.paused) session.gameState.paused = true;
                try { broadcastRemoteGameState(session.gameState, session); } catch (e) { /* ignore */ }
                continue;
            }

            // resume from pause
            if (session.gameState.paused) {
                session.gameState.paused = false;
                session.lastUpdate = now();
                try { broadcastRemoteGameState(session.gameState, session); } catch (e) { /* ignore */ }
            }

            try {
                // initialize per-session tick bookkeeping
                if (typeof session._tick !== 'number') session._tick = 0;
                session._tick++;

                const nowTs = now();
                if (!session.lastUpdate) session.lastUpdate = nowTs;
                const deltaTime = (nowTs - session.lastUpdate) / 1000;
                session.lastUpdate = nowTs;

                try {
                    updateGame(
                        session.gameState,
                        deltaTime,
                        () => broadcastRemoteGameState(session.gameState, session), null);
                } catch (err) { /* ignore */ }

                if (session._tick % BROADCAST_INTERVAL === 0) {
                    try {
                        const serialized = JSON.stringify(session.gameState);
                        if (session._lastBroadcast !== serialized) {
                            session._lastBroadcast = serialized;
                            broadcastRemoteGameState(session.gameState, session);
                        }
                    } catch (err) {
                        try { broadcastRemoteGameState(session.gameState, session); } catch (_) { /* ignore */ }
                    }
                }

                if (session.gameState.gameEnded) {
                    session.gameState.winnerNick = session.players.find(p => p.playerNumber === session.gameState.winner)?.nick || null;
                    // Broadcast final state so frontend can render winner/winnerNick
                    try { broadcastRemoteGameState(session.gameState, session); } catch (e) { /* ignore */ }

                    // Schedule migration once with a short delay to give clients time to render final frame
                    if (!session._migrateScheduled) {
                        session._migrateScheduled = true;
                        setTimeout(() => {
                            try {
                                const migrated = migrateEndedGame(sessionId, session);
                                if (!migrated) {
                                    // allow retry next loop if migration failed
                                    session._migrateScheduled = false;
                                }
                            } catch (e) {
                                // reset flag so we can retry migration next tick
                                session._migrateScheduled = false;
                            }
                        }, 3000); // give clients ~3s to render final frame
                    }
                    // skip further processing of this session in this tick
                    continue;
                }

            } catch (err) { /* ignore */ }
        }
    }, 1000 / FPS);
}
