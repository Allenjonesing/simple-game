const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const player = {
    x: 50,
    y: canvas.height - 100,
    width: 50,
    height: 50,
    color: 'red',
    speed: 5,
    dx: 0,
    dy: 0,
    gravity: 0.1,
    jetpackForce: -0.2,
    maxHeight: 100
};

const keys = {
    right: false,
    left: false,
    up: false
};

const platforms = [
    { x: 100, y: canvas.height - 200, width: 200, height: 20 },
    { x: 400, y: canvas.height - 300, width: 200, height: 20 },
    { x: 700, y: canvas.height - 400, width: 200, height: 20 }
];

const boxes = [
    { x: 150, y: canvas.height - 250, width: 50, height: 50, dx: 0, dy: 0 }
];

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawPlatforms() {
    ctx.fillStyle = 'gray';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
}

function drawBoxes() {
    ctx.fillStyle = 'blue';
    boxes.forEach(box => {
        ctx.fillRect(box.x, box.y, box.width, box.height);
    });
}

function drawParticles(particles) {
    particles.forEach(particle => {
        ctx.fillStyle = `rgba(255, 255, 0, ${particle.alpha})`;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

const particles = [];

function update() {
    clear();
    drawPlayer();
    drawPlatforms();
    drawBoxes();
    drawParticles(particles);
    player.x += player.dx;
    player.y += player.dy;

    // Apply gravity
    if (player.y + player.height < canvas.height) {
        player.dy += player.gravity;
    } else {
        player.dy = 0;
        player.y = canvas.height - player.height;
    }

    // Jetpack movement
    if (keys.up && player.y > player.maxHeight) {
        player.dy += player.jetpackForce;
        createParticles(player.x + player.width / 2, player.y + player.height);
    }

    // Horizontal movement
    if (keys.right) {
        player.dx = player.speed;
    } else if (keys.left) {
        player.dx = -player.speed;
    } else {
        player.dx = 0;
    }

    // Limit player to the canvas boundaries
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }

    checkPlatformCollision();
    updateBoxes();
    updateParticles();

    requestAnimationFrame(update);
}

function checkPlatformCollision() {
    platforms.forEach(platform => {
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y < platform.y + platform.height &&
            player.y + player.height > platform.y) {
                player.dy = 0;
                player.y = platform.y - player.height;
            }
    });
}

function updateBoxes() {
    boxes.forEach(box => {
        box.dy += player.gravity;
        box.x += box.dx;
        box.y += box.dy;

        platforms.forEach(platform => {
            if (box.x < platform.x + platform.width &&
                box.x + box.width > platform.x &&
                box.y < platform.y + platform.height &&
                box.y + box.height > platform.y) {
                    box.dy = 0;
                    box.y = platform.y - box.height;
                }
        });

        // Limit box to the canvas boundaries
        if (box.x < 0) {
            box.x = 0;
            box.dx = 0;
        }
        if (box.x + box.width > canvas.width) {
            box.x = canvas.width - box.width;
            box.dx = 0;
        }
        if (box.y + box.height > canvas.height) {
            box.y = canvas.height - box.height;
            box.dy = 0;
        }

        // Check collision with player
        if (player.x < box.x + box.width &&
            player.x + player.width > box.x &&
            player.y < box.y + box.height &&
            player.y + player.height > box.y) {
                box.dx = player.dx;
                box.dy = player.dy;
        }
    });
}

function createParticles(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            size: Math.random() * 5 + 1,
            alpha: 1,
            dx: (Math.random() - 0.5) * 2,
            dy: Math.random() * 2
        });
    }
}

function updateParticles() {
    particles.forEach((particle, index) => {
        particle.x += particle.dx;
        particle.y += particle.dy;
        particle.alpha -= 0.02;

        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = true;
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = true;
    } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        keys.up = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = false;
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = false;
    } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        keys.up = false;
    }
});

update();
