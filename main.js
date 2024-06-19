let scene, camera, renderer, player, healthText;
let health = 100;
let target = null;
let npcs = [];
let trees = [];
let enemies = [];
let enemyTexture;

init();
animate();

function init() {
    scene = new THREE.Scene();

    // Camera setup
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(
        -aspectRatio, aspectRatio, 1, -1, 0.1, 1000
    );
    camera.position.set(0, 0, 10);

    // Renderer setup
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Load textures
    const loader = new THREE.TextureLoader();
    const playerTexture = loader.load('assets/player.png');
    const treeTexture = loader.load('assets/tree.png');
    const npcTexture = loader.load('assets/npc.png');
    enemyTexture = loader.load('assets/enemy.png'); // Assuming a default enemy image

    // Create player
    const playerGeometry = new THREE.PlaneGeometry(0.2, 0.2);
    const playerMaterial = new THREE.MeshBasicMaterial({ map: playerTexture });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 0, 0);
    scene.add(player);

    // Create NPCs
    for (let i = 0; i < 5; i++) {
        let x = THREE.MathUtils.randFloatSpread(1.5);
        let y = THREE.MathUtils.randFloatSpread(1.5);
        const npcGeometry = new THREE.PlaneGeometry(0.2, 0.2);
        const npcMaterial = new THREE.MeshBasicMaterial({ map: npcTexture });
        const npc = new THREE.Mesh(npcGeometry, npcMaterial);
        npc.position.set(x, y, 0);
        scene.add(npc);
        npcs.push(npc);
    }

    // Create trees
    for (let i = 0; i < 10; i++) {
        let x = THREE.MathUtils.randFloatSpread(1.5);
        let y = THREE.MathUtils.randFloatSpread(1.5);
        const treeGeometry = new THREE.PlaneGeometry(0.2, 0.2);
        const treeMaterial = new THREE.MeshBasicMaterial({ map: treeTexture });
        const tree = new THREE.Mesh(treeGeometry, treeMaterial);
        tree.position.set(x, y, 0);
        scene.add(tree);
        trees.push(tree);
    }

    // Health HUD
    healthText = document.createElement('div');
    healthText.style.position = 'absolute';
    healthText.style.top = '10px';
    healthText.style.left = '10px';
    healthText.style.color = 'white';
    healthText.style.fontSize = '32px';
    healthText.innerHTML = 'Health: 100';
    document.body.appendChild(healthText);

    // Input handling
    document.addEventListener('pointerdown', (event) => {
        target = { x: (event.clientX / window.innerWidth) * 2 - 1, y: -(event.clientY / window.innerHeight) * 2 + 1 };
    });

    document.addEventListener('pointerup', () => {
        target = null;
    });

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    // Prompt for setting and fetch news
    async function startGame() {
        const setting = prompt("Enter a setting for the game (e.g., Medieval, Futuristic, etc.):");
        const personas = await generatePersonas(setting);
        const newsData = await fetchNews(personas, setting);
        for (let i = 0; i < npcs.length; i++) {
            let persona = personas[i % personas.length];
            npcs[i].userData = {
                persona: persona,
                newsText: newsData[i % newsData.length].description
            };
        }
        spawnEnemies();
    }

    startGame();
}

function onWindowResize() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera.left = -aspectRatio;
    camera.right = aspectRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

function update() {
    if (target) {
        const targetPosition = new THREE.Vector3(target.x, target.y, 0);
        player.position.lerp(targetPosition, 0.1);
    }

    for (let enemy of enemies) {
        const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
        enemy.position.add(direction.multiplyScalar(0.01));
    }

    // Collision detection
    for (let npc of npcs) {
        if (player.position.distanceTo(npc.position) < 0.2) {
            alert(`${npc.userData.persona.name}: ${npc.userData.newsText}`);
        }
    }

    for (let enemy of enemies) {
        if (player.position.distanceTo(enemy.position) < 0.2) {
            takeDamage();
        }
    }
}

function takeDamage() {
    health -= 0.1;
    healthText.innerHTML = 'Health: ' + Math.max(Math.round(health), 0);
    if (health <= 0) {
        alert('Game Over');
        window.location.reload();
    }
}

function spawnEnemies() {
    for (let i = 0; i < 3; i++) {
        let x = THREE.MathUtils.randFloatSpread(1.5);
        let y = THREE.MathUtils.randFloatSpread(1.5);
        const enemyGeometry = new THREE.PlaneGeometry(0.2, 0.2);
        const enemyMaterial = new THREE.MeshBasicMaterial({ map: enemyTexture });
        const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
        enemy.position.set(x, y, 0);
        scene.add(enemy);
        enemies.push(enemy);
    }
}

async function generatePersonas(setting) {
    const prompt = `Generate 5 short (5-10 word) and detailed fictional personas for a ${setting} setting in JSON format. Each persona should have a name and a description.`;
    const response = await fetch(`https://example.com/generatePersonas?prompt=${encodeURIComponent(prompt)}`);
    const data = await response.json();
    return JSON.parse(data);
}

async function fetchNews(personas, setting) {
    const response = await fetch(`https://example.com/fetchNews?personas=${encodeURIComponent(JSON.stringify(personas))}&setting=${encodeURIComponent(setting)}`);
    const data = await response.json();
    return JSON.parse(data);
}
