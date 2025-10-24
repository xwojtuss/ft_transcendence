import { SEND_TIMEOUT_MS, sessions, generateId, sendSafe, sendConfig } from './utils.js';
import { broadcastRemoteGameState } from './remoteClientManager.js';
import { createRemoteGameState } from './remoteGameState.js';
import { setupSocketHandlers } from './socketHandlers.js';
import { notifyAllReady, sendConfigToAll } from './playerLifecycle.js';
import { startGame } from '../local/gameLogic.js';

export function markTimedOutPlayers(session) {
    session.players.forEach(p => {
        if (!p.connected && p.lastDisconnect && (Date.now() - p.lastDisconnect > SEND_TIMEOUT_MS) && !p.removed) {
            p.removed = true;
            // If a player is removed -> end the game and notify clients
            try {
                if (session.gameState && !session.gameState.gameEnded) {
                    session.gameState.gameEnded = true;
                    const other = session.players.find(x => x !== p && !x.removed);
                    session.gameState.winner = other ? other.playerNumber || null : null;
                    session.gameState.winnerNick = other ? other.nick || null : null;
                    // set loserNick to the removed player's nick
                    session.gameState.loserNick = p ? p.nick || null : null;
                    try { broadcastRemoteGameState(session.gameState, session); } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
        }
    });
}

export function pruneEmptySession(sessionId, session) {
    if (session.players.every(p => p.removed)) {
        sessions.delete(sessionId);
        return true;
    }
    return false;
}

export function sendWaitingOrReadyInfo(sessionId, session) {
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

export function migrateEndedGame(sessionId, session) {
    if (!session.gameState || !session.gameState.gameEnded) return false;

    try {
        const newSessionId = generateId();
        const newSession = { id: newSessionId, players: [], gameState: {}, lastUpdate: Date.now() };
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
