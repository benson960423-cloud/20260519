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
  handPose = ml5.handPose();
}

function setup() {
  // 自動適應手機螢幕大小
  createCanvas(windowWidth, windowHeight);
  
  // 【安卓優化】：強制指定開啟前置鏡頭 (facingMode: 'user')
  let constraints = {
    video: {
      facingMode: 'user'
    },
    audio: false
  };

  video = createCapture(constraints, function(stream) {
    isCameraStarted = true; 
  });
  video.hide();

  handPose.detectStart(video, gotHands);
}

function gotHands(results) {
  hands = results;
}

// 觸控解鎖（保留給部分安卓瀏覽器如 LINE 內建瀏覽器阻擋時使用）
function touchStarted() {
  if (!isCameraStarted && video) {
    video.remove();
    let constraints = {
      video: { facingMode: 'user' },
      audio: false
    };
    video = createCapture(constraints);
    video.hide();
    handPose.detectStart(video, gotHands);
    isCameraStarted = true;
  }
  if (getAudioContext().state === 'suspended') {
    getAudioContext().resume();
  }
  return false;
}

function draw() {
  background('#c6ffcb');

  // 1. 畫布正上方的學生資訊文字
  fill(50);
  noStroke();
  textSize(28); // 稍微縮小字體以符合手機螢幕
  textAlign(CENTER, TOP);
  text("414730894呂承諺", width / 2, 20);

  if (!isCameraStarted || !video) {
    fill(94, 84, 142);
    textSize(20);
    textAlign(CENTER, CENTER);
    text(" 遊戲載入中...\n\n若畫面沒有反應，請點擊螢幕\n允許相機權限喔！", width / 2, height / 2);
    return;
  }

  // 【手機版畫面適應】：讓視訊畫面能完美塞進手機螢幕
  let imgW = width * 0.85; // 寬度佔螢幕 85%
  let imgH = (imgW / video.width) * video.height; // 依比例計算高度
  let offsetX = (width - imgW) / 2;
  let offsetY = 80; // 留給上方文字空間

  // 繪製攝影機影像
  image(video, offsetX, offsetY, imgW, imgH);

  // UI 往下推，放在視訊畫面下方
  drawGameUI(offsetY + imgH);

  if (hands.length > 0) {
    for (let hand of hands) {
      if (hand.confidence > 0.1) {
        
        if (millis() - lastMatchTime > 500) {
          judgeGesture(hand);
        }

        let handColor = hand.handedness == "Left" ? color(255, 0, 255) : color(255, 255, 0);
        strokeWeight(3);
        stroke(handColor);
        drawFinger(hand, 0, 4, offsetX, offsetY, imgW, imgH);  
        drawFinger(hand, 5, 8, offsetX, offsetY, imgW, imgH);  
        drawFinger(hand, 9, 12, offsetX, offsetY, imgW, imgH);  
        drawFinger(hand, 13, 16, offsetX, offsetY, imgW, imgH);
        drawFinger(hand, 17, 20, offsetX, offsetY, imgW, imgH);

        noStroke();
        for (let i = 0; i < hand.keypoints.length; i++) {
          let kp = hand.keypoints[i];
          let kx = map(kp.x, 0, video.width, offsetX, offsetX + imgW);
          let ky = map(kp.y, 0, video.height, offsetY, offsetY + imgH);
          
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
  } else {
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