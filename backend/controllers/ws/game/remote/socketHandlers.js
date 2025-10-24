export function setupSocketHandlers(socket, session, playerId) {
	// remove previously attached listeners (prevents duplicate handlers)
	try {
		if (typeof socket.removeAllListeners === 'function') {
			socket.removeAllListeners('message');
			socket.removeAllListeners('close');
		}
		if (typeof socket.setMaxListeners === 'function') {
			socket.setMaxListeners(0);
		}
	} catch (e) { /* ignore */ }

	socket.on('message', (msg) => {
		let data;
		try {
			data = JSON.parse(msg);
		} catch (err) {
			return;
		}

		const idx = session.players.findIndex(p => p.id === playerId);

		if (data.type === "clientDisconnecting") {
			if (idx !== -1) {
				session.players[idx].connected = false;
				session.players[idx].lastDisconnect = Date.now();
			}
			return;
		}

		if ((data.type === 'keydown' || data.type === 'keyup') && idx !== -1) {
			handlePlayerInput(session, idx, data);
		}
	});

	socket.on('close', () => {
		const idx = session.players.findIndex(p => p.id === playerId);
		if (idx !== -1) {
			session.players[idx].connected = false;
			session.players[idx].lastDisconnect = Date.now();
		}
	});
}

function handlePlayerInput(session, playerIndex, data) {
	const sessionPlayer = session.players[playerIndex];
	const playerNumber = sessionPlayer.playerNumber;

	if (!session.gameState || !session.gameState.players || !session.gameState.players[playerNumber]) return;

	const gsPlayer = session.gameState.players[playerNumber];
	if (!gsPlayer.keyState) gsPlayer.keyState = { up: false, down: false };

	const isDown = data.type === 'keydown';
	if (data.key === 'w' || data.key === 'ArrowUp') {
		gsPlayer.keyState.up = isDown;
	} else if (data.key === 's' || data.key === 'ArrowDown') {
		gsPlayer.keyState.down = isDown;
	}

	const up = gsPlayer.keyState.up ? 1 : 0;
	const down = gsPlayer.keyState.down ? 1 : 0;
	gsPlayer.dy = (down - up);
}
