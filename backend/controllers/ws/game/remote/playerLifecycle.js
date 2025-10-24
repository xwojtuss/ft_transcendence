import { getUserSession } from '../../../view/viewUtils.js';
import { createRemoteGameState } from './remoteGameState.js';
import { broadcastRemoteGameState } from './remoteClientManager.js';
import { startGame } from '../local/gameLogic.js';
import { sendSafe, sendConfig, sendState } from './utils.js';
import { setupSocketHandlers } from './socketHandlers.js';

export function reconnectPlayer(session, socket, playerId, existingIdx) {
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

export function handleSessionFull(socket) {
    sendSafe(socket, { type: "error", message: "Session full or not found" });
    try { socket.close(); } catch (e) { /* ignore */ }
}

// notification helpers used by addNewPlayer
export function notifyAllReady(session) {
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

export function sendConfigToAll(session) {
    session.players.forEach(p => { if (p.socket) sendConfig(p.socket); });
}
