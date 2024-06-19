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
        if (data && data.data && data.data.length > 0) {
            console.log('generateEnemyImage... data.data[0].url: ', data.data[0].url);
            const imageUrl = data.data[0].url;
            console.log('generateEnemyImage... imageUrl: ', imageUrl);
            return new Promise((resolve) => {
                console.log('generateEnemyImage Resolution...');
                imageToBase64(imageUrl, (base64Image) => {
                    console.log('generateEnemyImage... Base64 Image:', base64Image); // Log the Base64 string for debugging
                    resolve(base64Image);
                });
            });
        } else {
            throw new Error('No image generated');
        }
    } catch (error) {
        console.error('Error generating enemy image:', error);
        return null;
    }
}

function spawnEnemies(scene) {
    console.log('spawnEnemies... ');
    if (newsData.length > 0) {
        const newsArticle = newsData[0]; // Use the first article for the enemy
        console.log('spawnEnemies... Generating new enemy image... ');
        // generateEnemyImage(newsArticle, setting).then(enemyImageBase64 => {
        //     console.log('spawnEnemies... enemyImageBase64: ', enemyImageBase64)
        //     if (enemyImageBase64) {
                const imageKey = 'generatedEnemy';
                scene.textures.addBase64(imageKey, enemyImageBase64);
                for (let i = 0; i < 3; i++) {
                    let x = Phaser.Math.Between(50, 750);
                    let y = Phaser.Math.Between(50, 550);
                    let enemy = scene.enemies.create(x, y, imageKey); // Create enemies using the Base64 image
                    enemy.setCollideWorldBounds(true);
                }
                // Add enemy collisions
                scene.physics.add.collider(scene.player, scene.enemies, scene.startBattle, null, scene);
                scene.physics.add.collider(scene.enemies, scene.trees);
                scene.physics.add.collider(scene.npcs, scene.enemies);
                scene.physics.add.collider(scene.enemies, scene.enemies);
        //     } else {
        //         console.error('Failed to generate enemy image');
        //     }
        // });
    } else {
        console.error('No news data available to generate enemies');
    }
}

