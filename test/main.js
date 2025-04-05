// Game variables
let scene, camera, renderer, playerShip, clock;
let enemies = [];
let projectiles = [];
let environmentalElements = [];
let debris = [];
let powerUps = [];
let score = 0;
let health = 100;
let gameRunning = false;
let gameOver = false;
let models = {};
let gameTime = 0;
let difficultyLevel = 1;

// Constants
const PLAYER_SPEED = 30; // Reduced speed to match smaller map
const PROJECTILE_SPEED = 100;
const ENEMY_SPEED_BASE = 12; // Slightly reduced speed for balance
const ENEMY_SPAWN_INTERVAL_BASE = 5000; // milliseconds
const ENVIRONMENT_SPAWN_RADIUS = 80; // More compact map
const ENVIRONMENT_ELEMENT_COUNT = 20; // Fewer elements for less clutter
const POWER_UP_TYPES = ['laser', 'rapidFire', 'shield', 'healthBoost'];
const POWER_UP_DURATION = 15000; // 15 seconds
const POWER_UP_SPAWN_CHANCE = 0.2; // 20% chance per enemy killed

// Power-up active flags
let activePowerUps = {
    laser: false,
    rapidFire: false,
    shield: false
};

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Create camera
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 120, 150); // Raised and moved back for better view of the larger models
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas').appendChild(renderer.domElement);
    
    // Create clock for timing
    clock = new THREE.Clock();
    
    // Create lighting
    createLighting();
    
    // Create water
    createWater();
    
    // Load models
    loadModels().then(() => {
        // Create player ship
        createPlayerShip();
        
        // Create environmental elements
        createEnvironment();
        
        // Add event listeners
        setupEventListeners();
        
        // Show start menu
        document.getElementById('start-menu').classList.remove('hidden');
    });
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
}

// Function to start the game
function startGame() {
    document.getElementById('start-menu').classList.add('hidden');
    gameRunning = true;
    gameOver = false;
    score = 0;
    health = 100;
    gameTime = 0;
    difficultyLevel = 1;
    
    // Clear any existing enemies, projectiles, etc.
    enemies.forEach(enemy => scene.remove(enemy.model));
    projectiles.forEach(proj => scene.remove(proj.model));
    debris.forEach(deb => scene.remove(deb.model));
    
    enemies = [];
    projectiles = [];
    debris = [];
    powerUps = [];
    
    // Reset power-ups
    activePowerUps = {
        laser: false,
        rapidFire: false,
        shield: false
    };
    
    // Update UI
    updateScore();
    updateHealth();
    
    // Start the game loop
    animate();
}

// Create lighting for the scene
function createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
}

// Create water surface
function createWater() {
    const waterGeometry = new THREE.PlaneGeometry(1000, 1000); // Smaller water plane for more compact map
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x0077be,
        metalness: 0.1,
        roughness: 0.2,
        transparent: true,
        opacity: 0.8
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1;
    water.receiveShadow = true;
    scene.add(water);
}

// Load all models
async function loadModels() {
    const loader = new THREE.GLTFLoader();
    
    const modelList = [
        'ship-small', 'ship-medium', 'ship-large', // Player ships
        'ship-pirate-small', 'ship-pirate-medium', 'ship-pirate-large', 'ship-ghost', // Enemy ships
        'cannon', 'cannon-ball', // Weapons
        'barrel', 'crate', 'chest', // Destructible elements
        'rocks-a', 'rocks-b', 'rocks-c', 'rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c', // Environmental elements
        'palm-straight', 'palm-bend', 'grass-patch', 'patch-sand', // More environment
        'flag', 'flag-pirate' // Flags
    ];
    
    const promises = modelList.map(modelName => {
        return new Promise((resolve, reject) => {
            loader.load(`Models/${modelName}.glb`, (gltf) => {
                models[modelName] = gltf.scene.clone();
                resolve();
            }, undefined, reject);
        });
    });
    
    return Promise.all(promises);
}

