export function getErrorLogin(login: string): string | undefined {
    if (getErrorNickname(login) && getErrorEmail(login)) {
        return "Nickname or email must be valid";
    }
    return undefined;
}

export function getErrorEmail(email: string): string | undefined {
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(email)) {
        return "Invalid email address";
    }
    return undefined;
}

export function getErrorNickname(nickname: string): string | undefined {
    if (nickname.length < 4) {
        return "Username must have at least 4 characters";
    } else if (nickname.length > 12) {
        return "Username must have at most 12 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
        return "Username can only contain letters, numbers, and underscores";
    }
    return undefined;
}

export function getErrorPassword(password: string): string | undefined {
    if (password.length < 8) {
        return "Password must have at least 8 characters";
    } else if (password.length > 30) {
        return "Password must have at most 30 characters";
    } else if (!/[a-z]/.test(password)
            || !/[A-Z]/.test(password)
            || !/\d/.test(password)
            || !/[!@#$%^&*]/.test(password)) {
        return "Password must include an uppercase letter, a lowercase letter, a number and a special character"
    }
    return undefined;
}