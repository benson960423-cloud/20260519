let handpose;
let video;
let hands = [];
let gameState = "LOADING"; 
let playerChoice = "等待中...";
let computerChoice = "？";
let resultText = "";

let lastGestureTime = 0;
let countdownStart = 0;
const gestureCooldown = 2500; 
let playerScore = 0;
let computerScore = 0;

const gestureEmoji = {
  "石頭": "✊",
  "剪刀": "✌️",
  "布": "🖐",
  "？": "❓",
  "等待中...": "⏳"
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handpose = ml5.handPose(video, () => {
    gameState = "COUNTDOWN";
    countdownStart = millis();
  });

  handpose.detectStart(video, results => {
    hands = results;
  });

  textAlign(CENTER, CENTER);
}

function draw() {
  background('#e7c6ff'); 
  
  // 1. 攝影機畫面
  let vWidth = width * 0.8;
  let vHeight = (vWidth * 480) / 640;
  let videoY = 20;

  push();
  translate((width + vWidth) / 2, videoY); 
  scale(-1, 1); 
  image(video, 0, 0, vWidth, vHeight);
  
  // 顯示骨架點
  if (hands.length > 0) {
    fill(0, 255, 0);
    for (let kp of hands[0].keypoints) {
      circle(kp.x * (vWidth / 640), kp.y * (vHeight / 480), 6);
    }
  }
  pop();

  // 2. 遊戲邏輯與 UI
  let uiY = videoY + vHeight + 40;

  if (gameState === "COUNTDOWN") {
    drawCountdown(uiY);
  } else if (gameState === "PLAYING") {
    // 這一秒是關鍵：321結束，立即捕捉雙方出拳
    captureChoices(); 
  } else if (gameState === "RESULT") {
    drawResult(uiY);
  } else if (gameState === "GAMEOVER") {
    drawGameOver();
  }
}

// 關鍵功能：捕捉瞬間
function captureChoices() {
  if (hands.length > 0) {
    let detected = analyzeGesture(hands[0].keypoints);
    if (detected !== "未知" && detected !== "三角形" && detected !== "叉叉") {
      playerChoice = detected;
    } else {
      playerChoice = "沒看清楚"; // 如果手沒擺好
    }
  } else {
    playerChoice = "沒出手";
  }

  // 電腦出拳
  computerChoice = ["石頭", "剪刀", "布"][floor(random(3))];
  resultText = checkWinner(playerChoice, computerChoice);

  // 計分
  if (resultText.includes("贏")) playerScore++;
  if (resultText.includes("輸")) computerScore++;

  gameState = "RESULT";
  lastGestureTime = millis();
}

function drawCountdown(uiY) {
  let elapsed = millis() - countdownStart;
  let timer = floor((3000 - elapsed) / 1000) + 1;

  fill(0);
  textSize(30);
  text("準備...請看鏡頭", width / 2, uiY);
  
  textSize(100);
  fill('#ff4d6d');
  if (timer > 0) {
    text(timer, width / 2, uiY + 100);
  } else {
    gameState = "PLAYING"; // 倒數完進入判定瞬間
  }
}

function drawResult(uiY) {
  // 分數板
  fill(50);
  textSize(24);
  text(`YOU: ${playerScore}  |  CPU: ${computerScore}`, width / 2, uiY - 20);

  // 對決畫面
  textSize(20);
  fill(0);
  text("你的出拳", width * 0.25, uiY + 40);
  text("電腦出拳", width * 0.75, uiY + 40);

  // 顯示大 Emoji
  textSize(80);
  text(gestureEmoji[playerChoice] || "❓", width * 0.25, uiY + 110);
  text(gestureEmoji[computerChoice], width * 0.75, uiY + 110);

  // 輸贏結果
  textSize(40);
  let c = resultText.includes("贏") ? '#2a9d8f' : (resultText.includes("輸") ? '#e76f51' : '#264653');
  fill(c);
  text(resultText, width / 2, uiY + 190);

  // 手勢提示
  textSize(18);
  fill(100);
  text("△ 三角形：繼續遊玩", width / 2, height - 80);
  text("X 叉叉：結束遊戲", width / 2, height - 50);

  // 判定三角形或叉叉
  if (millis() - lastGestureTime > gestureCooldown && hands.length > 0) {
    let g = analyzeGesture(hands[0].keypoints);
    if (g === "三角形") {
      playerChoice = "等待中...";
      computerChoice = "？";
      countdownStart = millis();
      gameState = "COUNTDOWN";
    } else if (g === "叉叉") {
      gameState = "GAMEOVER";
    }
  }
}

function analyzeGesture(lm) {
  // 取得關鍵點距離
  let d_index = dist(lm[8].x, lm[8].y, lm[0].x, lm[0].y);
  let d_middle = dist(lm[12].x, lm[12].y, lm[0].x, lm[0].y);
  let d_ring = dist(lm[16].x, lm[16].y, lm[0].x, lm[0].y);
  let d_pinky = dist(lm[20].x, lm[20].y, lm[0].x, lm[0].y);
  let d_thumb_index = dist(lm[8].x, lm[8].y, lm[4].x, lm[4].y);
  let d_index_middle = dist(lm[8].x, lm[8].y, lm[12].x, lm[12].y);

  // 判斷邏輯
  if (d_index < 130 && d_middle < 130 && d_ring < 130) return "石頭";
  if (d_index > 180 && d_middle > 180 && d_ring > 180) return "布";
  if (d_index > 180 && d_middle > 180 && d_ring < 130) return "剪刀";
  
  if (d_thumb_index < 40 && d_index > 150) return "三角形";
  if (d_index_middle < 30 && d_index > 150 && d_middle > 150) return "叉叉";

  return "未知";
}

function checkWinner(p, c) {
  if (p === c) return "平手";
  if (p === "沒看清楚" || p === "沒出手") return "判斷失敗";
  if ((p === "剪刀" && c === "布") || (p === "石頭" && c === "剪刀") || (p === "布" && c === "石頭")) return "你贏了！";
  return "你輸了！";
}

function drawGameOver() {
  background(0, 200);
  fill(255);
  textSize(50);
  text("遊戲結束", width / 2, height / 2);
  textSize(24);
  text(`總分：${playerScore}`, width / 2, height / 2 + 60);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}