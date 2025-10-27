import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser } from "../../db/dbQuery.js";
import { areFriends } from "../../db/friendQueries.js";
import { cheerio } from '../../buildApp.js';
import HTTPError from "../../utils/error.js";
import Match from "../../utils/Match.js";
import User from "../../utils/User.js";

let cachedProfileHtmlPromise = fs.readFile('./backend/views/profile.html', 'utf8');

/**
 * Get the ordinal indicator
 * @param {number} number the number to check
 * @returns {string} the ordinal indicator
 * @example
 * // returns 'st'
 * getOrdinalIndicator(1);
 * @example
 * // returns 'nd'
 * getOrdinalIndicator(2);
 */
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

/**
 * Get the HTML of the row of a table for one match
 * @param {Match} match the match to convert to HTML
 * @param {string} profileOwner the user nickname who's profile is currently being viewed
 * @returns {string} the HTML for a row that corresponds to one match
 */
function getDesktopMatchHTML(match, profileOwner) {
    let count = 1;
    let delim;
    const row = cheerio.load(`
        <tr>
            <td>${match.endedAt}</td>
            <td>${match.game}</td>
            <td>${match.mode}</td>
            <td class="overflow-x-auto max-w-[150px] whitespace-nowrap inline-block no-border"></td>
            <td></td>
        </tr>`, null, false);
    match.participants.forEach((key, participant) => {
        delim = ', ';
        if (count === match.maxNumOfPlayers) delim = '';
        if (participant === profileOwner || participant.nickname === profileOwner) {
            row('tr td:nth-child(5)').text(key);
        }
        if (participant instanceof User) row('tr td:nth-child(4)').append(`<a href="/profile/${participant.nickname}">${(participant.nickname)}</a>${delim}`);
        else if (typeof participant === "string") row('tr td:nth-child(4)').append(`${participant + delim}</a>`);
        count++;
    })
    return row.html();
}

/**
 * Get the HTML of one list element for one match
 * @param {Match} match the match to convert to HTML
 * @param {User | string} profileOwner the user or user nickname who's profile is currently being viewed
 * @returns {string} the HTML for one list element that corresponds to one match
 */
function getMobileMatchHTML(match, profileOwner) {
    const row = cheerio.load(`
        <li class="mobile-match-list"><b>at ${match.endedAt}:</b><ul>
            <li>Game: ${match.game}</li>
            <li>Mode: ${match.mode}</li>
            <li>Players:<ul>
            </ul></li>
            <li>Outcome: </li>
        </ul></li>`, null, false)
    match.participants.forEach((key, participant) => {
        if ((participant === profileOwner || participant.nickname === profileOwner)) {
            row('li.mobile-match-list > ul > li:last-child').text(`Outcome: ${key}`);
        }
        if (participant instanceof User) row('li.mobile-match-list ul li ul').append(`<li><a href="/profile/${participant.nickname || participant}">${(participant.nickname || participant)}</a></li>`);
        else if (typeof participant === "string") row('li.mobile-match-list ul li ul').append(`<li>${participant.nickname || participant}</li>`);
    })
    return row.html();
}

/**
 * Return the HTML for when there are no matches
 * @param {User | string} user the user or user nickname who's profile is being viewed
 * @returns {string} the HTML for the empty match history
 */
function getEmptyMatchHistory(user) {
    const empty = cheerio.load(`
        <p>${user.nickname || user}'s Match History</p>
        <p class="empty-list">No matches yet!</p>
        `, null, false)
    return empty.html();
}

/**
 * Get the profile view HTML
 * @param {string} loggedInNickname the nickname of a user who is viewing the profile page
 * @param {string} toFetchNickname the nickname of a user who's profile is being viewed
 * @returns {Promise<string>} the HTML for the profile view
 */
export async function getProfile(loggedInNickname, toFetchNickname) {
    if (!loggedInNickname)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const cachedProfileHtml = await cachedProfileHtmlPromise;
    const user = await getUser(toFetchNickname);
    if (!user)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const profilePage = cheerio.load(cachedProfileHtml, null, false);
    profilePage('.user-stats span.nickname span.user-nickname').text(user.nickname);
    if (loggedInNickname !== toFetchNickname && !(await areFriends(loggedInNickname, toFetchNickname))) {
        profilePage('.tooltip').html('');
    } else if (loggedInNickname !== toFetchNickname && user.isOnline === 0) {
        profilePage('.tooltip .tooltiptext').text('Offline');
        profilePage('.tooltip svg').removeClass('online-indicator');
        profilePage('.tooltip svg').addClass('offline-indicator');
        profilePage('.tooltip svg circle').removeClass('online-indicator');
        profilePage('.tooltip svg circle').addClass('offline-indicator');
    }
    if (loggedInNickname !== toFetchNickname) {
        profilePage('.avatar p').remove();
    }
    profilePage('.wins-losses div:first-child span:first-child').text(user.won_games);
    profilePage('.wins-losses div:last-child span:first-child').text(user.lost_games);
    profilePage('.user-info .avatar img').attr('src', user.avatar ? `/api/avatars/${user.id}?t=${Date.now()}` : '/assets/default-avatar.svg');
    profilePage('.match-history-desktop table caption, .match-history-mobile p').text(user.nickname + "'s Match History");
    const userMatches = await Match.getUserMatches(user);
    userMatches.forEach(match => {
        profilePage('.match-history-desktop table tbody').append(getDesktopMatchHTML(match, toFetchNickname));
        profilePage('.match-history-mobile ol').append(getMobileMatchHTML(match, toFetchNickname));
    });
    if (userMatches.size === 0) {
        profilePage('.match-history-desktop').html(getEmptyMatchHistory(toFetchNickname));
        profilePage('.match-history-mobile').html(getEmptyMatchHistory(toFetchNickname));
    }
    return profilePage.html();
}
