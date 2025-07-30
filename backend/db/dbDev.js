import { unlink } from "fs/promises";

export default async function deleteDatabase(filename) {
    try {
        await unlink("./backend/db/" + filename);
    } catch (error) {
        console.error("Failed to delete database file:", error);
    }
}