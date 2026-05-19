'use strict';

// ─────────────────────────────────────────────────────────────
//  CONFIG & 全螢幕佈局
// ─────────────────────────────────────────────────────────────
const cv = document.getElementById('c');
const g = cv.getContext('2d');
const vid = document.getElementById('vid');

// 讓畫布填滿整個視窗
let W = window.innerWidth, H = window.innerHeight;
cv.width = W; cv.height = H;

window.addEventListener('resize', () => {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W; cv.height = H;
});

const PICKS = ['rock', 'paper', 'scissors'];
const EM = { rock: '✊', paper: '🖐', scissors: '✌️', triangle: '🔺', cross: '❌' };
const LB = { rock: '石頭', paper: '布', scissors: '剪刀', triangle: '三角形', cross: '叉叉' };
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

// 全新風格調色盤：清新優雅粉紫與療癒馬卡龍色
const BG_COLOR = '#e7c6ff';      // 畫布背景色
const MAIN_TXT = '#4a154b';      // 主要文字顏色 (深紫)
const CARD_BG = 'rgba(255, 255, 255, 0.85)'; // 簡約白色半透明卡片背景
const PAL = ['#ffb5a7', '#fcd5ce', '#f8edeb', '#f9dec9', '#e8e8e4', '#d8f3dc', '#b7e4c7', '#74c69d'];

const SKEL = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

// ─────────────────────────────────────────────────────────────
//  STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────
let st = 'loading', stAt = Date.now();
const enter = s => { st = s; stAt = Date.now(); };

let pG = null, cG = null;         
let lm = null, stable = null, handedness = null; 
let gBuf = [], holdT = null;      
let menuHoldT = null;             
const BUF = 10, HOLD = 400, CD = 3; 

let score = { w: 0, l: 0, d: 0 };
let parts = [];

let mx = 0, my = 0;
cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
cv.addEventListener('click', onClk);

// ─────────────────────────────────────────────────────────────
//  MEDIAPIPE INIT
// ─────────────────────────────────────────────────────────────
(function () {
    const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: .72, minTrackingConfidence: .5 });
    hands.onResults(r => {
        if (r.multiHandLandmarks && r.multiHandLandmarks[0]) {
            lm = r.multiHandLandmarks[0];
            handedness = r.multiHandedness[0].label; 
            const gest = classify(lm);
            gBuf.push(gest); if (gBuf.length > BUF) gBuf.shift();
            stable = vote(gBuf);
        } else {
            lm = null; stable = null; handedness = null; gBuf = [];
        }
    });
    new Camera(vid, { onFrame: async () => hands.send({ image: vid }), width: 640, height: 480 })
        .start().then(() => { if (st === 'loading') enter('idle'); });
})();

// ─────────────────────────────────────────────────────────────
//  GESTURE CLASSIFICATION (新增 三角形 與 叉叉 判定)
// ─────────────────────────────────────────────────────────────
function classify(l) {
    const tips = [8, 12, 16, 20], pips = [6, 10, 14, 18];
    const ext = tips.map((t, i) => l[t].y < l[pips[i]].y); // 食指、中指、無名指、小指
    const n = ext.filter(Boolean).length;

    // 🔺 三角形：食指、中指、無名指伸直，小指收起 (3隻手指)
    if (ext[0] && ext[1] && ext[2] && !ext[3]) return 'triangle';
    
    // ❌ 叉叉：食指、小指伸直，中指、無名指收起 (搖滾手勢)
    if (ext[0] && !ext[1] && !ext[2] && ext[3]) return 'cross';

    // 猜拳經典手勢
    if (n === 0) return 'rock';
    if (n >= 3) return 'paper';
    if (ext[0] && ext[1] && !ext[2] && !ext[3]) return 'scissors';
    return 'unknown';
}

function vote(buf) {
    if (buf.length < 6) return null;
    const c = {}; buf.forEach(v => { c[v] = (c[v] || 0) + 1; });
    let b = null, bn = 0;
    for (const v in c) if (v !== 'unknown' && c[v] > bn) { bn = c[v]; b = v; }
    return bn / buf.length >= .55 ? b : null;
}