// Create player ship
function createPlayerShip() {
    playerShip = {
        model: models['ship-medium'].clone(),
        speed: PLAYER_SPEED,
        health: 100,
        canShoot: true,
        shootCooldown: 500, // Reduced from 1000ms to 500ms for more responsive shooting
        lastShot: 0
    };
    
    playerShip.model.scale.set(2.5, 2.5, 2.5); // MUCH bigger model (increased from 1.0)
    playerShip.model.position.set(0, 0, 0);
    playerShip.model.rotation.y = Math.PI; // Face forward
    playerShip.model.castShadow = true;
    scene.add(playerShip.model);
    
    // Add cannons to the player ship
    const leftCannon = models['cannon'].clone();
    leftCannon.scale.set(1.2, 1.2, 1.2); // MUCH bigger cannons
    leftCannon.position.set(-6, 6, 0); // Adjusted position for larger ship
    playerShip.model.add(leftCannon);
    
    const rightCannon = models['cannon'].clone();
    rightCannon.scale.set(1.2, 1.2, 1.2); // MUCH bigger cannons
    rightCannon.position.set(6, 6, 0); // Adjusted position for larger ship
    playerShip.model.add(rightCannon);
    
    // Add the player's flag
    const flag = models['flag'].clone();
    flag.scale.set(2.0, 2.0, 2.0); // MUCH bigger flag
    flag.position.set(0, 18, 0); // Adjusted position for larger ship
    playerShip.model.add(flag);
}

// Create environmental elements
function createEnvironment() {
    const environmentModels = [
        'rocks-a', 'rocks-b', 'rocks-c', 'rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c',
        'palm-straight', 'palm-bend', 'barrel', 'crate', 'chest'
    ];
    
    for (let i = 0; i < ENVIRONMENT_ELEMENT_COUNT; i++) {
        const modelName = environmentModels[Math.floor(Math.random() * environmentModels.length)];
        const element = {
            model: models[modelName].clone(),
            type: modelName,
            health: modelName.includes('rocks') ? 50 : 20, // Rocks are harder to destroy
            isDestructible: true
        };
        
        // Random position around the map (but not too close to player)
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * ENVIRONMENT_SPAWN_RADIUS; // Closer to center
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        element.model.position.set(x, 0, z);
        element.model.rotation.y = Math.random() * Math.PI * 2;
        element.model.scale.set(2.5, 2.5, 2.5); // MUCH bigger environmental elements
        element.model.castShadow = true;
        element.model.receiveShadow = true;
        
        scene.add(element.model);
        environmentalElements.push(element);
    }
}

// Set up event listeners
function setupEventListeners() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', startGame);
}

// Handle key down events
const keysPressed = {};
function handleKeyDown(event) {
    keysPressed[event.key.toLowerCase()] = true;
}

// Handle key up events
function handleKeyUp(event) {
    keysPressed[event.key.toLowerCase()] = false;
}

// Handle mouse down events (shooting)
function handleMouseDown(event) {
    if (!gameRunning || gameOver) return;
    
    // Shoot immediately when clicked
    shootCannon();
    
    // For more rapid shooting while mouse is held down
    if (!window.mouseHoldInterval) {
        window.mouseHoldInterval = setInterval(() => {
            if (activePowerUps.rapidFire) {
                shootCannon(); // Shoot multiple times when rapid fire is active
            }
        }, 100);
        
        // Add a mouse up listener to clear the interval
        const clearMouseInterval = () => {
            if (window.mouseHoldInterval) {
                clearInterval(window.mouseHoldInterval);
                window.mouseHoldInterval = null;
            }
            window.removeEventListener('mouseup', clearMouseInterval);
        };
        
        window.addEventListener('mouseup', clearMouseInterval);
    }
}

