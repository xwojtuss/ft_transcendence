import { getUserSession } from '../../../view/viewUtils.js';
import { createRemoteGameState } from './remoteGameState.js';
import { broadcastRemoteGameState } from './remoteClientManager.js';
import { startGame } from '../local/gameLogic.js';
import { sendSafe, sendConfig, sendState } from './utils.js';
import { setupSocketHandlers } from './socketHandlers.js';

function getPresentPlayers(session) {
    const arr = [];
    for (let i = 0; i < session.players.length; i++) {
        const p = session.players[i];
        if (!p.removed) arr.push(p);
    }
    return arr;
}

export function reconnectPlayer(session, socket, playerId, existingIdx) {
    const player = session.players[existingIdx];
    if (!player) return;

    player.socket = socket;
    player.connected = true;
    player.lastDisconnect = null;
    player.removed = false;

    // keep socket metadata consistent
    socket.playerId = existingIdx + 1;
    socket.playerNumber = player.playerNumber;

    setupSocketHandlers(socket, session, playerId);

    const present = getPresentPlayers(session);
    const presentCount = present.length;

    // Inform the reconnected socket
    sendSafe(socket, {
        type: "reconnected",
        message: "Reconnected to session.",
        players: presentCount,
        playerId: socket.playerNumber,
        sessionId: session.id
    });

    if (session.gameState) {
        sendState(socket, session.gameState);
        sendConfig(socket);
    }

    // If alone -> waiting message
    if (presentCount === 1) {
        sendSafe(socket, {
            type: "waiting",
            message: "Waiting for opponent to join...",
            players: 1,
            playerId: socket.playerNumber,
            sessionId: session.id
        });
    }

    // Notify other connected players about reconnection
    for (let i = 0; i < present.length; i++) {
        const other = present[i];
        if (other === player) continue;
        if (!other.socket || !other.connected) continue;
        sendSafe(other.socket, {
            type: "reconnected",
            message: "Opponent reconnected.",
            players: presentCount,
            playerId: other.playerNumber,
            sessionId: session.id
        });
    }
}

export function addNewPlayer(session, socket, playerId, fastify, providedNick) {
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

    // socket indexing consistent with existing code
    socket.playerId = session.players.length;
    socket.playerNumber = playerNumber;

    setupSocketHandlers(socket, session, playerId);

    const present = getPresentPlayers(session);
    const presentCount = present.length;

    if (presentCount === 1) {
        // send config first so frontend can init UI, then waiting message
        sendConfig(socket);
        sendSafe(socket, {
            type: "waiting",
            message: "Waiting for opponent to join...",
            players: 1,
            playerId: playerNumber,
            sessionId: session.id
        });
        return;
    }

    // Two players -> prepare game
    notifyAllReady(session);
    sendConfigToAll(session);

    try {
        session.gameState = createRemoteGameState();

        // populate player meta in state
        for (let idx = 0; idx < session.players.length; idx++) {
            const p = session.players[idx];
            const pn = idx + 1;
            if (session.gameState.players[pn]) {
                session.gameState.players[pn].connected = !!p.connected;
                session.gameState.players[pn].removed = !!p.removed;
                session.gameState.players[pn].nick = p.nick;
            }
        }

        // initial broadcast
        broadcastRemoteGameState(session.gameState, session);

        // resend ready briefly after state to avoid client race
        setTimeout(() => {
            try { notifyAllReady(session); } catch (e) { /* ignore */ }
        }, 50);

        // start game after short delay
        setTimeout(() => {
            if (!session.gameState) return;
            startGame(session.gameState);
            broadcastRemoteGameState(session.gameState, session);
        }, 3000);
    } catch (err) {
        // best-effort: ignore startup errors
    }
}

export function handleSessionFull(socket) {
    sendSafe(socket, { type: "error", message: "Session full or not found" });
    try { socket.close(); } catch (e) { /* ignore */ }
}

// notification helpers used by addNewPlayer
export function notifyAllReady(session) {
    const present = getPresentPlayers(session);
    const playersCount = present.length;

    for (let i = 0; i < present.length; i++) {
        const p = present[i];
        if (!p.socket) continue;
        const opponent = present.find(x => x !== p) || null;
        const opponentNick = opponent ? (opponent.nick || '') : null;
        const playersNick = p.nick || '';
        sendSafe(p.socket, {
            type: "ready",
            message: "Enemy found! Starting game...",
            players: playersCount,
            playerId: p.playerNumber,
            sessionId: session.id,
            you: playersNick,
            opponent: opponentNick
        });
    }
}

export function sendConfigToAll(session) {
    const present = getPresentPlayers(session);
    for (let i = 0; i < present.length; i++) {
        const p = present[i];
        if (p.socket) sendConfig(p.socket);
    }
}
