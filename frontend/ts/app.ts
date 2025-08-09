import { loginHandler, refreshAccessToken } from "./authenticate.js";
import changePasswordButton from "./login-register-form.js";
import { accessToken } from "./authenticate.js";
import formPasswordVisibility from "./login-register-form.js";

const app: HTMLElement | null = document.getElementById('app');

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (!target)
        return;
    if (target.tagName === 'A') {
        const href: string | null = target.getAttribute('href');
        if (href) {
            e.preventDefault();
            renderPage(href);
        }
    }
})

window.addEventListener('popstate', handleRouteChange);

handleRouteChange();
changeActiveStyle();

export async function renderPage(pathURL: string) {
    if (!app)
        return;
    if ((pathURL === '/login' || pathURL === '/register') && accessToken !== null)
        return renderPage('/');
    try {
        const response = await fetch(`/api/view${pathURL}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (response.status === 401 && await refreshAccessToken() === false) {
            return renderPage('/login');
        }
        const view = await response.text();
        app.innerHTML = view;
        const newUrl = new URL(pathURL, window.location.origin).pathname;
        if (window.location.pathname !== newUrl) {
            window.history.pushState({}, '', newUrl);
        }
    } catch (error) {
        console.error(error);
    }
    changeActiveStyle(pathURL);
    switch (pathURL) {
        case '/login':
            await loginHandler();
            formPasswordVisibility();
            break;
        case '/register':
            formPasswordVisibility();
        default:
            break;
    }
}

async function handleRouteChange() {
    await renderPage(window.location.pathname);
}

function changeActiveStyle(pathURL?: string) {
    const path: string = pathURL || window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
        }
    });
}
