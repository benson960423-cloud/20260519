let video;
let handPose;
let hands = [];
let stars = []; 

// 猜拳遊戲相關變數
let playerChoice = "請出拳...";
let computerChoice = "等待中...";
let gameResult = "看看誰會贏？";
let choices = [" 石頭", " 剪刀", " 布"];
let lastMatchTime = 0;

// 啟動鎖（安卓通常直接開，但保留此機制以防萬一）
let isCameraStarted = false;

function preload() {
  handPose = ml5.handPose({ flipped: true }); // 初始化時可設定預設翻轉
}

function setup() {
  // 自動適應手機螢幕大小
  createCanvas(windowWidth, windowHeight);

  // 檢查是否在安全環境下執行
  if (!window.isSecureContext && location.hostname !== "localhost") {
    console.warn("攝影機需要 HTTPS 環境才能啟動。");
  }

  // 【安卓優化】：強制指定開啟前置鏡頭 (facingMode: 'user')
  let constraints = {
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  };

  video = createCapture(constraints, (stream) => {
    isCameraStarted = true;
    console.log("攝影機已成功啟動");
  });
  video.elt.setAttribute('playsinline', ''); // 解決 iOS/Android 自動播放問題
  video.hide();

  handPose.detectStart(video, gotHands);
}

function gotHands(results) {
  hands = results;
}

// 觸控解鎖（保留給部分安卓瀏覽器如 LINE 內建瀏覽器阻擋時使用）
function touchStarted() {
  // 點擊畫面時強制讓影片播放 (部分瀏覽器安全性要求)
  if (video && video.elt) {
    video.elt.play();
  }
  if (getAudioContext().state === 'suspended') {
    getAudioContext().resume();
  }
  return false;
}

function draw() {
  background('#e7c6ff'); // 背景顏色設為指定色

  // 1. 畫布正上方的學生資訊文字
  fill(50);
  noStroke();
  textSize(24);
  textAlign(CENTER, TOP);
  text("414730894呂承諺", width / 2, 20);

  if (!isCameraStarted || !video) {
    fill(94, 84, 142);
    textSize(18);
    textAlign(CENTER, CENTER);
    text("攝影機啟動中...\n(若無反應請點擊畫面並檢查權限)", width / 2, height / 2);
    return;
  }

  // 設定影像大小為畫布的 50%
  let imgW = width * 0.5;
  let imgH = height * 0.5;

  // 繪製攝影機影像：置中 + 水平翻轉
  push();
  translate(width / 2, height / 2); // 移到畫布中心
  scale(-1, 1); // 左右翻轉實現鏡像
  image(video, -imgW / 2, -imgH / 2, imgW, imgH); // 影像繪製在變換後的中心

  if (hands.length > 0) {
    for (let hand of hands) {
      if (hand.confidence > 0.1) {
        if (millis() - lastMatchTime > 500) {
          judgeGesture(hand);
        }
        let handColor = hand.handedness == "Left" ? color(255, 0, 255) : color(255, 255, 0);
        strokeWeight(3);
        stroke(handColor);
        drawFinger(hand, 0, 4, -imgW / 2, -imgH / 2, imgW, imgH);  
        drawFinger(hand, 5, 8, -imgW / 2, -imgH / 2, imgW, imgH);  
        drawFinger(hand, 9, 12, -imgW / 2, -imgH / 2, imgW, imgH);  
        drawFinger(hand, 13, 16, -imgW / 2, -imgH / 2, imgW, imgH);
        drawFinger(hand, 17, 20, -imgW / 2, -imgH / 2, imgW, imgH);

        noStroke();
        for (let i = 0; i < hand.keypoints.length; i++) {
          let kp = hand.keypoints[i];
          // 映射座標到 transformed 的 50% 影像區域
          let kx = map(kp.x, 0, video.width, -imgW / 2, imgW / 2);
          let ky = map(kp.y, 0, video.height, -imgH / 2, imgH / 2);
          
          fill(handColor);
          circle(kx, ky, 8); // 手機上圓點稍微縮小一點點

          // 指尖產生星星效果
          if (i === 4 || i === 8 || i === 12 || i === 16 || i === 20) {
            if (frameCount % 2 === 0) {
              stars.push(new Star(kx, ky, handColor));
            }
          }
        }
      }
    }
  }
  pop(); // 結束鏡像矩陣轉換

  // UI 放在影像下方 (外面才不會被翻轉)
  drawGameUI(height / 2 + imgH / 2 + 20);

  if (hands.length === 0) {
    playerChoice = "請把手放到畫面中...";
  }

  // 更新與顯示星星
  for (let i = stars.length - 1; i >= 0; i--) {
    stars[i].update();
    stars[i].display();
    if (stars[i].isFaded) {
      stars.splice(i, 1);
    }
  }
}

