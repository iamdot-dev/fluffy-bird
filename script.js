const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'start'; // start, playing, gameover, win
let score = 0;
let frames = 0;

// Assets
const birdImg = new Image();
birdImg.src = 'penguin.png'; // Changed to penguin, will fallback to drawing

// Backgrounds
const bgImages = [];
for (let i = 1; i <= 5; i++) {
    const img = new Image();
    img.src = i === 1 ? 'background.png' : `background${i}.png`;
    bgImages.push(img);
}
let currentBgImg = bgImages[0];

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playJumpSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

// Simple background drone/music
let musicOscillator = null;
let musicGain = null;

function startMusic() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (musicOscillator) return; // Already playing

    musicOscillator = audioCtx.createOscillator();
    musicGain = audioCtx.createGain();

    musicOscillator.type = 'triangle';
    musicOscillator.frequency.setValueAtTime(110, audioCtx.currentTime); // Low A

    // LFO for some variation
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5; // 0.5 Hz
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(musicOscillator.frequency);
    lfo.start();

    musicGain.gain.setValueAtTime(0.05, audioCtx.currentTime);

    musicOscillator.connect(musicGain);
    musicGain.connect(audioCtx.destination);
    musicOscillator.start();
}

function stopMusic() {
    if (musicOscillator) {
        musicOscillator.stop();
        musicOscillator = null;
    }
}


// Game Objects
const bird = {
    x: 50,
    y: 150,
    w: 60,
    h: 60,
    radius: 30,
    velocity: 0,
    gravity: 0.25,
    jump: 4.6,

    draw: function () {
        if (birdImg.complete && birdImg.naturalWidth !== 0) {
            ctx.drawImage(birdImg, this.x, this.y, this.w, this.h);
        } else {
            // Fallback Penguin Drawing
            const cx = this.x + this.w / 2;
            const cy = this.y + this.h / 2;

            // Body (Black)
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.ellipse(cx, cy, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Belly (White)
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 5, this.w / 3, this.h / 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eye (White with Black pupil)
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(cx + 10, cy - 10, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(cx + 12, cy - 10, 3, 0, Math.PI * 2);
            ctx.fill();

            // Beak (Orange)
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.moveTo(cx + 15, cy);
            ctx.lineTo(cx + 35, cy + 5);
            ctx.lineTo(cx + 15, cy + 10);
            ctx.fill();
        }
    },

    update: function () {
        this.velocity += this.gravity;
        this.y += this.velocity;

        // Floor collision
        if (this.y + this.h >= canvas.height) {
            this.y = canvas.height - this.h;
            this.velocity = 0;
        }

        // Ceiling collision
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
    },

    flap: function () {
        this.velocity = -this.jump;
        playJumpSound();
    }
};

const walls = {
    position: [],
    w: 60, // Slightly wider walls
    dx: 2,
    gap: 180, // Gap for bird to fly through

    draw: function () {
        ctx.fillStyle = '#2ecc71';
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 2;

        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];

            // Top Wall
            ctx.fillRect(p.x, 0, this.w, p.top);
            ctx.strokeRect(p.x, 0, this.w, p.top);

            // Bottom Wall
            ctx.fillRect(p.x, canvas.height - p.bottom, this.w, p.bottom);
            ctx.strokeRect(p.x, canvas.height - p.bottom, this.w, p.bottom);
        }
    },

    update: function () {
        // Add new wall
        if (frames % 220 === 0) {
            // Calculate random heights
            // Available height = canvas.height - gap
            // Top wall can be from 50 to (canvas.height - gap - 50)
            const maxTop = canvas.height - this.gap - 50;
            const topHeight = Math.floor(Math.random() * (maxTop - 50 + 1) + 50);
            const bottomHeight = canvas.height - this.gap - topHeight;

            this.position.push({
                x: canvas.width,
                top: topHeight,
                bottom: bottomHeight,
                passed: false
            });
        }

        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            p.x -= this.dx;

            // Collision detection
            // Check Top Wall
            if (
                bird.x < p.x + this.w &&
                bird.x + bird.w > p.x &&
                bird.y < p.top
            ) {
                gameState = 'gameover';
                updateUI();
            }

            // Check Bottom Wall
            if (
                bird.x < p.x + this.w &&
                bird.x + bird.w > p.x &&
                bird.y + bird.h > canvas.height - p.bottom
            ) {
                gameState = 'gameover';
                updateUI();
            }

            // Score update
            if (p.x + this.w < bird.x && !p.passed) {
                score++;
                p.passed = true;
                document.getElementById('score').innerText = score;

                if (score >= 10) {
                    gameState = 'win';
                    updateUI();
                }
            }

            // Remove off-screen walls
            if (p.x + this.w < 0) {
                this.position.shift();
                i--;
            }
        }
    },

    reset: function () {
        this.position = [];
    }
};

const background = {
    x: 0,
    dx: 1,
    draw: function () {
        if (currentBgImg.complete && currentBgImg.naturalWidth !== 0) {
            ctx.drawImage(currentBgImg, this.x, 0, canvas.width, canvas.height);
            ctx.drawImage(currentBgImg, this.x + canvas.width, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    },
    update: function () {
        this.x -= this.dx;
        if (this.x <= -canvas.width) {
            this.x = 0;
        }
    }
};

// Input Control
function handleInput() {
    switch (gameState) {
        case 'start':
            gameState = 'playing';
            startMusic();
            updateUI();
            bird.flap();
            break;
        case 'playing':
            bird.flap();
            break;
        case 'gameover':
        case 'win':
            resetGame();
            break;
    }
}

// Input Control
document.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowUp') {
        handleInput();
    }
});

document.addEventListener('touchstart', function (e) {
    e.preventDefault(); // Prevent scrolling/zooming
    handleInput();
}, { passive: false });

function updateUI() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    if (gameState === 'start') {
        document.getElementById('start-screen').classList.add('active');
    } else if (gameState === 'gameover') {
        document.getElementById('game-over-screen').classList.add('active');
        stopMusic();
    } else if (gameState === 'win') {
        document.getElementById('win-screen').classList.add('active');
        stopMusic();
    }
}

function resetGame() {
    bird.y = canvas.height / 2; // Start in middle
    bird.velocity = 0;
    walls.reset();
    score = 0;
    frames = 0;
    document.getElementById('score').innerText = score;

    // Random Background
    const randomIndex = Math.floor(Math.random() * bgImages.length);
    currentBgImg = bgImages[randomIndex];

    gameState = 'start';
    updateUI();
}

function loop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background
    background.draw();
    if (gameState === 'playing') {
        background.update();
    }

    // Draw Walls
    walls.draw();
    if (gameState === 'playing') {
        walls.update();
    }

    // Draw Bird
    bird.draw();
    if (gameState === 'playing') {
        bird.update();
        frames++;
    }

    requestAnimationFrame(loop);
}

// Initialize
resetGame();
loop();
