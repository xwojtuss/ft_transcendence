import {
    Bracket, Match, createBracket, getCurrentRound,
    reportMatch, isFinished, getChampion,
    saveBracket, loadBracket, clearBracket
} from "./ticTournamentBracket.js";

const BRACKET_KEY = "tic/bracket";

let bracket: Bracket | null = null;
let currentMatchId: string | null = null;

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;

function countInputs(host: Element): number {
    return host.querySelectorAll('input').length;
}

function setBtnDisabled(btn: HTMLElement | null, disabled: boolean) {
    const b = btn as HTMLButtonElement | null;
    if (!b) return;
    b.disabled = disabled;
    b.classList.toggle('opacity-60', disabled);
    b.classList.toggle('cursor-not-allowed', disabled);
}

export function initTicTournament(): void {
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = `
    <div class="mx-auto max-w-[1500px] px-4 py-6">
    <div id="bracket">
        <div class="flex items-center justify-between mb-4">
        <h1 class="text-white text-2xl font-bold">Tic-Tac-Toe Match</h1>
        <button id="btn-reset-top"
        class="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15">
        Reset
        </button>
        </div>
        <div id="round-host" class="mb-4"></div>
        <div class="rounded-2xl ring-1 ring-white/10 p-3 bg-black/20">
        <canvas id="canvasTic2"
        class="w-full max-w-[520px] aspect-square mx-auto hidden"></canvas>
        </div>
        <div id="controls" class="mt-4 text-white/80"></div>
        </div>
        </div>
        `;
        document.getElementById("btn-reset-top")?.addEventListener("click", () => {
            clearAll();
            initTicTournament();
        });

  // 1) Try to auto-seed from the Matching alias form (3–8 aliases)
  const raw = sessionStorage.getItem("ticMatchingAliases");
  if (raw) {
    let aliases: string[] = [];
    try { aliases = JSON.parse(raw); } catch { aliases = []; }
    // sanitize + validate
    const names = Array.isArray(aliases)
      ? aliases.map(s => String(s).trim()).filter(Boolean)
      : [];
    if (names.length >= MIN_PLAYERS && names.length <= MAX_PLAYERS) {
      sessionStorage.removeItem("ticMatchingAliases"); // one-shot
      bracket = createBracket(names);
      saveBracket(BRACKET_KEY, bracket);
      renderCurrentRound(); // go straight to the bracket
      return;
    }
    // invalid payload: drop it and continue
    sessionStorage.removeItem("ticMatchingAliases");
  }

  // 2) If a bracket was previously saved, just render it
  bracket = loadBracket(BRACKET_KEY);
  if (bracket) {
    renderCurrentRound();
    return;
  }

  // 3) Nothing to render → show a minimal empty state (no setup inputs)
  const host = document.getElementById("round-host")!;
  host.innerHTML = `
    <div class="text-center text-white/80">
      <div class="text-6xl text-yellow-400 mb-3">🏆</div>
      <h2 class="text-2xl font-bold mb-2">No players loaded</h2>
      <p class="mb-4">Start “Matching” from the Home page to provide 3–8 names.</p>
      <div class="flex gap-3 justify-center">
        <a href="/" class="px-5 py-3 rounded-lg bg-yellow-300 text-black font-bold text-xl hover:bg-yellow-400">Go Home</a>
      </div>
    </div>
  `;
  // Hide reset when there’s nothing to reset
  document.getElementById("btn-reset-top")?.classList.add("hidden");
}



function appendNameRow(host: Element): boolean {
    if (countInputs(host) >= MAX_PLAYERS) return false;
    const idx = host.children.length + 1;
    const row = document.createElement("div");
    row.className = "flex gap-2";
    row.innerHTML = `
    <input class="flex-1 bg-black/30 text-white rounded-xl px-3 py-2 ring-1 ring-white/10"
    placeholder="Player ${idx}" />
    `;
    host.appendChild(row);
    return true;
}

