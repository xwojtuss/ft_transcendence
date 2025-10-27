import { renderPage } from "./app.js";
import { checkNickname } from "./validateInput.js";

export function initAliasRegistration(): void {
    // 1) Primary signal from URL
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "true") {
        params.delete("registered");
        let redirectURL: string = '';
        const localPongAliases = sessionStorage.getItem("localGameAliases");
        if (localPongAliases || window.location.pathname.startsWith("/game/tic-tac-toe")) {
            redirectURL = window.location.pathname + "?" + params.toString();
        } else {
            redirectURL = window.location.origin + "/game/local-tournament" + (params.toString() ? "?" + params.toString() : "");
        }
        renderPage(redirectURL, true);
        return;
    }
    let isMatching = params.get('matching') === '1';
    if (!isMatching && window.location.pathname.includes('tic-tac-toe') && document.querySelectorAll('input[id^="player"]').length >= 4) isMatching = true;
    const isAI = params.get('ai') === '1'; // unchanged for local/AI
    
    // 2) Candidate forms (typed as forms)
    const localForm      = document.getElementById('local-form') as HTMLFormElement | null;
    const aiForm         = document.getElementById('ai-form') as HTMLFormElement | null;
    const tournamentForm = document.getElementById('tournament-form') as HTMLFormElement | null;
    if (!isMatching && window.location.pathname.includes('tic-tac-toe')) {
        const probe: HTMLFormElement | null =
        (document.getElementById('alias-form') as HTMLFormElement | null) ||
        tournamentForm || localForm || aiForm;
        
        if (probe) {
            const count = probe.querySelectorAll<HTMLInputElement>('input[id^="player"]').length;
            if (count >= 4) {
                isMatching = true;
            }
        }
    }
    // 4) Matching mode
    if (isMatching) {
        const matchingForm: HTMLFormElement | null =
        (document.getElementById('alias-form') as HTMLFormElement | null) ||
        (document.querySelector('form#matching-form') as HTMLFormElement | null) ||
        tournamentForm || localForm || aiForm;
        if (matchingForm) {
            handleMatchingAliasForm(matchingForm);
        }
        return;
    }
    if (localForm)      handleLocalAliasForm(localForm, false);
    if (aiForm)         handleLocalAliasForm(aiForm, true);
    if (tournamentForm) handleTournamentAliasForm(tournamentForm);
    // after a refresh we need to redirect to /
}


/**
 * Handle alias registration form submission for tournament
 * @param form The form element
 */
function handleTournamentAliasForm(form: HTMLFormElement): void {
    const cancelBtn = document.getElementById('cancel-form');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            renderPage('/game/local-tournament', false);
        });
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Count total inputs to determine player count
        let playerCount = 0;
        for (let i = 1; i <= 8; i++) {
            if (document.getElementById(`player${i}`)) {
                playerCount = i;
            } else {
                break;
            }
        }
        
        const aliases: string[] = [];
        const namesSet = new Set<string>();
        
        // Collect and validate aliases
        for (let i = 1; i <= playerCount; i++) {
            const input = document.getElementById(`player${i}`) as HTMLInputElement;
            if (!input) continue;
            
            const val = input.value.trim();
            if (!val) {
                alert("All names must be filled in.");
                return;
            }
            
            // For disabled inputs (logged-in user), always use the value as-is
            // For other inputs, validate
            if (!input.disabled) {
                const key = val.toLowerCase();
                if (namesSet.has(key)) {
                    alert("Names must be unique.");
                    return;
                }
                
                try {
                    checkNickname(val, "Alias");
                } catch (error) {
                    if (!(error instanceof Error)) {
                        alert("Invalid alias");
                        return;
                    }
                    alert(error.message);
                    return;
                }
                
                namesSet.add(key);
            }
            
            aliases.push(val);
        }
        
        // Validate aliases on backend first
        try {
            const validateRes = await fetch('/api/game/tournament/aliases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aliases: aliases })
            });
            
            if (!validateRes.ok) {
                const error = await validateRes.json();
                alert(error.message || 'Validation failed');
                return;
            }
            
            const validateData = await validateRes.json();
            if (!validateData.success) {
                alert('Validation failed');
                return;
            }
        } catch (err) {
            console.error('Failed to validate aliases:', err);
            alert('Failed to validate aliases. Please try again.');
            return;
        }
        
        // Create tournament
        try {
            const res = await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ players: aliases })
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            
            // Store tournament data and navigate back to tournament page
            sessionStorage.setItem('newTournament', JSON.stringify({
                tournamentId: data.tournamentId,
                matches: data.matches
            }));
            
            await renderPage('/game/local-tournament', false);
        } catch (err: any) {
            alert("Error creating tournament: " + (err?.message || err));
        }
    });
}


