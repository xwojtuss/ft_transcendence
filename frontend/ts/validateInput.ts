export function checkLogin(login: string): void {
    try {
        checkNickname(login);
        return;
    } catch (error) {}
    try {
        checkEmail(login);
    } catch (error) {
        throw new Error("Nickname or email must be valid");
    }
}

export function checkEmail(email: string): void {
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(email)) {
        throw new Error("Invalid email address");
    }
}

export function checkNickname(nickname: string): void {
    if (nickname.length < 4) {
        throw new Error("Username must have at least 4 characters");
    } else if (nickname.length > 12) {
        throw new Error("Username must have at most 12 characters");
    } else if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
        throw new Error("Username can only contain letters, numbers, and underscores");
    }
}

export function checkPassword(password: string): void {
    if (password.length < 8) {
        throw new Error("Password must have at least 8 characters");
    } else if (password.length > 30) {
        throw new Error("Password must have at most 30 characters");
    } else if (!/[a-z]/.test(password)
            || !/[A-Z]/.test(password)
            || !/\d/.test(password)
            || !/[!@#$%^&*]/.test(password)) {
        throw new Error("Password must include an uppercase letter, a lowercase letter, a number and a special character");
    }
}

export function checkFile(inputElement: HTMLInputElement | null | undefined): void {
    if (!inputElement) return;
    const imageFile = inputElement.files?.[0];
    if (!imageFile) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) {
        throw new Error('Only JPEG, PNG and WEBP files are allowed');
    }
    if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error('Image must be smaller than 5MB');
    }
}