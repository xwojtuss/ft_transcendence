import { setIsOnline } from "../../db/dbQuery.js";
import { checkRefreshToken } from "../auth/authUtils.js";

export default async function updateOnlineStatus(socket, request) {
    let payload;

    try {
        payload = await checkRefreshToken(request.server, request.cookies.refreshToken);
    } catch (error) {
        return;
    }
    await setIsOnline(payload.id, true);
    socket.on('close', async (stream) => {
        await setIsOnline(payload.id, false);
    });
}