async function fetchNews(personas, setting) {
    console.log('fetchNews... personas: ', personas);
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

        // Parsing the stringified JSON data in the body
        const bodyData = JSON.parse(jsonData.body);
        
        if (!bodyData) {
            throw new Error('No body found in the response!');
        }

        if (!bodyData.articles) {
            throw new Error('No articles found in the body!');
        }

        // Limit to 5 articles
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
    console.log('generateAIResponses... newsData: ', newsData);
    console.log('generateAIResponses... personas: ', personas);
    console.log('generateAIResponses... personas.personas: ', personas.personas);
    const newsContainer = document.getElementById('news');
    newsContainer.innerHTML = ''; // Clear previous content
    const responses = [];

    let foundPersonas = [];
    console.log('generateAIResponses... newsData: ', newsData);
    if (personas) {
        console.log('generateAIResponses... personas: ', personas);
        console.log('generateAIResponses... personas.personas: ', personas.personas);
        console.log('generateAIResponses... typeof personas.personas: ', typeof personas.personas);
        console.log('generateAIResponses... typeof personas: ', typeof personas);
        console.log('generateAIResponses... personas.length: ', personas.length);
        if (personas.personas && personas.personas.length && typeof personas.personas == 'object') {
            console.log('foundPersonas = personas.personas...');
            foundPersonas = personas.personas;
        } else if (personas.length && typeof personas == 'object') {
            console.log('foundPersonas = personas...');
            foundPersonas = personas;
        } else {
            // Failsafe
            console.log('Failsafe...');
            foundPersonas = ['Bob the Loser', 'John the terrible', 'No Work Terk', 'Jery the dim', 'Jimmy the reclaimer'];
        }
    } else {
        // MEGA Failsafe
        console.log('Mega Failsafe...');
        foundPersonas = ['Bob the Loser', 'John the terrible', 'No Work Terk', 'Jery the dim', 'Jimmy the reclaimer'];
    }
    console.log('generateAIResponses... foundPersonas: ', foundPersonas);

    for (let i = 0; i < newsData.length; i++) {
        const news = newsData[i];
        console.log('generateAIResponses... looped news: ', news);
        const persona = foundPersonas[i % foundPersonas.length]; // Cycle through personas
        console.log('generateAIResponses... looped persona: ', persona);
        const prompt = `As ${persona.name}, ${persona.description}, As if talking to the player of the game, discuss the following news article:\n\nTitle: ${news.title}\nDescription: ${news.description}, as it pertains to the setting chosen: ${setting}. Be sure to really, REALLY, get into character and blend the article with the setting without revealing ANY Brand names, celebrity names, etc.`;
        console.log('generateAIResponses... looped prompt: ', prompt);
        const encodedPrompt = encodeURIComponent(prompt); // Encoding the prompt

        try {
            const response = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test?prompt=${encodedPrompt}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: prompt })
            })

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const aiResponse = await response.json(); // This converts the response body to JSON
            
            if (aiResponse 
                && aiResponse.choices 
                && aiResponse.choices.length 
                && aiResponse.choices[0] 
                && aiResponse.choices[0].message
                && aiResponse.choices[0].message.content )
                {
                    const textContent = aiResponse.choices[0].message.content;
                    //responses.push({ response: aiResponse.choices[0].message.content, persona: persona });
                    
                    const imgPrompt = `Generate an image of ${persona.name}, ${persona.description} in the setting chosen: ${setting}.`;
                    console.log('generateAIResponses...  imgPrompt: ', imgPrompt);
                    const encodedPrompt = encodeURIComponent(imgPrompt); // Encoding the prompt
            
                    try {
                        const imageResponse  = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test/db?prompt=${encodedPrompt}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ prompt: imgPrompt, generateImage: true  })
                        })
            
                        if (!imageResponse .ok) {
                            throw new Error('Network response was not ok');
                        }
                        
                        const imageAIResponse = await imageResponse.json(); // This converts the response body to JSON
                        
                        if (imageAIResponse 
                            && imageAIResponse.data 
                            && imageAIResponse.data.length 
                            && imageAIResponse.data[0] 
                            && imageAIResponse.data[0].url) 
                            {
                                const imageUrl = imageAIResponse.data[0].url;
                                responses.push({ response: textContent, persona: persona, imageUrl: imageUrl });
                                displayAIResponse(news.title, textContent, persona, imageUrl);
                            }
                    } catch (error) {
                        console.error('Error generating AI response:', error);
                        newsContainer.innerHTML += `<div class="error-message">Error generating AI response for article "${news.title}": ${error.message}</div>`;
                    }
            
                    //displayAIResponse(news.title, aiResponse.choices[0].message.content, persona);
                }
        } catch (error) {
            console.error('Error generating AI response:', error);
            newsContainer.innerHTML += `<div class="error-message">Error generating AI response for article "${news.title}": ${error.message}</div>`;
        }
    }

    console.log('generateAIResponses... returning responses: ', responses);
    return responses;
}

async function displayAIResponse(newsTitle, aiResponse, persona, imageUrl) {
    console.log('displayAIResponse... imageUrl: ', imageUrl);
    const newsContainer = document.getElementById('news');
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';

    const titleElement = document.createElement('h2');
    titleElement.textContent = newsTitle;
    newsItem.appendChild(titleElement);

    const contentElement = document.createElement('p');
    contentElement.textContent = aiResponse;
    newsItem.appendChild(contentElement);

    if (imageUrl) {
        const imageElement = document.createElement('img');
        imageElement.setAttribute("id", "npc_img");
        imageElement.src = imageUrl;
        imageElement.alt = 'Generated image';
        newsItem.appendChild(imageElement);
        enemySpriteUrl = imageUrl;
        console.log('enemySpriteUrl:', enemySpriteUrl);
    }
    
    const personaElement = document.createElement('p');
    personaElement.textContent = `Persona: ${persona.name}`;
    newsItem.appendChild(personaElement);
    
    newsContainer.appendChild(newsItem);
    base64Image = await imageToBase64(imageUrl, (base64Image) => {
        console.log('generateEnemyImage... Base64 Image:', base64Image); // Log the Base64 string for debugging
        resolve(base64Image);
    });;
    console.log('base64Image:', base64Image);
}