function renderTicFinalScreen(): void {
    if (!bracket) return;
    
    const champ = getChampion(bracket);
    const winnerName = champ?.name ?? "—";
    
    const app = document.getElementById("app")!;
    app.innerHTML = `
    <div class="w-screen h-screen flex items-center justify-center">
    <div class="bg-black rounded-xl p-10 text-center shadow-lg max-w-2xl w-[90%]">
    <h2 class="text-4xl font-extrabold text-white mb-8">Final Results</h2>
    <p class="text-3xl font-extrabold text-yellow-400 mb-6">
    Winner: ${esc(winnerName)} 🏆
    </p>
    <div class="flex flex-col sm:flex-row justify-center gap-4 mt-2">
    <button id="tic-reset"
    class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
    Reset
    </button>
    <button id="tic-finish"
    class="bg-gray-400 text-black font-bold text-xl py-3 px-6 rounded-lg hover:bg-yellow-300 transition">
    Finish
    </button>
    </div>
    </div>
    </div>
    `;
    
    // Reset -> clear local state and restart the Tic-Tac-Toe match UI
    document.getElementById("tic-reset")?.addEventListener("click", () => {
        clearAll();
        initTicTournament();
    });
    
    // Finish -> clear and go home (SPA + hard fallback)
    document.getElementById("tic-finish")?.addEventListener("click", () => {
        clearAll();
        try {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
        } catch {}
        window.location.href = "/";
    });
}

function renderCurrentRound() {
    if (!bracket) return;
    const roundHost = document.getElementById("round-host")!;
    const canvas = document.getElementById("canvasTic2") as HTMLCanvasElement;
    const controls = document.getElementById("controls")!;
    const bracketEl = document.getElementById("bracket");
    if (bracketEl && bracketEl.firstElementChild) {
        (bracketEl.firstElementChild as HTMLElement).classList.add("hidden");
    }
    const topReset = document.getElementById("btn-reset-top");
    if (topReset) topReset.classList.add("hidden");
    const pending = getCurrentRound(bracket);
    roundHost.innerHTML = "";
    controls.innerHTML = "";
    canvas.classList.add("hidden");
    
    // Header: trophy on top, then the centered title
    const headerHtml = `
    <div class="flex items-center justify-center mb-3">
    <div class="text-6xl text-yellow-400">🏆</div>
    </div>
    <h1 class="text-white text-2xl font-bold text-center mb-4">Tic-Tac-Toe Match</h1>
    `;
    
    if (pending.length === 0) {
        renderTicFinalScreen();
        return;
    }
    
    // Round label
    const rNum = pending[0].round + 1;
    const totalRounds = Math.log2((function nextPow2(n:number){let p=1;while(p<n)p<<=1;return p;})(bracket.players.length));
    const title = rNum === totalRounds ? "Final" : `Round ${rNum}`;
    
    // Container for the list
    const container = document.createElement("div");
    container.innerHTML = `
    ${headerHtml}
    <div class="text-white text-2xl font-bold mb-4">${title}</div>
    `;
    
    // Rows & Play button
    for (const m of pending) {
        const a = m.a.player?.name ?? (m.a.bye ? "BYE" : "—");
        const b = m.b.player?.name ?? (m.b.bye ? "BYE" : "—");
        const playable = !!(m.a.player && m.b.player);
        const row = document.createElement("div");
        row.className = "w-full flex items-center justify-between rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 mb-4";
        row.innerHTML = `
        <div class="text-white text-lg font-semibold">${a} <span class="text-white/60">vs</span> ${b}</div>
        <button class="px-5 py-3 rounded-lg bg-yellow-300 text-black font-bold text-xl hover:bg-yellow-400 transition focus:outline-none focus:ring-2 focus:ring-yellow-300"
        ${playable ? "" : "disabled"}>
        Play
        </button>
        `;
        row.querySelector("button")!.addEventListener("click", () => {
            if (!playable) return;
            playMatch(m);
        });
        container.appendChild(row);
    }
    
    //Reset under the table
    const reset = document.createElement("button");
    reset.id = "btn-reset-under";
    reset.className = "mt-2 w-full px-5 py-3 rounded-lg bg-yellow-300 text-black font-bold text-xl hover:bg-yellow-400 transition focus:outline-none focus:ring-2 focus:ring-yellow-300";
    reset.textContent = "Reset";
    reset.addEventListener("click", () => {
        clearAll();
        initTicTournament();
    });
    roundHost.appendChild(container);
    roundHost.appendChild(reset);
}

