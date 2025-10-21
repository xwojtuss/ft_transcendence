import changePasswordButton from "./login-register-form.js";
import { loginHandler, registerHandler, refreshAccessToken, updateSubmitHandler, update2FASubmitHandler, changeOnlineStatus } from "./authenticate.js";
import { accessToken, tfaTempToken } from "./authenticate.js";
import { friendsHandler } from "./friends.js";
import formPasswordVisibility from "./login-register-form.js";
import { profileHandler, update2FAHandler, updateHandler } from "./userProfile.js";
import { initLocalGame } from "./localGame.js";
import { initLocalTournament } from "./tournament.js";
import { clearTournamentAll, isTournamentPath, cleanupTournamentOnRouteChange } from "./tournamentCleanup.js";
import { initAliasRegistration } from "./aliasRegistration.js";
import { initTicTacToe } from "./ticTacToe.js";
import { HomeRenderer } from "./homePage/HomeRenderer.js";


  
// ^^^^^ TRDM ^^^^^
// frontend/ts/app.ts — routes that are rendered 100% client-side.
// We skip the network fetch for these to avoid 404 noise.
const CLIENT_ONLY_ROUTES = new Set<string>([
    "/game/local-tournament",
    "tic-tac-toe",
    "tic-tac-toe/match",
  ]);
  


const app: HTMLElement | null = document.getElementById('app');
const navigation: HTMLElement | null = document.getElementById('navigation');

window.addEventListener("beforeunload", () => {
    // If the user refreshes or closes the tab while not on a tournament page,
    // make sure stale keys won’t linger into the next session.
    const p = window.location.pathname;
    if (p !== "/game/local" && p !== "/game/local-tournament") {
        try { clearTournamentAll("beforeunload"); sessionStorage.removeItem('localGameAliases'); } catch {}
    }
  });

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
        case '/home':
        case '/':
            const canvas = document.getElementById('home-canvas');
            if (!canvas) return;
            const renderer = new HomeRenderer(canvas as HTMLCanvasElement);
            renderer.startRenderLoop();
            break;
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


async function runChosenGame(pathURL: string): Promise<void> {
    const url = new URL(pathURL, window.location.origin);
    const pathname = url.pathname;
    const params = url.searchParams;
    
    // Handle local game with parameters
    if (pathname === '/game/local') {
        const isAI = params.get('ai') === '1';
        const isRegistered = params.get('registered') === 'true';
        
        if (isRegistered) {
            initLocalGame(isAI);
        } else {
            initAliasRegistration();
        }
        return;
    }
    
    // Handle tournament with parameters
    if (pathname === '/game/local-tournament') {
        const hasPlayers = params.has('players');
        
        if (hasPlayers) {
            initAliasRegistration();
        } else {
            initLocalTournament();
        }
        return;
    }
    if (pathname === '/game/tic-tac-toe') {
        const isMatching = params.get('matching') === '1';
        const isRegistered = params.get('registered') === 'true';

    if (isMatching) {
        if (!isRegistered) {
        // show Matching alias form (4–8)
        initAliasRegistration();
        } 
        else {
            const { initTicTournament } = await import("./ticTournament.js");
            initTicTournament();
        }
        return;
    }
    if (isRegistered) {
        initTicTacToe();
    } 
    else {
        initAliasRegistration();
    }
    return;
    }
    switch (pathname) {
        case '/game/online':
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
    const url = new URL(pathURL, window.location.origin);
    const reqPath = url.pathname + url.search;

    // ^^^^^ TRDM ^^^^^  frontend/ts/app.ts  (at the very beginning of renderPage)
    const prev = window.location.pathname;
    const next = new URL(pathURL, window.location.origin).pathname;

    // If we are leaving the tournament flow entirely, purge stale crumbs.
    // Allowed in-flow transitions (/game/local <-> /game/local-tournament) are preserved.
    if (isTournamentPath(prev) && !isTournamentPath(next)) {
        clearTournamentAll("leaving-tournament-flow");
        sessionStorage.removeItem('localGameAliases');
    }

    // Clean tournament crumbs if we’re leaving that flow (e.g., user clicked title or PLAY).
    // We do this BEFORE fetching the next view, so the next page starts clean.
    try {
        cleanupTournamentOnRouteChange(window.location.pathname, pathURL);
    } catch {}
    //addToHistory(pathURL);
    try {
        const responsePromise: Promise<Response> = fetch(`${reqPath}`, {
            headers: {
                Authorization: `Bearer ${tfaTempToken || accessToken}`,
                'X-Partial-Load': 'true',
                'X-Request-Navigation-Bar': `${requestNavBar}`
            }
        });
        if (pathURL === '/2fa' || pathURL.startsWith('/game')) app.innerHTML = spinner;
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
        const fullPath = url.pathname + url.search;
        if (window.location.pathname + window.location.search !== fullPath) {
            window.history.pushState({}, '', fullPath);
        }
        await runChosenGame(url.toString());
    } catch (error) {
        if (error instanceof Error) alert(error.message);
        console.error(error);
    }
    changeActiveStyle(url.pathname);
    await runHandlers(url.pathname);
}

/**
 * Render the view of window.location.pathname
 */
async function handleRouteChange(): Promise<void> {
    await renderPage(window.location.pathname + window.location.search, true);
    
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
    if (CLIENT_ONLY_ROUTES.has(window.location.pathname)) {
        renderPage(window.location.pathname, false);
        return;
    }
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
