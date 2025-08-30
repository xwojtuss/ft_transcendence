import z from "zod";
import TFA from "./TFA.js";

const nicknameSchema = z
    .string()
    .min(4, "Username must have at least 4 characters")
    .max(12, "Username must have at most 12 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");
const emailSchema = z
    .email("Invalid email address");
const passwordSchema = z
    .string()
    .min(8, "Password must have at least 8 characters")
    .max(30, "Password must have at most 30 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/, "Password must include an uppercase letter, a lowercase letter, a number and a special character");
const nicknameOrEmailRefine = z
    .string()
    .refine((val) => nicknameSchema.safeParse(val).success || emailSchema.safeParse(val).success, {
        message: "Nickname or email must be valid",
    });
const tfaSchema = z
    .enum(Array.from(TFA.TFAtypes.keys()));
const phoneNumberSchema = z
    .e164("Invalid phone number");

export const registerSchema = z.object({
    nickname: nicknameSchema,
    email: emailSchema,
    password: passwordSchema
});

export const loginSchema = z.object({
    login: nicknameOrEmailRefine,
    password: passwordSchema
});

export const updateSchema = z.object({
    nickname: nicknameSchema,
    email: emailSchema,
    phone: phoneNumberSchema,
    tfa: tfaSchema,
    currentPassword: passwordSchema
})

export const updateNewPasswordSchema = z.object({
    nickname: nicknameSchema,
    email: emailSchema,
    currentPassword: passwordSchema,
    newPassword: passwordSchema
})