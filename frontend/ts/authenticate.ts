import { renderPage } from "./app.js";
import { checkFile, checkNickname, checkPassword, checkEmail, checkLogin, checkOneTimeCode } from "./validateInput.js";
export let accessToken: string | null = null;
export let tfaTempToken: string | null = null;

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

        try {
            checkLogin(data.login as string);
            checkPassword(data.password as string);
        } catch (error) {
            return alert(error);
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
        } else if (result.status === 202) { // 2FA REQUIRED
            tfaTempToken = (await result.json()).tfaToken;
            return await renderPage('/2fa', false);
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

        try {
            checkNickname(data.nickname as string);
            checkEmail(data.email as string);
            checkPassword(data.password as string);
        } catch (error) {
            return alert(error);
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
            const input = form.elements.item(i) as HTMLInputElement | HTMLSelectElement;
            if (!input.name || input.name === 'avatar')
                continue;
            data[input.name] = input.value;
        }
        const fileInput = document.getElementById('file-input') as HTMLInputElement | null | undefined;
        try {
            checkFile(fileInput);
            checkNickname(data.nickname as string);
            checkEmail(data.email as string);
            checkPassword(data.currentPassword as string);
            if (data.newPassword) checkPassword(data.newPassword as string);
        } catch (error) {
            return alert(error);
        }
        const formData = new FormData();
        if (fileInput && fileInput.files?.[0]) {
            formData.append('avatar', fileInput.files[0]);
        }
        formData.append('nickname', data.nickname);
        formData.append('email', data.email);
        formData.append('currentPassword', data.currentPassword);
        formData.append('newPassword', data.newPassword);
        formData.append('tfa', data.tfa);
        const result = await fetch('/api/auth/update', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            body: formData
        });
        if (result.status === 403) {
            return await renderPage('/', true);
        } else if (!result.ok) {
            return alert((await result.json()).message);
        } else if (result.status === 202) { // 2FA REQUIRED
            tfaTempToken = (await result.json()).tfaToken;
            return await renderPage('/2fa', false);
        }
        accessToken = (await result.json()).accessToken;
        return await renderPage('/profile', false);
    });
}

export async function update2FASubmitHandler() {
    const inputs = document.querySelectorAll('form input.digit');

    document.getElementById('tfa-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let data = 0;

        inputs.forEach((element) => {
            const input = element as HTMLInputElement;
            data *= 10;
            data += parseInt(input.value);
        });
        try {
            checkOneTimeCode(data);
        } catch (error) {
            return alert(error);
        }
        const result = await fetch('/api/auth/2fa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tfaTempToken}`
            },
            body: JSON.stringify({ code: data.toString().padStart(6, '0') })
        });
        if (result.status === 403) {
            return await renderPage('/', true);
        } else if (!result.ok) {
            return alert((await result.json()).message);
        }
        tfaTempToken = null;
        const responseAccess = (await result.json()).accessToken;
        if (responseAccess !== null && responseAccess !== undefined) {
            accessToken = responseAccess;
        }
        return await renderPage('/', true);
    });
}

export function invalidateAccessToken() {
    accessToken = null;
}