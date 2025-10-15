import { renderPage } from "./app.js";
import { checkNickname } from "./validateInput.js";

/**
 * Initialize alias registration form handlers for local games
 */
export function initAliasRegistration(): void {
    const localForm = document.getElementById('local-form');
    const aiForm = document.getElementById('ai-form');
    const tournamentForm = document.getElementById('tournament-form');
    
    if (localForm) {
        handleLocalAliasForm(localForm as HTMLFormElement, false);
    }
    
    if (aiForm) {
        handleLocalAliasForm(aiForm as HTMLFormElement, true);
    }
    
    if (tournamentForm) {
        handleTournamentAliasForm(tournamentForm as HTMLFormElement);
    }
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
            
            // Skip validation for disabled inputs (they're already validated)
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

/**
 * Handle alias registration form submission for local games
 * @param form The form element
 * @param isAI Whether this is AI mode
 */
function handleLocalAliasForm(form: HTMLFormElement, isAI: boolean): void {
    const cancelBtn = document.getElementById('cancel-form');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            renderPage('/', false);
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
            
            // Skip disabled inputs (logged in user)
            if (input.disabled) {
                aliases.push(input.value);
                continue;
            }
            
            const val = input.value.trim();
            if (!val) {
                alert("All names must be filled in.");
                return;
            }
            
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
            aliases.push(val);
        }
        
        // Store aliases in sessionStorage for the game to use
        try {
            sessionStorage.setItem('localGameAliases', JSON.stringify({
                player1: aliases[0],
                player2: isAI ? 'AI' : aliases[1]
            }));
        } catch (err) {
            console.error('Failed to store aliases:', err);
        }
        
        // Navigate to the game with registered flag
        const gameUrl = isAI ? '/game/local?ai=1&registered=true' : '/game/local?registered=true';
        await renderPage(gameUrl, false);
    });
}
