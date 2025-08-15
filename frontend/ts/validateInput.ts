// const nicknameSchema = z
//     .string()
//     .min(4, "Username must have at least 4 characters")
//     .max(12, "Username must have at most 12 characters")
//     .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");
// const emailSchema = z
//     .email("Invalid email address");
// const nicknameOrEmailRefine = z
//     .string()
//     .refine((val) => nicknameSchema.safeParse(val).success || emailSchema.safeParse(val).success, {
//         message: "Nickname or email must be valid",
//     });

export default function getErrorForPassword(password: string): string | undefined {
    if (password.length < 8) {
        return "Password must have at least 8 characters";
    } else if (password.length > 30) {
        return "Password must have at most 30 characters";
    } else if (!/[a-z]/.test(password)
            || !/[A-Z]/.test(password)
            || !/\d/.test(password)
            || !/[!@#$%^&*]/.test(password)) {
        return "Password must include uppercase letter, lowercase letter, number and a special character"
    }
    return undefined;
}