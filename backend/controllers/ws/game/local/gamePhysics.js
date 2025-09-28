import { BALL_SPEED, PADDLE_SPEED, FIELD_HEIGHT } from './gameConfig.js';

export function handlePaddleCollision(ball, paddle, isLeftPaddle) {
    const hitPosition = (ball.y + ball.size/2 - paddle.y) / paddle.height;
    const relativePosition = (hitPosition - 0.5) * 2;
    
    const maxAngle = Math.PI / 4;
    const bounceAngle = relativePosition * maxAngle;

    // Direction of the bounce
    const direction = isLeftPaddle ? 1 : -1;
    ball.dx = direction * Math.cos(bounceAngle) * BALL_SPEED;
    ball.dy = Math.sin(bounceAngle) * BALL_SPEED;

    // Add paddle movement influence
    ball.dy += paddle.dy * PADDLE_SPEED * 0.1;
    ball.dy = Math.max(-BALL_SPEED * 0.8, Math.min(BALL_SPEED * 0.8, ball.dy));

    // Set ball position to avoid intersecting with paddle
    if (isLeftPaddle) {
        ball.x = paddle.x + paddle.width;
    } else {
        ball.x = paddle.x - ball.size;
    }
}

export function updatePlayerPositions(players, deltaTime) {
    for (const id of [1, 2]) {
        const player = players[id];
        player.y += player.dy * PADDLE_SPEED * deltaTime;
        player.y = Math.max(1, Math.min(FIELD_HEIGHT - 1 - player.height, player.y));
    }
}

export function generateBallDirection(towardsPlayer) {
    const maxAngle = Math.PI / 3;
    const randomAngle = (Math.random() - 0.5) * 2 * maxAngle;
    
    const direction = towardsPlayer === 1 ? -1 : 1;
    return {
        dx: direction * Math.cos(Math.abs(randomAngle)) * BALL_SPEED,
        dy: Math.sin(randomAngle) * BALL_SPEED
    };
}