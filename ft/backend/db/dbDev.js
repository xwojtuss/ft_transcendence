import { unlink } from 'node:fs/promises';
import path from 'node:path';

export default async function deleteDatabase(filename) {
    const filePath = path.join(process.cwd(), 'backend', 'db', filename);
    try {
        await unlink(filePath);
    } catch (error) {}
}