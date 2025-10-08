// Local Tournament SPA flow (no embedded canvas):
// - Choose 4 or 8 players
// - Register unique aliases
// - Backend creates tournament + random Round 1 matches
// - When a match starts -> store context in sessionStorage and navigate to /game/local
// - Local game posts winner to backend, sets 'tournamentResult', returns to /game/local-tournament
// - On return, we show 'Winner' screen and continue with next match/round
// - Pass objects between pages via sessionStorage (simple key/value storage in the browser).
import { clearTournamentAll } from "./tournamentCleanup.js"; // put at file top with other imports

/* ------------------------- small DOM helpers ------------------------- */

// Clear main app container
function clearApp(): void {
    const app = document.getElementById('app');
    if (app) app.innerHTML = '';
}

// Minimal HTML-escape to avoid XSS when inserting user aliases
function esc(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return ch;
        }
    });
}

/**
 * Compute the label for the current round.
 * - If the round is marked as third place -> "Round: Match for 3rd Place"
 * - Else if it's the highest non-third round -> "Round: Finals"
 * - Else -> "Round: <round number>"
 * FINAL round number depends on tournament size:
 *  - 4 players -> Final is round 3
 *  - 8 players -> Final is round 4
 * We accept optional hints (round, isThird) from the caller. If missing,
 */

async function computeRoundLabel(
    tournamentId: number,
    hintRound?: number,
    hintIsThird?: boolean
): Promise<string> {
    try {
        const res = await fetch(`/api/tournaments/${tournamentId}`);
        const data = await res.json();

        const all: any[] = Array.isArray(data.matches) ? data.matches : [];
        const playersCount = Array.isArray(data.players) ? data.players.length : 0;

        // Determine the FINAL round number based on tournament size.
        // Backend schedules: 4P -> R1 semis, R2 3rd, R3 final  |  8P -> R1 QF, R2 SF, R3 3rd, R4 final
        const finalRound = (playersCount === 4) ? 3 : 4;

        // Decide which round we're about to play.
        let round = hintRound;
        let isThird = hintIsThird;

        if (round === undefined || isThird === undefined) {
            const pending = all.filter(m => !m.winner);
            if (pending.length > 0) {
                const minPendingRound = Math.min(...pending.map(m => m.round));
                round = round ?? minPendingRound;
                // isThird if ANY pending match of that round is marked third-place
                isThird = isThird ?? pending.some(m => m.round === minPendingRound && m.is_third);
            } else {
                // Fallback: choose highest round present
                const maxRound = all.length ? Math.max(...all.map(m => m.round)) : undefined;
                round = round ?? maxRound;
                isThird = isThird ?? (maxRound !== undefined && all.some(m => m.round === maxRound && m.is_third));
            }
        }

        // Map round to label:
        if (isThird) return "Round: Match for 3rd Place";
        if (round !== undefined && round === finalRound) return "Round: Finals";
        return `Round: ${round ?? ""}`;
    } catch {
        return "Round";
    }
}

/** Build the bracket bullet list */
function buildBracketListHTML(matches: any[]): string {
    let html = `<ul class="text-white text-left list-disc list-inside space-y-2 mb-6 text-lg">`;
    for (const m of matches) {
        let line = `Round ${m.round}${m.is_third ? ' (3rd place)' : ''}: ${m.player1} vs ${m.player2}`;
        if (m.winner) {
            line += ` – Winner: ${m.winner}`;
        }
        html += `<li>${esc(line)}</li>`;
    }
    html += `</ul>`;
    return html;
}

