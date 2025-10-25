import { SEND_TIMEOUT_MS, sessions, generateId, sendSafe, sendConfig } from './utils.js';
import { broadcastRemoteGameState } from './remoteClientManager.js';
import { createRemoteGameState } from './remoteGameState.js';
import { setupSocketHandlers } from './socketHandlers.js';
import { notifyAllReady, sendConfigToAll } from './playerLifecycle.js';
import { startGame } from '../local/gameLogic.js';

export function markTimedOutPlayers(session) {
    const now = Date.now();
    let broadcastNeeded = false;

    for (let i = 0; i < session.players.length; i++) {
        const player = session.players[i];
        if (player.removed) continue;
        if (!player.connected && player.lastDisconnect && (now - player.lastDisconnect > SEND_TIMEOUT_MS)) {
            player.removed = true;
            // If this removal ends the game -> prepare single broadcast
            if (session.gameState && !session.gameState.gameEnded) {
                session.gameState.gameEnded = true;
                const secondPlayer = session.players.find(x => x !== player && !x.removed) || null;
                session.gameState.winner = secondPlayer ? secondPlayer.playerNumber || null : null;
                session.gameState.winnerNick = secondPlayer ? secondPlayer.nick || null : null;
                session.gameState.loserNick = player ? player.nick || null : null;
                broadcastNeeded = true;
            }
        }
    }

    if (broadcastNeeded) {
        try { broadcastRemoteGameState(session.gameState, session); } catch (e) { /* best-effort */ }
    }
}

export function pruneEmptySession(sessionId, session) {
    for (let i = 0; i < session.players.length; i++) {
        if (!session.players[i].removed) return false;
    }
    sessions.delete(sessionId);
    return true;
}

export function sendWaitingOrReadyInfo(sessionId, session) {
    // Count and find active/disconnected players
    let activePlayer = null;
    let disconnectedCount = 0;
    let presentPlayersCount = 0;

    for (let i = 0; i < session.players.length; i++) {
        const p = session.players[i];
        if (p.removed) continue;
        presentPlayersCount++;
        if (p.connected) activePlayer = p;
        else disconnectedCount++;
    }

    // If exactly one active and one disconnected -> notify active to wait for reconnection
    if (activePlayer && disconnectedCount === 1) {
        if (activePlayer.socket) {
            sendSafe(activePlayer.socket, {
                type: "waitForRec",
                message: "Opponent disconnected. Waiting for reconnection...",
                players: presentPlayersCount,
                playerId: activePlayer.playerNumber,
                sessionId
            });
        }
    }
}

export function migrateEndedGame(sessionId, session) {
    if (!session.gameState || !session.gameState.gameEnded) return false;

    try {
        const newSessionId = generateId();
        const newSession = { id: newSessionId, players: [], gameState: {}, lastUpdate: Date.now() };
        sessions.set(newSessionId, newSession);

        // Reuse sockets from old session for players who are connected & not removed
        for (let i = 0; i < session.players.length; i++) {
            const oldP = session.players[i];
            if (oldP.removed || !oldP.connected || !oldP.socket) continue;

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

            // keep socket metadata in sync
            socket.playerId = playerId;
            socket.playerNumber = playerNumber;

            setupSocketHandlers(socket, newSession, playerId);
        }

        const pLen = newSession.players.length;
        if (pLen === 1) {
            const p = newSession.players[0];
            sendSafe(p.socket, { type: "waiting", message: "Waiting for opponent to join...", players: 1, playerId: 1, sessionId: newSession.id });
            sendConfig(p.socket);
        } else if (pLen === 2) {
            notifyAllReady(newSession);
            sendConfigToAll(newSession);

            newSession.gameState = createRemoteGameState();
            for (let idx = 0; idx < newSession.players.length; idx++) {
                const p = newSession.players[idx];
                const playerNumber = idx + 1;
                if (newSession.gameState.players[playerNumber]) {
                    newSession.gameState.players[playerNumber].connected = !!p.connected;
                    newSession.gameState.players[playerNumber].removed = !!p.removed;
                    newSession.gameState.players[playerNumber].nick = p.nick;
                }
            }

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
