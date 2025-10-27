// Elimination bracket for 3..8 players

export type Player = { id: string; name: string };
type Slot = { player?: Player; bye?: boolean };
export type Match = {
    id: string; round: number; a: Slot; b: Slot;
    winner?: Slot; nextId?: string; nextSlot?: 'A'|'B';
};
export type Bracket = { players: Player[]; rounds: Match[][]; createdAt: number; seed: number };
const MIN = 3, MAX = 8;
const nextPow2 = (n: number) => { let p = 1; while (p < n) p <<= 1; return p; };
function shuffle<T>(arr: T[], seed = Date.now()) {
    let m = 0x80000000, a = 1103515245, c = 12345; let s = (seed|0) >>> 0;
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) { s = (a*s + c) % m; const j = s % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
}

export function createBracket(names: string[]): Bracket {
    if (names.length < MIN || names.length > MAX) throw new Error(`Enter ${MIN}–${MAX} players.`);
    const players = names.map((n, i) => ({ id: `p${i+1}`, name: (n||'').trim() || `Player ${i+1}` }));
    const seed = Date.now(), shuffled = shuffle(players, seed);
    const total = nextPow2(shuffled.length), byes = total - shuffled.length;
    const entries: Slot[] = shuffled.map(p => ({ player: p }));
    for (let i = 0; i < byes; i++) entries.push({ bye: true });
    const rounds: Match[][] = Array.from({ length: Math.log2(total) }, () => []);
    for (let i = 0; i < total; i += 2) rounds[0].push({ id:`r0-m${i/2}`, round:0, a:entries[i]??{bye:true}, b:entries[i+1]??{bye:true} });
    for (let r = 1; r < rounds.length; r++) {
        for (let i = 0; i < rounds[r-1].length; i += 2) {
            const id = `r${r}-m${i/2}`; const m: Match = { id, round:r, a:{}, b:{} };
            rounds[r].push(m);
            const A = rounds[r-1][i], B = rounds[r-1][i+1];
            A.nextId = id; A.nextSlot = 'A'; B.nextId = id; B.nextSlot = 'B';
        }
    }
    const br: Bracket = { players, rounds, createdAt: Date.now(), seed };
    autoAdvanceByes(br);
    return br;
}

function autoAdvanceByes(br: Bracket) {
    for (const round of br.rounds) for (const m of round) {
        if (m.winner) continue;
        const aBye = !!m.a.bye && !m.a.player, bBye = !!m.b.bye && !m.b.player;
        if (aBye && bBye) { m.winner = { bye: true }; feed(br, m); }
        else if (aBye && m.b.player) { m.winner = { player:{...m.b.player} }; feed(br, m); }
        else if (bBye && m.a.player) { m.winner = { player:{...m.a.player} }; feed(br, m); }
    }
}

function feed(br: Bracket, m: Match) {
    if (!m.winner || !m.nextId || !m.nextSlot) return;
    const next = find(br, m.nextId); if (!next) return;
    const clone = m.winner.player ? { player:{...m.winner.player} } : { bye:true };
    if (m.nextSlot === 'A' && !next.a.player && !next.a.bye) next.a = clone;
    if (m.nextSlot === 'B' && !next.b.player && !next.b.bye) next.b = clone;
}

function find(br: Bracket, id: string) {
    for (const r of br.rounds) { const f = r.find(m => m.id === id); if (f) return f; }
}

export function getCurrentRound(br: Bracket): Match[] {
    for (const round of br.rounds) {
        const p = round.filter(m => !m.winner && ((m.a.player && !m.a.bye) || (m.b.player && !m.b.bye)));
        if (p.length) return p;
    }
    return [];
}

export function reportMatch(br: Bracket, id: string, winner: 'A'|'B') {
    const m = find(br, id); if (!m) throw new Error('Match not found');
    const slot = winner === 'A' ? m.a : m.b;
    if (!slot.player && !slot.bye) throw new Error('Winner slot empty');
    m.winner = slot.player ? { player:{...slot.player} } : { bye:true };
    feed(br, m); autoAdvanceByes(br);
}

export function isFinished(br: Bracket) {
    const finals = br.rounds[br.rounds.length - 1];
    return finals.length === 1 && !!finals[0].winner && !!finals[0].winner.player;
}

export function getChampion(br: Bracket) {
    if (!isFinished(br)) return null;
    const finals = br.rounds[br.rounds.length - 1];
    const winnerSlot = finals[0].winner;
    return winnerSlot && winnerSlot.player ? winnerSlot.player : null;
}


export function saveBracket(key: string, br: Bracket) { try { sessionStorage.setItem(key, JSON.stringify(br)); } catch {} }
export function loadBracket(key: string): Bracket | null { try { const s = sessionStorage.getItem(key); return s ? JSON.parse(s) as Bracket : null; } catch { return null; } }
export function clearBracket(key: string) { try { sessionStorage.removeItem(key); } catch {} }