/* --------------------- render final screen --------------------- */
/** Final Results screen — no bracket list. Adds "Bracket" button on the left. */
function renderFinalScreen(tournamentId: number, data: any): void {
    clearApp();
    const app = document.getElementById('app')!;

    const matches: any[] = data.matches || [];
    const players: any[] = data.players || [];

    // Find Final (highest non-third round)
    const nonThird = matches.filter(m => !m.is_third);
    const finalRound = nonThird.length ? Math.max(...nonThird.map(m => m.round)) : 0;
    const finalMatch = nonThird.find(m => m.round === finalRound);

    const champion = finalMatch?.winner || null;
    const runnerUp = finalMatch
        ? (finalMatch.player1 === finalMatch.winner ? finalMatch.player2 : finalMatch.player1)
        : null;

    // 3rd / 4th from 3rd-place match (if present)
    const thirdMatches = matches.filter(m => m.is_third);
    const thirdRound = thirdMatches.length ? Math.max(...thirdMatches.map(m => m.round)) : 0;
    const thirdPlaceMatch = thirdMatches.find(m => m.round === thirdRound);

    const third = thirdPlaceMatch?.winner || null;
    const fourth = thirdPlaceMatch
        ? (thirdPlaceMatch.player1 === thirdPlaceMatch.winner ? thirdPlaceMatch.player2 : thirdPlaceMatch.player1)
        : null;

    const topSet = new Set([champion, runnerUp, third, fourth].filter(Boolean));
    const everyone = players.map((p: any) => p.alias);
    const others = everyone.filter((a: string) => !topSet.has(a));

    // Final results table rows
    const rows: Array<{ rank: string; player: string; notes: string }> = [];
    if (champion) rows.push({ rank: '🥇 1st', player: champion, notes: 'Tournament Champion🏆' });
    if (runnerUp) rows.push({ rank: '🥈 2nd', player: runnerUp, notes: 'Lost in final' });
    if (third) rows.push({ rank: '🥉 3rd', player: third, notes: 'Won 3rd-place match' });
    if (fourth) rows.push({ rank: '4️⃣ 4th', player: fourth, notes: 'Lost 3rd-place match' });

    // For 8 players, add 5–8th (quarterfinal losers)
    const playersSet = new Set<string>();
    for (const m of matches) { playersSet.add(m.player1); playersSet.add(m.player2); }
    if (playersSet.size >= 8) {
        const qf = matches.filter(m => m.round === 1);
        const losers5to8 = qf
            .filter(m => m.winner)
            .map(m => (m.player1 === m.winner ? m.player2 : m.player1));
        for (const p of losers5to8) rows.push({ rank: '❌ 5–8th', player: p, notes: 'Eliminated' });
    }

    // === Render with your original layout / classes ===
    let html = `
    <div class="w-screen h-screen flex items-center justify-center">
      <div class="bg-black rounded-xl p-10 text-center shadow-lg max-w-2xl w-[90%]">
        <h2 class="text-4xl font-extrabold text-white mb-8">Final Results</h2>
        ${champion ? `<p class="text-3xl font-extrabold text-yellow-400 mb-6">Champion: ${esc(champion)} 🏆</p>` : ''}
  
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-white border-separate border-spacing-y-2">
            <thead>
              <tr class="text-gray-300 text-lg">
                <th class="px-4 py-2">Rank</th>
                <th class="px-4 py-2">Player</th>
                <th class="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr class="bg-zinc-800/60 rounded-xl">
                  <td class="px-4 py-3 font-semibold">${esc(r.rank)}</td>
                  <td class="px-4 py-3">${esc(r.player)}</td>
                  <td class="px-4 py-3">${esc(r.notes)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
  
        <div class="flex flex-col sm:flex-row justify-center gap-4 mt-8">
          <button id="btn-bracket" class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Bracket
          </button>
          <button id="play-again" class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Play Again
          </button>
          <button id="finish" class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Finish
          </button>
        </div>
      </div>
    </div>`;

    app.innerHTML = html;

    // Buttons
    document.getElementById('btn-bracket')!.addEventListener('click', () => {
        showBracketScreen(tournamentId, data);
    });
    document.getElementById('play-again')!.addEventListener('click', async () => {
        const aliases = data.players.map((p: any) => p.alias);
        const res2 = await fetch('/api/tournaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ players: aliases })
        });
        const data2 = await res2.json();
        renderInitialBracket(data2.matches, data2.tournamentId);
    });
    document.getElementById('finish')!.addEventListener('click', () => {
        // proactively nuke any remaining tournament crumbs
        clearTournamentAll("user-clicked-finish");
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
        window.location.href = '/';
    });
}

