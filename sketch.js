let handpose;
let video;
let hands = [];
let gameState = "LOADING"; // LOADING, COUNTDOWN, PLAYING, RESULT, GAMEOVER
let playerChoice = "";
let computerChoice = "";
let resultText = "";
let lastGestureTime = 0;
let countdownStart = 0;
const gestureCooldown = 2000; 

// 手勢對應的 Emoji
const gestureEmoji = {
  "石頭": "✊",
  "剪刀": "✌️",
  "布": "🖐"
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handpose = ml5.handPose(video, () => {
    console.log("模型已載入！");
    // 模型載入後，直接進入倒數階段
    startCountdown();
  });

  handpose.detectStart(video, results => {
    hands = results;
  });

  textAlign(CENTER, CENTER);
}

function draw() {
  background('#e7c6ff');
  
  // --- 1. 攝影機畫面 (固定在畫面上半部) ---
  let vWidth = width * 0.8; 
  let vHeight = (vWidth * 480) / 640; // 保持比例
  let videoY = height * 0.25; // 放在偏上方，避免擋住下方 UI

  push();
  translate(width / 2, videoY); // 移動到畫布上方中間
  scale(-1, 1); 
  imageMode(CENTER);
  image(video, 0, 0, vWidth, vHeight);
  pop();

  // --- 2. 遊戲 UI (顯示在攝影機下方) ---
  push();
  if (gameState === "LOADING") {
    drawLoadingScreen(videoY, vHeight);
  } else if (gameState === "COUNTDOWN") {
    drawCountdownScreen(videoY, vHeight);
  } else if (gameState === "PLAYING") {
    handlePlaying(videoY, vHeight);
  } else if (gameState === "RESULT") {
    drawResultScreen(videoY, vHeight);
  } else if (gameState === "GAMEOVER") {
    drawGameOverScreen();
  }
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// --- 遊戲邏輯與狀態切換 ---

function startCountdown() {
  gameState = "COUNTDOWN";
  countdownStart = millis();
}

function handlePlaying(videoY, vHeight) {
  let uiY = videoY + (vHeight / 2) + 60; // 確保文字在影片下方
  
  fill(0);
  textSize(32);
  text("請出拳！", width / 2, uiY);
  textSize(48);
  text("✊ 🖐 ✌️", width / 2, uiY + 60);
  
  if (hands.length > 0) {
    let gesture = analyzeGesture(hands[0].keypoints);
    
    if (["石頭", "剪刀", "布"].includes(gesture)) {
      playerChoice = gesture;
      computerChoice = ["石頭", "剪刀", "布"][floor(random(3))];
      resultText = checkWinner(playerChoice, computerChoice);
      gameState = "RESULT";
      lastGestureTime = millis();
    }
  }
}

function analyzeGesture(lm) {
  let d_index = dist(lm[8].x, lm[8].y, lm[0].x, lm[0].y);
  let d_middle = dist(lm[12].x, lm[12].y, lm[0].x, lm[0].y);
  let d_ring = dist(lm[16].x, lm[16].y, lm[0].x, lm[0].y);
  let d_pinky = dist(lm[20].x, lm[20].y, lm[0].x, lm[0].y);

  if (d_index < 150 && d_middle < 150 && d_ring < 150) return "石頭";
  if (d_index > 200 && d_middle > 200 && d_ring > 200 && d_pinky > 200) return "布";
  if (d_index > 200 && d_middle > 200 && d_ring < 150) return "剪刀";

  // 修正：ml5 1.x 必須使用 .x 和 .y
  let triDist = dist(lm[8].x, lm[8].y, lm[4].x, lm[4].y);
  if (triDist < 50 && d_index > 150) return "三角形";

  let crossDist = dist(lm[8].x, lm[8].y, lm[12].x, lm[12].y);
  if (crossDist < 30 && d_index > 200 && d_middle > 200) return "叉叉";

  return "未知";
}

function checkWinner(p, c) {
  if (p === c) return "平手！";
  if ((p === "剪刀" && c === "布") || (p === "石頭" && c === "剪刀") || (p === "布" && c === "石頭")) {
    return "你贏了！🎉";
  }
  return "你輸了...💀";
}

// --- 介面呈現函式 ---

function drawLoadingScreen(videoY, vHeight) {
  let uiY = videoY + (vHeight / 2) + 80;
  fill(0);
  textSize(24);
  text("載入 AI 手勢辨識中...", width / 2, uiY);
  text("請允許攝影機存取", width / 2, uiY + 40);
}

function drawCountdownScreen(videoY, vHeight) {
  let uiY = videoY + (vHeight / 2) + 100;
  let elapsed = millis() - countdownStart;
  
  fill(0);
  textSize(80);
  
  if (elapsed < 1000) {
    text("3", width / 2, uiY);
  } else if (elapsed < 2000) {
    text("2", width / 2, uiY);
  } else if (elapsed < 3000) {
    text("1", width / 2, uiY);
  } else {
    gameState = "PLAYING"; // 倒數結束，切換到偵測出拳狀態
  }
}

function drawResultScreen(videoY, vHeight) {
  let uiY = videoY + (vHeight / 2) + 60;
  
  // 顯示玩家與電腦的出拳
  fill(0);
  textSize(24);
  text(`你：${playerChoice}`, width / 4, uiY);
  text(`電腦：${computerChoice}`, (width / 4) * 3, uiY);
  
  textSize(60);
  text(gestureEmoji[playerChoice], width / 4, uiY + 60);
  text(gestureEmoji[computerChoice], (width / 4) * 3, uiY + 60);

  // 顯示輸贏結果
  textSize(40);
  if (resultText.includes("贏")) fill(0, 150, 0); // 綠色
  else if (resultText.includes("輸")) fill(200, 0, 0); // 紅色
  else fill(0); // 平手黑色
  text(resultText, width / 2, uiY + 140);
  
  // 顯示操作提示
  textSize(18);
  fill(0, 100);
  text("△ 雙手比三角形：再來一局", width / 2, height - 80);
  text("X 雙手比叉叉：結束遊戲", width / 2, height - 50);

  // 偵測後續手勢 (加入冷卻時間避免誤判)
  if (millis() - lastGestureTime > gestureCooldown && hands.length > 0) {
    let g = analyzeGesture(hands[0].keypoints);
    if (g === "三角形") {
      startCountdown(); // 重新倒數
    }
    if (g === "叉叉") {
      gameState = "GAMEOVER";
    }
  }
}

function drawGameOverScreen() {
  fill(0, 200);
  rect(0, 0, width, height); // 蓋住全螢幕
  fill(255);
  textSize(50);
  text("遊戲結束", width / 2, height / 2);
  textSize(20);
  text("重新掃描 QR Code 或重整網頁以再次遊玩", width / 2, height / 2 + 60);
}