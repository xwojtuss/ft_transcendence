const clients = [];

export function addClient(socket) {
    clients.push(socket);
    //console.log('Game client connected. Total:', clients.length);
}

export function removeClient(socket) {
    const index = clients.indexOf(socket);
    if (index !== -1) {
        clients.splice(index, 1);
        //console.log('Game client disconnected. Total:', clients.length);
    }
}

export function broadcastGameState(gameState) {
    if (clients.length === 0) return;
    
    const payload = JSON.stringify({ type: "state", state: gameState });
    
    for (let i = clients.length - 1; i >= 0; i--) {
        const client = clients[i];
        try {
            if (client && client.readyState === 1) {
                client.send(payload);
            } else {
                clients.splice(i, 1);
            }
        } catch (error) {
            //console.log('Error sending to client, removing:', error.message);
            clients.splice(i, 1);
        }
    }
}

export function getClientCount() {
    return clients.length;
}