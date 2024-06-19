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
let enemyBase64Image = '';

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
    constructor(x, y, base64Image) {
        this.x = x;
        this.y = y;
        this.size = 40;
        this.image = loadImage(base64Image);
    }

    display() {
        image(this.image, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
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
        enemies.push(new Enemy(x, y, enemyBase64Image));
    }
}

function mousePressed() {
    target = { x: mouseX, y: mouseY };
}

function mouseReleased() {
    target = null;
    player.update();
}

async function generateEnemyImage(newsArticle, setting) {
    console.log('generateEnemyImage... newsArticle: ', newsArticle);
    const prompt = `Generate an image of an enemy based on the following news article and setting:\n\nTitle: ${newsArticle.title}\nDescription: ${newsArticle.description}\nSetting: ${setting}`;
    const encodedPrompt = encodeURIComponent(prompt);

    try {
        const response = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test/db?prompt=${encodedPrompt}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: prompt, generateImage: true })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        if (data && data.base64_image) {
            console.log('generateEnemyImage... Base64 Image:', data.base64_image);
            return data.base64_image;
        } else {
            throw new Error('No image generated');
        }
    } catch (error) {
        console.error('Error generating enemy image:', error);
        return null;
    }
}


async function fetchNews(personas, setting) {
    const loadingMessage = document.getElementById('loading');
    const newsContainer = document.getElementById('news');

    loadingMessage.style.display = 'block';
    newsContainer.style.display = 'none';

    try {
        const apiUrl = 'https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com';
        const newsEndpoint = '/test';
        const response = await fetch(apiUrl + newsEndpoint);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const jsonData = await response.json();
        
        if (!jsonData) {
            throw new Error('No Data gathered!');
        }

        const bodyData = JSON.parse(jsonData.body);
        
        if (!bodyData) {
            throw new Error('No body found in the response!');
        }

        if (!bodyData.articles) {
            throw new Error('No articles found in the body!');
        }

        const structuredNews = structureNewsData(bodyData.articles.sort(() => 0.5 - Math.random()).slice(0, 1));
        let generatedAIResponses = await generateAIResponses(structuredNews, personas, setting);
        loadingMessage.style.display = 'none';
        newsContainer.style.display = 'block';
        return generatedAIResponses;
    } catch (error) {
        console.error('Error fetching news:', error);
        newsContainer.innerHTML = `<div class="error-message">Error fetching news: ${error.message}</div>`;
        loadingMessage.style.display = 'none';
        newsContainer.style.display = 'block';
        return [];
    }
}

function structureNewsData(articles) {
    return articles.map(article => {
        return {
            title: article.title,
            description: article.description,
            url: article.url
        };
    });
}

async function generateAIResponses(newsData, personas, setting) {
    const newsContainer = document.getElementById('news');
    newsContainer.innerHTML = ''; 
    const responses = [];

    let foundPersonas = [];
    if (personas) {
        if (personas.personas && personas.personas.length && typeof personas.personas == 'object') {
            foundPersonas = personas.personas;
        } else if (personas.length && typeof personas == 'object') {
            foundPersonas = personas;
        } else {
            foundPersonas = ['Bob the Loser', 'John the terrible', 'No Work Terk', 'Jery the dim', 'Jimmy the reclaimer'];
        }
    } else {
        foundPersonas = ['Bob the Loser', 'John the terrible', 'No Work Terk', 'Jery the dim', 'Jimmy the reclaimer'];
    }

    for (let i = 0; i < newsData.length; i++) {
        const news = newsData[i];
        const persona = foundPersonas[i % foundPersonas.length];
        const prompt = `As ${persona.name}, ${persona.description}, As if talking to the player of the game, discuss the following news article:\n\nTitle: ${news.title}\nDescription: ${news.description}, as it pertains to the setting chosen: ${setting}. Be sure to really, REALLY, get into character and blend the article with the setting without revealing ANY Brand names, celebrity names, etc.`;
        const encodedPrompt = encodeURIComponent(prompt);

        try {
            const response = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test?prompt=${encodedPrompt}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: prompt })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const aiResponse = await response.json();
            
            if (aiResponse && aiResponse.choices && aiResponse.choices.length && aiResponse.choices[0] && aiResponse.choices[0].message && aiResponse.choices[0].message.content) {
                const textContent = aiResponse.choices[0].message.content;
                const imgPrompt = `Generate an image of ${persona.name}, ${persona.description} in the setting chosen: ${setting}.`;
                const encodedImgPrompt = encodeURIComponent(imgPrompt);

                try {
                    const imageResponse = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test/db?prompt=${encodedImgPrompt}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt: imgPrompt, generateImage: true })
                    });

                    if (!imageResponse.ok) {
                        throw new Error('Network response was not ok');
                    }

                    const data = await imageResponse.json();
                    const parsedBody = JSON.parse(data.body);
                    if (parsedBody && parsedBody.base64_image) {
                        console.log('generateEnemyImage... parsedBody.base64_image: ', parsedBody.base64_image);
                        responses.push({ response: textContent, persona: persona, imageBase64: parsedBody.base64_image });
                        displayAIResponse(news.title, textContent, persona, parsedBody.base64_image);
                    } else {
                        throw new Error('No image generated');
                    }                } catch (error) {
                    console.error('Error generating AI response:', error);
                    newsContainer.innerHTML += `<div class="error-message">Error generating AI response for article "${news.title}": ${error.message}</div>`;
                }
            }
        } catch (error) {
            console.error('Error generating AI response:', error);
            newsContainer.innerHTML += `<div class="error-message">Error generating AI response for article "${news.title}": ${error.message}</div>`;
        }
    }

    return responses;
}