/** The full bracket list screen with three buttons: Final Results / Play Again / Finish. */
async function showBracketScreen(tournamentId: number, dataFromCaller?: any): Promise<void> {
    let data = dataFromCaller;
    if (!data) {
        const res = await fetch(`/api/tournaments/${tournamentId}`);
        data = await res.json();
    }

    clearApp();
    const app = document.getElementById('app')!;
    const list = buildBracketListHTML(data.matches);

    const html = `
    <div class="w-screen h-screen flex items-center justify-center">
      <div class="bg-black rounded-xl p-10 text-center shadow-lg max-w-2xl w-[90%]">
        <h2 class="text-4xl font-extrabold text-white mb-8">Tournament Bracket</h2>
        ${list}
        <div class="flex flex-col sm:flex-row justify-center gap-4">
          <button id="btn-results" class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Final Results
          </button>
          <button id="play-again" class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Play Again
          </button>
          <button id="finish" class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Finish
          </button>
        </div>
      </div>
    </div>`;
    app.innerHTML = html;

    // Buttons
    document.getElementById('btn-results')!.addEventListener('click', () => {
        renderFinalScreen(tournamentId, data);
    });
    document.getElementById('play-again')!.addEventListener('click', async () => {
        const aliases = data.players.map((p: any) => p.alias);
        const res2 = await fetch('/api/tournaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ players: aliases })
        });
        const data2 = await res2.json();
        renderInitialBracket(data2.matches, data2.tournamentId);
    });
    document.getElementById('finish')!.addEventListener('click', () => {
        clearTournamentAll("user-clicked-finish");
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
        window.location.href = '/';
    });
}

/* --------------------- navigation & return handling --------------------- */

