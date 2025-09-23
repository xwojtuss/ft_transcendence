import {
  FPS, FIELD_WIDTH, FIELD_HEIGHT,
  PADDLE_HEIGHT, PADDLE_WIDTH, BALL_SIZE
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

// Decide only once per second. Between decisions, keep moving toward the
// previously computed intercept Y. This works with your physics:
// - ball.dx/dy are velocities (px/s) already
// - player2.dy ∈ {-1,0,1} is scaled by PADDLE_SPEED in gamePhysics
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
    vx: ball.dx,            // already velocities (DON’T multiply by BALL_SPEED)
    vy: ball.dy,
    r: BALL_SIZE / 2
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

// dy controller (simulates pressing a key). Keep it sharp but stable.
function steerTowardTarget(paddle, targetY) {
  if (targetY == null) { paddle.dy = 0; return; }
  const center = paddle.y + PADDLE_HEIGHT / 2;
  const DEADZONE = 2; // ±2 units
  if (center < targetY - DEADZONE)      paddle.dy = 1;
  else if (center > targetY + DEADZONE) paddle.dy = -1;
  else                                   paddle.dy = 0;
}

// Predict Y where ball reaches paddleX, reflecting off top/bottom.
// Uses constant-velocity stepping derived from your current velocities.
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

  // Send config to client
  socket.send(JSON.stringify({
    type: "gameConfig",
    config: { FIELD_WIDTH, FIELD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, BALL_SIZE }
  }));

  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      const currentSession = getSession(sessionId);
      if (!currentSession) return;

      const { gameState } = currentSession;

      if (data.type === "keydown") {
        if (!gameState.gameEnded) {
          if (["w", "s"].includes(data.key)) {
            gameState.players[1].dy = (data.key === "w") ? -1 : 1;
          }
        }

        // Space: (re)start match
        if (data.key === " " && (!gameState.gameInitialized || gameState.gameEnded)) {
          if (gameState.gameEnded) {
            resetGameState(gameState);
          } else {
            startGame(gameState);
          }
          if (!currentSession.ai) currentSession.ai = { lastDecision: 0, forceImmediate: false, targetY: null };
          currentSession.ai.forceImmediate = true;   // decide instantly after (re)start
          gameState.players[2].dy = 0;               // stop drift
        }
      }

      if (data.type === "keyup") {
        if (!gameState.gameEnded) {
          if (["w", "s"].includes(data.key)) gameState.players[1].dy = 0;
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

      // AI: 1 Hz “vision” + predictive steering
      maybeUpdateAI(session, now);

      // Physics + scoring + broadcast
      updateGame(
        session.gameState,
        deltaTime,
        () => broadcastToSession(sessionId, session.gameState)
      );
    }
  }, 1000 / FPS);
}

