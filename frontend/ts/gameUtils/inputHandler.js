export class InputHandler {
    constructor(gameWs) {
        this.validKeys = ["w", "s", "ArrowUp", "ArrowDown", " "];
        this.gameWs = gameWs;
        this.setupEventListeners();
    }
    setupEventListeners() {
        document.addEventListener("keydown", this.handleKeyDown.bind(this));
        document.addEventListener("keyup", this.handleKeyUp.bind(this));
    }
    handleKeyDown(e) {
        if (this.validKeys.includes(e.key)) {
            this.gameWs.sendInput("keydown", e.key);
        }
    }
    handleKeyUp(e) {
        if (this.validKeys.includes(e.key)) {
            this.gameWs.sendInput("keyup", e.key);
        }
    }
}