// ─────────────────────────────────────────────────────────────
//  簡單繽紛粒子系統 (贏球時散落馬卡龍亮片)
// ─────────────────────────────────────────────────────────────
function burst(x, y, n = 30) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = Math.random() * 4 + 1;
        parts.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, dec: Math.random() * .02 + .01, sz: Math.random() * 6 + 4,
            col: PAL[Math.random() * PAL.length | 0]
        });
    }
}

// ─────────────────────────────────────────────────────────────
//  DRAW UTILITIES & 視訊區塊計算
// ─────────────────────────────────────────────────────────────
// 計算視訊要在正中央顯示 50% 大小的尺寸與座標
function getVidRect() {
    const vW = W * 0.5;
    const vH = H * 0.5;
    return {
        w: vW, h: vH,
        x: (W - vW) / 2,
        y: (H - vH) / 2
    };
}

// 轉換手勢骨架座標至中央視訊內
function lxy(p) {
    const vr = getVidRect();
    return [vr.x + (1 - p.x) * vr.w, vr.y + p.y * vr.h];
}

function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function drawVid() {
    if (!vid || vid.readyState < 2) return;
    const vr = getVidRect();
    g.save();
    // 移動至視訊區塊右側再翻轉，達到區塊內左右顛倒(鏡像)的效果
    g.translate(vr.x + vr.w, vr.y);
    g.scale(-1, 1);
    g.drawImage(vid, 0, 0, vr.w, vr.h);
    g.restore();

    // 為中央視訊加上優雅的外框
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 6;
    rr(vr.x, vr.y, vr.w, vr.h, 12);
    g.stroke();
}