// Navigate to the real Local game view for a specific match.
// Context in sessionStorage so Local can read it.
function goToLocalGameForMatch(tournamentId: number, match: any): void {
    sessionStorage.setItem('tournamentMatch', JSON.stringify({
        tournamentId,
        matchId: match.matchId,
        player1: match.player1,
        player2: match.player2
    }));

    // SPA navigation to /game/local (no full reload)
    window.history.pushState({}, "", "/game/local");
    window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * If we just returned from Local game and Local stored 'tournamentResult',
 * show the Winner screen and continue. Returns true if handled.
 */
async function handleReturnFromLocal(): Promise<boolean> {
    const raw = sessionStorage.getItem('tournamentResult');
    if (!raw) return false;

    const res = JSON.parse(raw);
    sessionStorage.removeItem('tournamentResult');

    clearApp();
    const app = document.getElementById('app')!;
    app.innerHTML = `
    <div class="w-screen h-screen flex items-center justify-center">
      <div class="bg-black rounded-xl p-10 text-center shadow-lg max-w-xl w-[90%]">
        <p class="text-3xl font-extrabold text-white mb-8">Winner: <span class="text-yellow-400">${esc(res.winnerAlias)}</span></p>
        <button id="next-btn" class="w-full bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
          Next
        </button>
      </div>
    </div>
  `;

    document.getElementById('next-btn')!.addEventListener('click', async () => {
        await continueTournament(res.tournamentId);
    });

    return true;
}

/** Continue tournament by playing the next pending match (lowest round first) or show bracket. */
async function continueTournament(tournamentId: number): Promise<void> {
    const r = await fetch(`/api/tournaments/${tournamentId}`);
    const data = await r.json();

    const pending = data.matches.filter((m: any) => !m.winner);
    if (pending.length === 0) {
        await showBracket(tournamentId);
        return;
    }
    const minRound = Math.min(...pending.map((m: any) => m.round));
    const nextRoundMatches = pending.filter((m: any) => m.round === minRound);
    // Play the first pending match of the current round
    playRound(nextRoundMatches, 0, tournamentId);
}

/* --------------------------- main entry point --------------------------- */

export function initLocalTournament(): void {
    // If a Local match just finished and we returned here, show Winner & continue.
    handleReturnFromLocal().then((handled) => {
        if (handled) return;
        // We didn’t return from a match now -> this is a *fresh* entry.
        // Nuke any leftovers from an abandoned, older tournament so we start clean.
        clearTournamentAll("enter-local-tournament-root");
        // Otherwise show player count selection
        try { sessionStorage.removeItem('tournamentResult'); } catch {}
        delete (window as any).player1Name;
        delete (window as any).player2Name;

        clearApp();
        const app = document.getElementById('app')!;
        app.innerHTML = `
      <div class="w-screen h-screen flex items-center justify-center">
        <div class="bg-black rounded-xl p-10 text-center shadow-lg">
          <h2 class="text-4xl font-extrabold text-white mb-8">Select Number of Players</h2>
          <div class="flex items-center justify-center space-x-10">
            <button id="btn-4players" class="px-8 py-4 bg-gray-400 text-black font-bold text-xl rounded-lg hover:bg-yellow-300 transition">
              4 Players
            </button>
            <div class="text-6xl text-yellow-400">🏆</div>
            <button id="btn-8players" class="px-8 py-4 bg-gray-400 text-black font-bold text-xl rounded-lg hover:bg-yellow-300 transition">
              8 Players
            </button>
          </div>
        </div>
      </div>
    `;

        document.getElementById('btn-4players')!.addEventListener('click', () => showRegistration(4));
        document.getElementById('btn-8players')!.addEventListener('click', () => showRegistration(8));
    });
}

/* ------------------------ registration & creation ------------------------ */

async function showRegistration(playerCount: number): Promise<void> {
    clearApp();
    const app = document.getElementById('app')!;
    let inputsHtml = '';
    for (let i = 1; i <= playerCount; i++) {
        inputsHtml += `
        <div class="mb-2">
          <label class="block font-medium">Player ${i} ________ </label>
          <input id="player${i}" type="text" class="w-full border px-2 py-1 rounded" />
        </div>`;
    }
    app.innerHTML = `
    <div class="w-screen h-screen flex items-center justify-center">
      <div class="bg-black rounded-xl p-10 text-center shadow-lg">
        <h2 class="text-4xl font-extrabold text-white mb-8">Enter Player Names</h2>
        <form id="tournament-form" class="space-y-4">
          ${inputsHtml}
          <button type="submit" class="w-full bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Register
          </button>
        </form>
      </div>
    </div>
    `;

    document.getElementById('tournament-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const aliases: string[] = [];
        const namesSet = new Set<string>();
        for (let i = 1; i <= playerCount; i++) {
            const val = (document.getElementById(`player${i}`) as HTMLInputElement).value.trim();
            if (!val) { alert("All names must be filled in."); return; }
            const key = val.toLowerCase();
            if (namesSet.has(key)) { alert("Names must be unique."); return; }
            namesSet.add(key);
            aliases.push(val);
        }
        try {
            const res = await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ players: aliases })
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            renderInitialBracket(data.matches, data.tournamentId);
        } catch (err: any) {
            alert("Error creating tournament: " + (err?.message || err));
        }
    });
}

