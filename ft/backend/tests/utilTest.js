import getAllUsers, { addUser, getAllMatchHistory, getAllMatches, getUser } from "../db/dbQuery.js";
import User from "../utils/User.js";
import Match from "../utils/Match.js";
import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * Adds test users and test matches
 */
export default async function testDatabase() {
    try {
        let nickname = "wkornato";
        let newuser = new User(nickname);
        await newuser.setPassword("zaq1@WSX");
        newuser.email = nickname + "@gmail.com";

        await addUser(newuser);
        newuser = await getUser(nickname);

        nickname = "pzurawic";
        let pzurawic = new User("pzurawic");
        await pzurawic.setPassword("zaq1@WSX");
        pzurawic.email = nickname + "@gmail.com";

        await addUser(pzurawic);
        pzurawic = await getUser(nickname);

        nickname = "pingwin";
        let pingwin = new User(nickname);
        await pingwin.setPassword("zaq1@WSX");
        pingwin.email = nickname + "@gmail.com";

        await addUser(pingwin);
        pingwin = await getUser(nickname);

        // TEST MATCHES WITH REGISTERED USERS
        let newmatch = new Match(newuser, "Pong", "Local");
        newmatch.addParticipant(pzurawic);
        newmatch.endMatch();
        newmatch.addRank(newuser, "Lost");
        newmatch.addRank(pzurawic, "Won");
        newmatch.endMatch();

        await newmatch.commitMatch();

        let secondMatch = new Match(pzurawic, "Pong", "Tournament");
        secondMatch.addParticipant(newuser);
        secondMatch.addParticipant(pingwin);
        secondMatch.endMatch();
        secondMatch.addRank(pingwin, "Won");
        secondMatch.addRank(pzurawic, "Lost");
        secondMatch.addRank(newuser, "Lost");
        secondMatch.endMatch();

        await secondMatch.commitMatch();

        // TEST MATCHES WITH ALIASES ONLY

        let aliasMatch = new Match("aliasTest", "Pong", "Local", 2);
        aliasMatch.addParticipant("test");
        aliasMatch.addRank("test", "Lost");
        aliasMatch.addRank("aliasTest", "Won");
        aliasMatch.endMatch();

        await aliasMatch.commitMatch();

        let aliasTournament = new Match("aliasTourn", "Pong", "Tournament");
        aliasTournament.addParticipant("one");
        aliasTournament.addParticipant("two");
        aliasTournament.addRank("one", "Lost");
        aliasTournament.addRank("two", "Lost");
        aliasTournament.addRank("aliasTourn", "Won");
        aliasTournament.endMatch();

        await aliasTournament.commitMatch();

        // TEST MIXED MATCHES

        let mixedPong = new Match(pzurawic, "Pong", "Online");
        mixedPong.addParticipant("haha");
        mixedPong.addRank("haha", "Lost");
        mixedPong.addRank(pzurawic, "Lost");
        mixedPong.endMatch();

        await mixedPong.commitMatch();

        let mixedTournament = new Match("mixedTourn", "Pong", "Tournament");
        mixedTournament.addParticipant(pingwin);
        mixedTournament.addParticipant("two");
        mixedTournament.addRank(pingwin, "Lost");
        mixedTournament.addRank("two", "Lost");
        mixedTournament.addRank("mixedTourn", "Won");
        mixedTournament.endMatch();

        await mixedTournament.commitMatch();

        console.log(await getAllUsers());
        console.log(await getAllMatchHistory());
        console.log(await getAllMatches());
        console.log(await Match.getUserMatches(pzurawic));
    } catch (error) {
        console.error(error);
    }
}

/**
 * Check if the necessary secrets are correct
 */
export function runSecretsTest() {
    assert(fs.existsSync(path.join(process.cwd(), 'secrets', 'ft_transcendence.key')), "SSL key not found");
    assert(fs.existsSync(path.join(process.cwd(), 'secrets', 'ft_transcendence.crt')), "SSL cert not found");
    assert(process.env.COOKIE_SECRET, "Cookie secret not found in .env");
    assert(process.env.ACCESS_TOKEN_SECRET, "Access token secret not found in .env");
    assert(process.env.REFRESH_TOKEN_SECRET, "Refresh token secret not found in .env");
    assert(process.env.TFA_TOKEN_SECRET, "2FA authorization token secret not found in .env");
    assert(process.env.CRYPTO_TFA_KEY, "2FA secret encryption key not found in .env");
    assert(Buffer.from(process.env.CRYPTO_TFA_KEY, 'base64').length === 32, "2FA secret encryption key in .env is not 256-bit/32-byte");
    assert(process.env.TFA_EMAIL_EMAIL, "No google email found for sending 2FA emails in .env");
    assert(process.env.TFA_EMAIL_PASSWORD, "No google app password found for sending 2FA emails in .env");
    assert(process.env.TFA_SMS_OAUTH, "SMSAPI OAuth token not found in .env");
    if (!process.env.PORT) {
        //console.log("Port not found in .env, defaulting to 3000");
    }
}