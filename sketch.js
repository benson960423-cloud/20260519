let handpose;
let video;
let hands = [];
let gameState = "LOADING"; // 狀態：LOADING, COUNTDOWN, PLAYING, RESULT, GAMEOVER
let playerChoice = "";
let computerChoice = "";
let resultText = "";

// 時間控制與分數
let lastGestureTime = 0;
let countdownStart = 0;
const gestureCooldown = 2000; 
let playerScore = 0;
let computerScore = 0;

const gestureEmoji = {
  "石頭": "✊",
  "剪刀": "✌️",
  "布": "🖐"
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 建立攝影機
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 載入 ml5.js 手勢辨識模型
  handpose = ml5.handPose(video, () => {
    console.log("模型已載入！");
    startCountdown(); // 模型載入完畢，直接開始倒數
  });

  // 持續偵測手部
  handpose.detectStart(video, results => {
    hands = results;
  });

  textAlign(CENTER, CENTER);
}

function draw() {
  background('#e7c6ff'); // 柔和的紫色背景
  
  // --- 1. 攝影機畫面與 AI 骨架 (固定在畫布上半部) ---
  let vWidth = width * 0.85; // 寬度佔螢幕 85%
  let vHeight = (vWidth * 480) / 640; // 維持 4:3 比例
  let videoX = (width - vWidth) / 2; // 置中
  let videoY = 40; // 距離上方 40px

  push();
  // 為了讓攝影機像照鏡子，我們移動原點並水平翻轉
  translate(videoX + vWidth, videoY); 
  scale(-1, 1); 
  image(video, 0, 0, vWidth, vHeight);

  // 繪製 AI 手部追蹤點 (讓玩家知道 AI 正在看)
  if (hands.length > 0) {
    let scaleX = vWidth / 640;
    let scaleY = vHeight / 480;
    let keypoints = hands[0].keypoints;

    fill(0, 255, 100);
    noStroke();
    for (let i = 0; i < keypoints.length; i++) {
      let x = keypoints[i].x * scaleX;
      let y = keypoints[i].y * scaleY;
      circle(x, y, 8); // 畫出綠色小圓點
    }
  }
  pop();

  // --- 2. 計分板 ---
  let uiY = videoY + vHeight + 30; // 介面起始位置在影片下方
  
  if (gameState !== "LOADING" && gameState !== "GAMEOVER") {
    fill(50);
    textSize(22);
    text(`玩家分數：${playerScore}   |   電腦分數：${computerScore}`, width / 2, uiY);
  }

  // --- 3. 遊戲狀態機控制 ---
  uiY += 50; // 將主要文字往下推
  
  if (gameState === "LOADING") {
    drawLoadingScreen(uiY);
  } else if (gameState === "COUNTDOWN") {
    drawCountdownScreen(uiY);
  } else if (gameState === "PLAYING") {
    handlePlaying(uiY);
  } else if (gameState === "RESULT") {
    drawResultScreen(uiY);
  } else if (gameState === "GAMEOVER") {
    drawGameOverScreen();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ================= 遊戲邏輯 =================

function startCountdown() {
  gameState = "COUNTDOWN";
  countdownStart = millis();
}

function handlePlaying(uiY) {
  fill(0);
  textSize(28);
  text("請出拳！", width / 2, uiY);
  textSize(50);
  text("✊  🖐  ✌️", width / 2, uiY + 60);
  
  if (hands.length > 0) {
    let gesture = analyzeGesture(hands[0].keypoints);
    
    // 只接收石頭、剪刀、布
    if (["石頭", "剪刀", "布"].includes(gesture)) {
      playerChoice = gesture;
      computerChoice = ["石頭", "剪刀", "布"][floor(random(3))];
      resultText = checkWinner(playerChoice, computerChoice);
      
      // 更新計分板
      if (resultText.includes("贏")) playerScore++;
      if (resultText.includes("輸")) computerScore++;
      
      gameState = "RESULT";
      lastGestureTime = millis();
    }
  }
}

// 核心手勢判斷 (包含你自訂的三角形與叉叉)
function analyzeGesture(lm) {
  let d_index = dist(lm[8].x, lm[8].y, lm[0].x, lm[0].y);
  let d_middle = dist(lm[12].x, lm[12].y, lm[0].x, lm[0].y);
  let d_ring = dist(lm[16].x, lm[16].y, lm[0].x, lm[0].y);
  let d_pinky = dist(lm[20].x, lm[20].y, lm[0].x, lm[0].y);

  // 1. 基本猜拳
  if (d_index < 150 && d_middle < 150 && d_ring < 150) return "石頭";
  if (d_index > 200 && d_middle > 200 && d_ring > 200 && d_pinky > 200) return "布";
  if (d_index > 200 && d_middle > 200 && d_ring < 150) return "剪刀";

  // 2. 三角形 (繼續)
  let triDist = dist(lm[8].x, lm[8].y, lm[4].x, lm[4].y);
  if (triDist < 50 && d_index > 150) return "三角形";

  // 3. 叉叉 (結束)
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

// ================= 介面繪製 =================

function drawLoadingScreen(uiY) {
  fill(0);
  textSize(24);
  text("載入 AI 模型中...", width / 2, uiY);
  textSize(18);
  fill(100);
  text("請允許攝影機存取並稍候", width / 2, uiY + 40);
}

function drawCountdownScreen(uiY) {
  let elapsed = millis() - countdownStart;
  fill(0);
  textSize(80);
  
  if (elapsed < 1000) {
    text("3", width / 2, uiY + 40);
  } else if (elapsed < 2000) {
    text("2", width / 2, uiY + 40);
  } else if (elapsed < 3000) {
    text("1", width / 2, uiY + 40);
  } else {
    gameState = "PLAYING"; 
  }
}

function drawResultScreen(uiY) {
  // 顯示雙方出拳
  fill(0);
  textSize(20);
  text(`你：${playerChoice}`, width * 0.3, uiY);
  text(`電腦：${computerChoice}`, width * 0.7, uiY);
  
  textSize(60);
  text(gestureEmoji[playerChoice], width * 0.3, uiY + 50);
  text(gestureEmoji[computerChoice], width * 0.7, uiY + 50);

  // 顯示結果文字 (輸贏顏色變化)
  textSize(36);
  if (resultText.includes("贏")) fill(0, 150, 0); 
  else if (resultText.includes("輸")) fill(200, 0, 0); 
  else fill(0);
  text(resultText, width / 2, uiY + 130);
  
  // 顯示自訂手勢提示
  textSize(18);
  fill(50, 150);
  text("△ 捏合食指拇指(三角形)：再來一局", width / 2, height - 80);
  text("X 食指中指交叉(叉叉)：結束遊戲", width / 2, height - 50);

  // 偵測後續的三角形或叉叉手勢 (需等待冷卻時間)
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
  rect(0, 0, width, height); // 半透明黑幕
  fill(255);
  textSize(40);
  text("遊戲結束！", width / 2, height / 2 - 40);
  
  textSize(24);
  fill(255, 204, 0);
  text(`最終分數：你 ${playerScore} - ${computerScore} 電腦`, width / 2, height / 2 + 20);
  
  textSize(16);
  fill(200);
  text("重新掃描 QR Code 或重整網頁以再次遊玩", width / 2, height / 2 + 80);
}