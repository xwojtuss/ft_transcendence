import path from "path";
import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser, getUserMatchHistory } from "../db/dbQuery.js";
import { cheerio } from '../server.js';

const allowedNames = new Set(["", "home", "friends", "login", "register", "update", "profile"]);

export async function getView(name) {
    if (allowedNames.has(name) === false)
        return [StatusCodes.NOT_FOUND, ReasonPhrases.NOT_FOUND];
    if (name === "")
        name = "home";
    const viewPath = path.join(process.cwd(), `backend/views/${name}.html`);
    try {
        const view = await fs.readFile(viewPath, "utf-8");
        return [StatusCodes.OK, view];
    } catch (error) {
        return [StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR];
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

function getMatchHTML(match, currentUser) {
    var count = 1;
    var delim;
    var originator = false;
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

export async function getProfile(login) {
    if (!login)
        return [StatusCodes.NOT_FOUND, 'Requested resource does not exist.'];
    try {
        const cachedProfileHtml = await cachedProfileHtmlPromise;
        const user = await getUser(login);
        if (!user)
            return [StatusCodes.NOT_FOUND, 'Requested resource does not exist.'];
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
            profilePage('.match-history-desktop table tbody').append(getMatchHTML(match, login));
        });
        return [StatusCodes.OK, profilePage.html()];
    } catch (error) {
        console.error(error);
        return [StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR];
    }
}