let player;
let enemies = [];
let npcs = [];
let trees = [];
let health = 100;
let target = null;
let newsData = [];
let setting = '';
let base64Image = '';
let gameState = 'exploration';

function preload() {
    // Load your assets here
}

function setup() {
    createCanvas(800, 600);
    setting = prompt("Enter a setting for the game (e.g., Medieval, Futuristic, etc.):");
    player = new Player(400, 300);
    generatePersonas(setting).then(personas => {
        fetchNews(personas, setting).then(news => {
            newsData = news;
            for (let i = 0; i < 5; i++) {
                let x = random(50, 750);
                let y = random(50, 550);
                npcs.push(new NPC(x, y, personas[i % personas.length]));
            }
            spawnEnemies();
        });
    });
}

function draw() {
    background(0);

    if (gameState === 'exploration') {
        drawExploration();
    } else if (gameState === 'battle') {
        drawBattle();
    }
}

function drawExploration() {
    player.display();
    player.update();

    for (let tree of trees) {
        tree.display();
    }

    for (let npc of npcs) {
        npc.display();
    }

    for (let enemy of enemies) {
        enemy.display();
        enemy.moveTowards(player);
        if (enemy.collidesWith(player)) {
            startBattle(player, enemy);
        }
    }

    fill(255);
    textSize(32);
    text(`Health: ${health}`, 16, 40);
}

function drawBattle() {
    // Draw battle scene
}

function startBattle(player, enemy) {
    gameState = 'battle';
    // Initialize battle variables here
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 40;
    }

    display() {
        fill(0, 255, 0);
        ellipse(this.x, this.y, this.size, this.size);
    }

    update() {
        if (target) {
            let angle = atan2(target.y - this.y, target.x - this.x);
            this.x += cos(angle) * 2;
            this.y += sin(angle) * 2;
        }
    }
}

class NPC {
    constructor(x, y, persona) {
        this.x = x;
        this.y = y;
        this.persona = persona;
        this.size = 40;
    }

    display() {
        fill(0, 0, 255);
        ellipse(this.x, this.y, this.size, this.size);
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 40;
    }

    display() {
        fill(255, 0, 0);
        ellipse(this.x, this.y, this.size, this.size);
    }

    moveTowards(player) {
        let angle = atan2(player.y - this.y, player.x - this.x);
        this.x += cos(angle) * 1;
        this.y += sin(angle) * 1;
    }

    collidesWith(player) {
        let d = dist(this.x, this.y, player.x, player.y);
        return d < (this.size + player.size) / 2;
    }
}

function spawnEnemies() {
    for (let i = 0; i < 3; i++) {
        let x = random(50, 750);
        let y = random(50, 550);
        enemies.push(new Enemy(x, y));
    }
}

function mousePressed() {
    target = { x: mouseX, y: mouseY };
}

function mouseReleased() {
    target = null;
    player.update();
}

async function generatePersonas(setting) {
    const prompt = `Generate 5 short (5-10 word) and detailed fictional personas for a ${setting} setting in JSON format. Each persona should have a name and a description.`;
    const response = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test?prompt=${encodeURIComponent(prompt)}`);
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

async function fetchNews(personas, setting) {
    const response = await fetch('https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test');
    const data = await response.json();
    const articles = JSON.parse(data.body).articles.slice(0, 5);
    let newsData = structureNewsData(articles);
    return await generateAIResponses(newsData, personas, setting);
}

function structureNewsData(articles) {
    return articles.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url
    }));
}

async function generateAIResponses(newsData, personas, setting) {
    let responses = [];
    for (let i = 0; i < newsData.length; i++) {
        const news = newsData[i];
        const persona = personas[i % personas.length];
        const prompt = `As ${persona.name}, ${persona.description}, discuss the following news article: Title: ${news.title} Description: ${news.description} in the setting chosen: ${setting}.`;
        const response = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test?prompt=${encodeURIComponent(prompt)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        });
        const aiResponse = await response.json();
        if (aiResponse.choices && aiResponse.choices.length > 0) {
            responses.push({ response: aiResponse.choices[0].message.content, persona: persona });
        }
    }
    return responses;
}
