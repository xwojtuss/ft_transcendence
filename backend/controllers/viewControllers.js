import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser, getUserMatchHistory, areFriends, getTemp2FAsecret, get2FAsecret } from "../db/dbQuery.js";
import { cheerio } from '../server.js';
import HTTPError from "../utils/error.js";
import QRCode from "qrcode";
import { authenticator } from "otplib";
import { TFAtypes } from "../routes/authRoutes.js";

// authenticator.options = {
//     algorithm: 'sha256',
//     digits: 6,
//     step: 30
// };

const allowedNames = new Set(["login", "register", "home"]);// TEMP delete home, add a separate function for '/'

/**
 * Gets the static views e.g. login
 * @param {string} name Name of the view to get
 * @returns {Promise<string>} The rendered static view
 * @throws {HTTPError} NOT_FOUND if the view was not found, INTERNAL_SERVER_ERROR when there has been an Error thrown
 */
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

function getDesktopMatchHTML(match, profileOwner) {
    let count = 1;
    let delim;
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
        if (count === match.maxNumOfPlayers) delim = '';
        if (participant === profileOwner || participant === profileOwner.nickname) {
            row('tr td:nth-child(5)').text(`${key + getOrdinalIndicator(key)}`);
        }
        row('tr td:nth-child(3)').append(`<a href="/profile/${participant.nickname || participant}">${(participant.nickname || participant) + delim}</a>`);
        count++;
    })
    return row.html();
}

function getMobileMatchHTML(match, profileOwner) {
    const row = cheerio.load(`
        <li class="mobile-match-list"><b>at ${match.endedAt}:</b><ul>
            <li>Player Count: ${match.numOfPlayers}</li>
            <li>Players:<ul>
            </ul></li>
            <li>Initiator: <a href="/profile/${match.originator.nickname || match.originator}">${match.originator.nickname || match.originator}</a></li>
            <li>Rank: 1st</li>
        </ul></li>`, null, false)
    match.participants.forEach((key, participant) => {
        if ((participant === profileOwner || participant === profileOwner.nickname)) {
            row('li.mobile-match-list > ul > li:last-child').text(`Rank: ${key + getOrdinalIndicator(key)}`);
        }
        row('li.mobile-match-list ul li ul').append(`<li><a href="/profile/${participant.nickname || participant}">${(participant.nickname || participant)}</a></li>`);
    })
    return row.html();
}

function getEmptyMatchHistory(user) {
    const empty = cheerio.load(`
        <p>${user.nickname || user}'s Match History</p>
        <p class="empty-list">No matches yet!</p>
        `, null, false)
    return empty.html();
}

export async function getProfile(loggedInNickname, toFetchNickname) {
    if (!loggedInNickname)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const cachedProfileHtml = await cachedProfileHtmlPromise;
    const user = await getUser(toFetchNickname);
    if (!user)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const profilePage = cheerio.load(cachedProfileHtml, null, false);
    profilePage('.user-stats span.nickname span.user-nickname').text(user.nickname);
    if (loggedInNickname != toFetchNickname && !(await areFriends(loggedInNickname, toFetchNickname))) {
        profilePage('.tooltip').html('');
    } else if (user.isOnline === false) {
        profilePage('.tooltip .tooltiptext').text('Offline');
        profilePage('.tooltip svg').removeClass('online-indicator');
        profilePage('.tooltip svg').addClass('offline-indicator');
    }
    if (loggedInNickname !== toFetchNickname) {
        profilePage('.avatar p').remove();
    }
    profilePage('.wins-losses div:first-child span:first-child').text(user.won_games);
    profilePage('.wins-losses div:last-child span:first-child').text(user.lost_games);
    profilePage('.user-info .avatar img').attr('src', user.avatar ? `/api/avatars/${user.id}?t=${Date.now()}` : '/assets/default-avatar.svg');
    profilePage('.match-history-desktop table caption, .match-history-mobile p').text(user.nickname + "'s Match History");
    const userMatches = await getUserMatchHistory(user.nickname);
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

let cachedUpdateHtmlPromise = fs.readFile('./backend/views/update.html', 'utf8');

export async function getUpdate(loggedInNickname) {
    if (!loggedInNickname)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const cachedUpdateHtml = await cachedUpdateHtmlPromise;
    const user = await getUser(loggedInNickname);
    const updatePage = cheerio.load(cachedUpdateHtml, null, false);
    updatePage('.avatar img#preview-avatar').attr('src', user.avatar ? `/api/avatars/${user.id}?t=${Date.now()}` : '/assets/default-avatar.svg');
    updatePage('#nickname-input').attr('value', user.nickname);
    updatePage('#email-input').attr('value', user.email);
    
    updatePage('#tfa-select').append(`<option value="${user.typeOfTFA}">${TFAtypes.get(user.typeOfTFA)}</option>`);
    TFAtypes.forEach((value, key) => {
        if (key !== user.typeOfTFA) {
            updatePage('#tfa-select').append(`<option value="${key}">${TFAtypes.get(key)}</option>`);
        }
    });
    updatePage('#tfa-select').attr('value', user.typeOfTFA);
    return updatePage.html();
}

let cached2FAHtmlPromise = fs.readFile('./backend/views/2FA.html', 'utf8');

export async function get2FAview(payload) {
    const cached2FAHtml = await cached2FAHtmlPromise;
    const tfaPage = cheerio.load(cached2FAHtml, null, false);
    let tfaSecret;

    if (payload.status === 'update') {
        tfaSecret = await getTemp2FAsecret(payload.nickname);
        const uri = authenticator.keyuri(payload.nickname, 'ft_transcendence', tfaSecret);
        const imageURL = await QRCode.toDataURL(uri);
        tfaPage('div#qr-wrapper').append(`<img src="${imageURL}" alt="QR code" />`);
    } else if (payload.status === 'check') {
        tfaPage('div#qr-wrapper').html('');
    } else {
        throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
    }
    return tfaPage.html();
}