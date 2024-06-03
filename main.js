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
let cursors;
let client;

function preload() {
    this.load.image('player', 'assets/playerShip.png');  // Ensure the path is correct
    console.log('Preloading assets...');
    this.load.on('complete', () => {
        console.log('Assets loaded successfully.');
    });
}

function create() {
    console.log('Creating game scene...');
    const scene = this;  // Preserve scene context
    client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, "fdd578f2-f3c3-4089-bcda-f34576e0b095", "1.0");

    client.onStateChange = function(state) {
        console.log("State:", state);
    };

    client.onEvent = function(code, content, actorNr) {
        console.log("Event received:", code, content);
        if (code === 1) {
            if (content.playerId !== player.id) {
                if (!otherPlayers[content.playerId]) {
                    otherPlayers[content.playerId] = createOtherPlayer(content.x, content.y, scene);
                } else {
                    otherPlayers[content.playerId].setPosition(content.x, content.y);
                }
            }
        }
    };

    client.onJoinRoom = function() {
        console.log("Joined room");
        player = createPlayer(scene);
        console.log('Player ID:', player.id);
        client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
    };

    client.onLeaveRoom = function() {
        console.log("Left room");
        removePlayer(client.myActor().actorNr);
    };

    client.onPlayerLeftRoom = function(player) {
        console.log("Player left room:", player.actorNr);
        removePlayer(player.actorNr);
    };

    client.onError = function(errorCode, errorMsg) {
        console.log(`Error: ${errorCode} - ${errorMsg}`);
    };

    client.onRoomListUpdate = function(rooms) {
        console.log("Room list updated:", rooms);
        if (rooms.length === 0) {
            console.log("No rooms available. Creating a new room.");
            createRoom();
        } else {
            console.log("Joining existing room.");
            client.joinRandomRoom();
        }
    };

    client.onRoomList = function(rooms) {
        console.log("Room list received:", rooms);
        if (rooms.length === 0) {
            console.log("No rooms available in list. Creating a new room.");
            createRoom();
        } else {
            console.log("Joining existing room from list.");
            client.joinRandomRoom();
        }
    };

    client.onJoinRoomFailed = function(errorCode, errorMsg) {
        console.log(`Failed to join room: ${errorCode} - ${errorMsg}`);
        // Attempt to create a room if joining failed
        createRoom();
    };

    client.onConnectedToMaster = function() {
        console.log("Connected to master server");
        client.joinLobby();
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

    // Add keyboard input
    cursors = this.input.keyboard.createCursorKeys();

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
    if (player) {
        if (cursors.left.isDown) {
            player.x -= 5;
        } else if (cursors.right.isDown) {
            player.x += 5;
        }

        if (cursors.up.isDown) {
            player.y -= 5;
        } else if (cursors.down.isDown) {
            player.y += 5;
        }

        // Broadcast player position to other clients
        client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
    }
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

function removePlayer(actorNr) {
    if (otherPlayers[actorNr]) {
        otherPlayers[actorNr].destroy();
        delete otherPlayers[actorNr];
        console.log('Player removed:', actorNr);
    }
}
