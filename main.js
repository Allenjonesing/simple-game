const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);
let player;
let otherPlayers = {};
let enemies = [];
let projectiles = [];
let cursors;
let client;
let scoreText;
let timeText;
let score = 0;
let timeSurvived = 0;
let isHost = false;
const disconnectionTimeout = 5000;
let disconnectTimeouts = {};

function preload() {
    this.load.image('player', 'assets/playerShip.png');
    this.load.image('enemy1', 'assets/enemy1.png');
    this.load.image('enemy2', 'assets/enemy2.png');
    this.load.image('enemy3', 'assets/enemy3.png');
}

function create() {
    const scene = this;

    client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, "fdd578f2-f3c3-4089-bcda-f34576e0b095", "1.0");

    client.onStateChange = function(state) {
        console.log("State:", state);
    };

    client.onEvent = function(code, content, actorNr) {
        if (code === 1) {
            if (content.type === 'playerMove') {
                if (!otherPlayers[content.playerId]) {
                    otherPlayers[content.playerId] = createOtherPlayer(content.x, content.y, scene);
                } else {
                    otherPlayers[content.playerId].setPosition(content.x, content.y);
                }
            } else if (content.type === 'spawnEnemy') {
                spawnEnemyAt(content.x, content.y, content.enemyType, scene);
            } else if (content.type === 'fireProjectile') {
                fireProjectileAt(content.x, content.y, scene);
            } else if (content.type === 'syncState') {
                syncGameState(content.state, scene);
            }
        }
    };
        
    client.onJoinRoom = function() {
        player = createPlayer(scene);
        client.raiseEvent(1, { type: 'playerMove', playerId: player.id, x: player.x, y: player.y });
    
        if (client.myActor().actorNr === client.myRoom().masterClientId) {
            isHost = true;
            console.log("You are the host.");
        }
    };
    
    client.onLeaveRoom = function() {
        removePlayer(client.myActor().actorNr);
    };
    
    client.onPlayerLeftRoom = function(player) {
        schedulePlayerRemoval(player.actorNr);
    };
    
    client.onPlayerDisconnected = function(player) {
        schedulePlayerRemoval(player.actorNr);
    };

    client.onError = function(errorCode, errorMsg) {
        console.log(`Error: ${errorCode} - ${errorMsg}`);
    };

    client.onRoomListUpdate = function(rooms) {
        if (rooms.length === 0) {
            createRoom();
        } else {
            client.joinRandomRoom();
        }
    };

    client.onRoomList = function(rooms) {
        if (rooms.length === 0) {
            createRoom();
        } else {
            client.joinRandomRoom();
        }
    };

    client.onJoinRoomFailed = function(errorCode, errorMsg) {
        createRoom();
    };

    client.onConnectedToMaster = function() {
        client.joinLobby();
    };

    function createRoom() {
        const roomOptions = {
            isVisible: true,
            isOpen: true,
            maxPlayers: 10,
            playerTtl: 60000
        };
        client.createRoom(`room_${Math.floor(Math.random() * 10000)}`, roomOptions);
    }

    client.connectToRegionMaster("us");

    cursors = this.input.keyboard.createCursorKeys();

    scoreText = this.add.text(10, 10, 'Score: 0', { font: '16px Arial', fill: '#ffffff' });
    timeText = this.add.text(10, 30, 'Time: 0', { font: '16px Arial', fill: '#ffffff' });
    this.time.addEvent({
        delay: 1000,
        callback: updateTime,
        callbackScope: this,
        loop: true
    });

    this.time.addEvent({
        delay: 1000,
        callback: hostSpawnEnemy,
        callbackScope: this,
        loop: true
    });

    this.time.addEvent({
        delay: 300,
        callback: autoFire,
        callbackScope: this,
        loop: true
    });

    this.time.addEvent({
        delay: 1000,
        callback: syncGameStateToClients,
        callbackScope: this,
        loop: true
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

        client.raiseEvent(1, { type: 'playerMove', playerId: player.id, x: player.x, y: player.y });
    }

    updateEnemies();
    updateProjectiles();
}

function autoFire() {
    if (player) {
        const x = player.x;
        const y = player.y - 20;
        fireProjectile(x, y);
        client.raiseEvent(1, { type: 'fireProjectile', x: x, y: y });
    }
}

function fireProjectile(x, y) {
    const scene = game.scene.scenes[0];
    const projectile = scene.add.circle(x, y, 5, 0x0000ff);
    projectile.speed = 5;
    projectiles.push(projectile);
}

function fireProjectileAt(x, y, scene) {
    const projectile = scene.add.circle(x, y, 5, 0x0000ff);
    projectile.speed = 5;
    projectiles.push(projectile);
}