//HTML-escape to inject player names into innerHTML
function esc(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            case "'": return "&#39;";
            default:  return ch;
        }
    });
}

async function playMatch(m: Match) {
    if (!bracket || !m.a.player || !m.b.player) return;
    const roundHost = document.getElementById("round-host")!;
    const canvas = document.getElementById("canvasTic2") as HTMLCanvasElement;
    const controls = document.getElementById("controls")!;
    const p1 = m.a.player!.name; // X
    const p2 = m.b.player!.name; // O
    roundHost.innerHTML = `
    <div class="flex items-center justify-center mb-3">
    <div class="text-6xl text-yellow-400">🏆</div>
    </div>
    <h1 class="text-white text-2xl font-bold text-center mb-2">Tic-Tac-Toe Match</h1>
    <div class="text-white text-center text-lg mb-3">
    <span class="font-bold">${esc(p1)}</span> (X)
    <span class="text-white/60">vs</span>
    <span class="font-bold">${esc(p2)}</span> (O)
    </div>
    `;
    document.getElementById("btn-reset-under")?.classList.add("hidden");
    canvas.classList.remove("hidden");
    controls.innerHTML = "";
    controls.classList.add("hidden");
    (window as any).player1Name = p1;
    (window as any).player2Name = p2;
        try {
        sessionStorage.setItem('ticGameAliases', JSON.stringify({ player1: p1, player2: p2 }));
    } catch {}
    // Start 2-player Tic-Tac-Toe on the canvas
    const { showTic2 } = await import("./gameUtils/tic2.js") as typeof import("./gameUtils/tic2");
    showTic2("canvasTic2", "controls");

    // Track the match
    currentMatchId = (m as any).id ?? (m as any).matchId ?? null;
    const onOver = (ev: Event) => {
        const detail = (ev as CustomEvent).detail as { winner: 'X' | 'O' | 'nowinner' };
        if (!bracket) return;
        if (detail.winner === "nowinner") {
            // Tie
            setTimeout(() => {
                showTic2("canvasTic2", "controls");
                document.addEventListener("tic:over", onOver, { once: true });
            }, 900);
            return;
        }
        let matchId = currentMatchId;
        if (matchId == null) {
            for (const rnd of bracket.rounds) {
                for (const mm of rnd) {
                    const a = mm.a.player?.name, b = mm.b.player?.name;
                    if ((a === p1 && b === p2) || (a === p2 && b === p1)) {
                        matchId = (mm as any).id ?? (mm as any).matchId ?? null;
                        if (matchId != null) break;
                    }
                }
                if (matchId != null) break;
            }
        }
        const winnerSlot: 'A' | 'B' = detail.winner === "X" ? "A" : "B";
        if (matchId != null) {
            reportMatch(bracket, matchId, winnerSlot);
            saveBracket(BRACKET_KEY, bracket);
        }
        currentMatchId = null;
        // Lets players see the overlay briefly, then rebuilds the list view
        setTimeout(() => {
            controls.classList.remove("hidden");
            renderCurrentRound();
        }, 700);
    };
    document.addEventListener("tic:over", onOver, { once: true });
}

async function startTic2(canvas: HTMLCanvasElement) {
    const { showTic2 } = (await import("./gameUtils/tic2.js")) as typeof import("./gameUtils/tic2");
    canvas.id = "canvasTic2";
    showTic2("canvasTic2", "controls");
}

function clearAll() {
    clearBracket(BRACKET_KEY);
    currentMatchId = null;
    delete (window as any).player1Name;
    delete (window as any).player2Name;
}

function nextPow2(n: number) { let p = 1; while (p < n) p <<= 1; return p; }

