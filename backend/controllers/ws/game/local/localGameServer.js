/* UPDATED WITH AI PLAYER [AI]
  Mode flag (session.mode) with default "local" and "hello" message handler.
  AI loop gated: maybeUpdateAI(session, now) runs only when mode === "ai".
  Right-paddle keys (ArrowUp/ArrowDown) only work in local mode; ignored in ai mode.
*/

import {
    FPS, FIELD_WIDTH, FIELD_HEIGHT,
    PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS,
    AI_NOISE
} from './gameConfig.js';
import { resetGameState } from './gameState.js';
import { updateGame, startGame } from './gameLogic.js';
import { createSession, getSession, removeSession, getAllSessions } from './sessionManager.js';

/* -------------------------
   Networking
-------------------------- */
function broadcastToSession(sessionId, gameState) {
    const session = getSession(sessionId);
    if (session && session.socket && session.socket.readyState === 1) {
        try {
            session.socket.send(JSON.stringify({ type: "state", state: gameState }));
        } catch (error) {
            console.log(`Error sending to session ${sessionId}:`, error.message);
            removeSession(sessionId);
        }
    }
}

/* -------------------------
   AI (1 Hz “vision” + prediction)
-------------------------- */
// [AI]

// Decide only once per second. Between decisions, keep moving toward the
// previously computed intercept Y.
function maybeUpdateAI(session, now) {
    if (!session || !session.gameState) return;
    const gs = session.gameState;
    const ai = session.ai || (session.ai = {
        lastDecision: 0,
        forceImmediate: false,
        targetY: null,
    });
    
    const player2 = gs.players[2];   // AI paddle (right side, x is left edge)
    const ball = gs.ball;
    if (!player2 || !ball || gs.gameEnded) return;
    
    // 1) 1-second “vision” gate
    if (ai.forceImmediate) {
        ai.forceImmediate = false;
        ai.lastDecision = now;
    } else {
        if (now - ai.lastDecision < 1000) {
            // Between samples: keep steering toward the last target
            steerTowardTarget(player2, ai.targetY);
            return;
        }
        ai.lastDecision = now;
    }

  // 2) Compute a fresh targetY (predicted intercept at the AI paddle)
    const paddleX = player2.x; // left face of right paddle (matches your state)
    const ballState = {
        x: ball.x,
        y: ball.y,
        vx: ball.dx,            // already velocities (px/s)
        vy: ball.dy,
        r: BALL_RADIUS
    };

  // If ball moving away, re-center; else predict impact Y (with wall bounces)
    if (ballState.vx <= 0) {
        ai.targetY = FIELD_HEIGHT / 2;
    } else {
        ai.targetY = predictImpactY(ballState, FIELD_HEIGHT, paddleX);
    }

  // 3) Set dy toward target (deadband to avoid micro-wobble)
    steerTowardTarget(player2, ai.targetY);
}

// [AI]
function steerTowardTarget(paddle, targetY) {
    if (targetY == null) { paddle.dy = 0; return; }
    const center = paddle.y;
    const DEADZONE = 2; // ±2 units
    if (center < targetY - DEADZONE)      paddle.dy = 1;
    else if (center > targetY + DEADZONE) paddle.dy = -1;
    else                                   paddle.dy = 0;
}

// [AI]
function predictImpactY(ball, fieldH, paddleX) {
    let { x, y, vx, vy, r } = ball;
    if (Math.abs(vx) < 1e-6) return y; // nearly vertical ⇒ just aim current y
    const dir = Math.sign(vx);
    // Contact plane: for right paddle, aim for its left face minus the ball radius
    const targetX = paddleX - (dir > 0 ? r : -r);
    // Step along X in coarse chunks; advance Y by vy*dt each step
    const stepX = Math.max(2, Math.min(8, Math.abs(vx) * 0.05)); // auto scales with speed
    const steps = Math.max(1, Math.ceil(Math.abs(targetX - x) / stepX));
    for (let i = 0; i < steps; i++) {
        const dt = stepX / Math.max(1e-6, Math.abs(vx));
        x += dir * stepX;
        y += vy * dt;
        // Perfect reflection at walls
        if (y - r < 0) {
            y = r + (r - y);
            vy = Math.abs(vy);
        } else if (y + r > fieldH) {
            y = fieldH - r - ((y + r) - fieldH);
            vy = -Math.abs(vy);
        }
    }
    y = y + (Math.random() * 2 - 1) * AI_NOISE * PADDLE_HEIGHT;
    return y;
}

