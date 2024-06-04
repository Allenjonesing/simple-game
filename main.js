const appId = "fdd578f2-f3c3-4089-bcda-f34576e0b095"; // Your App ID
const appVersion = "1.0";

const client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, appId, appVersion);

client.onEvent = function (code, content, actorNr) {
    switch (code) {
        case 1: // Player moved
            movePlayer(content.id, content.x, content.y);
            break;
    }
};

client.onJoinRoom = function () {
    players[client.myActor().actorNr] = { x: 100, y: 100, color: '#' + Math.floor(Math.random() * 16777215).toString(16) };
};

client.connectToRegionMaster("us");

let players = {};
let canvas = document.createElement('canvas');
let context = canvas.getContext('2d');
document.body.appendChild(canvas);

window.addEventListener('resize', resizeCanvas, false);
resizeCanvas();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function gameLoop() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let id in players) {
        let player = players[id];
        context.fillStyle = player.color;
        context.fillRect(player.x, player.y, 50, 50);
    }
    requestAnimationFrame(gameLoop);
}

function movePlayer(id, x, y) {
    if (!players[id]) {
        players[id] = {
            x: x,
            y: y,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16)
        };
    } else {
        players[id].x = x;
        players[id].y = y;
    }
}

window.addEventListener('keydown', (event) => {
    let player = players[client.myActor().actorNr];
    if (!player) return;

    switch (event.key) {
        case 'ArrowUp': player.y -= 10; break;
        case 'ArrowDown': player.y += 10; break;
        case 'ArrowLeft': player.x -= 10; break;
        case 'ArrowRight': player.x += 10; break;
    }

    client.raiseEvent(1, { id: client.myActor().actorNr, x: player.x, y: player.y });
});

gameLoop();