function handleMatchingAliasForm(form: HTMLFormElement): void {
    const cancelBtn = document.getElementById('cancel-form');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            renderPage('/?game=tic-tac-toe', false);
        });
    }
    
    //let JS handle min/max; don’t let HTML block on empty 5–8
    form.noValidate = true;
    for (let i = 5; i <= 8; i++) {
        const el = document.getElementById(`player${i}`) as HTMLInputElement | null;
        if (el) {
            el.required = false;
            el.removeAttribute('pattern');
            el.removeAttribute('minlength');
        }
    }
    
    // --- Title -> "Enter Player Names (4 - 8 players)" 
    (function updateTTTTitle() {
        const appRoot = document.getElementById('app');
        if (!appRoot) return;
        const TO = 'Enter Player Names (4 - 8 players)';
        const tryReplace = () => {
            const nodes = appRoot.querySelectorAll<HTMLElement>('#alias-form *, .alias-title, h1, h2, p, div, span');
            for (const el of nodes) {
                if (el.childElementCount === 0) {
                    const txt = (el.textContent ?? '').trim();
                    if (txt === 'Enter Player Names' || /enter player names/i.test(txt)) {
                        el.textContent = TO;
                        return true;
                    }
                }
            }
            const walker = document.createTreeWalker(appRoot, NodeFilter.SHOW_TEXT);
            let n: Node | null;
            while ((n = walker.nextNode())) {
                const t = (n.nodeValue ?? '').trim();
                if (t === 'Enter Player Names' || /enter player names/i.test(t)) {
                    n.nodeValue = TO;
                    return true;
                }
            }
            return false;
        };
        if (!tryReplace()) requestAnimationFrame(tryReplace);
    })();
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const aliases: string[] = [];
        const namesSet = new Set<string>();
        
        for (let i = 1; i <= 8; i++) {
            const input = document.getElementById(`player${i}`) as HTMLInputElement | null;
            if (!input) continue;
            const val = input.value.trim();
            if (!val) continue;
            const key = val.toLowerCase();
            if (namesSet.has(key)) { alert("Names must be unique."); return; }
            try { checkNickname(val, "Alias"); } catch (err) {
                alert(err instanceof Error ? err.message : "Invalid alias");
                return;
            }
            namesSet.add(key);
            aliases.push(val);
        }
        
        if (aliases.length < 4) { alert("Please enter at least 4 names."); return; }
        if (aliases.length > 8) { alert("Maximum 8 players."); return; }
        
        try {
            const res = await fetch('/api/game/tournament/aliases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aliases, game: 'tictactoe' })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.message || 'Validation failed');
                return;
            }
            const data = await res.json();
            if (!data.success) { alert('Validation failed'); return; }
        } 
        catch (err) {
            console.error('Failed to validate aliases:', err);
            alert('Failed to validate aliases. Please try again.');
            return;
        }
        try {
            sessionStorage.setItem('ticMatchingAliases', JSON.stringify(aliases));
        } 
        catch (err) {
            console.error('Failed to store aliases:', err);
        }
        await renderPage('/game/tic-tac-toe?matching=1&registered=true', false);
    });
}

/**
 * Handle alias registration form submission for local games
 * @param form The form element
 * @param isAI Whether this is AI mode
 */
function handleLocalAliasForm(form: HTMLFormElement, isAI: boolean): void {
    const cancelBtn = document.getElementById('cancel-form');
    const game = window.location.pathname.includes('tic-tac-toe') ? "tic-tac-toe" : "ping-pong";
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            renderPage('/?game=' + game, false);
        });
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const playerCount = isAI ? 1 : 2;
        const aliases: string[] = [];
        const namesSet = new Set<string>();
        
        // Collect and validate aliases
        for (let i = 1; i <= playerCount; i++) {
            const input = document.getElementById(`player${i}`) as HTMLInputElement;
            if (!input) continue;
            
            const val = input.value.trim();
            if (!val) {
                alert("All names must be filled in.");
                return;
            }
            
            // For disabled inputs (logged-in user), always use the value as-is
            // For other inputs, validate
            if (!input.disabled) {
                const key = val.toLowerCase();
                if (namesSet.has(key)) {
                    alert("Names must be unique.");
                    return;
                }
                
                try {
                    checkNickname(val, "Alias");
                } catch (error) {
                    if (!(error instanceof Error)) {
                        alert("Invalid alias");
                        return;
                    }
                    alert(error.message);
                    return;
                }
                
                namesSet.add(key);
            }
            
            aliases.push(val);
        }
        
        // Validate aliases on backend
        try {
            const res = await fetch('/api/game/local/aliases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    aliases: aliases,
                    gameMode: isAI ? 'ai' : 'local'
                })
            });
            
            if (!res.ok) {
                const error = await res.json();
                alert(error.message || 'Validation failed');
                return;
            }
            
            const data = await res.json();
            if (!data.success) {
                alert('Validation failed');
                return;
            }
        } catch (err) {
            console.error('Failed to validate aliases:', err);
            alert('Failed to validate aliases. Please try again.');
            return;
        }
        const basePath = window.location.pathname.includes('tic-tac-toe')
        ? '/game/tic-tac-toe'
        : '/game/local';
        
        // Choose the correct sessionStorage key
        const storageKey = basePath.includes('tic-tac-toe')
        ? 'ticGameAliases'
        : 'localGameAliases';
        
        // Save aliases for the game to use
        try {
            sessionStorage.setItem(storageKey, JSON.stringify({
                player1: aliases[0],
                player2: isAI ? 'AI' : aliases[1],
            }));
        } 
        catch (err) {
            console.error('Failed to store aliases:', err);
        }
        
        // Build target URL with the registered flag
        const gameUrl = isAI
        ? `${basePath}?ai=1&registered=true`
        : `${basePath}?registered=true`;
        
        await renderPage(gameUrl, false);
    });
}