// Shoot cannon function
function shootCannon() {
    if (!playerShip.canShoot) return;
    
    const now = Date.now();
    if (now - playerShip.lastShot < playerShip.shootCooldown && !activePowerUps.rapidFire) return;
    
    playerShip.lastShot = now;
    
    // Create projectile (cannon ball)
    const projectile = {
        model: models['cannon-ball'].clone(),
        velocity: new THREE.Vector3(0, 0, -PROJECTILE_SPEED), // Forward direction
        isPlayerProjectile: true,
        damage: activePowerUps.laser ? 30 : 10
    };
    
    projectile.model.scale.set(1.5, 1.5, 1.5); // MUCH bigger projectiles
    
    // Position projectile at the front of the ship
    projectile.model.position.copy(playerShip.model.position);
    projectile.model.position.z -= 12; // Increased offset to front of larger ship
    projectile.model.position.y += 5; // Increased height offset for larger ship
    
    // Change projectile appearance if laser power-up is active
    if (activePowerUps.laser) {
        const laserGeometry = new THREE.CylinderGeometry(1.0, 1.0, 40, 8); // MUCH bigger, longer laser
        const laserMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.7
        });
        projectile.model = new THREE.Mesh(laserGeometry, laserMaterial);
        projectile.model.rotation.x = Math.PI / 2; // Align with forward direction
        projectile.model.position.copy(playerShip.model.position);
        projectile.model.position.z -= 12; // Increased offset for larger ship
        projectile.model.position.y += 5; // Increased height for larger ship
    }
    
    scene.add(projectile.model);
    projectiles.push(projectile);
}

// Update player movement
function updatePlayerMovement(deltaTime) {
    if (!gameRunning || gameOver) return;
    
    const moveSpeed = playerShip.speed * deltaTime;
    
    if (keysPressed['w']) {
        playerShip.model.position.z -= moveSpeed;
    }
    if (keysPressed['s']) {
        playerShip.model.position.z += moveSpeed;
    }
    if (keysPressed['a']) {
        playerShip.model.position.x -= moveSpeed;
        playerShip.model.rotation.y = Math.PI + 0.3; // Slight turn for visual feedback
    } else if (keysPressed['d']) {
        playerShip.model.position.x += moveSpeed;
        playerShip.model.rotation.y = Math.PI - 0.3; // Slight turn for visual feedback
    } else {
        playerShip.model.rotation.y = Math.PI; // Reset rotation when not turning
    }
    
    // Keep player within bounds - smaller area for more compact map
    const BOUNDS = 100;
    playerShip.model.position.x = Math.max(-BOUNDS, Math.min(BOUNDS, playerShip.model.position.x));
    playerShip.model.position.z = Math.max(-BOUNDS, Math.min(BOUNDS, playerShip.model.position.z));
}

// Spawn enemies
function spawnEnemies(deltaTime) {
    if (!gameRunning || gameOver) return;
    
    gameTime += deltaTime * 1000; // Convert to milliseconds
    
    // Update difficulty level based on game time
    difficultyLevel = 1 + Math.floor(gameTime / 60000); // Increase every minute
    
    // Calculate spawn interval based on difficulty
    const spawnInterval = ENEMY_SPAWN_INTERVAL_BASE / difficultyLevel;
    
    // Random chance to spawn an enemy based on time elapsed
    if (Math.random() < deltaTime * 1000 / spawnInterval) {
        // Choose enemy type based on difficulty
        let enemyType;
        const roll = Math.random();
        
        if (difficultyLevel >= 5 && roll < 0.1) { // 10% chance for ghost ship at higher levels
            enemyType = 'ship-ghost';
        } else if (difficultyLevel >= 3 && roll < 0.3) { // 20% chance for large ships at higher levels
            enemyType = 'ship-pirate-large';
        } else if (difficultyLevel >= 2 && roll < 0.6) { // 30% chance for medium ships at medium levels
            enemyType = 'ship-pirate-medium';
        } else { // 40% chance for small ships
            enemyType = 'ship-pirate-small';
        }
        
        // Create enemy
        const enemy = {
            model: models[enemyType].clone(),
            type: enemyType,
            speed: ENEMY_SPEED_BASE * (1 + (difficultyLevel - 1) * 0.2), // Speed increases with difficulty
            health: enemyType.includes('small') ? 30 : 
                   enemyType.includes('medium') ? 60 : 
                   enemyType.includes('ghost') ? 150 : 100, // Health based on ship size
            canShoot: true,
            shootCooldown: 3000, // milliseconds
            lastShot: 0
        };
        
        enemy.model.scale.set(0.5, 0.5, 0.5);
        
        // Random position on the edge of the map - closer for more compact map
        const angle = Math.random() * Math.PI * 2;
        const distance = 90; // Reduced spawn distance from center
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        enemy.model.position.set(x, 0, z);
        
        // Make the enemy ships bigger
        enemy.model.scale.set(2.5, 2.5, 2.5); // MUCH bigger enemies (increased from 1.0)
        
        // Set rotation to face the player
        enemy.model.lookAt(playerShip.model.position);
        
        // Add pirate flag
        const flag = models['flag-pirate'].clone();
        flag.scale.set(2.0, 2.0, 2.0); // MUCH bigger flag
        flag.position.set(0, 18, 0); // Adjusted for larger ship
        enemy.model.add(flag);
        
        enemy.model.castShadow = true;
        scene.add(enemy.model);
        enemies.push(enemy);
    }
}

