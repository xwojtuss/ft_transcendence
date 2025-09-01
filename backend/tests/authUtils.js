export async function logIn(fastify, login, password) {
    const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
            'Content-Type': 'application/json'
        },
        payload: {
            login: login,
            password: password
        }
    });
    return response;
}

export async function register(fastify, nickname, email, password) {
    const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: {
            'Content-Type': 'application/json'
        },
        payload: {
            nickname: nickname,
            email: email,
            password: password
        }
    });
    return response;
}

export async function update(fastify, changes, accessToken, refreshToken) {
    const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/update',
        headers: {
            Authorization: 'Bearer ' + accessToken
        },
        cookies: {
            refreshToken: refreshToken
        },
        payload: changes
    });
    return response;
}
