import { StatusCodes } from "http-status-codes";
import HTTPError from "../../utils/error.js";

/**
 * Get the rendered HTML with the alias registration form
 * @param {number} playerCount player count, counting the logged in user
 * @param {"tournament" | "local" | "ai"} gameMode the mode of the game to be passed as the id of the form
 * @param {User} loggedInUser the logged in user
 * @returns {string} HTML string for alias registration form
 */
export const getAliasRegistrationHTML = function (playerCount, gameMode, loggedInUser) {
    let inputs = '';

    if (!playerCount) throw new HTTPError(StatusCodes.BAD_REQUEST, "Player count is required");
    
    for (let i = 1; i <= playerCount; i++) {
        const isFirstAndLoggedIn = loggedInUser && i === 1;
        inputs += `
            <div>
                <input type="text" name="player${i}" id="player${i}" value="${isFirstAndLoggedIn ? loggedInUser.nickname : ''}" autocomplete="off" required ${isFirstAndLoggedIn ? 'disabled class="disabled"' : ''}>
                <label for="player${i}">Player ${i}</label>
            </div>`;
    }

    const html = `
<div class="app-wrapper-center">
    <div class="floater">
        <form class="labeled update" id="${gameMode}-form">
            <legend>Enter Player Name${playerCount > 1 ? 's' : ''}</legend>
            ${inputs}
            <div class="buttons">
                <button type="button" class="cancel" id="cancel-form">Cancel</button>
                <input type="submit" value="Submit">
            </div>
        </form>
    </div>
</div>`;
    return html;
};
