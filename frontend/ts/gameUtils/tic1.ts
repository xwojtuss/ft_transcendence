// Tic-Tac-Toe — Play with AI

type Mark = 'X' | 'O' | null;
type Winner = 'X' | 'O' | 'nowinner' | null;
type Cell = { row: number; col: number };
type Board = Mark[][];
type Difficulty = 'auto' | 'easy' | 'hard';

interface ShowOpts {
    difficulty?: Difficulty; // 'auto' ~60% hard, 40% easy
    delayMs?: number;        // AI think delay
}

const N = 3;
const LINE_COLOR = '#94a3b8';
const XO_COLOR = '#ffffff';

let board: Board;
let isProcessingMove = false;
let gameOver = false;

function makeEmptyBoard(): Board {
    return [
        [null, null, null],
        [null, null, null],
        [null, null, null],
    ];
}

function availableMoves(b: Board): Cell[] {
    const moves: Cell[] = [];
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
    if (b[r][c] === null) moves.push({ row: r, col: c });
    return moves;
}

function evaluate(b: Board): number {
    const w = checkWinner(b);
    if (w === 'O') return +10; // AI is 'O'
    if (w === 'X') return -10;
    return 0;
}

function checkWinner(b: Board): Winner {
    for (let i = 0; i < N; i++) {
        if (b[i][0] && b[i][0] === b[i][1] && b[i][1] === b[i][2]) return b[i][0];
        if (b[0][i] && b[0][i] === b[1][i] && b[1][i] === b[2][i]) return b[0][i];
    }
    if (b[0][0] && b[0][0] === b[1][1] && b[1][1] === b[2][2]) return b[0][0];
    if (b[0][2] && b[0][2] === b[1][1] && b[1][1] === b[2][0]) return b[0][2];
    return availableMoves(b).length ? null : 'nowinner';
}

function minimax(b: Board, depth: number, isMax: boolean): number {
    const score = evaluate(b);
    if (score === 10 || score === -10) return score - Math.sign(score) * depth; // prefer faster win/slower loss
    if (availableMoves(b).length === 0) return 0;
    
    if (isMax) {
        let best = -Infinity;
        for (const m of availableMoves(b)) {
            b[m.row][m.col] = 'O';
            best = Math.max(best, minimax(b, depth + 1, false));
            b[m.row][m.col] = null;
        }
        return best;
    } else {
        let best = +Infinity;
        for (const m of availableMoves(b)) {
            b[m.row][m.col] = 'X';
            best = Math.min(best, minimax(b, depth + 1, true));
            b[m.row][m.col] = null;
        }
        return best;
    }
}

function findBestMove(b: Board): Cell | null {
    let bestVal = -Infinity;
    let best: Cell | null = null;
    for (const m of availableMoves(b)) {
        b[m.row][m.col] = 'O';
        const val = minimax(b, 0, false);
        b[m.row][m.col] = null;
        if (val > bestVal) { bestVal = val; best = m; }
    }
    return best;
}

function getRandomMove(b: Board): Cell | null {
    const moves = availableMoves(b);
    if (!moves.length) return null;
    return moves[Math.floor(Math.random() * moves.length)];
}

function chooseDifficulty(opt: Difficulty): Difficulty {
    if (opt !== 'auto') return opt;
    // ~60% hard, 40% easy
    return Math.random() < 0.6 ? 'hard' : 'easy';
}

// ---------- Canvas helpers ----------
function fitCanvasToCssSize(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; cell: number } | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Respect current CSS size (aspect-square in markup), render at device pixels
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    
    // Scale drawing ops to DPR
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const sideCss = rect.width; // since it's square due to aspect ratio
    const cell = sideCss / N;
    return { ctx, cell };
}

function drawGrid(canvas: HTMLCanvasElement): number {
    const meta = fitCanvasToCssSize(canvas);
    if (!meta) return 0;
    const { ctx, cell } = meta;
    const sideCss = cell * N;
    ctx.clearRect(0, 0, sideCss, sideCss);
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;
    
    for (let i = 1; i < N; i++) {
        // vertical
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, sideCss);
        ctx.stroke();
        // horizontal
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(sideCss, i * cell);
        ctx.stroke();
    }
    return cell;
}

function drawX(ctx: CanvasRenderingContext2D, cell: number, r: number, c: number): void {
    const pad = cell * 0.22;
    const x0 = c * cell + pad, y0 = r * cell + pad;
    const x1 = (c + 1) * cell - pad, y1 = (r + 1) * cell - pad;
    ctx.strokeStyle = XO_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y0); ctx.stroke();
}

