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
    console.log('Creating game scene...');
    client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, "fdd578f2-f3c3-4089-bcda-f34576e0b095", "1.0");

    client.onStateChange = function(state) {
        console.log("State:", state);
    };

    client.onEvent = (code, content, actorNr) => {
        console.log("Event received:", code, content);
        if (code === 1) {
            if (content.playerId !== player.id) {
                if (!otherPlayers[content.playerId]) {
                    otherPlayers[content.playerId] = createOtherPlayer(content.x, content.y, this.scene);
                } else {
                    otherPlayers[content.playerId].setPosition(content.x, content.y);
                }
            }
        }
    };

    client.onJoinRoom = () => {
        console.log("Joined room");
        player = createPlayer(this);
        client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
    };

    client.onError = function(errorCode, errorMsg) {
        console.log(`Error: ${errorCode} - ${errorMsg}`);
    };

    client.onRoomListUpdate = function(rooms) {
        console.log("Room list updated:", rooms);
    };

    client.onRoomList = function(rooms) {
        console.log("Room list received:", rooms);
    };

    client.onJoinRoomFailed = function(errorCode, errorMsg) {
        console.log(`Failed to join room: ${errorCode} - ${errorMsg}`);
        // Attempt to create a room if joining failed
        createRoom();
    };

    client.onConnectedToMaster = function() {
        console.log("Connected to master server");
        client.joinRandomRoom();
    };

    function createRoom() {
        const roomOptions = {
            isVisible: true,
            isOpen: true,
            maxPlayers: 10
        };
        client.createRoom("myTestRoom", roomOptions);
    }

    client.connectToRegionMaster("us");

    // Add some static objects
    this.add.text(10, 10, 'Welcome to the game!', { font: '16px Arial', fill: '#ffffff' });

    // Add some animated objects
    const star = this.add.star(400, 300, 5, 20, 40, 0xffffff, 0.5);
    this.tweens.add({
        targets: star,
        rotation: 2 * Math.PI,
        duration: 4000,
        repeat: -1
    });

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

function createPlayer(scene) {
    const playerSprite = scene.add.image(400, 300, 'player');
    playerSprite.id = client.myActor().actorNr; // Assign an ID to the player sprite
    console.log('Player created:', playerSprite);
    return playerSprite;
}

function createOtherPlayer(x, y, scene) {
    const otherPlayerSprite = scene.add.image(x, y, 'player');
    console.log('Other player created:', otherPlayerSprite);
    return otherPlayerSprite;
}
