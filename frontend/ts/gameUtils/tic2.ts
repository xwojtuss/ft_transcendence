// Tic-Tac-Toe — local 2 players, Canvas-based

type Mark = 'X' | 'O' | null;
type Winner = 'X' | 'O' | 'nowinner' | null;
type Board = Mark[][];
type Player = 1 | 2;

const N = 3;
const LINE_COLOR = '#94a3b8';
const XO_COLOR = '#ffffff';

let board: Board;
let current: Player;
let gameOver = false;

function makeEmptyBoard(): Board {
    return [
        [null, null, null],
        [null, null, null],
        [null, null, null],
    ];
}

function availableMoves(b: Board) {
    const moves: { r: number; c: number }[] = [];
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
    if (b[r][c] === null) moves.push({ r, c });
    return moves;
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

// ---------- Canvas helpers ----------
function fitCanvasToCssSize(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; cell: number } | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const sideCss = rect.width;
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
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, sideCss);
        ctx.stroke();   
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
function cellFromPointer(ev: PointerEvent, canvas: HTMLCanvasElement): { row: number; col: number } | null {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const cell = rect.width / N;
    return { row: Math.floor(y / cell), col: Math.floor(x / cell) };
}

function setControls(text: string, showReset: boolean, canvas: HTMLCanvasElement, controlsId: string): void {
    const host = document.getElementById(controlsId);
    if (!host) return;
    host.innerHTML = '';
    if (!showReset) {
        const msg = document.createElement('div');
        msg.textContent = text;
        msg.className = 'text-white/90 text-center text-base sm:text-lg font-medium mb-2';
        host.appendChild(msg);
    }
    if (showReset) {
        const wrap = document.createElement('div');
        wrap.className = 'w-full flex justify-center mt-4';
        const btn = document.createElement('button');
        btn.textContent = 'New Game';
        btn.className = 'px-6 py-3 rounded-lg bg-yellow-300 text-black font-bold text-xl hover:bg-yellow-400 transition focus:outline-none focus:ring-2 focus:ring-yellow-300';
        btn.onclick = () => resetGame(canvas, controlsId);
        wrap.appendChild(btn);
        host.appendChild(wrap);
    }
}


function drawGameOverOverlay(canvas: HTMLCanvasElement, outcome: Exclude<Winner, null>): void {
    const cell = drawGrid(canvas);
    const ctx = canvas.getContext('2d')!;
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
    const text = outcome === 'nowinner' ? 'Tie!' : `${outcome} wins!`;
    ctx.fillText(text, side / 2, side / 2);
}

function resetGame(canvas: HTMLCanvasElement, controlsId: string): void {
    board = makeEmptyBoard();
    current = 1;
    gameOver = false;
    redrawAll(canvas);
    setControls('Player 1: X — Player 2: O. Player 1 to move.', false, canvas, controlsId);
}

// ---------- Public entry ----------
export function showTic2(canvasId = 'canvasTic2', controlsId = 'tic-controls'): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    if (!canvas.dataset.ticResizeBound) {
        window.addEventListener('resize', () => {
            if (!canvas.isConnected) return;
            redrawAll(canvas);
        });
        canvas.dataset.ticResizeBound = '1';
    }
    board = makeEmptyBoard();
    current = 1;
    gameOver = false;
    redrawAll(canvas);
    setControls('Player 1: X — Player 2: O. Player 1 to move.', false, canvas, controlsId);
    canvas.onpointerdown = null;
    canvas.onpointerup = (ev: PointerEvent) => {
        if (gameOver) return;
        const cell = cellFromPointer(ev, canvas);
        if (!cell) return;
        const { row, col } = cell;
        if (board[row][col] !== null) return;
        board[row][col] = current === 1 ? 'X' : 'O';
        redrawAll(canvas);
        const w = checkWinner(board);
        if (w) {
            gameOver = true;
            drawGameOverOverlay(canvas, w);
            setControls('', true, canvas, controlsId);
            document.dispatchEvent(new CustomEvent('tic:over', { detail: { winner: w } }));
            return;
        }
        current = current === 1 ? 2 : 1;
        setControls(
            current === 1 ? 'Player 1 to move (X).' : 'Player 2 to move (O).',
            false,
            canvas,
            controlsId
        );
    };
}