// Update enemy behavior
function updateEnemies(deltaTime) {
    enemies.forEach((enemy, idx) => {
        // Move towards player
        const direction = new THREE.Vector3();
        direction.subVectors(playerShip.model.position, enemy.model.position).normalize();
        enemy.model.position.add(direction.multiplyScalar(enemy.speed * deltaTime));
        
        // Make enemy face the player
        enemy.model.lookAt(playerShip.model.position);
        
        // Random chance to shoot based on cooldown
        const now = Date.now();
        if (enemy.canShoot && now - enemy.lastShot > enemy.shootCooldown) {
            if (Math.random() < 0.01) { // 1% chance per frame to shoot
                enemyShoot(enemy);
                enemy.lastShot = now;
            }
        }
        
        // Check for collision with player - increased threshold for MUCH bigger models
        const distance = enemy.model.position.distanceTo(playerShip.model.position);
        if (distance < 30) { // Significantly increased collision threshold
            // Player takes damage
            if (!activePowerUps.shield) {
                health -= 10;
                updateHealth();
                
                if (health <= 0) {
                    endGame();
                }
            }
            
            // Enemy is destroyed
            scene.remove(enemy.model);
            enemies.splice(idx, 1);
            
            // Visual effect for collision
            createExplosion(enemy.model.position);
        }
    });
}

// Enemy shoot function
function enemyShoot(enemy) {
    // Create projectile
    const projectile = {
        model: models['cannon-ball'].clone(),
        velocity: new THREE.Vector3(),
        isPlayerProjectile: false
    };
    
    projectile.model.scale.set(1.5, 1.5, 1.5); // MUCH bigger projectiles
    
    // Position projectile at the front of the enemy ship
    projectile.model.position.copy(enemy.model.position);
    projectile.model.position.y += 5; // Increased height offset for larger ship
    
    // Calculate direction towards player
    const direction = new THREE.Vector3();
    direction.subVectors(playerShip.model.position, enemy.model.position).normalize();
    projectile.velocity = direction.multiplyScalar(PROJECTILE_SPEED * 0.5); // Slightly slower than player projectiles
    
    scene.add(projectile.model);
    projectiles.push(projectile);
}

