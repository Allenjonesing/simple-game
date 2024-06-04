const appId = "fdd578f2-f3c3-4089-bcda-f34576e0b095"; // Your App ID
const appVersion = "1.0";

const client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, appId, appVersion);

client.onEvent = function (code, content, actorNr) {
    switch (code) {
        case 1: // Player moved
            movePlayer(content.id, content.x, content.y);
            break;
        case 2: // NPC moved
            moveNPC(content.x, content.y);
            break;
    }
};

client.onJoinRoom = function () {
    console.log("Joined room");
    players[client.myActor().actorNr] = { x: 100, y: 100, color: '#' + Math.floor(Math.random() * 16777215).toString(16) };
};

client.onStateChange = function (state) {
    console.log("State:", state);
    if (state === Photon.LoadBalancing.LoadBalancingClient.State.JoinedLobby) {
        client.joinRoom("exampleRoom");
    }
};

client.onError = function (errorCode, errorMessage) {
    console.error("Error:", errorCode, errorMessage);
    if (errorCode === Photon.LoadBalancing.Constants.ErrorCode.GameDoesNotExist) {
        client.createRoom("exampleRoom");
    } else if (errorCode === Photon.LoadBalancing.Constants.ErrorCode.GameIdAlreadyExists) {
        client.joinRoom("exampleRoom");
    }
};

client.connectToRegionMaster("us");

let players = {};
let npc = { x: 200, y: 200, color: 'red' };
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
    // Draw NPC
    context.fillStyle = npc.color;
    context.fillRect(npc.x, npc.y, 50, 50);

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

function moveNPC(x, y) {
    npc.x = x;
    npc.y = y;
}

function randomMoveNPC() {
    npc.x += Math.random() * 20 - 10;
    npc.y += Math.random() * 20 - 10;
    client.raiseEvent(2, { x: npc.x, y: npc.y });
}

setInterval(randomMoveNPC, 1000);

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
