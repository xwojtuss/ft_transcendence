<div class="mx-auto max-w-[1100px] px-4 py-6" id="ttt-root">
    <h1 class="text-3xl sm:text-4xl font-bold text-white mb-6 text-center">Tic-Tac-Toe</h1>
    
    <!-- Mode Switch -->
    <div class="flex items-center justify-center gap-3 mb-5">
        <button id="btn-ai" class="game-button">Play with AI</button>
        <button id="btn-2p" class="game-button">Two Players</button>
        <button id="btn-match" class="game-button">Matching</button>
    </div>
    <!-- Controls/status area (both modes reuse the same block) -->
    <div id="tic-controls" class="text-white/90 text-center mb-4"></div>
    <!-- Canvases: the old modules target these IDs by default -->
    <div class="flex items-center justify-center gap-4">
        <canvas id="canvasTic1" class="w-[360px] h-[360px] rounded-xl bg-slate-700 border border-slate-500 shadow"></canvas>
        <canvas id="canvasTic2" class="w-[360px] h-[360px] rounded-xl bg-slate-700 border border-slate-500 shadow hidden"></canvas>
        </div>
    </div>