// Update projectiles
function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Move projectile
        projectile.model.position.add(projectile.velocity.clone().multiplyScalar(deltaTime));
        
        // Check if projectile is out of bounds - smaller bounds for compact map
        if (projectile.model.position.length() > 150) {
            scene.remove(projectile.model);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check for collisions
        if (projectile.isPlayerProjectile) {
            let hitSomething = false;
            
            // Check collisions with enemies
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                const distance = projectile.model.position.distanceTo(enemy.model.position);
                
                if (distance < 20) { // Significantly increased collision threshold for MUCH bigger models
                    // Enemy takes damage
                    enemy.health -= projectile.damage || 10;
                    
                    if (enemy.health <= 0) {
                        // Enemy destroyed
                        scene.remove(enemy.model);
                        enemies.splice(j, 1);
                        
                        // Add score
                        score += enemy.type.includes('small') ? 10 : 
                                enemy.type.includes('medium') ? 20 : 
                                enemy.type.includes('ghost') ? 50 : 30;
                        updateScore();
                        
                        // Visual effect for destruction
                        createExplosion(enemy.model.position);
                        
                        // Chance to spawn power-up
                        if (Math.random() < POWER_UP_SPAWN_CHANCE) {
                            spawnPowerUp(enemy.model.position);
                        }
                    }
                    
                    hitSomething = true;
                    break;
                }
            }
            
            // If hit an enemy and not laser (which can pierce), remove projectile
            if (hitSomething && !activePowerUps.laser) {
                scene.remove(projectile.model);
                projectiles.splice(i, 1);
                continue;
            }
            
            // Check collisions with environmental elements
            for (let j = environmentalElements.length - 1; j >= 0; j--) {
                const element = environmentalElements[j];
                
                if (!element.isDestructible) continue;
                
                const distance = projectile.model.position.distanceTo(element.model.position);
                if (distance < 20) { // Significantly increased collision threshold for MUCH bigger models
                    // Element takes damage
                    element.health -= projectile.damage || 10;
                    
                    if (element.health <= 0) {
                        // Element destroyed
                        scene.remove(element.model);
                        environmentalElements.splice(j, 1);
                        
                        // Create debris
                        createDebris(element.model.position, element.type);
                        
                        // Visual effect for destruction
                        createExplosion(element.model.position);
                    }
                    
                    // Remove projectile unless it's a laser (which can pierce through)
                    if (!activePowerUps.laser) {
                        scene.remove(projectile.model);
                        projectiles.splice(i, 1);
                    }
                    break;
                }
            }
            
        } else {
            // Enemy projectile colliding with player
            const distance = projectile.model.position.distanceTo(playerShip.model.position);
            if (distance < 20) { // Significantly increased collision threshold for MUCH bigger models
                // Player takes damage
                if (!activePowerUps.shield) {
                    health -= 5;
                    updateHealth();
                    
                    if (health <= 0) {
                        endGame();
                    }
                }
                
                // Remove projectile
                scene.remove(projectile.model);
                projectiles.splice(i, 1);
                
                // Visual effect for hit
                createExplosion(projectile.model.position);
            }
        }
    }
}

// Create debris from destroyed environmental element
function createDebris(position, type) {
    // Number of debris pieces based on element type
    const count = type.includes('rocks') ? 5 : 3;
    
    for (let i = 0; i < count; i++) {
        // Create simple geometry for debris - MUCH bigger debris
        const geometry = new THREE.BoxGeometry(5, 5, 5); // Significantly increased size
        const material = new THREE.MeshStandardMaterial({ 
            color: type.includes('rocks') ? 0x888888 : 0x8B4513 // Gray for rocks, brown for wooden objects
        });
        const debrisModel = new THREE.Mesh(geometry, material);
        
        // Position debris at destroyed element
        debrisModel.position.copy(position);
        debrisModel.position.y += Math.random() * 2; // Random height offset
        
        const deb = {
            model: debrisModel,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 20, // Random X velocity
                Math.random() * 15 + 5,     // Random Y velocity (upward)
                (Math.random() - 0.5) * 20  // Random Z velocity
            ),
            rotationSpeed: new THREE.Vector3(
                Math.random() * 2,
                Math.random() * 2,
                Math.random() * 2
            ),
            damage: type.includes('rocks') ? 15 : 10, // Rock debris does more damage
            lifetime: 5 + Math.random() * 3 // Seconds before despawning
        };
        
        scene.add(deb.model);
        debris.push(deb);
    }
}

