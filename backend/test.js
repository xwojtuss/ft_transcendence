import getAllUsers, { addUser, addMatch, getAllMatchHistory, getAllMatches, getUserMatchHistory } from "./db/dbQuery.js";
import User from "./utils/User.js";
import Match from "./utils/Match.js";
import assert from "assert";
import fs from "fs";

/**
 * Adds test users and test matches
 */
export default async function testDatabase() {
    try {
        let newuser = new User("wkornato");
        await newuser.setPassword("zaq1@WSX");
        newuser.email = "wkornatoemail@gmail.com";

        await addUser(newuser);

        let pzurawic = new User("pzurawic");
        await pzurawic.setPassword("zaq1@WSX");
        pzurawic.email = "pzurawicemail@gmail.com";

        await addUser(pzurawic);

        let pingwin = new User("pingwin");
        await pingwin.setPassword("zaq1@WSX");
        pingwin.email = "pingwinemail@gmail.com";

        await addUser(pingwin);

        let newmatch = new Match(newuser);
        newmatch.addParticipant(pzurawic);
        newmatch.endMatch();
        newmatch.addRank(newuser, 2);
        newmatch.addRank(pzurawic, 1);

        await addMatch(newmatch);

        let secondMatch = new Match(pzurawic);
        secondMatch.addParticipant(newuser);
        secondMatch.addParticipant(pingwin);
        secondMatch.endMatch();
        secondMatch.addRank(pingwin, 1);
        secondMatch.addRank(pzurawic, 2);
        secondMatch.addRank(newuser, 3);

        await addMatch(secondMatch);

        console.log(await getAllUsers());
        console.log(await getAllMatchHistory());
        console.log(await getAllMatches());
        console.log(await getUserMatchHistory('wkornato'));
    } catch (error) {
        console.log(error);
    }
}

export function runSecretsTest() {
    assert(fs.existsSync("./secrets/ft_transcendence.key"), "SSL key not found");
    assert(fs.existsSync("./secrets/ft_transcendence.crt"), "SSL cert not found");
    assert(process.env.COOKIE_SECRET, "Cookie secret not found in .env");
    assert(process.env.ACCESS_TOKEN_SECRET, "Access token secret not found in .env");
    assert(process.env.REFRESH_TOKEN_SECRET, "Refresh token secret not found in .env");
    assert(process.env.TFA_TOKEN_SECRET, "2FA authorization token secret not found in .env");
    assert(process.env.CRYPTO_TFA_KEY, "2FA secret encryption key not found in .env");
    assert(Buffer.from(process.env.CRYPTO_TFA_KEY, 'base64').length === 32, "2FA secret encryption key is not 256-bit/32-byte");
    if (!process.env.PORT) {
        console.log("Port not found in .env, defaulting to 3000");
    }
}