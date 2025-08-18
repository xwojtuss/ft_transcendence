import { renderPage } from "./app.js";
import { getErrorNickname, getErrorPassword, getErrorEmail, getErrorLogin } from "./validateInput.js";
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

        let errorMessage = getErrorLogin(data.login as string);
        if (errorMessage) {
            return alert(errorMessage);
        } else if ((errorMessage = getErrorPassword(data.password as string))) {
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

        let errorMessage = getErrorNickname(data.nickname as string);
        if (errorMessage) {
            return alert(errorMessage);
        } else if ((errorMessage = getErrorEmail(data.email as string))) {
            return alert(errorMessage);
        } else if ((errorMessage = getErrorPassword(data.password as string))) {
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

export async function updateSubmitHandler() {
    document.getElementById('update-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const data: Record<string, string> = {};

        for (let i = 0; i < form.elements.length; i++) {
            const input = form.elements.item(i) as HTMLInputElement;
            if (!input.name)
                continue;
            data[input.name] = input.value;
        }
        let errorMessage = getErrorNickname(data.nickname as string);
        if (errorMessage) {
            return alert(errorMessage);
        } else if ((errorMessage = getErrorEmail(data.email as string))) {
            return alert(errorMessage);
        } else if ((errorMessage = getErrorPassword(data.currentPassword as string))) {
            return alert(errorMessage);
        } else if (data.newPassword && (errorMessage = getErrorPassword(data.newPassword as string))) {
            return alert(errorMessage);
        }
        // compress the image or resize it or limit the file size
        const result = await fetch('/api/auth/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(data)
        });
        if (result.status === 403) {
            return await renderPage('/', true);
        } else if (!result.ok) {
            return alert((await result.json()).message);
        }
        accessToken = (await result.json()).accessToken;
        return await renderPage('/profile', true);
    });
}