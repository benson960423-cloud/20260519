let handpose;
let video;
let hands = [];
let gameState = "LOADING"; // LOADING, PLAYING, RESULT, GAMEOVER
let playerChoice = "";
let computerChoice = "";
let resultText = "";
let lastGestureTime = 0;
const gestureCooldown = 2000; 

function setup() {
  // 1. 產生全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  
  // 2. 擷取攝影機影像
  video = createCapture(VIDEO);
  video.size(640, 480); // 設定擷取解析度
  video.hide();

  // 3. 初始化 ml5 handPose (注意 P 大寫，這是 1.x 版本的語法)
  handpose = ml5.handPose(video, () => {
    console.log("模型已載入！");
    gameState = "PLAYING";
  });

  // 開始持續偵測
  handpose.detectStart(video, results => {
    hands = results;
  });

  textAlign(CENTER, CENTER);
  textSize(32);
}

function draw() {
  // 背景顏色
  background('#e7c6ff');
  
  // 計算 50% 畫布大小的影像寬高
  let vWidth = width * 0.5;
  let vHeight = height * 0.5;

  // 繪製攝影機畫面：置中 + 水平翻轉
  push();
  translate(width / 2, height / 2);
  scale(-1, 1); // 左右翻轉
  image(video, -vWidth / 2, -vHeight / 2, vWidth, vHeight);
  pop();

  // 遊戲 UI 邏輯 (UI 不要跟著影像翻轉)
  push();
  if (gameState === "LOADING") {
    drawLoadingScreen();
  } else if (gameState === "PLAYING") {
    handlePlaying();
  } else if (gameState === "RESULT") {
    drawResultScreen();
  } else if (gameState === "GAMEOVER") {
    drawGameOverScreen();
  }
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// --- 遊戲邏輯 ---

function handlePlaying() {
  fill(0);
  text("請出拳：✊ 🖐 ✌️", width / 2, 50);
  
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
  // ml5 1.x 的 keypoints 格式為 {x, y}
  let d_index = dist(lm[8].x, lm[8].y, lm[0].x, lm[0].y);
  let d_middle = dist(lm[12].x, lm[12].y, lm[0].x, lm[0].y);
  let d_ring = dist(lm[16].x, lm[16].y, lm[0].x, lm[0].y);
  let d_pinky = dist(lm[20].x, lm[20].y, lm[0].x, lm[0].y);

  // --- 1. 石頭剪刀布判斷 ---
  if (d_index < 150 && d_middle < 150 && d_ring < 150) return "石頭";
  if (d_index > 200 && d_middle > 200 && d_ring > 200 && d_pinky > 200) return "布";
  if (d_index > 200 && d_middle > 200 && d_ring < 150) return "剪刀";

  // --- 2. 三角形 (繼續遊戲) --- 
  // 邏輯：食指、中指、拇指指尖靠得很近
  let triDist = dist(lm[8][0], lm[8][1], lm[4][0], lm[4][1]);
  if (triDist < 50 && d_index > 150) return "三角形";

  // --- 3. 叉叉 (結束遊戲) ---
  // 邏輯：食指與中指交叉 (簡化判定：食指與中指距離極近且伸直)
  let crossDist = dist(lm[8][0], lm[8][1], lm[12][0], lm[12][1]);
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

function drawLoadingScreen() {
  fill(0, 150);
  rect(0, 0, width, height);
  fill(255);
  text("載入 AI 手勢辨識中...", width / 2, height / 2);
  text("請允許攝影機存取", width / 2, height / 2 + 50);
}

function drawResultScreen() {
  fill(0, 180);
  rect(0, 0, width, height);
  fill(255);
  text(`你出：${playerChoice} vs 電腦：${computerChoice}`, width / 2, height / 2 - 50);
  textSize(48);
  text(resultText, width / 2, height / 2 + 20);
  
  textSize(24);
  fill(0, 255, 0);
  text("△ 比出三角形：繼續挑戰", width / 2, height / 2 + 100);
  fill(255, 0, 0);
  text("X 比出叉叉：結束遊戲", width / 2, height / 2 + 140);

  // 偵測後續手勢
  if (millis() - lastGestureTime > gestureCooldown && predictions.length > 0) {
    let g = analyzeGesture(predictions[0].landmarks);
    if (g === "三角形") gameState = "PLAYING";
    if (g === "叉叉") gameState = "GAMEOVER";
  }
}

function drawGameOverScreen() {
  fill(0, 230);
  rect(0, 0, width, height);
  fill(255);
  textSize(50);
  text("遊戲結束", width / 2, height / 2);
  textSize(20);
  text("重新掃描 QR Code 以再次遊玩", width / 2, height / 2 + 60);
}