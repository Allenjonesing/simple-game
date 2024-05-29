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
    jumpForce: -15,
    gravity: 0.3
};

const keys = {
    right: false,
    left: false,
    up: false
};

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// function update() {
//     clear();
//     drawPlayer();
//     player.x += player.dx;
//     player.y += player.dy;

//     // Apply gravity
//     if (player.y + player.height < canvas.height) {
//         player.dy += player.gravity;
//     } else {
//         player.dy = 0;
//         player.y = canvas.height - player.height;
//     }

//     // Limit player to the canvas boundaries
//     if (player.x < 0) {
//         player.x = 0;
//     }
//     if (player.x + player.width > canvas.width) {
//         player.x = canvas.width - player.width;
//     }

//     // Horizontal movement
//     if (keys.right) {
//         player.dx = player.speed;
//     } else if (keys.left) {
//         player.dx = -player.speed;
//     } else {
//         player.dx = 0;
//     }

//     requestAnimationFrame(update);
// }

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = true;
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = true;
    } else if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') && player.dy === 0) {
        player.dy = player.jumpForce;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = false;
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = false;
    }
});

const platforms = [
    { x: 100, y: canvas.height - 200, width: 200, height: 20 },
    { x: 400, y: canvas.height - 300, width: 200, height: 20 },
    { x: 700, y: canvas.height - 400, width: 200, height: 20 }
];

function drawPlatforms() {
    ctx.fillStyle = 'gray';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
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

function update() {
    clear();
    drawPlayer();
    drawPlatforms();
    player.x += player.dx;
    player.y += player.dy;

    // Apply gravity
    if (player.y + player.height < canvas.height) {
        player.dy += player.gravity;
    } else {
        player.dy = 0;
        player.y = canvas.height - player.height;
    }

    checkPlatformCollision();

    // Limit player to the canvas boundaries
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }

    // Horizontal movement
    if (keys.right) {
        player.dx = player.speed;
    } else if (keys.left) {
        player.dx = -player.speed;
    } else {
        player.dx = 0;
    }

    requestAnimationFrame(update);
}

update();
