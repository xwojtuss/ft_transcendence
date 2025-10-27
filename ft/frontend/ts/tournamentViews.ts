export const registration = function (playerCount: number) {
    let inputs: string = '';

    for (let i = 1; i <= playerCount; i++) {
        inputs += `
            <div>
                <input type="text" name="player${i}" id="player${i}" value="" autocomplete="off" required>
                <label for="player${i}">Player ${i}</label>
            </div>`;
    }
    
    const html: string = `
<div class="app-wrapper-center">
    <div class="floater">
        <form class="labeled update" id="tournament-form">
            <legend>Enter Player Names</legend>
            ${inputs}
            <div class="buttons">
                <button type="button" class="cancel" id="cancel-form">Cancel</button>
                <input type="submit" value="Submit">
            </div>
        </form>
    </div>
</div>`;
    return html;
};

export const initialBracket = function (matches: any[]) {
    let elements = "";

    for (const m of matches) {
        elements += `<li>${m.player1} vs ${m.player2}</li>\n`;
    }
    const html: string = `
<div class="app-wrapper-center">
    <div class="floater">
        <form id="tournament-confirm-form" class="update">
            <legend>First Round Matchups</legend>
            <ul>
                ${elements}
            </ul>
            <div class="buttons">
                <button type="button" class="cancel" id="cancel-form">Cancel</button>
                <input type="submit" value="Submit">
            </div>
        </form>
    </div>
</div>`;
    return html;
};

/** Build the bracket bullet list */
function buildBracketListHTML(matches: any[]): string {
    let elements = "";
    for (const m of matches) {
        elements += `<li>Round ${m.round}${m.is_third ? ' (3rd place)' : ''}: ${m.player1} vs ${m.player2}`;
        if (m.winner) elements += ` - Winner ${m.winner}`;
        elements += `</li>\n`;
    }
    return elements;
}

export const bracket = function (matches: any[]) {
    const elements = buildBracketListHTML(matches);
    const html: string = `
<div class="app-wrapper-center">
    <div class="floater">
        <form id="tournament-next-form" class="update">
            <legend>Tournament Bracket</legend>
            <ul>
                ${elements}
            </ul>
            <input type="submit" value="Next Round">
        </form>
    </div>
</div>`;
    return html;
};

export const nextMatch = function (winnerAlias: string) {
    return `
<div class="app-wrapper-center">
    <div class="floater">
        <form id="tournament-match-form" class="update">
            <legend>${winnerAlias} won!</legend>
            <div>
                <input type="submit" value="Next">
            </div>
        </form>
    </div>
</div>`;
};

export const playNextRound = function (label: string, player1: string, player2: string) {
    return `
<div class="app-wrapper-center">
    <div class="floater">
        <form id="tournament-confirm-form" class="update">
            <legend>${label}</legend>
            <p class="text-lg mb-4">
                Players: <span class="font-bold">${player1}</span> vs <span class="font-bold">${player2}</span>
            </p>
            <div id="countdown" class="text-6xl font-extrabold my-6">3</div>
        </form>
    </div>
</div>`;
};

// this will not be used
export const finalBracket = function (matches: any[]) {
    const elements = buildBracketListHTML(matches);
    const html: string = `
<div class="app-wrapper-center">
    <div class="floater">
        <form id="tournament-final-form" class="update">
            <legend>Tournament Bracket</legend>
            <ul>
                ${elements}
            </ul>
            <div class="buttons">
                <button type="button" class="cancel" id="finish">Finish</button>
                <input type="submit" value="Play Again">
            </div>
        </form>
    </div>
</div>`;
    return html;
};

export const finalScores = function (champion: string, results: Array<{ rank: string; player: string; notes: string }>) {
    const html: string = `
<div class="app-wrapper-center">
    <div class="floater">
        <form id="tournament-scores-form" class="update">
            <legend>Final Results</legend>
            ${champion ? `<p>Champion: ${champion} 🏆</p>` : ''}
            <div class="match-history-desktop">
                <table>
                    <thead>
                        <tr>
                            <th class="px-4 py-2">Rank</th>
                            <th class="px-4 py-2">Player</th>
                            <th class="px-4 py-2">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${results.map(r => `
                        <tr">
                        <td>${r.rank}</td>
                        <td>${r.player}</td>
                        <td>${r.notes}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="buttons">
                <button type="button" class="cancel" id="finish">Finish</button>
                <input type="submit" value="Play Again">
            </div>
        </form>
    </div>
</div>`;
    return html;
};