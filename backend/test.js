import getAllUsers, { addUser, addMatch, getAllMatchHistory, getAllMatches, getUserMatchHistory } from "./db/dbQuery.js";
import User from "./utils/User.js";
import Match from "./utils/Match.js";

/**
 * Adds test users and test matches
 */
export default async function testDatabase() {
    try {
        let newuser = new User("wkornato");
        await newuser.setPassword("test");
        newuser.email = "wkornatoemail@gmail.com";

        await addUser(newuser);

        let pzurawic = new User("pzurawic");
        await pzurawic.setPassword("hastobehashed");
        pzurawic.email = "pzurawicemail@gmail.com";

        await addUser(pzurawic);

        let pingwin = new User("pingwin");
        await pingwin.setPassword("itishashed");
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