function fireProjectileAt(x, y, scene) {
    const projectile = scene.add.circle(x, y, 5, 0x0000ff);
    projectile.speed = 5;
    projectiles.push(projectile);
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy) {
            enemy.y += enemy.speed;
            if (enemy.y > game.config.height) {
                enemy.destroy();
                enemies.splice(i, 1);
            }
        }
    }
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        if (projectile) {
            projectile.y -= projectile.speed;
            if (projectile.y < 0) {
                projectile.destroy();
                projectiles.splice(i, 1);
            }
        }
    }
}

function hitEnemy(enemy, projectile) {
    enemy.destroy();
    projectile.destroy();
    score += 10;
    scoreText.setText('Score: ' + score);
}

function updateTime() {
    timeSurvived += 1;
    timeText.setText('Time: ' + timeSurvived);
}

function hostSpawnEnemy() {
    if (isHost) {
        const x = Phaser.Math.Between(0, game.config.width);
        const y = 0;
        const enemyType = Phaser.Math.Between(1, 3);
        const enemy = spawnEnemyAt(x, y, enemyType);
        client.raiseEvent(1, { type: 'spawnEnemy', x: x, y: y, enemyType: enemyType });
    }
}

function syncGameStateToClients() {
    if (isHost) {
        const gameState = {
            enemies: enemies.map(enemy => ({ x: enemy.x, y: enemy.y, type: enemy.texture.key })),
            projectiles: projectiles.map(proj => ({ x: proj.x, y: proj.y })),
            score,
            timeSurvived
        };
        client.raiseEvent(1, { type: 'syncState', state: gameState });
    }
}

function syncGameState(state, scene) {
    enemies.forEach(enemy => enemy.destroy());
    projectiles.forEach(proj => proj.destroy());

    enemies = state.enemies.map(e => spawnEnemyAt(e.x, e.y, e.type, scene));
    projectiles = state.projectiles.map(p => fireProjectileAt(p.x, p.y, scene));
    score = state.score;
    timeSurvived = state.timeSurvived;

    scoreText.setText('Score: ' + score);
    timeText.setText('Time: ' + timeSurvived);
}

function createPlayer(scene) {
    const playerSprite = scene.add.image(game.config.width / 2, game.config.height - 50, 'player').setScale(0.1);
    playerSprite.id = client.myActor().actorNr;
    return playerSprite;
}

function createOtherPlayer(x, y, scene) {
    const otherPlayerSprite = scene.add.image(x, y, 'player').setScale(0.1);
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
    } else if (player && player.id === actorNr) {
        player.destroy();
        player = null;
    }
}

function setupPhotonClient(scene) {
    client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, "fdd578f2-f3c3-4089-bcda-f34576e0b095", "1.0");

    client.onStateChange = function (state) {
        console.log("State:", state);
    };

    client.onEvent = function (code, content, actorNr) {
        if (code === 1) {
            if (content.type === 'playerMove') {
                if (!otherPlayers[content.playerId]) {
                    otherPlayers[content.playerId] = createOtherPlayer(content.x, content.y, scene);
                } else {
                    otherPlayers[content.playerId].setPosition(content.x, content.y);
                }
            } else if (content.type === 'spawnEnemy') {
                spawnEnemyAt(content.x, content.y, content.enemyType, scene);
            } else if (content.type === 'fireProjectile') {
                fireProjectileAt(content.x, content.y, scene);
            } else if (content.type === 'syncState') {
                syncGameState(content.state, scene);
            }
        }
    };

    client.onJoinRoom = function () {
        player = createPlayer(scene);
        client.raiseEvent(1, { type: 'playerMove', playerId: player.id, x: player.x, y: player.y });

        if (client.myActor().actorNr === client.myRoom().masterClientId) {
            isHost = true;
            console.log("You are the host.");
        }
    };

    client.onLeaveRoom = function () {
        removePlayer(client.myActor().actorNr);
    };

    client.onPlayerLeftRoom = function (player) {
        schedulePlayerRemoval(player.actorNr);
    };

    client.onPlayerDisconnected = function (player) {
        schedulePlayerRemoval(player.actorNr);
    };

    client.onError = function (errorCode, errorMsg) {
        console.log(`Error: ${errorCode} - ${errorMsg}`);
    };

    client.onRoomListUpdate = function (rooms) {
        if (rooms.length === 0) {
            createRoom();
        } else {
            client.joinRandomRoom();
        }
    };

    client.onRoomList = function (rooms) {
        if (rooms.length === 0) {
            createRoom();
        } else {
            client.joinRandomRoom();
        }
    };

    client.onJoinRoomFailed = function (errorCode, errorMsg) {
        createRoom();
    };

    client.onConnectedToMaster = function () {
        client.joinLobby();
    };

    function createRoom() {
        const roomOptions = {
            isVisible: true,
            isOpen: true,
            maxPlayers: 10,
            playerTtl: 60000
        };
        client.createRoom(`room_${Math.floor(Math.random() * 10000)}`, roomOptions);
    }

    client.connectToRegionMaster("us");
}
