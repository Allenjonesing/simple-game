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
const disconnectionTimeout = 5000;  // Timeout period in milliseconds
let disconnectTimeouts = {};

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

    // Registering all connection-related event handlers
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
        setCustomPlayerProperties(client.myActor().actorNr, { playerId: player.id, state: 'active' });
        client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
    };

    client.onLeaveRoom = function() {
        console.log("Left room");
        setCustomPlayerProperties(client.myActor().actorNr, { state: 'disconnected' });
        removePlayer(client.myActor().actorNr);
    };

    client.onPlayerLeftRoom = function(player) {
        console.log("Player left room:", player.actorNr);
        schedulePlayerRemoval(player.actorNr);
    };

    client.onPlayerDisconnected = function(player) {
        console.log("Player disconnected:", player.actorNr);
        setCustomPlayerProperties(player.actorNr, { state: 'disconnected' });
        schedulePlayerRemoval(player.actorNr);
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

    // Ensure all PhotonPeer status handlers are registered
    client._dispatchPeerStatus = function(statusCode, message) {
        console.log(`PhotonPeer status: ${statusCode} - ${message}`);
        // Add any additional handlers if necessary
    };

    function createRoom() {
        const roomOptions = {
            isVisible: true,
            isOpen: true,
            maxPlayers: 10,
            playerTtl: 60000  // Keep player data for 1 minute after disconnection
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

function schedulePlayerRemoval(actorNr) {
    if (disconnectTimeouts[actorNr]) {
        clearTimeout(disconnectTimeouts[actorNr]);
    }
    disconnectTimeouts[actorNr] = setTimeout(() => {
        removePlayer(actorNr);
        delete disconnectTimeouts[actorNr];
    }, disconnectionTimeout);
}

function removePlayer(actorNr) {
    if (otherPlayers[actorNr]) {
        otherPlayers[actorNr].destroy();
        delete otherPlayers[actorNr];
        console.log('Player removed:', actorNr);
    } else if (player && player.id === actorNr) {
        player.destroy();
        player = null;
        console.log('Self player removed:', actorNr);
    }
}

function setCustomPlayerProperties(actorNr, properties) {
    const actor = client.myRoomActors()[actorNr];
    if (actor) {
        actor.setCustomProperties(properties);
        console.log('Set custom properties for actor:', actorNr, properties);
    }
}
