import { FPS } from '../local/gameConfig.js';
import { broadcastRemoteGameState } from './remoteClientManager.js';
import { updateGame } from '../local/gameLogic.js';

import { BROADCAST_INTERVAL, sessions } from './utils.js';
import { findOrCreateSessionForPlayer } from './sessionHelpers.js';
import { reconnectPlayer, addNewPlayer, handleSessionFull } from './playerLifecycle.js';
import { markTimedOutPlayers, pruneEmptySession, sendWaitingOrReadyInfo, migrateEndedGame } from './gameLoopHelpers.js';
import Match from '../../../../utils/Match.js';

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
    const providedNick = req.query && req.query.nickname ? req.query.nickname : req.currentUser.nickname;

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
                session.lastUpdate = Date.now();
                try { broadcastRemoteGameState(session.gameState, session); } catch (e) { /* ignore */ }
            }

            try {
                // initialize per-session tick bookkeeping
                if (typeof session._tick !== 'number') session._tick = 0;
                session._tick++;

                const nowTs = Date.now();
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
                    // set both winnerNick and loserNick so frontend can display both
                    const winnerPlayer = session.players.find(p => p.playerNumber === session.gameState.winner);
                    const loserPlayer = session.players.find(p => p.playerNumber !== session.gameState.winner);
                    
                    const match = new Match(winnerPlayer, "Pong", "Online", 2);
                    match.addRank(winnerPlayer, "Won");
                    match.addParticipant(loserPlayer);
                    match.addRank(loserPlayer, "Lost");
                    match.endMatch();
                    match.commitMatch();
                    session.gameState.winnerNick = winnerPlayer ? winnerPlayer.nick || null : null;
                    session.gameState.loserNick = loserPlayer ? loserPlayer.nick || null : null;
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
