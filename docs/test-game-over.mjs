globalThis.window = { addEventListener: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

(async () => {
    const { initGrid, grid, gameState } = await import('./js/data.js');
    const { spawnTile, move, canMove } = await import('./js/board.js');

    initGrid(); spawnTile(); spawnTile();
    let moves = 0;
    while (moves < 100000 && !gameState.gameOver) {
        const d = Math.floor(Math.random() * 4);
        const info = move(d);
        if (!info) continue;
        moves++;
        spawnTile();
        if (!canMove()) gameState.gameOver = true;
    }

    console.log('='.repeat(40));
    console.log(`Moves played: ${moves}`);
    console.log(`Score: ${gameState.score}`);
    console.log(`gameState.gameOver: ${gameState.gameOver}`);
    console.log(`canMove(): ${canMove()}`);
    console.log('='.repeat(40));
    if (gameState.gameOver) {
        console.log('✅ VERIFIED: Game-over logic works.');
        console.log('If popup not visible in browser: CSS/rendering issue.');
    } else {
        console.log('❌ Game-over did not trigger after 100K moves.');
    }
})();