// Update debris
function updateDebris(deltaTime) {
    for (let i = debris.length - 1; i >= 0; i--) {
        const deb = debris[i];
        
        // Move debris
        deb.model.position.add(deb.velocity.clone().multiplyScalar(deltaTime));
        
        // Apply gravity effect
        deb.velocity.y -= 20 * deltaTime;
        
        // Rotate debris
        deb.model.rotation.x += deb.rotationSpeed.x * deltaTime;
        deb.model.rotation.y += deb.rotationSpeed.y * deltaTime;
        deb.model.rotation.z += deb.rotationSpeed.z * deltaTime;
        
        // Decrease lifetime
        deb.lifetime -= deltaTime;
        
        // Check if debris is below water, out of bounds, or expired - smaller bounds for compact map
        if (deb.model.position.y < -1 || deb.model.position.length() > 150 || deb.lifetime <= 0) {
            scene.remove(deb.model);
            debris.splice(i, 1);
            continue;
        }
        
        // Check for collisions with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const distance = deb.model.position.distanceTo(enemy.model.position);
            
            if (distance < 20) { // Significantly increased collision threshold for MUCH bigger models
                // Enemy takes damage
                enemy.health -= deb.damage;
                
                if (enemy.health <= 0) {
                    // Enemy destroyed
                    scene.remove(enemy.model);
                    enemies.splice(j, 1);
                    
                    // Add score
                    score += enemy.type.includes('small') ? 10 : 
                            enemy.type.includes('medium') ? 20 : 
                            enemy.type.includes('ghost') ? 50 : 30;
                    updateScore();
                    
                    // Visual effect for destruction
                    createExplosion(enemy.model.position);
                    
                    // Chance to spawn power-up
                    if (Math.random() < POWER_UP_SPAWN_CHANCE) {
                        spawnPowerUp(enemy.model.position);
                    }
                }
                
                // Remove debris
                scene.remove(deb.model);
                debris.splice(i, 1);
                break;
            }
        }
    }
}

// Create explosion effect
function createExplosion(position) {
    // Simple particle system for explosion
    const particleCount = 20;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        // Create simple geometry for particles - MUCH bigger explosion effects
        const geometry = new THREE.SphereGeometry(2.5, 8, 8); // Significantly increased size
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff8800, 
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geometry, material);
        
        // Position particle at explosion center
        particle.position.copy(position);
        
        // Random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );
        
        // Add to scene
        scene.add(particle);
        
        particles.push({
            mesh: particle,
            velocity: velocity,
            life: 1.0 // Life decreases over time
        });
    }
    
    // Animate particles
    const animateExplosion = () => {
        let aliveParticles = false;
        
        particles.forEach((particle, index) => {
            if (particle.life <= 0) return;
            
            aliveParticles = true;
            particle.mesh.position.add(particle.velocity.clone().multiplyScalar(0.02));
            particle.mesh.material.opacity = particle.life;
            particle.life -= 0.02;
            
            if (particle.life <= 0) {
                scene.remove(particle.mesh);
            }
        });
        
        if (aliveParticles) {
            requestAnimationFrame(animateExplosion);
        }
    };
    
    animateExplosion();
}

// Spawn power-up
function spawnPowerUp(position) {
    // Choose random power-up type
    const type = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
    
    // Create power-up model - MUCH bigger power-ups
    const geometry = new THREE.SphereGeometry(8, 16, 16); // Significantly increased size
    let material;
    
    switch (type) {
        case 'laser':
            material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
            break;
        case 'rapidFire':
            material = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow
            break;
        case 'shield':
            material = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue
            break;
        case 'healthBoost':
            material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green
            break;
    }
    
    const powerUpModel = new THREE.Mesh(geometry, material);
    powerUpModel.position.copy(position);
    powerUpModel.position.y += 2; // Float above water
    
    const powerUp = {
        model: powerUpModel,
        type: type,
        originalPosition: position.clone()
    };
    
    scene.add(powerUp.model);
    powerUps.push(powerUp);
}

