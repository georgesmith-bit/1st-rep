// ==================== 输入处理 ====================

let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 30;

export function initInput(onMove) {
    // 阻止移动端默认滚动行为
    document.addEventListener('touchmove', e => {
        e.preventDefault();
    }, { passive: false });

    // 触摸滑动
    document.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

        if (absDx > absDy) {
            onMove(dx > 0 ? 1 : 3); // right : left
        } else {
            onMove(dy > 0 ? 2 : 0); // down : up
        }
    }, { passive: true });

    // 键盘
    document.addEventListener('keydown', e => {
        switch (e.key) {
            case 'ArrowUp':    e.preventDefault(); onMove(0); break;
            case 'ArrowRight': e.preventDefault(); onMove(1); break;
            case 'ArrowDown':  e.preventDefault(); onMove(2); break;
            case 'ArrowLeft':  e.preventDefault(); onMove(3); break;
        }
    });
}