/* -------------------------
   Connection handling
-------------------------- */
export function handleConnection(connection) {
    const socket = connection.socket || connection;
    const sessionId = createSession(socket);
    const session = getSession(sessionId);
    if (!session) {
        console.error('Failed to create session');
        return;
    }
    // default mode is "local" unless client says otherwise
    session.mode = "local"; // "local" | "ai"
    // Send config to client
    socket.send(JSON.stringify({
        type: "gameConfig",
        config: { FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_RADIUS }
    }));
    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            const currentSession = getSession(sessionId);
            if (!currentSession) return;
            const { gameState } = currentSession;
            // client greets with desired mode ("local" or "ai")
            if (data.type === "hello" && (data.mode === "local" || data.mode === "ai")) {
                currentSession.mode = data.mode;
                // Store player aliases for match history
                if (data.player1Alias) {
                    currentSession.player1Alias = data.player1Alias;
                }
                if (data.player2Alias) {
                    currentSession.player2Alias = data.player2Alias;
                }
                // Store if this is a tournament match
                if (data.isTournamentMatch) {
                    currentSession.isTournamentMatch = true;
                }
                return; // nothing else to do for hello
            }
            // Input handling
            if (data.type === "keydown") {
                if (!gameState.gameEnded) {
                    // left paddle (player 1) controlled by W/S 
                    if (["w", "s"].includes(data.key)) {
                        gameState.players[1].dy = (data.key === "w") ? -1 : 1;
                    }
                    // right paddle (player 2) only in LOCAL mode
                    if (currentSession.mode === "local" && ["ArrowUp", "ArrowDown"].includes(data.key)) {
                        gameState.players[2].dy = (data.key === "ArrowUp") ? -1 : 1;
                    }
                }
                // Space: (re)start match — with small tweak for AI/local
                if (data.key === " " && (!gameState.gameInitialized || gameState.gameEnded)) {
                    if (gameState.gameEnded) {
                        resetGameState(gameState);
                    } else {
                        startGame(gameState);
                    }
                    if (currentSession.mode === "ai") {
                        // [AI] ensure AI state and prime immediate decision
                        if (!currentSession.ai) currentSession.ai = { lastDecision: 0, forceImmediate: false, targetY: null };
                        currentSession.ai.forceImmediate = true;
                        gameState.players[2].dy = 0; // stop drift before AI moves
                        } else {
                            // [AI] ensure AI is off in local mode
                            currentSession.ai = null;
                            gameState.players[2].dy = 0; // neutral start for human right paddle
                        }
                }
            }
            if (data.type === "keyup") {
                if (!gameState.gameEnded) {
                    // left paddle (player 1) 
                    if (["w", "s"].includes(data.key)) gameState.players[1].dy = 0;
                    // right paddle only in LOCAL mode
                    if (currentSession.mode === "local" && ["ArrowUp", "ArrowDown"].includes(data.key)) {
                        gameState.players[2].dy = 0;
                    }
                }
            }
        } catch (error) {
            console.log('Error parsing message:', error.message);
        }
    });
    socket.on('close', () => {
        removeSession(sessionId);
    });
    socket.on('error', (error) => {
        console.log('WebSocket error:', error.message);
        removeSession(sessionId);
    });
}

/* -------------------------
   Main server loop
-------------------------- */
export function startLocalGameLoop() {
    let lastUpdateTime = Date.now();
    setInterval(() => {
        const now = Date.now();
        const deltaTime = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;
        for (const [sessionId, session] of getAllSessions()) {
            session.lastUpdateTime = now;
            // Run AI only when the session is in AI mode
            if (session.mode === "ai") {
                // [from AI file]
                maybeUpdateAI(session, now);
            }
            // Physics + scoring + broadcast
            updateGame(
                session.gameState,
                deltaTime,
                () => broadcastToSession(sessionId, session.gameState),
                session
            );
        }
    }, 1000 / FPS);
}
