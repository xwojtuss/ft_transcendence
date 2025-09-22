import TFA from "../utils/TFA.js";
import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser } from "../db/dbQuery.js";
import { cheerio } from '../buildApp.js';
import HTTPError from "../utils/error.js";

let cachedUpdateHtmlPromise = fs.readFile('./backend/views/update.html', 'utf8');

/**
 * Get the update user info view HTML
 * @param {string} loggedInNickname the nickname of a user who is viewing the update page
 * @returns {Promise<string>} the HTML for the update view
 */
export async function getUpdate(loggedInNickname) {
    if (!loggedInNickname)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const cachedUpdateHtml = await cachedUpdateHtmlPromise;
    const user = await getUser(loggedInNickname);
    const currentTFA = await TFA.getUsersTFA(user.id);
    const updatePage = cheerio.load(cachedUpdateHtml, null, false);
    updatePage('.avatar img#preview-avatar').attr('src', user.avatar ? `/api/avatars/${user.id}?t=${Date.now()}` : '/assets/default-avatar.svg');
    updatePage('#nickname-input').attr('value', user.nickname);
    updatePage('#email-input').attr('value', user.email);
    updatePage('#phone-input').attr('value', user.phoneNumber);
    updatePage('#tfa-select').append(`<option value="${currentTFA.type}">${currentTFA.prettyTypeName()}</option>`);
    TFA.TFAtypes.forEach((value, key) => {
        if (key !== currentTFA.type) {
            updatePage('#tfa-select').append(`<option value="${key}">${TFA.TFAtypes.get(key)}</option>`);
        }
    });
    updatePage('#tfa-select').attr('value', currentTFA.type);
    return updatePage.html();
}
