import { FIELD_WIDTH, FIELD_HEIGHT, WINNING_SCORE, RESET_DELAY, BALL_RADIUS, PADDLE_WIDTH, PADDLE_HEIGHT } from './gameConfig.js';
import { resetGameState } from './gameState.js';
import { handlePaddleCollision, updatePlayerPositions, generateBallDirection } from './gamePhysics.js';

export function checkGameEnd(gameState, scoringPlayer, session) {
    if (gameState.players[scoringPlayer].score >= WINNING_SCORE) {
        gameState.gameEnded = true;
        gameState.winner = scoringPlayer;
        gameState.gameStarted = false;
        
        gameState.ball.dx = 0;
        gameState.ball.dy = 0;
        
        // Print match result with player aliases/nicknames
        const losingPlayer = scoringPlayer === 1 ? 2 : 1;
        const gameType = session?.mode === 'ai' ? 'GAME:AI' : 'GAME:LOCAL';
        
        console.log('\n=== GAME COMPLETED ===');
        console.log(`Game Type: ${gameType}`);
        console.log(`Player 1: ${session?.player1Alias || 'Unknown'} - Score: ${gameState.players[1].score}`);
        console.log(`Player 2: ${session?.player2Alias || 'Unknown'} - Score: ${gameState.players[2].score}`);
        console.log(`Winner: ${scoringPlayer === 1 ? session?.player1Alias : session?.player2Alias || 'Unknown'} (Player ${scoringPlayer})`);
        console.log(`Loser: ${losingPlayer === 1 ? session?.player1Alias : session?.player2Alias || 'Unknown'} (Player ${losingPlayer})`);
        console.log('======================\n');
        
        // Store the winner at the time of game end for the timeout check
        const winnerAtEnd = scoringPlayer;
        setTimeout(() => {
            // Only auto-reset if game is still in ended state with same winner
            // This prevents resetting a new game if user manually restarted
            if (gameState.gameEnded && gameState.winner === winnerAtEnd) {
                resetGameState(gameState);
            }
        }, RESET_DELAY);
    }
}

export function resetBall(gameState, losingPlayer) {
    // Reset ball position and velocity
    gameState.ball.x = FIELD_WIDTH / 2;
    gameState.ball.y = FIELD_HEIGHT / 2;
    gameState.ball.dx = 0;
    gameState.ball.dy = 0;
    gameState.gameStarted = false;

    if (gameState.gameInitialized && !gameState.gameEnded) {
        setTimeout(() => {
            if (gameState.gameEnded) return;
            
            const direction = generateBallDirection(losingPlayer);
            gameState.ball.dx = direction.dx;
            gameState.ball.dy = direction.dy;
            gameState.gameStarted = true;
        }, 1000);
    }
}

export function startGame(gameState) {
    if (gameState.gameEnded) return;
    
    gameState.gameStarted = true;
    gameState.gameInitialized = true;
    
    const direction = generateBallDirection(Math.random() > 0.5 ? 1 : 2);
    gameState.ball.dx = direction.dx;
    gameState.ball.dy = direction.dy;
}

export function updateGame(gameState, deltaTime, broadcastCallback, session) {
    if (gameState.gameEnded) {
        broadcastCallback();
        return;
    }

    // Update players
    updatePlayerPositions(gameState.players, deltaTime);

    if (!gameState.gameStarted) {
        broadcastCallback();
        return;
    }

    // Move ball
    const ball = gameState.ball;
    ball.x += ball.dx * deltaTime;
    ball.y += ball.dy * deltaTime;

    // Bounce top/bottom
    if (ball.y - BALL_RADIUS <= 0 || ball.y + BALL_RADIUS >= FIELD_HEIGHT) {
        ball.dy *= -1;
        if (ball.y - BALL_RADIUS < 0) ball.y = BALL_RADIUS;
        if (ball.y + BALL_RADIUS > FIELD_HEIGHT) ball.y = FIELD_HEIGHT - BALL_RADIUS;
    }

    const p1 = gameState.players[1];
    const p2 = gameState.players[2];

    // Player collisions
    if (ball.x - BALL_RADIUS <= p1.x + PADDLE_WIDTH / 2
        && ball.y + BALL_RADIUS >= p1.y - PADDLE_HEIGHT / 2
        && ball.y - BALL_RADIUS <= p1.y + PADDLE_HEIGHT / 2
        && ball.dx < 0) {
        handlePaddleCollision(ball, p1, true);
    }

    if (ball.x + BALL_RADIUS >= p2.x - PADDLE_WIDTH / 2
        && ball.y + BALL_RADIUS >= p2.y - PADDLE_HEIGHT / 2
        && ball.y - BALL_RADIUS <= p2.y + PADDLE_HEIGHT / 2
        && ball.dx > 0) {
        handlePaddleCollision(ball, p2, false);
    }

    // Scoring
    if (ball.x - BALL_RADIUS < 0) {
        gameState.players[2].score++;
        checkGameEnd(gameState, 2, session);
        if (!gameState.gameEnded) resetBall(gameState, 1);
    } else if (ball.x + BALL_RADIUS > FIELD_WIDTH) {
        gameState.players[1].score++;
        checkGameEnd(gameState, 1, session);
        if (!gameState.gameEnded) resetBall(gameState, 2);
    }

    broadcastCallback();
}