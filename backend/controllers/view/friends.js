import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUsersFriendInvitations, getUsersPendingFriendInvitations, getUsersFriends } from "../../db/friendQueries.js";
import { cheerio } from '../../buildApp.js';
import HTTPError from "../../utils/error.js";

let cachedFriendsHtmlPromise = fs.readFile('./backend/views/friends.html', 'utf8');

/**
 * Get the HTML for the friends view
 * @param {number} userId the logged in user id
 * @returns {Promise<string>} the rendered HTML of the view
 */
export async function getFriendsView(userId) {
    if (!userId)
        throw new HTTPError(StatusCodes.NOT_FOUND, 'Requested resource does not exist.');
    const cachedFriendsHtml = await cachedFriendsHtmlPromise;
    const friendsPage = cheerio.load(cachedFriendsHtml, null, false);
    const invitations = await getUsersFriendInvitations(userId);
    const pendingInvites = await getUsersPendingFriendInvitations(userId);
    const friends = await getUsersFriends(userId);
    if (invitations.length === 0) {
        friendsPage('#friend-invitations-wrapper').replaceWith("<p class='fallback-info'>You don't have any friend invitations</p>");
    }
    invitations.forEach((user) => {
        friendsPage('#friend-invitations-wrapper').append(`
            <div class="avatar user-stats floater">
                <a href="/profile/${user.nickname}"><img src="${user.avatar ? `/api/avatars/${user.id}` : '/assets/default-avatar.svg'}" alt="Avatar"></a>
                <span class="nickname-smaller">
                    <a href="/profile/${user.nickname}">${user.nickname}</a>
                </span>
                <div class="buttons accept-decline">
                    <form class="accept-friend-invite">
                        <input type="hidden" name="userId" value="${user.id}">
                        <input type="submit" class="sm-button no-margin" value="Accept">
                    </form>
                    <form class="decline-friend-invite">
                        <input type="hidden" name="userId" value="${user.id}">
                        <input type="submit" class="cancel sm-button no-margin" value="Decline">
                    </form>
                </div>
            </div>
        `);
    });
    if (pendingInvites.length === 0 && friends.length === 0) {
        friendsPage('#friends-wrapper').replaceWith("<p class='fallback-info'>You don't have any friends nor pending invitations yet</p>");
    }
    pendingInvites.forEach((user) => {
        friendsPage('#friends-wrapper').append(`
            <div class="avatar user-stats floater">
                <span class="pending">Pending</span>
                <a href="/profile/${user.nickname}"><img src="${user.avatar ? `/api/avatars/${user.id}` : '/assets/default-avatar.svg'}" alt="Avatar"></a>
                <span class="nickname-smaller">
                    <a href="/profile/${user.nickname}">${user.nickname}</a>
                </span>
                <form class="cancel-friend-invite">
                    <input type="hidden" name="userId" value="${user.id}">
                    <input type="submit" class="cancel sm-button no-margin" value="Cancel">
                </form>
            </div>
        `);
    });
    friends.forEach((user) => {
        friendsPage('#friends-wrapper').append(`
            <div class="avatar user-stats floater">
                <a href="/profile/${user.nickname}"><img src="${user.avatar ? `/api/avatars/${user.id}` : '/assets/default-avatar.svg'}" alt="Avatar"></a>
                <span class="nickname-smaller">
                    <span class="tooltip">
                        <span class="tooltiptext">
                            Online
                        </span>
                        <svg class="smaller">
                            <circle class="online-indicator" cx="6" cy="13" r="6"></circle>
                        </svg>
                    </span>
                    <a href="/profile/${user.nickname}">${user.nickname}</a>
                </span>
                <form class="remove-friend">
                    <input type="hidden" name="userId" value="${user.id}">
                    <input type="submit" class="sm-button no-margin" value="Remove">
                </form>
            </div>
        `);
    });
    return friendsPage.html();
}