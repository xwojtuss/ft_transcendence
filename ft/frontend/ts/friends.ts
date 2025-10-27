import { renderPage } from "./app.js";
import { accessToken } from "./authenticate.js";
import { checkNickname } from "./validateInput.js";

function getFormRecords(form: HTMLFormElement): Record<string, string> {
    const data: Record<string, string> = {};

    for (let i: number = 0; i < form.elements.length; i++) {
        const input: Element | null = form.elements.item(i);
        if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) continue;
        if (!input.name || input.name === 'avatar')
            continue;
        data[input.name] = input.value;
    }
    return data;
}

async function completeFriendsAction(method: string, endpoint: string, userId: number | string) {
    const result: Response = await fetch(endpoint, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ userId: userId })
    });
    if (result.status === 403) {
        return await renderPage('/', true);
    } else if (!result.ok) {
        return alert((await result.json()).message);
    }
    return await renderPage('/friends', true);
}

export function friendsHandler() {
    document.getElementById('add-friend-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formRecords: Record<string, string> = getFormRecords(e.target as HTMLFormElement);
        try {
            checkNickname(formRecords.nickname as string);
        } catch (error) {
            return alert(error);
        }
        const result: Response = await fetch('/api/friends/invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({ nickname: formRecords.nickname })
        });
        if (result.status === 403) {
            return await renderPage('/', true);
        } else if (!result.ok) {
            return alert((await result.json()).message);
        }
        return await renderPage('/friends', true);
    });

    document.querySelectorAll('form.decline-friend-invite')?.forEach(element => {
        if (!(element instanceof HTMLFormElement)) return;
        const formElement: HTMLFormElement = element as HTMLFormElement;
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const records = getFormRecords(formElement);
            await completeFriendsAction('POST', '/api/friends/decline', records.userId);
        });
    });

    document.querySelectorAll('form.accept-friend-invite')?.forEach(element => {
        if (!(element instanceof HTMLFormElement)) return;
        const formElement: HTMLFormElement = element as HTMLFormElement;
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const records = getFormRecords(formElement);
            await completeFriendsAction('POST', '/api/friends/accept', records.userId);
        });
    });

    document.querySelectorAll('form.cancel-friend-invite')?.forEach(element => {
        if (!(element instanceof HTMLFormElement)) return;
        const formElement: HTMLFormElement = element as HTMLFormElement;
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const records = getFormRecords(formElement);
            await completeFriendsAction('POST', '/api/friends/cancel', records.userId);
        });
    });

    document.querySelectorAll('form.remove-friend')?.forEach(element => {
        if (!(element instanceof HTMLFormElement)) return;
        const formElement: HTMLFormElement = element as HTMLFormElement;
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const records = getFormRecords(formElement);
            await completeFriendsAction('DELETE', '/api/friends', records.userId);
        });
    });
    
}