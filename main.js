const { Engine, Render, Runner, Bodies, World, Body, Events } = Matter;

const canvas = document.getElementById('gameCanvas');

const engine = Engine.create();
const world = engine.world;

const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent'
    }
});

Render.run(render);
Runner.run(Runner.create(), engine);

const player = Bodies.rectangle(50, window.innerHeight - 100, 50, 50, { 
    render: { fillStyle: 'red' }, 
    inertia: Infinity 
});
World.add(world, player);

const platforms = [
    Bodies.rectangle(200, window.innerHeight - 200, 400, 20, { 
        isStatic: true, 
        render: { fillStyle: 'gray' }
    }),
    Bodies.rectangle(600, window.innerHeight - 300, 400, 20, { 
        isStatic: true, 
        render: { fillStyle: 'gray' }
    }),
    Bodies.rectangle(1000, window.innerHeight - 400, 400, 20, { 
        isStatic: true, 
        render: { fillStyle: 'gray' }
    })
];
World.add(world, platforms);

const boxes = [
    Bodies.rectangle(150, window.innerHeight - 250, 50, 50, { render: { fillStyle: 'blue' } }),
    Bodies.rectangle(250, window.innerHeight - 300, 50, 50, { render: { fillStyle: 'blue' } }),
    Bodies.rectangle(350, window.innerHeight - 350, 50, 50, { render: { fillStyle: 'blue' } })
];
World.add(world, boxes);

const rockets = [];
const particles = [];

function createParticles(x, y) {
    for (let i = 0; i < 50; i++) {
        const particle = Bodies.circle(x, y, Math.random() * 5 + 2, {
            render: { fillStyle: `rgba(255, 165, 0, 0.5)` },
            isSensor: true,
            frictionAir: 0.05
        });
        Body.setVelocity(particle, { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 });
        particles.push(particle);
        World.add(world, particle);
    }
}

function updateParticles() {
    particles.forEach((particle, index) => {
        particle.render.fillStyle = `rgba(255, 165, 0, ${parseFloat(particle.render.fillStyle.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*(\d+(?:\.\d+)?)/)[1]) - 0.02})`;
        if (parseFloat(particle.render.fillStyle.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*(\d+(?:\.\d+)?)/)[1]) <= 0) {
            World.remove(world, particle);
            particles.splice(index, 1);
        }
    });
}

Events.on(engine, 'afterUpdate', updateParticles);

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') {
        Body.setVelocity(player, { x: 5, y: player.velocity.y });
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        Body.setVelocity(player, { x: -5, y: player.velocity.y });
    } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        Body.setVelocity(player, { x: player.velocity.x, y: -5 });
    }
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    shootRocket(mouseX, mouseY);
});

function shootRocket(targetX, targetY) {
    if (!player.canShoot) return;
    player.canShoot = false;
    setTimeout(() => player.canShoot = true, 500); // 0.5 seconds cooldown

    const angle = Math.atan2(targetY - player.position.y, targetX - player.position.x);
    const speed = 10;

    const rocket = Bodies.rectangle(player.position.x, player.position.y, 10, 5, { render: { fillStyle: 'orange' } });
    Body.setVelocity(rocket, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    rockets.push(rocket);
    World.add(world, rocket);

    Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach(pair => {
            if (pair.bodyA === rocket || pair.bodyB === rocket) {
                createExplosion(rocket.position.x, rocket.position.y);
                World.remove(world, rocket);
                rockets.splice(rockets.indexOf(rocket), 1);
            }
        });
    });
}

function createExplosion(x, y) {
    createParticles(x, y);
    boxes.forEach(box => {
        const distX = box.position.x - x;
        const distY = box.position.y - y;
        const distance = Math.sqrt(distX * distX + distY * distY);
        const force = 10 / (distance + 1);

        Body.applyForce(box, box.position, { x: distX * force, y: distY * force });
    });
}

Engine.run(engine);
Render.run(render);
