import { FPS } from '../local/gameConfig.js';
import { updateGame } from '../local/gameLogic.js';

import { BROADCAST_INTERVAL, broadcastRemoteGameState, sessions } from './utils.js';
import { findOrCreateSessionForPlayer } from './sessionHelpers.js';
import { reconnectPlayer, addNewPlayer, handleSessionFull } from './playerLifecycle.js';
import { markTimedOutPlayers, pruneEmptySession, sendWaitingOrReadyInfo, migrateEndedGame } from './gameLoopHelpers.js';
import Match from '../../../../utils/Match.js';
import { getUser } from '../../../../db/dbQuery.js';

// --- helpers ---------------------------------------------------------------

function safeBroadcast(gameState, session) {
    try { broadcastRemoteGameState(gameState, session); } catch (e) { /* best-effort */ }
}

function scheduleMigration(sessionId, session) {
    if (session._migrateScheduled) return;
    session._migrateScheduled = true;

    (async () => {
        try {
            const winnerPlayer = session.players.find(p => p.playerNumber === session.gameState.winner) || null;
            const loserPlayer = session.players.find(p => p.playerNumber !== session.gameState.winner) || null;

            // try to persist match result
            try {
                const winner = winnerPlayer ? await getUser(winnerPlayer.nick) : null;
                const loser = loserPlayer ? await getUser(loserPlayer.nick) : null;
                if (winner && loser) {
                    const match = new Match(winner, "Pong", "Online", 2);
                    match.addRank(winner, "Won");
                    match.addParticipant(loser);
                    match.addRank(loser, "Lost");
                    match.endMatch();
                    await match.commitMatch();
                }
            } catch (err) {
                console.log(err);
            }

            // give clients time to render final frame, then try migrate
            setTimeout(() => {
                try {
                    const migrated = migrateEndedGame(sessionId, session);
                    if (!migrated) session._migrateScheduled = false;
                } catch (e) {
                    session._migrateScheduled = false;
                }
            }, 3000);
        } catch (e) {
            session._migrateScheduled = false;
        }
    })();
}

// process single session tick
function processSessionTick(sessionId, session) {
    try {
        markTimedOutPlayers(session);

        if (pruneEmptySession(sessionId, session)) return;

        sendWaitingOrReadyInfo(sessionId, session);

        if (!session.gameState) return;

        // pause handling for temporary disconnects
        let hasTempDisconnected = false;
        for (let i = 0; i < session.players.length; i++) {
            const p = session.players[i];
            if (p && p.connected === false && p.removed === false && p.lastDisconnect != null) {
                hasTempDisconnected = true;
                break;
            }
        }
        if (hasTempDisconnected) {
            if (!session.gameState.paused) session.gameState.paused = true;
            safeBroadcast(session.gameState, session);
            return;
        }

        // resume from pause
        if (session.gameState.paused) {
            session.gameState.paused = false;
            session.lastUpdate = Date.now();
            safeBroadcast(session.gameState, session);
        }

        // tick bookkeeping
        if (typeof session._tick !== 'number') session._tick = 0;
        session._tick++;

        const nowTs = Date.now();
        if (!session.lastUpdate) session.lastUpdate = nowTs;
        const deltaTime = (nowTs - session.lastUpdate) / 1000;
        session.lastUpdate = nowTs;

        // update game state
        try {
            updateGame(session.gameState, deltaTime, () => safeBroadcast(session.gameState, session), null);
        } catch (err) { }

        // periodic broadcast: only when state changed (serialize once)
        if (session._tick % BROADCAST_INTERVAL === 0) {
            try {
                const serialized = JSON.stringify(session.gameState);
                if (session._lastBroadcast !== serialized) {
                    session._lastBroadcast = serialized;
                    safeBroadcast(session.gameState, session);
                }
            } catch (err) {
                safeBroadcast(session.gameState, session);
            }
        }

        // finished game -> finalize and schedule migration
        if (session.gameState.gameEnded) {
            const winnerPlayer = session.players.find(p => p.playerNumber === session.gameState.winner) || null;
            const loserPlayer = session.players.find(p => p.playerNumber !== session.gameState.winner) || null;
            session.gameState.winnerNick = winnerPlayer ? winnerPlayer.nick || null : null;
            session.gameState.loserNick = loserPlayer ? loserPlayer.nick || null : null;

            safeBroadcast(session.gameState, session);
            scheduleMigration(sessionId, session);
            return;
        }
    } catch (err) { }
}

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
        for (const [sessionId, session] of Array.from(sessions.entries())) {
            processSessionTick(sessionId, session);
        }
    }, 1000 / FPS);
}