function skel() {
    if (!lm) return;
    g.save();
    g.strokeStyle = '#4a154b'; g.lineWidth = 3;
    SKEL.forEach(([a, b]) => {
        const [ax, ay] = lxy(lm[a]), [bx, by] = lxy(lm[b]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    });
    lm.forEach((p, i) => {
        const [x, y] = lxy(p);
        g.fillStyle = i ? '#ffb5a7' : '#4a154b';
        g.beginPath(); g.arc(x, y, i ? 4 : 7, 0, Math.PI * 2); g.fill();
    });
    g.restore();
}

function txt(t, x, y, fs, col = MAIN_TXT, align = 'center') {
    g.save(); g.font = `bold ${fs}px Arial`; g.textAlign = align; g.textBaseline = 'middle';
    g.fillStyle = col; g.fillText(t, x, y); g.restore();
}

function scoreHUD() {
    const vr = getVidRect();
    g.save();
    g.fillStyle = CARD_BG;
    rr(vr.x, vr.y - 55, vr.w, 40, 8); g.fill();
    const midX = vr.x + vr.w / 2;
    txt(`🌸 戰績 ─  贏: ${score.w}  |  輸: ${score.l}  |  平: ${score.d}`, midX, vr.y - 35, 16);
    g.restore();
}

function btn(lbl, x, y, w, h, bg) {
    const hov = mx >= x && mx <= x + w && my >= y && my <= y + h;
    g.save();
    g.fillStyle = hov ? '#FFF' : bg;
    rr(x, y, w, h, 10); g.fill();
    g.lineWidth = 2; g.strokeStyle = MAIN_TXT; g.stroke();
    txt(lbl, x + w / 2, y + h / 2, 16, hov ? bg : MAIN_TXT);
    g.restore();
}

// ─────────────────────────────────────────────────────────────
//  各狀態渲染面 (風格全面簡約平面化)
// ─────────────────────────────────────────────────────────────
function dLoading() {
    txt('正在載入 AI 魔法辨識中...', W / 2, H / 2, 24);
}

function dIdle() {
    skel(); scoreHUD();
    const vr = getVidRect();
    
    // 下方提示文字卡片
    g.fillStyle = CARD_BG;
    rr(vr.x, vr.y + vr.h + 20, vr.w, 75, 12); g.fill();

    if (!lm) {
        txt('👋 請將手伸入畫面中', W / 2, vr.y + vr.h + 42, 18);
        txt('比出 ✊ 石頭 · 🖐 布 · ✌️ 剪刀 開始遊戲', W / 2, vr.y + vr.h + 68, 14, '#777');
    } else if (stable && PICKS.includes(stable)) {
        txt(`已鎖定手勢：${EM[stable]} ${LB[stable]}`, W / 2, vr.y + vr.h + 42, 18);
        const pct = holdT ? Math.min(1, (Date.now() - holdT) / HOLD) : 0;
        g.fillStyle = '#e8e8e4'; rr(W / 2 - 100, vr.y + vr.h + 62, 200, 8, 4); g.fill();
        g.fillStyle = '#ffb5a7'; rr(W / 2 - 100, vr.y + vr.h + 62, 200 * pct, 8, 4); g.fill();
    } else {
        txt('請比出出拳手勢並維持住', W / 2, vr.y + vr.h + 55, 16);
    }
}

function dCountdown() {
    skel(); scoreHUD();
    const vr = getVidRect();
    const el = Date.now() - stAt;
    const rem = CD * 1000 - el, sc = Math.ceil(rem / 1000);
    
    // 大大的倒數數字浮現在畫面中央
    txt(sc, W / 2, H / 2, 100, '#4a154b');
    
    g.fillStyle = CARD_BG;
    rr(vr.x, vr.y + vr.h + 20, vr.w, 50, 10); g.fill();
    txt(`你出了：${EM[pG]} ${LB[pG]}！ 電腦思考中...`, W / 2, vr.y + vr.h + 45, 16);
}

function dReveal() {
    scoreHUD();
    const vr = getVidRect();
    const el = Date.now() - stAt;
    const cpuShow = el > 500;

    // 清晰簡約的對決看板
    g.fillStyle = CARD_BG;
    rr(vr.x, vr.y + vr.h + 20, vr.w, 90, 12); g.fill();

    txt(`你出: ${EM[pG]} ${LB[pG]}`, vr.x + vr.w * 0.25, vr.y + vr.h + 65, 22);
    txt('VS', W / 2, vr.y + vr.h + 65, 20, '#aaa');
    txt(`電腦出: ${cpuShow ? EM[cG] + ' ' + LB[cG] : '❓'}`, vr.x + vr.w * 0.75, vr.y + vr.h + 65, 22);
}

// 簡化後的清爽輸贏結果呈現
function dResultCommon(title, sub, color) {
    scoreHUD();
    const vr = getVidRect();
    
    // 簡單漂亮的亮色滿版大條幅
    g.fillStyle = color;
    g.fillRect(0, vr.y + vr.h + 15, W, 100);

    txt(title, W / 2, vr.y + vr.h + 45, 32, MAIN_TXT);
    txt(sub, W / 2, vr.y + vr.h + 85, 16, MAIN_TXT);

    // 噴發粒子動畫渲染
    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= p.dec; });
    parts = parts.filter(p => p.life > 0);
    parts.forEach(p => {
        g.save(); g.globalAlpha = p.life; g.fillStyle = p.col;
        g.beginPath(); g.arc(p.x, p.y, p.sz, 0, Math.PI * 2); g.fill(); g.restore();
    });
}

function dWin() {  dResultCommon('🎉 你贏了！太厲害了！', `你的 ${EM[pG]} 打敗了 電腦的 ${EM[cG]}`, '#d8f3dc'); }
function dLose() { dResultCommon('😭 輸掉了，再接再厲！', `你的 ${EM[pG]} 輸給了 電腦的 ${EM[cG]}`, '#ffb5a7'); }
function dDraw() { dResultCommon('🤝 平手！不分上下！', `雙方都出了 ${EM[pG]}`, '#fcd5ce'); }

function dMenu() {
    scoreHUD();
    const vr = getVidRect();
    
    g.fillStyle = 'rgba(255, 255, 255, 0.92)';
    rr(vr.x - 20, vr.y - 10, vr.w + 40, vr.h + 150, 16); g.fill();

    txt('要再玩一局嗎？', W / 2, H / 2 - 60, 28);
    txt('請比出下方手勢進行選擇：', W / 2, H / 2 - 20, 14, '#666');

    const bw = 140, bh = 50, by = H / 2 + 20;
    btn('❌ 結束遊戲', W / 2 - bw - 20, by, bw, bh, '#ffb5a7');
    btn('🔺 繼續遊戲', W / 2 + 20, by, bw, bh, '#b7e4c7');

    txt('💡 提示：比出 🔺 (3指伸直) 繼續  ·  比出 ❌ (惡魔角) 結束', W / 2, by + bh + 30, 14, '#555');

    // 選單手勢鎖定進度條
    if (stable === 'triangle' || stable === 'cross') {
        const pct = menuHoldT ? Math.min(1, (Date.now() - menuHoldT) / HOLD) : 0;
        const col = stable === 'triangle' ? '#74c69d' : '#ffb5a7';
        g.fillStyle = '#e8e8e4'; rr(W / 2 - 100, by + bh + 55, 200, 8, 4); g.fill();
        g.fillStyle = col; rr(W / 2 - 100, by + bh + 55, 200 * pct, 8, 4); g.fill();
    }
}

