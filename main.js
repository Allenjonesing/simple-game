// Create the scene
const scene = new THREE.Scene();

// Create an orthographic camera
const aspectRatio = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -aspectRatio, aspectRatio, 1, -1, 0.1, 1000
);
camera.position.set(0, 0, 10);

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a simple square plane as the player
const playerGeometry = new THREE.PlaneGeometry(0.2, 0.2);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 0, 0);
scene.add(player);

// Handle player movement
const moveSpeed = 0.05;
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowUp':
      player.position.y += moveSpeed;
      break;
    case 'ArrowDown':
      player.position.y -= moveSpeed;
      break;
    case 'ArrowLeft':
      player.position.x -= moveSpeed;
      break;
    case 'ArrowRight':
      player.position.x += moveSpeed;
      break;
  }
});

// Create a simple background
const backgroundGeometry = new THREE.PlaneGeometry(2, 2);
const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
background.position.set(0, 0, -0.1);
scene.add(background);

// Render loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  const aspectRatio = window.innerWidth / window.innerHeight;
  camera.left = -aspectRatio;
  camera.right = aspectRatio;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
