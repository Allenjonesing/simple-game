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
    gravity: 0.05,
    jetpackForce: -0.1,
    maxHeight: 100,
    canShoot: true
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
    { x: 150, y: canvas.height - 250, width: 50, height: 50, dx: 0, dy: 0, angle: 0, angularVelocity: 0 },
    { x: 150, y: canvas.height - 350, width: 50, height: 50, dx: 0, dy: 0, angle: 0, angularVelocity: 0 },
    { x: 150, y: canvas.height - 450, width: 50, height: 50, dx: 0, dy: 0, angle: 0, angularVelocity: 0 }
];

const rockets = [];
const particles = [];

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
        ctx.save();
        ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
        ctx.rotate(box.angle);
        ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
        ctx.restore();
    });
}

function drawRockets() {
    ctx.fillStyle = 'orange';
    rockets.forEach(rocket => {
        ctx.fillRect(rocket.x, rocket.y, rocket.width, rocket.height);
    });
}

function drawParticles() {
    particles.forEach(particle => {
        ctx.fillStyle = `rgba(255, 165, 0, ${particle.alpha})`;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function update() {
    clear();
    drawPlayer();
    drawPlatforms();
    drawBoxes();
    drawRockets();
    drawParticles();
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
    updateRockets();
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
        box.angle += box.angularVelocity;

        platforms.forEach(platform => {
            if (box.x < platform.x + platform.width &&
                box.x + box.width > platform.x &&
                box.y < platform.y + platform.height &&
                box.y + box.height > platform.y) {
                    box.dy = 0;
                    box.y = platform.y - box.height;
                    box.angularVelocity = 0;
                }
        });

        // Limit box to the canvas boundaries
        if (box.x < 0) {
            box.x = 0;
            box.dx = 0;
            box.angularVelocity = 0;
        }
        if (box.x + box.width > canvas.width) {
            box.x = canvas.width - box.width;
            box.dx = 0;
            box.angularVelocity = 0;
        }
        if (box.y + box.height > canvas.height) {
            box.y = canvas.height - box.height;
            box.dy = 0;
            box.angularVelocity = 0;
        }

        // Check collision with player
        if (player.x < box.x + box.width &&
            player.x + player.width > box.x &&
            player.y < box.y + box.height &&
            player.y + player.height > box.y) {
                box.dx = player.dx;
                box.dy = player.dy;
                box.angularVelocity = player.dx * 0.05;
        }
    });
}

function updateRockets() {
    rockets.forEach((rocket, index) => {
        rocket.x += rocket.dx;
        rocket.y += rocket.dy;

        // Remove rocket if out of bounds
        if (rocket.x < 0 || rocket.x > canvas.width || rocket.y < 0 || rocket.y > canvas.height) {
            rockets.splice(index, 1);
        }

        // Check collision with boxes
        boxes.forEach(box => {
            if (rocket.x < box.x + box.width &&
                rocket.x + rocket.width > box.x &&
                rocket.y < box.y + box.height &&
                rocket.y + rocket.height > box.y) {
                    createExplosion(rocket.x, rocket.y);
                    rockets.splice(index, 1);
                }
        });
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

function shootRocket(targetX, targetY) {
    if (!player.canShoot) return;
    player.canShoot = false;
    setTimeout(() => player.canShoot = true, 500); // 0.5 seconds cooldown

    const angle = Math.atan2(targetY - (player.y + player.height / 2), targetX - (player.x + player.width / 2));
    const speed = 10;

    rockets.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        width: 10,
        height: 5,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed
    });
}

function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
            size: Math.random() * 10 + 2,
            alpha: 1,
            dx: (Math.random() - 0.5) * 5,
            dy: (Math.random() - 0.5) * 5
        });
    }

    boxes.forEach(box => {
        const distX = box.x + box.width / 2 - x;
        const distY = box.y + box.height / 2 - y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        const force = 100 / (distance + 1);

        box.dx += distX * force;
        box.dy += distY * force;
        box.angularVelocity += (Math.random() - 0.5) * force;
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

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    shootRocket(mouseX, mouseY);
});

update();