function dEnded() {
    txt('感謝遊玩！遊戲已結束', W / 2, H / 2 - 30, 32);
    txt(`最終戰績 ─ 贏: ${score.w} | 敗: ${score.l} | 平: ${score.d}`, W / 2, H / 2 + 15, 18, '#666');
    txt('想要重新開始，請直接重新整理網頁唷！', W / 2, H / 2 + 60, 14, '#888');
}

// ─────────────────────────────────────────────────────────────
//  邏輯更新
// ─────────────────────────────────────────────────────────────
function update() {
    const now = Date.now(), el = now - stAt;

    if (st === 'menu') {
        if (stable === 'triangle' || stable === 'cross') {
            if (!menuHoldT) menuHoldT = now;
            if (now - menuHoldT >= HOLD) {
                if (stable === 'triangle') startGame();
                else enter('ended');
                menuHoldT = null;
            }
        } else {
            menuHoldT = null;
        }
    }

    if (st === 'idle') {
        if (stable && PICKS.includes(stable)) {
            if (pG !== stable) { holdT = now; pG = stable; }
            if (now - holdT >= HOLD) enter('countdown');
        } else {
            holdT = null; pG = null;
        }
    }
    
    if (st === 'countdown') {
        if (stable && PICKS.includes(stable)) pG = stable;
        if (el >= CD * 1000) {
            if (!pG) pG = PICKS[Math.random() * 3 | 0];
            cG = PICKS[Math.random() * 3 | 0];
            enter('reveal');
        }
    }
    
    if (st === 'reveal' && el > 1500) {
        const res = pG === cG ? 'draw' : BEATS[pG] === cG ? 'win' : 'lose';
        if (res === 'win') { score.w++; burst(W / 2, H / 2 + 100, 40); }
        else if (res === 'lose') score.l++;
        else score.d++;
        enter(res);
    }
    
    if ((st === 'win' && el > 4000) || (st === 'lose' && el > 3000) || (st === 'draw' && el > 3000)) {
        enter('menu');
    }
}

function onClk(e) {
    if (st !== 'menu') return;
    const r = cv.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const bw = 140, bh = 50, by = H / 2 + 20;
    if (cx >= W / 2 + 20 && cx <= W / 2 + 20 + bw && cy >= by && cy <= by + bh) startGame(); 
    if (cx >= W / 2 - bw - 20 && cx <= W / 2 - 20 && cy >= by && cy <= by + bh) enter('ended'); 
}

function startGame() {
    parts = []; gBuf = []; stable = null; holdT = null; menuHoldT = null; pG = null; cG = null; enter('idle');
}

// ─────────────────────────────────────────────────────────────
//  主迴圈 (LOOP)
// ─────────────────────────────────────────────────────────────
function loop() {
    update();
    
    // 1. 清空畫布並填滿指定背景顏色 e7c6ff
    g.fillStyle = BG_COLOR;
    g.fillRect(0, 0, W, H);
    
    // 2. 繪製頂部置中指定的文字標題
    txt("414730894呂承諺", W / 2, 45, 26, MAIN_TXT);

    // 3. 繪製鏡像置中視訊 (加載與結束畫面除外)
    if (st !== 'loading' && st !== 'ended') drawVid();
    
    // 4. 根據狀態渲染不同介面
    const draw = {
        loading: dLoading, idle: dIdle, countdown: dCountdown, reveal: dReveal,
        win: dWin, lose: dLose, draw: dDraw, menu: dMenu, ended: dEnded
    };
    (draw[st] || dLoading)();
    
    requestAnimationFrame(loop);
}

loop();