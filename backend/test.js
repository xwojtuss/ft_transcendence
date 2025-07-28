import { initDb } from "./db/dbInit.js";
import getAllUsers, { addUser, addMatch, getAllMatchHistory, getAllMatches } from "./db/dbQuery.js";
import User from "./utils/User.js";
import deleteDatabase from "./db/dbDev.js";
import Match from "./utils/Match.js";

export default async function testDatabase() {
    await deleteDatabase("test.sqlite");

    const db = await initDb("test.sqlite");

    let newuser = new User("wkornato");
    await newuser.setPassword("test");
    newuser.email = "wkornatoemail@gmail.com";

    addUser(db, newuser);

    let pzurawic = new User("pzurawic");
    await pzurawic.setPassword("hastobehashed");
    pzurawic.email = "pzurawicemail@gmail.com";

    addUser(db, pzurawic);

    let newmatch = new Match(newuser);
    newmatch.addParticipant(pzurawic);
    newmatch.endMatch();
    newmatch.addRank(newuser, 2);
    newmatch.addRank(pzurawic, 1);

    await addMatch(db, newmatch);

    console.log(await getAllUsers(db));
    console.log(await getAllMatchHistory(db));
    console.log(await getAllMatches(db));
}