function drawO(ctx: CanvasRenderingContext2D, cell: number, r: number, c: number): void {
    const cx = c * cell + cell / 2;
    const cy = r * cell + cell / 2;
    const radius = cell * 0.35;
    ctx.strokeStyle = XO_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
}

function redrawAll(canvas: HTMLCanvasElement): void {
    const cell = drawGrid(canvas);
    const ctx = canvas.getContext('2d')!;
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
            const v = board[r][c];
            if (v === 'X') drawX(ctx, cell, r, c);
            if (v === 'O') drawO(ctx, cell, r, c);
    }
}

// ---------- UX ----------
function cellFromPointer(ev: PointerEvent, canvas: HTMLCanvasElement): Cell | null {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const cell = rect.width / N;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    return { row, col };
}

function setControls(text: string, showReset: boolean, canvas: HTMLCanvasElement, controlsId: string): void {
    const host = document.getElementById(controlsId);
    if (!host) return;
    host.innerHTML = '';
    if (text && text.trim().length > 0) {
        const msg = document.createElement('div');
        msg.textContent = text;
        msg.className = 'text-white text-lg font-bold text-center mb-3';
        host.appendChild(msg);
    }
    if (showReset) {
        const btn = document.createElement('button');
        btn.textContent = 'New Game';
        btn.className = 'block mx-auto px-5 py-3 rounded-lg bg-yellow-300 text-black font-bold text-xl hover:bg-yellow-400 transition focus:outline-none focus:ring-2 focus:ring-yellow-300';
        btn.onclick = () => resetGame(canvas, controlsId);
        host.appendChild(btn);
    }
}

function drawGameOverOverlay(canvas: HTMLCanvasElement, outcome: Exclude<Winner, null>): void {
    const cell = drawGrid(canvas);
    const ctx = canvas.getContext('2d')!;
    
    // redraw marks
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
            const v = board[r][c];
            if (v === 'X') drawX(ctx, cell, r, c);
            if (v === 'O') drawO(ctx, cell, r, c);
    }
    const rect = canvas.getBoundingClientRect();
    const side = rect.width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = '#fff';
    ctx.font = '700 28px system-ui, -apple-system, Segoe UI, Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text =
    outcome === 'nowinner' ? 'Tie!' :
    outcome === 'X' ? 'You win!' : 'You lose!';
    ctx.fillText(text, side / 2, side / 2);
}

function resetGame(canvas: HTMLCanvasElement, controlsId: string): void {
    board = makeEmptyBoard();
    isProcessingMove = false;
    gameOver = false;
    redrawAll(canvas);
    setControls('Your move (X).', false, canvas, controlsId);
}

// ---------- Public entry ----------
export function showTic1(canvasId = 'canvasTic1', controlsId = 'tic-controls', opts: ShowOpts = {}): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    
    const difficulty = chooseDifficulty(opts.difficulty ?? 'auto');
    const thinkDelay = opts.delayMs ?? 220;
    
    if (!canvas.dataset.ticResizeBound) {
        window.addEventListener('resize', () => {
            if (!canvas.isConnected) return;
            redrawAll(canvas);
        });
        canvas.dataset.ticResizeBound = '1';
    }
    board = makeEmptyBoard();
    gameOver = false;
    isProcessingMove = false;
    redrawAll(canvas);
    setControls('Your move (X).', false, canvas, controlsId);
    
    canvas.onpointerdown = null;
    canvas.onpointerup = async (ev: PointerEvent) => {
        if (isProcessingMove || gameOver) return;
        const cell = cellFromPointer(ev, canvas);
        if (!cell) return;
        const { row, col } = cell;
        if (board[row][col] !== null) return;
        
        // Human move
        isProcessingMove = true;
        board[row][col] = 'X';
        redrawAll(canvas);
        
        // Check outcome
        let w = checkWinner(board);
        if (w) {
            gameOver = true;
            drawGameOverOverlay(canvas, w);
            setControls('', true, canvas, controlsId);
            isProcessingMove = false;
            return;
        }
        // CPU move (small delay for UX)
        await new Promise(r => setTimeout(r, thinkDelay));
        let cpuMove: Cell | null = null;
        if (difficulty === 'hard') cpuMove = findBestMove(board);
        if (!cpuMove) cpuMove = getRandomMove(board); // fallback or easy
        if (cpuMove) {
            board[cpuMove.row][cpuMove.col] = 'O';
            redrawAll(canvas);
        }
        w = checkWinner(board);
        if (w) {
            gameOver = true;
            drawGameOverOverlay(canvas, w);
            setControls('', true, canvas, controlsId);
            isProcessingMove = false;
            return;
        }
        isProcessingMove = false;
        setControls('Your move (X).', false, canvas, controlsId);
    };
}
