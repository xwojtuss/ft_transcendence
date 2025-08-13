import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser, getUserMatchHistory } from "../db/dbQuery.js";
import { cheerio } from '../server.js';
import HTTPError from "../utils/error.js";

const allowedNames = new Set(["login", "register"]);

export async function getStaticView(name) {
    if (allowedNames.has(name) === false)
        throw new HTTPError(StatusCodes.NOT_FOUND, ReasonPhrases.NOT_FOUND);
    try {
        return await fs.readFile(`./backend/views/${name}.html`, "utf-8");
    } catch (error) {
        throw new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR);
    }
}

let cachedProfileHtmlPromise = fs.readFile('./backend/views/profile.html', 'utf8');

function getOrdinalIndicator(number) {
    
    if (number > 10 && number < 14)
        return 'th';
    switch (number % 10) {
        case 1:
            return 'st';
        case 2:
            return 'nd';
        case 3:
            return 'rd';
        default:
            return 'th';
    }
}

function getDesktopMatchHTML(match, currentUser) {
    let count = 1;
    let delim;
    let originator = false;
    const row = cheerio.load(`
        <tr>
            <td>${match.endedAt}</td>
            <td>${match.numOfPlayers}</td>
            <td class="overflow-x-auto max-w-[150px] whitespace-nowrap"></td>
            <td><a href="/profile/${match.originator.nickname || match.originator}">${match.originator.nickname || match.originator}</a></td>
            <td>1st</td>
        </tr>`, null, false)
    match.participants.forEach((key, participant) => {
        delim = ', ';
        if (count === match.maxNumOfPlayers || (count === match.maxNumOfPlayers - 1 && originator === false)) delim = '';
        if (participant === currentUser || participant === currentUser.nickname) {
            row('tr td:nth-child(5)').text(`${key + getOrdinalIndicator(key)}`);
            originator = true;
        } else {
            row('tr td:nth-child(3)').append(`<a href="/profile/${participant.nickname || participant}">${(participant.nickname || participant) + delim}</a>`);
        }
        count++;
    })
    return row.html();
}

function getMobileMatchHTML(match, currentUser) {
    const row = cheerio.load(`
        <li class="mobile-match-list"><b>at ${match.endedAt}:</b><ul>
            <li>Player Count: ${match.numOfPlayers}</li>
            <li>Opponents:<ul>
            </ul></li>
            <li>Initiator: <a href="/profile/${match.originator.nickname || match.originator}">${match.originator.nickname || match.originator}</a></li>
            <li>Rank: 1st</li>
        </ul></li>`, null, false)
    match.participants.forEach((key, participant) => {
        if (participant === currentUser || participant === currentUser.nickname) {
            row('li.mobile-match-list > ul > li:last-child').text(`Rank: ${key + getOrdinalIndicator(key)}`);
        } else {
            row('li.mobile-match-list ul li ul').append(`<li><a href="/profile/${participant.nickname || participant}">${(participant.nickname || participant)}</a></li>`);
        }
    })
    return row.html();
}

export async function getProfile(login) {
    if (!login)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const cachedProfileHtml = await cachedProfileHtmlPromise;
    const user = await getUser(login);
    if (!user)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const profilePage = cheerio.load(cachedProfileHtml, null, false);
    profilePage('.user-stats span.nickname span.user-nickname').text(user.nickname);
    if (user.isOnline === false) {
        profilePage('.tooltip .tooltiptext').text('Offline');
        profilePage('.tooltip svg').removeClass('online-indicator');
        profilePage('.tooltip svg').addClass('offline-indicator');
    }
    profilePage('.wins-losses div:first-child span:first-child').text(user.won_games);
    profilePage('.wins-losses div:last-child span:first-child').text(user.lost_games);
    profilePage('.user-info .avatar img').attr('src', user.avatar || '/assets/default-avatar.svg');
    profilePage('.match-history-desktop table caption, .match-history-mobile p').text(user.nickname + "'s Match History");
    const userMatches = await getUserMatchHistory(user.nickname);
    userMatches.forEach(match => {
        profilePage('.match-history-desktop table tbody').append(getDesktopMatchHTML(match, login));
        profilePage('.match-history-mobile ol').append(getMobileMatchHTML(match, login));
    });
    return profilePage.html();
}
