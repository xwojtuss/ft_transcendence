import getAllUsers, { addUser, addMatch, getAllMatchHistory, getAllMatches, getUserMatchHistory } from "./db/dbQuery.js";
import User from "./utils/User.js";
import Match from "./utils/Match.js";

export default async function testDatabase(db) {
    let newuser = new User("wkornato");
    await newuser.setPassword("test");
    newuser.email = "wkornatoemail@gmail.com";

    addUser(newuser);

    let pzurawic = new User("pzurawic");
    await pzurawic.setPassword("hastobehashed");
    pzurawic.email = "pzurawicemail@gmail.com";

    addUser(pzurawic);

    let newmatch = new Match(newuser);
    newmatch.addParticipant(pzurawic);
    newmatch.endMatch();
    newmatch.addRank(newuser, 2);
    newmatch.addRank(pzurawic, 1);

    await addMatch(newmatch);

    console.log(await getAllUsers());
    console.log(await getAllMatchHistory());
    console.log(await getAllMatches());
    console.log(await getUserMatchHistory('wkornato'));
}