async function displayAIResponse(newsTitle, aiResponse, persona, imageBase64) {
    const newsContainer = document.getElementById('news');
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';

    const titleElement = document.createElement('h2');
    titleElement.textContent = newsTitle;
    newsItem.appendChild(titleElement);

    const contentElement = document.createElement('p');
    contentElement.textContent = aiResponse;
    newsItem.appendChild(contentElement);

    if (imageBase64) {
        const imageElement = document.createElement('img');
        imageElement.setAttribute("id", "enemyImage");
        imageElement.src = `data:image/png;base64,${imageBase64}`;;
        imageElement.alt = 'Generated image';
        newsItem.appendChild(imageElement);
        enemyBase64Image = imageBase64;
    }

    const personaElement = document.createElement('p');
    personaElement.textContent = `Persona: ${persona.name}`;
    newsItem.appendChild(personaElement);

    newsContainer.appendChild(newsItem);
    spawnEnemies();

}

async function generatePersonas(setting) {
    const prompt = `Generate 5 short (5-10 word) and detailed fictional personas for a ${setting} setting in JSON format. Each persona should have a name and a description.`;
    const encodedPrompt = encodeURIComponent(prompt);
    let parsedPersonas = [];

    try {
        const response = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test?prompt=${encodedPrompt}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: prompt })
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const aiResponse = await response.json();

        if (aiResponse && aiResponse.choices && aiResponse.choices.length && aiResponse.choices[0] && aiResponse.choices[0].message && aiResponse.choices[0].message.content) {
            parsedPersonas = parsePersonas(aiResponse.choices[0].message.content);
        }
    } catch (error) {
        console.error('Error generating AI response:', error);
    }

    return parsedPersonas;
}

function parsePersonas(content) {
    try {
        return JSON.parse(content);
    } catch (error) {
        console.error('Error parsing personas:', error);
        return [];
    }
}

async function imageToBase64(url, callback) {
    let img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() { 
        let canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let dataURL = canvas.toDataURL('image/png');
        callback(dataURL);
    };
    img.onerror = function() {
        console.error('Error loading image');
        callback(null);
    };
    img.src = url;
}

function getBase64Image(imgElementID) {
    console.log('getBase64Image... imgElementID: ', imgElementID);
    const img = document.getElementById(imgElementID);
    if (img) {
        console.log('getBase64Image... img: ', img);
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        console.log('getBase64Image... img.width: ', img.width);
        console.log('getBase64Image... img.height: ', img.height);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, img.width, img.height);
        var dataURL = canvas.toDataURL('image/png');
        console.log('getBase64Image... dataURL: ', dataURL);
        return dataURL;
    } else {
        console.error('No IMG element found!');
        return '';
    }
}

async function robustGetBase64Image(imgElementID) {
    console.log('getBase64Image... imgElementID: ', imgElementID);
    const img = document.getElementById(imgElementID);
    console.log('getBase64Image... img: ', img);

    if (img) {
        // Wait until the image is fully loaded
        return new Promise((resolve, reject) => {
            img.onload = () => {
                var canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth; // Use naturalWidth for correct width
                canvas.height = img.naturalHeight; // Use naturalHeight for correct height
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                var dataURL = canvas.toDataURL();
                console.log('getBase64Image... dataURL: ', dataURL);
                resolve(dataURL);
            };

            img.onerror = () => {
                reject('Error loading image');
            };

            // If the image is already loaded, trigger onload manually
            if (img.complete) {
                img.onload();
            }
        });
    } else {
        console.error('No IMG element found!');
        return 'ERROR';
    }
}
