export function setupSocketHandlers(socket, session, playerId) {
    // detach previous listeners (defensive)
    try {
        if (typeof socket.removeAllListeners === 'function') {
            socket.removeAllListeners('message');
            socket.removeAllListeners('close');
        }
        if (typeof socket.setMaxListeners === 'function') {
            socket.setMaxListeners(0);
        }
    } catch (e) { /* ignore */ }

    const getPlayerIndex = () => session.players.findIndex(p => p.id === playerId);

    const markDisconnected = (idx) => {
        const p = session.players[idx];
        if (!p) return;
        p.connected = false;
        p.lastDisconnect = Date.now();
    };

    socket.on('message', (msg) => {
        // safe convert to string (Buffer in some ws libs)
        let raw;
        try { raw = typeof msg === 'string' ? msg : msg.toString(); } catch (e) { return; }

        let data;
        try { data = JSON.parse(raw); } catch (err) { return; }

        const idx = getPlayerIndex();

        if (data && data.type === "clientDisconnecting") {
            if (idx !== -1) markDisconnected(idx);
            return;
        }

        // ignore inputs if player not present
        if (idx === -1) return;

        if (data.type === 'keydown' || data.type === 'keyup') {
            handlePlayerInput(session, idx, data);
        }
    });

    socket.on('close', () => {
        const idx = getPlayerIndex();
        if (idx !== -1) markDisconnected(idx);
    });
}

function handlePlayerInput(session, playerIndex, data) {
    const sessionPlayer = session.players[playerIndex];
    if (!sessionPlayer) return;

    const playerNumber = sessionPlayer.playerNumber;
    const gsPlayer = session?.gameState?.players?.[playerNumber];
    if (!gsPlayer) return;

    // ensure keyState exists
    if (!gsPlayer.keyState) gsPlayer.keyState = { up: false, down: false };

    const isDown = data.type === 'keydown';

    // key groups to avoid repeated if/else chains
    const upKeys = { 'w': true, 'ArrowUp': true };
    const downKeys = { 's': true, 'ArrowDown': true };

    if (upKeys[data.key]) {
        gsPlayer.keyState.up = isDown;
    } else if (downKeys[data.key]) {
        gsPlayer.keyState.down = isDown;
    }

    // compute velocity direction compactly
    gsPlayer.dy = (gsPlayer.keyState.down ? 1 : 0) - (gsPlayer.keyState.up ? 1 : 0);
}