async function generatePersonas(setting) {
    console.log('generatePersonas... setting: ', setting);
    const prompt = `Generate 5 short (5-10 word) and detailed fictional personas for a ${setting} setting in JSON format. Each persona should have a name and a description.`;
    const encodedPrompt = encodeURIComponent(prompt); // Encoding the prompt
    let parsedPersonas = [];

    try {
        const response = await fetch(`https://bjvbrhjov8.execute-api.us-east-2.amazonaws.com/test?prompt=${encodedPrompt}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: prompt })
        })
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const aiResponse = await response.json(); // This converts the response body to JSON

        if (aiResponse 
            && aiResponse.choices 
            && aiResponse.choices.length 
            && aiResponse.choices[0] 
            && aiResponse.choices[0].message
            && aiResponse.choices[0].message.content )
            {
                parsedPersonas = parsePersonas(aiResponse.choices[0].message.content);
            }
    } catch (error) {
        console.error('Error generating AI response:', error);
        newsContainer.innerHTML += `<div class="error-message">Error generating AI response for article "${news.title}": ${error.message}</div>`;
    }

    console.log('generatePersonas... Returning parsedPersonas: ', parsedPersonas);
    return parsedPersonas;
}

function parsePersonas(content) {
    console.log('parsePersonas... content: ', content);
    try {
        console.log('parsePersonas... JSON.parse(content) ', JSON.parse(content));
        return JSON.parse(content);
    } catch (error) {
        console.error('Error parsing personas:', error);
        return [];
    }
}

function toDataUrl(url, callback) {
    console.log('toDataUrl...');
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        console.log('onload...');
        var reader = new FileReader();
        reader.onloadend = function() {
            console.log('onloadend...');
            callback(reader.result);
        }
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
    console.log('toDataUrl Complete...');
}

async function imageUrlToBase64(url) {
    console.log('imageUrlToBase64... url: ', url);
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve, reject) => {
        console.log('Promise...');
        const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        console.log('onloadend... reader.result: ', reader.result);
        const base64data = reader.result;
        resolve(base64data);
      };
      reader.onerror = reject;
    });
  };
  
  function getBase64Image(imgElementID) {
    console.log('getBase64Image... imgElementID: ', imgElementID);
    const img = document.getElementById(imgElementID);
    console.log('getBase64Image... img: ', img);
    if (img) {

        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        var dataURL = canvas.toDataURL();
        console.log('getBase64Image... dataURL: ', dataURL);
        
        return dataURL;
    } else {
        console.error('No IMG element found!');
        return 'ERROR';
    }
}

async function fetchImageAsBase64(url) {
    console.log('fetchImageAsBase64... url: ', url);
    const response = await fetch(url);
    console.log('fetchImageAsBase64... response: ', response);
    const blob = await response.blob();
    console.log('fetchImageAsBase64... blob: ', blob);
    return new Promise((resolve, reject) => {
        console.log('fetchImageAsBase64 Promise... ');
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function imageToBase64(url, callback) {
    console.log('imageToBase64... url: ', url);
    console.log('imageToBase64... callback: ', callback);
    let img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
        console.log('onload...'); 
        let canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let dataURL = canvas.toDataURL('image/png');
        console.log('imageToBase64... Calling back with dataURL: ', dataURL);
        callback(dataURL);
    };
    img.onerror = function() {
        console.error('Error loading image');
        callback(null);
    };
    img.src = url;
}