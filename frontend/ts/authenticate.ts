import { renderPage } from "./app.js";
import getErrorForPassword from "./validateInput.js";
export let accessToken: string | null = null;

/**
 * Tries to refresh the access token
 * @returns false if session is not active or has expired, true if the tokens have been refreshed
 */
export async function refreshAccessToken(): Promise<boolean> {
    const result = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include'
    });
    if (result.status === 403) {
        return true;// if the access token was already valid
    }
    if (!result.ok) {
        accessToken = null;
        return false;
    }
    accessToken = (await result.json()).accessToken;
    return true;
}

/**
 * Sets up the listeners for the login page,
 * Makes the submit buttons fetch /api/auth/login
 */
export async function loginHandler() {
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        let errorMessage = getErrorForPassword(data.password as string);
        if (errorMessage) {
            return alert(errorMessage);
        }
        const result = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(data)
        });
        if (result.status === 403) {// user is already logged in
            return await renderPage('/', true);
        } else if (!result.ok) {
            return alert((await result.json()).message);
        }
        accessToken = (await result.json()).accessToken;
        return await renderPage('/', true);
    });
}

/**
 * Sets up the listeners for the register page,
 * Makes the submit buttons fetch /api/auth/register
 */
export async function registerHandler() {
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        let errorMessage = getErrorForPassword(data.password as string);
        if (errorMessage) {
            return alert(errorMessage);
        }
        const result = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(data)
        });
        if (result.status === 403) {// user is already logged in
            return await renderPage('/', true);
        } else if (!result.ok) {
            return alert((await result.json()).message);
        }
        accessToken = (await result.json()).accessToken;
        return await renderPage('/', true);
    });
}
