import changePasswordButton from "./login-register-form.js";
import { initLocalGame } from "./localGame.js";
import { loginHandler, registerHandler, refreshAccessToken, updateSubmitHandler, update2FASubmitHandler, changeOnlineStatus } from "./authenticate.js";
import { accessToken, tfaTempToken } from "./authenticate.js";
import { friendsHandler } from "./friends.js";
import formPasswordVisibility from "./login-register-form.js";
import { profileHandler, update2FAHandler, updateHandler } from "./userProfile.js";
import { run } from "node:test";

const app: HTMLElement | null = document.getElementById('app');
const navigation: HTMLElement | null = document.getElementById('navigation');

// to make the <a> links render different views in <main>
document.addEventListener('click', (e) => {
    const target: EventTarget | null = e.target;

    if (!target || !(target instanceof HTMLElement)) return;
    if (target.tagName === 'A') {
        const href: string | null = target.getAttribute('href');
        if (href) {
            e.preventDefault();
            renderPage(href, false);
        }
    }
});

// to make the back and forward buttons function
window.addEventListener('popstate', handleRouteChange);

changeOnlineStatus();

// change the nav bar style on load
changeActiveStyle();

// make the page functional
runHandlers(window.location.pathname);

async function runHandlers(pathURL: string): Promise<void> {
    switch (pathURL) {
        case '/login':
            await loginHandler();
            formPasswordVisibility();
            break;
        case '/register':
            await registerHandler();
            formPasswordVisibility();
            break;
        case '/profile':
            await profileHandler();
            break;
        case '/update':
            updateHandler();
            formPasswordVisibility();
            await updateSubmitHandler();
            break;
        case '/2fa':
            update2FAHandler();
            await update2FASubmitHandler();
            break;
        case '/friends':
            friendsHandler();
            break;
        default:
            if (pathURL.startsWith('/profile/')) {
                await profileHandler();
                break;
            }
            break;
    }
}

function runChosenGame(pathURL: string): void {
    switch (pathURL) {
        case '/game/local':
            initLocalGame();
            break;
        case '/game/online':
            // add initialization for online game mode
            break;
        case '/game/multiplayer':
            // add initialization for multiplayer game mode
            break;
        case '/game/local-tournament':
            // add initialization for local tournament game mode
            break;
        case '/game/online-tournament':
            // add initialization for online tournament game mode
            break;
        default:
            return;
    }
}

/**
 * Render the view or the whole document
 * @param pathURL the path to the view e.g. /login
 * @param requestNavBar whether to also refresh the nav bar
 * @returns
 */
export async function renderPage(pathURL: string, requestNavBar: boolean): Promise<void> {
    if (!app)
        return;
    addToHistory(pathURL);
    try {
        const responsePromise: Promise<Response> = fetch(`${pathURL}`, {
            headers: {
                Authorization: `Bearer ${tfaTempToken || accessToken}`,
                'X-Partial-Load': 'true',
                'X-Request-Navigation-Bar': `${requestNavBar}`
            }
        });
        if (pathURL === '/2fa') app.innerHTML = spinner;
        const response: Response = await responsePromise;
        switch (response.status) {
            case 400:// bad request
                alert((await response.json()).message);
                break;
            case 401:// unauthorized
                // e.g. to a /profile if the user is not logged in
                if (await refreshAccessToken() === false) {
                    break;
                }
                return renderPage(pathURL, requestNavBar);
            case 403:// forbidden
                // e.g. to /login if user is logged in already
                // return renderPage('/', true);
                break;
            default:
                break;
        }
        let view: string;
        if (requestNavBar && navigation) {
            const jsonHTML: { nav: string, app: string } = await response.json();
            view = jsonHTML.app;
            navigation.innerHTML = DOMPurify.sanitize(jsonHTML.nav);
        } else {
            view = await response.text();
        }
        app.innerHTML = DOMPurify.sanitize(view);

        if (pathURL === '/' || pathURL === '/home') {
            initGameModesRouter();
        }

        const newUrl: string = new URL(pathURL, window.location.origin).pathname;
        if (window.location.pathname !== newUrl) {
            window.history.pushState({}, '', newUrl);
        }
        
        runChosenGame(pathURL);
    } catch (error) {
        if (error instanceof Error) alert(error.message);
        console.error(error);
    }
    changeActiveStyle(pathURL);
    await runHandlers(pathURL);
}

/**
 * Render the view of window.location.pathname
 */
async function handleRouteChange(): Promise<void> {
    await renderPage(window.location.pathname, true);
}

function addToHistory(url: string) {
    const newUrl: string = new URL(url, window.location.origin).pathname;
    if (window.location.pathname !== newUrl) {
        window.history.pushState({}, '', newUrl);
    }
}

/**
 * Change the style of the nav bar buttons
 * @param pathURL path to find in the href attr in <a>
 */
function changeActiveStyle(pathURL?: string): void {
    const path: string = pathURL || window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
        }
    });
}

function initGameModesRouter() {
    document.querySelectorAll('.game-tile').forEach(tile => {
        tile.addEventListener('click', function (e) {
            e.preventDefault();
            const href = tile.getAttribute('data-href');
            if (href) {
                renderPage(href, false);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/' || window.location.pathname === '/home') {
        initGameModesRouter();
    }
    runChosenGame(window.location.pathname);
});

const spinner: string = `
<div class="grid min-h-[140px] w-full place-items-center overflow-x-scroll rounded-lg p-6 lg:overflow-visible">
  <svg class="w-12 h-12 text-gray-600 animate-spin" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
    width="24" height="24">
    <path
      d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
      stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path
      d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
      stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="text-white">
    </path>
  </svg>
</div>`