// 手勢判定邏輯功能
function judgeGesture(hand) {
  let indexTip = hand.keypoints[8];
  let middleTip = hand.keypoints[12];
  let ringTip = hand.keypoints[16];
  let pinkyTip = hand.keypoints[20];
  let indexBase = hand.keypoints[5];
  let middleBase = hand.keypoints[9];
  let ringBase = hand.keypoints[13];
  let pinkyBase = hand.keypoints[17];

  let isIndexOpen = indexTip.y < indexBase.y;
  let isMiddleOpen = middleTip.y < middleBase.y;
  let isRingOpen = ringTip.y < ringBase.y;
  let isPinkyOpen = pinkyTip.y < pinkyBase.y;

  let currentPlay = "";

  if (isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen) {
    currentPlay = " 布";
  } else if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    currentPlay = " 剪刀";
  } else if (!isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    currentPlay = " 石頭";
  } else {
    currentPlay = "偵測中...";
  }

  if (currentPlay !== "偵測中..." && currentPlay !== playerChoice) {
    playerChoice = currentPlay;
    let randIdx = floor(random(3));
    computerChoice = choices[randIdx];
    calculateWinner(playerChoice, computerChoice);
    lastMatchTime = millis();
  }
}

// 勝負計算
function calculateWinner(p, c) {
  if (p === c) gameResult = "平手！我們很有默契";
  else if ((p === " 石頭" && c === " 剪刀") || (p === " 剪刀" && c === " 布") || (p === " 布" && c === " 石頭")) {
    gameResult = " 你贏了！厲害";
  } else {
    gameResult = " 電腦贏了！再接再厲 ";
  }
}

// 繪製遊戲 UI（針對手機寬度調整寬度）
function drawGameUI(yPos) {
  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  fill(255, 255, 255, 180);
  noStroke();
  
  let uiWidth = min(width * 0.9, 450); // 寬度最大 450，或跟著螢幕跑
  rect(width / 2, yPos + 60, uiWidth, 100, 15);
  
  textSize(18);
  fill(0);
  text(`你出：${playerChoice}`, width / 2 - 80, yPos + 45);
  text(`電腦出：${computerChoice}`, width / 2 + 80, yPos + 45);
  textSize(22);
  textStyle(BOLD);
  fill('#5e548e');
  text(gameResult, width / 2, yPos + 85);
  pop();
}

// 輔助功能：畫指節線
function drawFinger(hand, start, end, ox, oy, iw, ih) {
  for (let i = start; i < end; i++) {
    let pt1 = hand.keypoints[i];
    let pt2 = hand.keypoints[i + 1];
    let x1 = map(pt1.x, 0, video.width, ox, ox + iw);
    let y1 = map(pt1.y, 0, video.height, oy, oy + ih);
    let x2 = map(pt2.x, 0, video.width, ox, ox + iw);
    let y2 = map(pt2.y, 0, video.height, oy, oy + ih);
    line(x1, y1, x2, y2);
  }
}

// === 閃爍星星 粒子類別 ===
class Star {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.color = col;
    this.baseSize = random(8, 16); // 手機上稍微縮小星星，看起來更精緻
    this.size = this.baseSize;
    this.vx = random(-1.5, 1.5); 
    this.vy = random(-3.5, -1); 
    this.angle = random(TWO_PI); 
    this.rotationSpeed = random(-0.08, 0.08); 
    this.life = 1.0; 
    this.fadeSpeed = random(0.02, 0.04); 
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.04; 
    this.angle += this.rotationSpeed;
    this.life -= this.fadeSpeed;
    this.size = this.baseSize * this.life * (0.8 + 0.2 * sin(frameCount * 0.2 + this.x * 0.1));
  }

  display() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    noStroke();
    
    let r = red(this.color);
    let g = green(this.color);
    let b = blue(this.color);
    fill(r, g, b, this.life * 255);
    
    // 手機網頁若開啟發光會卡頓，這裡微調發光半徑，維持順暢度
    drawingContext.shadowBlur = this.size * 0.5;
    drawingContext.shadowColor = this.color;
    
    this.drawStarPattern(0, 0, this.size * 0.4, this.size, 5);
    pop();
  }

  get isFaded() {
    return this.life <= 0;
  }

  drawStarPattern(x, y, radius1, radius2, npoints) {
    let angle = TWO_PI / npoints;
    let halfAngle = angle / 2.0;
    beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
      let sx = x + cos(a) * radius2;
      let sy = y + sin(a) * radius2;
      vertex(sx, sy);
      sx = x + cos(a + halfAngle) * radius1;
      sy = y + sin(a + halfAngle) * radius1;
      vertex(sx, sy);
    }
    endShape(CLOSE);
  }
}