function renderInitialBracket(matches: any[], tournamentId: number): void {
    clearApp();
    const app = document.getElementById('app')!;

    let html = `
      <div class="w-screen h-screen flex items-center justify-center">
        <div class="bg-black rounded-xl p-10 text-center shadow-lg max-w-xl w-[90%]">
          <h2 class="text-4xl font-extrabold text-white mb-8">First Round Matchups</h2>
          <ul class="text-white text-left list-disc list-inside space-y-2 mb-8 text-lg">
    `;

    for (const m of matches) {
        html += `        <li>${esc(m.player1)} vs ${esc(m.player2)}</li>\n`;
    }

    html += `
          </ul>
          <button id="begin-btn"
            class="w-full bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
            Begin Tournament
          </button>
        </div>
      </div>
    `;

    app.innerHTML = html;

    document.getElementById('begin-btn')!.addEventListener('click', () => {
        playRound(matches, 0, tournamentId);
    });
}

/* ---------------------------- playing matches --------------------------- */

// Show countdown, then start the match in the real Local view.
async function playRound(matches: any[], index: number, tournamentId: number): Promise<void> {
    if (index >= matches.length) {
        await showBracket(tournamentId);
        return;
    }
    const match = matches[index];

    // Compute the correct label for this round.
    // For the very first call (from "Begin Tournament") matches may not have round/is_third,
    // so computeRoundLabel() will infer it from the server state.
    const roundLabel = await computeRoundLabel(
        tournamentId,
        (match && typeof match.round === 'number') ? match.round : undefined,
        (match && typeof match.is_third === 'boolean') ? match.is_third : undefined
    );

    clearApp();
    const app = document.getElementById('app')!;
    app.innerHTML = `
    <div class="w-screen h-screen flex items-center justify-center">
      <div class="bg-black rounded-xl p-10 text-center shadow-lg max-w-xl w-[90%]">
        <h2 class="text-4xl font-extrabold text-white mb-4">${esc(roundLabel)}</h2>
        <p class="text-white text-lg mb-4">
          Players: <span class="font-bold">${esc(match.player1)}</span> vs <span class="font-bold">${esc(match.player2)}</span>
        </p>
        <div id="countdown" class="text-6xl font-extrabold text-yellow-400 my-6">3</div>
      </div>
    </div>
  `;

    let count = 3;
    const countdownEl = document.getElementById('countdown')!;
    const t = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.textContent = count.toString();
        } else {
            clearInterval(t);
            countdownEl.textContent = "Go!";
            // Launch the actual Local game view with this match context
            if (window.location.pathname === '/game/local-tournament') {
                goToLocalGameForMatch(tournamentId, match);
            } else {
                return;
            }
        }
    }, 1000);
}

/* ------------------------------- bracket UI ------------------------------ */

async function showBracket(tournamentId: number): Promise<void> {
    const res = await fetch(`/api/tournaments/${tournamentId}`);
    const data = await res.json();

    // If finished → go straight to Final Results (no bracket content here)
    const pending = (data.matches as any[]).filter((m: any) => !m.winner);
    if (pending.length === 0) {
        renderFinalScreen(tournamentId, data);
        return;
    }

    // Mid-tournament: show bracket list + Next Round
    clearApp();
    const app = document.getElementById('app')!;
    const list = buildBracketListHTML(data.matches);

    const html = `
    <div class="w-screen h-screen flex items-center justify-center">
      <div class="bg-black rounded-xl p-10 text-center shadow-lg max-w-2xl w-[90%]">
        <h2 class="text-4xl font-extrabold text-white mb-8">Tournament Bracket</h2>
        ${list}
        <button id="next-round-btn" class="w-full bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
          Next Round
        </button>
      </div>
    </div>`;
    app.innerHTML = html;

    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) {
        nextRoundBtn.addEventListener('click', async () => {
            const r = await fetch(`/api/tournaments/${tournamentId}`);
            const d = await r.json();
            const pending2 = d.matches.filter((m: any) => !m.winner);
            if (pending2.length === 0) {
                renderFinalScreen(tournamentId, d);
                return;
            }
            const minRound = Math.min(...pending2.map((m: any) => m.round));
            const allThisRound = d.matches.filter((m: any) => m.round === minRound);
            const pendThisRound = allThisRound.filter((m: any) => !m.winner);
            playRound(pendThisRound, 0, tournamentId);
        });
    }
}
