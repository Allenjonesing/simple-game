const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let player;
let otherPlayers = {};
let client;

function preload() {
    this.load.image('player', 'assets/playerShip.png');  // Add a valid path to your player image
    console.log('Preloading assets...');
    this.load.on('complete', () => {
        console.log('Assets loaded successfully.');
    });
}
    
function create() {
    const client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, "fdd578f2-f3c3-4089-bcda-f34576e0b095", "1.0");

    client.onStateChange = function(state) {
        console.log("State:", state);
    };

    client.onEvent = (code, content, actorNr) => {
        if (code === 1) {
            if (content.playerId !== player.id) {
                if (!otherPlayers[content.playerId]) {
                    otherPlayers[content.playerId] = createOtherPlayer(content.x, content.y);
                } else {
                    otherPlayers[content.playerId].setPosition(content.x, content.y);
                }
            }
        }
    };

    client.onJoinRoom = () => {
        player = createPlayer();
        client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
    };

    client.connectToRegionMaster("us");

    this.input.on('pointermove', pointer => {
        if (player) {
            player.setPosition(pointer.x, pointer.y);
            client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
        }
    });
}

function update() {
    // Game loop logic here
}

function createPlayer() {
    const playerSprite = this.add.image(400, 300, 'player');
    console.log('Player created:', playerSprite);
    return playerSprite;
}

function createOtherPlayer(x, y) {
    return this.add.image(x, y, 'player');  // Ensure the 'this' context is correct
}