// Update power-ups (animation)
function updatePowerUps(deltaTime) {
    powerUps.forEach(powerUp => {
        // Make it bob up and down and rotate
        powerUp.model.position.y = powerUp.originalPosition.y + 2 + Math.sin(Date.now() * 0.002) * 1;
        powerUp.model.rotation.y += 2 * deltaTime;
    });
}

// Check for power-up collection
function checkPowerUpCollection() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        const distance = powerUp.model.position.distanceTo(playerShip.model.position);
        
        if (distance < 30) { // Significantly increased collection threshold for MUCH bigger models
            // Activate power-up
            activatePowerUp(powerUp.type);
            
            // Remove power-up
            scene.remove(powerUp.model);
            powerUps.splice(i, 1);
        }
    }
}

// Activate power-up
function activatePowerUp(type) {
    switch (type) {
        case 'laser':
            activePowerUps.laser = true;
            showPowerUpIndicator('Laser Cannon', POWER_UP_DURATION / 1000);
            setTimeout(() => {
                activePowerUps.laser = false;
            }, POWER_UP_DURATION);
            break;
        
        case 'rapidFire':
            const originalCooldown = playerShip.shootCooldown;
            playerShip.shootCooldown = originalCooldown / 5; // 5x faster firing
            activePowerUps.rapidFire = true;
            showPowerUpIndicator('Rapid Fire', POWER_UP_DURATION / 1000);
            setTimeout(() => {
                playerShip.shootCooldown = originalCooldown;
                activePowerUps.rapidFire = false;
            }, POWER_UP_DURATION);
            break;
        
        case 'shield':
            activePowerUps.shield = true;
            showPowerUpIndicator('Shield', POWER_UP_DURATION / 1000);
            
            // Create shield visual effect - MUCH bigger shield for MUCH bigger ship
            const shieldGeometry = new THREE.SphereGeometry(35, 16, 16); // Significantly increased size
            const shieldMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x0088ff,
                transparent: true,
                opacity: 0.3
            });
            const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
            playerShip.model.add(shield);
            
            setTimeout(() => {
                activePowerUps.shield = false;
                playerShip.model.remove(shield);
            }, POWER_UP_DURATION);
            break;
        
        case 'healthBoost':
            health = Math.min(100, health + 25); // Boost health, max 100
            updateHealth();
            showPowerUpIndicator('Health Boost', 3); // Show briefly
            break;
    }
}

// Show power-up indicator
function showPowerUpIndicator(name, duration) {
    // Remove existing indicator if any
    const existingIndicator = document.querySelector('.power-up-active');
    if (existingIndicator) {
        document.body.removeChild(existingIndicator);
    }
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'power-up-active';
    indicator.innerHTML = `
        <div class="icon">⚡</div>
        <div>${name}: <span class="timer">${duration}</span>s</div>
    `;
    
    document.body.appendChild(indicator);
    
    // Update timer
    let timeLeft = duration;
    const timerElement = indicator.querySelector('.timer');
    
    const updateTimer = () => {
        timeLeft -= 1;
        timerElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (document.body.contains(indicator)) {
                document.body.removeChild(indicator);
            }
        }
    };
    
    const timerInterval = setInterval(updateTimer, 1000);
}

// Update score UI
function updateScore() {
    document.getElementById('score-value').textContent = score;
}

// Update health UI
function updateHealth() {
    document.getElementById('health-value').textContent = health;
}

// End game
function endGame() {
    gameRunning = false;
    gameOver = true;
    
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over').classList.remove('hidden');
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    if (gameOver) return;
    
    requestAnimationFrame(animate);
    
    const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap delta time to prevent large jumps
    
    if (gameRunning) {
        // Update game elements
        updatePlayerMovement(deltaTime);
        spawnEnemies(deltaTime);
        updateEnemies(deltaTime);
        updateProjectiles(deltaTime);
        updateDebris(deltaTime);
        updatePowerUps(deltaTime);
        checkPowerUpCollection();
        
        // Add time-based score
        if (Math.random() < 0.05) { // Occasional time bonus
            score += difficultyLevel;
            updateScore();
        }
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// Initialize the game when page loads
window.addEventListener('load', init);