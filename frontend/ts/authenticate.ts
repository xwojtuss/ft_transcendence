import { renderPage } from "./app.js";
import { checkFile, checkNickname, checkPassword, checkEmail, checkLogin, checkOneTimeCode } from "./validateInput.js";
export let accessToken: string | null | undefined = null;
export let tfaTempToken: string | null | undefined = null;

/**
 * Tries to refresh the access token
 * @returns false if session is not active or has expired, true if the tokens have been refreshed
 */
export async function refreshAccessToken(): Promise<boolean> {
    const result: Response = await fetch('/api/auth/refresh', {
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
export async function loginHandler(): Promise<void> {
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData: FormData = new FormData(e.target as HTMLFormElement);
        const data: { [k: string]: FormDataEntryValue } = Object.fromEntries(formData.entries());

        try {
            checkLogin(data.login as string);
            checkPassword(data.password as string);
        } catch (error) {
            return alert(error);
        }
        const result: Response = await fetch('/api/auth/login', {
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
export async function registerHandler(): Promise<void> {
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData: FormData = new FormData(e.target as HTMLFormElement);
        const data: { [k: string]: FormDataEntryValue } = Object.fromEntries(formData.entries());

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

export async function updateSubmitHandler(): Promise<void> {
    document.getElementById('update-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form: HTMLFormElement = e.target as HTMLFormElement;
        const data: Record<string, string> = {};

        if (!form) return;
        for (let i = 0; i < form.elements.length; i++) {
            const input: Element | null = form.elements.item(i);
            if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) continue;
            if (!input.name || input.name === 'avatar')
                continue;
            data[input.name] = input.value;
        }
        const fileInput: HTMLElement | null = document.getElementById('file-input');
        if (!(fileInput instanceof HTMLInputElement)) return;
        try {
            checkFile(fileInput);
            checkNickname(data.nickname as string);
            checkEmail(data.email as string);
            checkPassword(data.currentPassword as string);
            if (data.newPassword) checkPassword(data.newPassword as string);
        } catch (error) {
            return alert(error);
        }
        const formData: FormData = new FormData();
        if (fileInput && fileInput.files?.[0]) {
            formData.append('avatar', fileInput.files[0]);
        }
        formData.append('nickname', data.nickname);
        formData.append('email', data.email);
        formData.append('currentPassword', data.currentPassword);
        formData.append('newPassword', data.newPassword);
        formData.append('tfa', data.tfa);
        const result: Response = await fetch('/api/auth/update', {
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

export async function update2FASubmitHandler(): Promise<void> {
    const inputs: NodeListOf<Element> = document.querySelectorAll('form input.digit');

    document.getElementById('tfa-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let data: number = 0;

        inputs.forEach((element) => {
            if (!(element instanceof HTMLInputElement)) return;
            data *= 10;
            data += parseInt(element.value);
        });
        try {
            checkOneTimeCode(data);
        } catch (error) {
            return alert(error);
        }
        const result: Response = await fetch('/api/auth/2fa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tfaTempToken}`
            },
            body: JSON.stringify({ code: data.toString().padStart(6, '0') })
        });
        if (result.status === 403) {
            return await renderPage('/', true);
        } else if (result.status === 400) {
            await renderPage('/', true);
            return alert((await result.json()).message);
        } else if (!result.ok) {
            return alert((await result.json()).message);
        }
        tfaTempToken = null;
        const responseAccess: string | undefined | null = (await result.json()).accessToken;
        if (responseAccess !== null && responseAccess !== undefined) {
            accessToken = responseAccess;
        }
        return await renderPage('/', true);
    });
}

export function invalidateAccessToken(): void {
    accessToken = null;
}