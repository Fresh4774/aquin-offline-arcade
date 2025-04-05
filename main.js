// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// UI elements
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');
const healthBar = document.getElementById('healthBar');
const powerupIndicator = document.getElementById('powerupIndicator');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

// Game variables
let scrollX = 0;
let scrollY = 0;
let score = 0;
let gameTime = 0;
let gameRunning = true;
let difficultyLevel = 1;
let lastEnemySpawn = 0;
let lastSatelliteSpawn = 0;
let lastPowerupSpawn = 0;
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;

// Image loading
const images = {};
const imageFiles = {
  ship: 'PNG/ship_F.png',
  asteroid: 'PNG/meteor_detailedLarge.png',
  smallAsteroid: 'PNG/meteor_detailedSmall.png',
  enemy1: 'PNG/enemy_A.png',
  enemy2: 'PNG/enemy_C.png',
  enemy3: 'PNG/enemy_B.png',
  enemy4: 'PNG/enemy_D.png',
  enemy5: 'PNG/enemy_E.png',
  satellite1: 'PNG/satellite_A.png',
  satellite2: 'PNG/satellite_B.png',
  satellite3: 'PNG/satellite_C.png',
  satellite4: 'PNG/satellite_D.png',
  station: 'PNG/station_A.png',
  starLarge: 'PNG/star_large.png',
  starMedium: 'PNG/star_medium.png',
  starSmall: 'PNG/star_small.png',
  starTiny: 'PNG/star_tiny.png'
};

let imagesLoaded = 0;
let totalImages = Object.keys(imageFiles).length;

function loadImages() {
  for (const [key, src] of Object.entries(imageFiles)) {
    images[key] = new Image();
    images[key].onload = () => {
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        initialize();
      }
    };
    images[key].src = src;
  }
}

// Game entities
let player;
let bullets = [];
let asteroids = [];
let enemies = [];
let satellites = [];
let powerups = [];
let particles = [];
let clones = [];

// Input handlers
const keys = {};
const mousePos = { x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
  // Normalize key names to lowercase and handle arrow keys
  let key = e.key.toLowerCase();
  
  // Map arrow keys to WASD equivalents
  const keyMap = {
    'arrowup': 'w',
    'arrowdown': 's',
    'arrowleft': 'a',
    'arrowright': 'd'
  };
  
  // If it's an arrow key, use the mapped WASD key
  if (keyMap[key]) {
    key = keyMap[key];
  }
  
  keys[key] = true;
});

window.addEventListener('keyup', (e) => {
  // Normalize key names to lowercase and handle arrow keys
  let key = e.key.toLowerCase();
  
  // Map arrow keys to WASD equivalents
  const keyMap = {
    'arrowup': 'w',
    'arrowdown': 's',
    'arrowleft': 'a',
    'arrowright': 'd'
  };
  
  // If it's an arrow key, use the mapped WASD key
  if (keyMap[key]) {
    key = keyMap[key];
  }
  
  keys[key] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left;
  mousePos.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
  if (gameRunning && e.button === 0) {
    player.shoot();
  }
});

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

restartBtn.addEventListener('click', () => {
  resetGame();
});

class Entity {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.markedForDeletion = false;
  }
  
  isColliding(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + other.radius;
  }
  
  worldToScreen(x, y) {
    return {
      x: x - scrollX,
      y: y - scrollY
    };
  }
}

class Player extends Entity {
  constructor(x, y, isClone = false) {
    super(x, y, 20);
    this.rotation = 0;
    this.velocity = { x: 0, y: 0 };
    this.acceleration = 0.5;
    this.maxSpeed = 5;
    this.health = 100;
    this.shootCooldown = 0;
    this.invulnerable = false;
    this.invulnerableTime = 0;
    this.powerup = null;
    this.powerupTime = 0;
    this.isClone = isClone;
    this.cloneOffset = { x: 0, y: 0 };
    this.bombReady = false;
    this.bombUses = 0; // Track bomb uses
  }
  
  update(deltaTime) {
    if (this.isClone) {
      // Clone behavior - actively follow the player with offset and potentially despawn
      if (player) {
        // Calculate target position based on player position and offset
        const targetX = player.x + this.cloneOffset.x;
        const targetY = player.y + this.cloneOffset.y;
        
        // Move smoothly toward target position
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if too far from main player and remove the clone
        if (dist > 300) {
          this.markedForDeletion = true;
          return;
        }
        
        if (dist > 5) {
          this.velocity.x = dx * 0.1;
          this.velocity.y = dy * 0.1;
        } else {
          this.velocity.x *= 0.9;
          this.velocity.y *= 0.9;
        }
        
        // Match player's rotation
        this.rotation = player.rotation;
        
        // Auto-shoot
        if (this.shootCooldown <= 0) {
          this.shoot();
          this.shootCooldown = 500; // Slower fire rate than player
        }
      }
    } else {
      // Regular player behavior
      // Update rotation based on mouse position
      const screenPos = this.worldToScreen(this.x, this.y);
      const dx = mousePos.x - screenPos.x;
      const dy = mousePos.y - screenPos.y;
      this.rotation = Math.atan2(dy, dx);
      
      // Movement
      if (keys['w'] || keys['arrowup']) {
        this.velocity.x += Math.cos(this.rotation) * this.acceleration;
        this.velocity.y += Math.sin(this.rotation) * this.acceleration;
      }
      
      if (keys['s'] || keys['arrowdown']) {
        this.velocity.x -= Math.cos(this.rotation) * this.acceleration * 0.5;
        this.velocity.y -= Math.sin(this.rotation) * this.acceleration * 0.5;
      }
      
      // Strafing
      if (keys['a'] || keys['arrowleft']) {
        this.velocity.x += Math.cos(this.rotation - Math.PI/2) * this.acceleration * 0.7;
        this.velocity.y += Math.sin(this.rotation - Math.PI/2) * this.acceleration * 0.7;
      }
      
      if (keys['d'] || keys['arrowright']) {
        this.velocity.x += Math.cos(this.rotation + Math.PI/2) * this.acceleration * 0.7;
        this.velocity.y += Math.sin(this.rotation + Math.PI/2) * this.acceleration * 0.7;
      }
      
      // Activate bomb on right-click if bomb is ready
      if ((keys[' ']) && this.bombReady && this.bombUses > 0) {
        this.activateBomb();
        this.bombUses--;
        
        // Update bomb indicator
        if (!this.isClone) {
          powerupIndicator.textContent = this.bombUses > 0 ? 
            `Bomb (${this.bombUses} uses)` : 'No bombs left';
        }
        
        // Clear bomb if no uses left
        if (this.bombUses <= 0) {
          this.bombReady = false;
          this.powerup = null;
        }
      }
    }
    
    // Limit speed
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (speed > this.maxSpeed) {
      this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
      this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
    }
    
    // Apply friction
    this.velocity.x *= 0.98;
    this.velocity.y *= 0.98;
    
    // Update position
    this.x = Math.max(0, Math.min(WORLD_WIDTH, this.x + this.velocity.x));
    this.y = Math.max(0, Math.min(WORLD_HEIGHT, this.y + this.velocity.y));
    
    // Update shoot cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime;
    }
    
    // Update invulnerability
    if (this.invulnerable) {
      this.invulnerableTime -= deltaTime;
      if (this.invulnerableTime <= 0) {
        this.invulnerable = false;
      }
    }
    
    // Update powerup
    if (this.powerup) {
      this.powerupTime -= deltaTime;
      if (!this.isClone) {
        if (this.powerup === "Bomb") {
          powerupIndicator.textContent = `${this.powerup} (${this.bombUses} uses)`;
        } else {
          powerupIndicator.textContent = `${this.powerup} (${Math.ceil(this.powerupTime / 1000)}s)`;
        }
      }
      
      // Clear clones if Clone powerup expires
      if (this.powerup === 'Clones' && this.powerupTime <= 0) {
        clones = clones.filter(clone => clone.powerupTime > 0);
      }
      
      if (this.powerupTime <= 0) {
        this.powerup = null;
        if (!this.isClone) {
          powerupIndicator.textContent = '';
        }
      }
    }
  }
  
  draw() {
    const screenPos = this.worldToScreen(this.x, this.y);
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    
    // Draw shield if invulnerable
    if (this.invulnerable) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(216, 216, 216, 0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Draw ship
    ctx.rotate(this.rotation);
    ctx.rotate(Math.PI/2);
    
    // Power-up visual effects
    if (this.powerup === 'Laser') {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.powerup === 'Shield') {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.powerup === 'Bomb') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.powerup === 'Clones') {
      ctx.fillStyle = 'rgba(20, 184, 166, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw the ship with slight transparency for clones
    if (this.isClone) {
      ctx.globalAlpha = 0.7;
      ctx.drawImage(images.ship, -25, -25, 50, 50);
    } else {
      ctx.drawImage(images.ship, -25, -25, 50, 50);
    }
    
    ctx.restore();
  }
  
  shoot() {
    if (this.shootCooldown <= 0) {
      const bulletSpeed = 10;
      
      if (this.powerup === 'Laser') {
        // Create three bullets in a spread pattern
        for (let angle = -0.2; angle <= 0.2; angle += 0.2) {
          const adjustedRotation = this.rotation + angle;
          bullets.push(new Bullet(
            this.x + Math.cos(adjustedRotation) * 30,
            this.y + Math.sin(adjustedRotation) * 30,
            bulletSpeed * Math.cos(adjustedRotation),
            bulletSpeed * Math.sin(adjustedRotation),
            10,
            'white'
          ));
        }
        this.shootCooldown = 150; // 0.15 seconds
      } else {
        // Regular single bullet
        bullets.push(new Bullet(
          this.x + Math.cos(this.rotation) * 30,
          this.y + Math.sin(this.rotation) * 30,
          bulletSpeed * Math.cos(this.rotation),
          bulletSpeed * Math.sin(this.rotation),
          5,
          'white'
        ));
        this.shootCooldown = 300; // 0.3 seconds
      }
    }
  }
  
  takeDamage(amount) {
    if (!this.invulnerable) {
      this.health -= amount;
      healthBar.style.width = `${this.health}%`;
      
      // Create damage particles
      for (let i = 0; i < 10; i++) {
        particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          Math.random() * 5 + 5,
          'rgba(255, 100, 100, 0.8)'
        ));
      }
      
      if (this.health <= 0) {
        this.health = 0;
        gameOver();
      }
      
      // Temporary invulnerability after taking damage
      this.invulnerable = true;
      this.invulnerableTime = 1000; // 1 second
    }
  }
  
  applyPowerup(type) {
    // Remove existing powerup effects
    if (this.powerup === 'Clones') {
      // Remove existing clones
      clones = clones.filter(clone => !clone.isClone);
    }
    
    // Reset previous powerup state
    if (this.powerup === 'Shield') {
      this.invulnerable = false;
      this.invulnerableTime = 0;
    }
    
    // Set new powerup
    this.powerup = type;
    
    if (type === 'Shield') {
      this.powerupTime = 15000; // 15 seconds
      powerupIndicator.textContent = `${type} (15s)`;
      this.invulnerable = true;
      this.invulnerableTime = 15000; // 15 seconds
    } 
    else if (type === 'Laser') {
      this.powerupTime = 15000; // 15 seconds
      powerupIndicator.textContent = `${type} (15s)`;
    }
    else if (type === 'Bomb') {
      this.powerupTime = 30000; // 30 seconds to use it
      this.bombReady = true;
      this.bombUses = 5; // Allow 5 bomb uses
      powerupIndicator.textContent = `Bomb (5 uses)`;
    }
    else if (type === 'Clones') {
      this.powerupTime = 15000; // 20 seconds
      powerupIndicator.textContent = `${type} (15s)`;
      this.spawnClones();
    }
  }
  
  spawnClones() {
    // Remove any existing clones
    clones = clones.filter(clone => !clone.isClone);
    
    // Create 3 clones with different offsets
    const offsetConfigs = [
      { x: -80, y: -80 },
      { x: 0, y: -100 },
      { x: 80, y: -80 }
    ];
    
    for (let i = 0; i < 3; i++) {
      const clone = new Player(this.x, this.y, true);
      clone.cloneOffset = offsetConfigs[i];
      clone.powerupTime = 20000;
      clones.push(clone);
      
      // Create spawn effect particles
      for (let j = 0; j < 15; j++) {
        particles.push(new Particle(
          clone.x, clone.y,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          Math.random() * 10 + 5,
          'rgba(0, 100, 255, 0.8)'
        ));
      }
    }
  }
  
  activateBomb() {
    // Create bomb effect - 360-degree attack
    const numBullets = 36; // One bullet every 10 degrees
    const bulletSpeed = 12;
    
    // Create explosion effect at player position
    for (let i = 0; i < 60; i++) {
      particles.push(new Particle(
        this.x, this.y,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        Math.random() * 20 + 10,
        'rgba(252, 165, 165, 0.8)'
      ));
    }
    
    // Create ring of bullets
    for (let i = 0; i < numBullets; i++) {
      const angle = (i / numBullets) * Math.PI * 2;
      bullets.push(new Bullet(
        this.x,
        this.y,
        bulletSpeed * Math.cos(angle),
        bulletSpeed * Math.sin(angle),
        8,
        'white'
      ));
    }
    
    // Apply damage to all nearby enemies and asteroids
    const bombRadius = 200;
    
    // Check asteroids in radius
    for (const asteroid of asteroids) {
      const dx = asteroid.x - this.x;
      const dy = asteroid.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < bombRadius) {
        asteroid.takeDamage();
        asteroid.takeDamage(); // Apply double damage
      }
    }
    
    // Check enemies in radius
    for (const enemy of enemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < bombRadius) {
        enemy.takeDamage();
        enemy.takeDamage(); // Apply double damage
      }
    }
  }
}

class Bullet extends Entity {
  constructor(x, y, vx, vy, radius, color) {
    super(x, y, radius);
    this.vx = vx;
    this.vy = vy;
    this.lifespan = 2000; // 2 seconds
    this.color = color;
    
    // Store previous positions for trail effect
    this.trailPositions = [];
    this.trailLength = 8; // Number of trail segments
    
    // Calculate the angle of movement
    this.angle = Math.atan2(vy, vx);
    
    // Store original radius for reference
    this.originalRadius = radius;
  }
  
  update(deltaTime) {
    // Store current position for trail
    this.trailPositions.unshift({x: this.x, y: this.y});
    
    // Limit trail length
    if (this.trailPositions.length > this.trailLength) {
      this.trailPositions.pop();
    }
    
    this.x += this.vx;
    this.y += this.vy;
    
    this.lifespan -= deltaTime;
    if (this.lifespan <= 0) {
      this.markedForDeletion = true;
    }
    
    // Check if out of bounds
    if (this.x < 0 || this.x > WORLD_WIDTH || this.y < 0 || this.y > WORLD_HEIGHT) {
      this.markedForDeletion = true;
    }
  }
  
  draw() {
    const screenPos = this.worldToScreen(this.x, this.y);
    
    ctx.save();
    
    // Draw the trail
    for (let i = 0; i < this.trailPositions.length; i++) {
      const pos = this.trailPositions[i];
      const trailPos = this.worldToScreen(pos.x, pos.y);
      
      // Calculate trail segment opacity and size (fading toward the end of the trail)
      const opacity = 1 - (i / this.trailPositions.length);
      const segmentRadius = this.originalRadius * (1 - (i / this.trailPositions.length) * 0.7);
      
      // Draw trail segment with reducing opacity
      ctx.globalAlpha = opacity * 0.5;
      
      // Different trail appearance based on bullet type
      if (this.color === 'red') {
        ctx.fillStyle = `rgba(200, 240, 255, ${opacity * 0.7})`;
      } else {
        ctx.fillStyle = `rgba(200, 240, 255, ${opacity * 0.7})`;
      }
      
      ctx.beginPath();
      ctx.arc(trailPos.x, trailPos.y, segmentRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Reset global alpha
    ctx.globalAlpha = 1.0;
    
    // Draw the main bullet as an elongated shape
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.angle);
    
    // Create gradient for the elongated bullet
    const bulletLength = this.originalRadius * 3;
    const bulletWidth = this.originalRadius * 0.8;
    
    let gradientColor;
    if (this.color === 'red') {
      gradientColor = 'rgba(79, 70, 229, 0.9)';
    } else if (this.color === 'white') {
      gradientColor = 'rgba(37, 99, 235, 0.9)';
    } else {
      gradientColor = this.color;
    }
    
    const gradient = ctx.createLinearGradient(-bulletLength, 0, bulletLength, 0);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.2, gradientColor);
    gradient.addColorStop(0.8, gradientColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    // Draw elongated bullet
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, bulletLength, bulletWidth, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Add a glow effect
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, bulletWidth * 3);
    
    if (this.color === 'red') {
      glowGradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
      glowGradient.addColorStop(0.5, 'rgba(67, 56, 202, 0.4)');
    } else {
      glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
      glowGradient.addColorStop(0.5, 'rgba(29, 78, 216, 0.4)');
    }
    
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, bulletLength * 0.8, bulletWidth * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

class Asteroid extends Entity {
  constructor(x, y, radius, speed, rotationSpeed, health) {
    super(x, y, radius);
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = rotationSpeed;
    this.velocity = {
      x: (Math.random() - 0.5) * speed,
      y: (Math.random() - 0.5) * speed
    };
    this.health = health || 3;
    this.maxHealth = this.health;
    this.image = radius > 25 ? images.asteroid : images.smallAsteroid;
  }
  
  update(deltaTime) {
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.rotation += this.rotationSpeed;
    
    // Bounce off edges
    if (this.x - this.radius < 0 || this.x + this.radius > WORLD_WIDTH) {
      this.velocity.x = -this.velocity.x;
    }
    if (this.y - this.radius < 0 || this.y + this.radius > WORLD_HEIGHT) {
      this.velocity.y = -this.velocity.y;
    }
  }
  
  draw() {
    const screenPos = this.worldToScreen(this.x, this.y);
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.rotation);
    
    // Draw health bar for larger asteroids
    if (this.radius > 25) {
      const healthPercent = this.health / this.maxHealth;
      const barWidth = this.radius * 2;
      
      ctx.fillStyle = 'rgba(185, 28, 28, 0.7)';
      ctx.fillRect(-barWidth/2, this.radius + 5, barWidth, 5);
      
      ctx.fillStyle = 'rgba(21, 128, 61, 0.7)';
      ctx.fillRect(-barWidth/2, this.radius + 5, barWidth * healthPercent, 5);
    }
    
    ctx.drawImage(this.image, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    
    ctx.restore();
  }
  
  split() {
    // Only split if this is a large asteroid
    if (this.radius > 25) {
      // Create different types of small asteroids
      const smallAsteroidTypes = ['meteor_small', 'meteor_squareSmall', 'meteor_squareDetailedSmall'];
      
      for (let i = 0; i < 3; i++) {
        const asteroid = new Asteroid(
          this.x + (Math.random() - 0.5) * 20,
          this.y + (Math.random() - 0.5) * 20,
          15,
          3,
          (Math.random() - 0.5) * 0.05,
          1
        );
        asteroid.image = images.smallAsteroid;
        asteroids.push(asteroid);
      }
      
      // Create explosion particles
      for (let i = 0; i < 15; i++) {
        particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          Math.random() * 10 + 5,
          'rgba(216, 216, 216, 0.8)'
        ));
      }
    }
  }
  
  takeDamage() {
    this.health--;
    if (this.health <= 0) {
      this.split();
      this.markedForDeletion = true;
      score += this.radius > 25 ? 100 : 50;
      scoreElement.textContent = score;
    }
  }
}

class Enemy extends Entity {
  constructor(x, y, type) {
    const size = type === 'large' ? 30 : 20;
    super(x, y, size);
    this.type = type;
    this.health = type === 'large' ? 5 : 3;
    this.maxHealth = this.health;
    this.speed = type === 'large' ? 1.5 : 2.5;
    this.shootCooldown = 0;
    this.shootRate = type === 'large' ? 2000 : 3000; // milliseconds
    this.rotation = 0;
    
    // Select enemy image based on type
    if (type === 'large') {
      // Randomly choose between enemy2 and enemy4 for large enemies
      this.image = Math.random() < 0.5 ? images.enemy2 : images.enemy4;
    } else {
      // Randomly choose between enemy1, enemy3, and enemy5 for normal enemies
      const normalEnemyTypes = [images.enemy1, images.enemy3, images.enemy5];
      this.image = normalEnemyTypes[Math.floor(Math.random() * normalEnemyTypes.length)];
    }
    
    this.targetingOffset = {
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100
    };
    this.behaviorTimer = 0;
    this.behaviorDuration = Math.random() * 5000 + 3000;
    this.behavior = this.chooseBehavior();
  }
  
  chooseBehavior() {
    const behaviors = ['chase', 'circle', 'retreat'];
    return behaviors[Math.floor(Math.random() * behaviors.length)];
  }
  
  update(deltaTime) {
    if (!player || !gameRunning) return;
    
    // Update behavior
    this.behaviorTimer += deltaTime;
    if (this.behaviorTimer >= this.behaviorDuration) {
      this.behaviorTimer = 0;
      this.behaviorDuration = Math.random() * 5000 + 3000;
      this.behavior = this.chooseBehavior();
      this.targetingOffset = {
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 100
      };
    }
    
    // Calculate direction to player
    const dx = player.x + this.targetingOffset.x - this.x;
    const dy = player.y + this.targetingOffset.y - this.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);
    this.rotation = Math.atan2(dy, dx);
    
    // Move based on behavior
    let moveX = 0;
    let moveY = 0;
    
    if (this.behavior === 'chase') {
      moveX = Math.cos(this.rotation) * this.speed;
      moveY = Math.sin(this.rotation) * this.speed;
    } else if (this.behavior === 'circle') {
      const circleAngle = this.rotation + Math.PI/2;
      moveX = Math.cos(circleAngle) * this.speed;
      moveY = Math.sin(circleAngle) * this.speed;
      
      // Still move toward player if too far
      if (distToPlayer > 300) {
        moveX += Math.cos(this.rotation) * this.speed * 0.5;
        moveY += Math.sin(this.rotation) * this.speed * 0.5;
      }
    } else if (this.behavior === 'retreat') {
      // Move away from player if too close
      if (distToPlayer < 200) {
        moveX = -Math.cos(this.rotation) * this.speed;
        moveY = -Math.sin(this.rotation) * this.speed;
      } else {
        // Otherwise pick a random direction and drift
        const randomAngle = Math.random() * Math.PI * 2;
        moveX = Math.cos(randomAngle) * this.speed * 0.5;
        moveY = Math.sin(randomAngle) * this.speed * 0.5;
      }
    }
    
    this.x += moveX;
    this.y += moveY;
    
    // Keep within bounds
    this.x = Math.max(0, Math.min(WORLD_WIDTH, this.x));
    this.y = Math.max(0, Math.min(WORLD_HEIGHT, this.y));
    
    // Check if can shoot
    this.shootCooldown -= deltaTime;
    if (this.shootCooldown <= 0 && distToPlayer < 500) {
      this.shoot();
      this.shootCooldown = this.shootRate;
    }
    
    // Check collision with player
    if (player && this.isColliding(player)) {
      player.takeDamage(this.type === 'large' ? 20 : 10);
      for (let i = 0; i < 15; i++) {
        particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          Math.random() * 10 + 5,
          'rgba(212, 212, 216, 0.8)'
        ));
      }
      this.health = 0;
      this.markedForDeletion = true;
    }
  }
  
  draw() {
    const screenPos = this.worldToScreen(this.x, this.y);
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.rotation);
    ctx.rotate(-Math.PI/2);
    
    // Draw health bar
    const healthPercent = this.health / this.maxHealth;
    const barWidth = this.radius * 2;
    
    ctx.fillStyle = 'rgba(185, 28, 28, 0.7)';
    ctx.fillRect(-barWidth/2, this.radius + 5, barWidth, 5);
    
    ctx.fillStyle = 'rgba(21, 128, 61, 0.7)';
    ctx.fillRect(-barWidth/2, this.radius + 5, barWidth * healthPercent, 5);
    
    ctx.drawImage(this.image, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    
    ctx.restore();
  }
  
  shoot() {
    const bulletSpeed = 7;
    bullets.push(new Bullet(
      this.x + Math.cos(this.rotation) * 30,
      this.y + Math.sin(this.rotation) * 30,
      bulletSpeed * Math.cos(this.rotation),
      bulletSpeed * Math.sin(this.rotation),
      5,
      'red'
    ));
  }
  
  takeDamage() {
    this.health--;
    if (this.health <= 0) {
      this.markedForDeletion = true;
      score += this.type === 'large' ? 200 : 100;
      scoreElement.textContent = score;
      
      // Create explosion particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 7,
          Math.random() * 15 + 5,
          'rgba(212, 212, 216, 0.8)'
        ));
      }
      
      // Chance to drop powerup
      if (Math.random() < 0.5) {
        const powerupTypes = ['Laser', 'Shield', 'Bomb', 'Clones'];
        const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        powerups.push(new Powerup(this.x, this.y, randomType));
      }
    }
  }
}

class Satellite extends Entity {
  constructor(x, y) {
    super(x, y, 15);
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    this.collected = false;
    this.blinkTimer = 0;
    this.visible = true;
    
    // Randomly choose one of the satellite types
    const satelliteTypes = ['satellite1', 'satellite2', 'satellite3', 'satellite4'];
    this.image = images[satelliteTypes[Math.floor(Math.random() * satelliteTypes.length)]];
  }
  
  update(deltaTime) {
    this.rotation += this.rotationSpeed;
    
    // Check if player collects
    if (player && this.isColliding(player) && !this.collected) {
      this.collected = true;
      this.markedForDeletion = true;
      score += 300;
      scoreElement.textContent = score;
      
      // Heal player
      player.health = Math.min(100, player.health + 20);
      healthBar.style.width = `${player.health}%`;
      
      // Create collection particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          Math.random() * 10 + 5,
          'rgba(34, 197, 94, 0.8)'
        ));
      }
    }
  }
  
  draw() {
    if (!this.visible) return;
    
    const screenPos = this.worldToScreen(this.x, this.y);
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.rotation);
    
    ctx.drawImage(this.image, -20, -20, 40, 40);
    
    // Draw glow effect
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fill();
    
    ctx.restore();
  }
}

class Powerup extends Entity {

  constructor(x, y, type) {
    super(x, y, 15);
    this.type = type;
    this.rotation = 0;
    this.rotationSpeed = 0.03;
    this.lifespan = 10000; // 10 seconds
    
    this.pulseTimer = 0;
    this.pulseSize = 0;
    
    // Add a floating effect
    this.floatTimer = 0;
    this.floatOffset = 0;
  }
  update(deltaTime) {
    this.rotation += this.rotationSpeed;
    this.lifespan -= deltaTime;
    
    // Pulse effect
    this.pulseTimer += deltaTime;
    this.pulseSize = Math.sin(this.pulseTimer / 200) * 5;
    
    // Floating effect
    this.floatTimer += deltaTime;
    this.floatOffset = Math.sin(this.floatTimer / 500) * 3;
    
    if (this.lifespan <= 0) {
      this.markedForDeletion = true;
    }
    
    // Check if player collects
    if (player && this.isColliding(player)) {
      player.applyPowerup(this.type);
      this.markedForDeletion = true;
      
      // Create collection particles
      const color = this.type === 'Laser' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 255, 0.8)';
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          Math.random() * 10 + 5,
          color
        ));
      }
    }
  }
  
  draw() {
    const screenPos = this.worldToScreen(this.x, this.y);
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y + this.floatOffset);
    ctx.rotate(this.rotation);
    
    // Draw glow effect with color based on powerup type
    let color;
    if (this.type === 'Laser') {
      color = 'rgba(255, 200, 0, 0.3)';
    } else if (this.type === 'Shield') {
      color = 'rgba(200, 0, 255, 0.3)';
    } else if (this.type === 'Bomb') {
      color = 'rgba(255, 0, 255, 0.3)';
    } else if (this.type === 'Clones') {
      color = 'rgba(0, 100, 255, 0.3)';
    }
    
    ctx.beginPath();
    ctx.arc(0, 0, 20 + this.pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    ctx.restore();
    
    // Draw fading effect when about to expire
    if (this.lifespan < 3000) {
      const opacity = this.lifespan / 3000;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y + this.floatOffset, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }}

class Particle extends Entity {
  constructor(x, y, vx, vy, radius, color) {
    super(x, y, radius);
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = 1.0; // 0.0 to 1.0
    this.fadeSpeed = 0.02 + Math.random() * 0.05;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.radius *= 0.96;
    this.life -= this.fadeSpeed;
    
    if (this.life <= 0) {
      this.markedForDeletion = true;
    }
  }
  
  draw() {
    const screenPos = this.worldToScreen(this.x, this.y);
    
    ctx.save();
    const [r, g, b] = this.extractRGB(this.color);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.life})`;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  extractRGB(rgba) {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      return [match[1], match[2], match[3]];
    }
    return [255, 255, 255];
  }
}

function spawnAsteroid() {
  const minDistance = 300; // Minimum distance from player
  
  // Try to find a position away from player
  let x, y, distance;
  do {
    x = Math.random() * WORLD_WIDTH;
    y = Math.random() * WORLD_HEIGHT;
    
    if (player) {
      const dx = player.x - x;
      const dy = player.y - y;
      distance = Math.sqrt(dx * dx + dy * dy);
    } else {
      distance = minDistance + 1; // Skip check if no player
    }
  } while (distance < minDistance);
  
  const radius = Math.random() < 0.7 ? 40 : 30;
  const speed = 0.5 + Math.random() * 0.5;
  const rotationSpeed = (Math.random() - 0.5) * 0.02;
  const health = radius > 35 ? 3 : 2;
  
  asteroids.push(new Asteroid(x, y, radius, speed, rotationSpeed, health));
}

function spawnEnemy() {
  const minDistance = 400; // Minimum distance from player
  
  // Try to find a position away from player
  let x, y, distance;
  do {
    x = Math.random() * WORLD_WIDTH;
    y = Math.random() * WORLD_HEIGHT;
    
    if (player) {
      const dx = player.x - x;
      const dy = player.y - y;
      distance = Math.sqrt(dx * dx + dy * dy);
    } else {
      distance = minDistance + 1; // Skip check if no player
    }
  } while (distance < minDistance);
  
  const type = Math.random() < 0.3 ? 'large' : 'normal';
  enemies.push(new Enemy(x, y, type));
}

function spawnSatellite() {
  const x = Math.random() * WORLD_WIDTH;
  const y = Math.random() * WORLD_HEIGHT;
  satellites.push(new Satellite(x, y));
}

function updateScrollPosition() {
  if (!player) return;
  
  // Smooth camera following with slight offset based on mouse
  const targetScrollX = player.x - canvas.width / 2 + (mousePos.x - canvas.width / 2) * 0.1;
  const targetScrollY = player.y - canvas.height / 2 + (mousePos.y - canvas.height / 2) * 0.1;
  
  scrollX += (targetScrollX - scrollX) * 0.1;
  scrollY += (targetScrollY - scrollY) * 0.1;
  
  // Ensure scroll doesn't go out of bounds
  scrollX = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, scrollX));
  scrollY = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, scrollY));
}

function updateDifficulty() {
  // Increase difficulty based on time
  const oldLevel = difficultyLevel;
  difficultyLevel = Math.floor(gameTime / 30000) + 1; // Increase every 30 seconds
  
  if (difficultyLevel > oldLevel) {
    // Show level up message
    const levelUpMsg = document.createElement('div');
    levelUpMsg.textContent = `Wave ${difficultyLevel}`;
    levelUpMsg.style.position = 'fixed';
    levelUpMsg.style.top = '50%';
    levelUpMsg.style.left = '50%';
    levelUpMsg.style.transform = 'translate(-50%, -50%)';
    levelUpMsg.style.color = 'red';
    levelUpMsg.style.fontSize = '48px';
    levelUpMsg.style.fontWeight = 'bold';
    levelUpMsg.style.color = 'rgba(250, 250, 250, 0.7)';
    levelUpMsg.style.background = 'rgba(24, 24, 27, 0.3)';
    levelUpMsg.style.zIndex = '1000';
    document.body.appendChild(levelUpMsg);
    
    setTimeout(() => {
      document.body.removeChild(levelUpMsg);
    }, 2000);
  }
}

function checkCollisions() {
  // Check bullet collisions with asteroids and enemies
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    
    // Check asteroid collisions
    for (let j = asteroids.length - 1; j >= 0; j--) {
      const asteroid = asteroids[j];
      if (bullet.isColliding(asteroid)) {
        asteroid.takeDamage();
        bullet.markedForDeletion = true;
        break;
      }
    }
    
    // Check enemy collisions
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (bullet.isColliding(enemy)) {
        enemy.takeDamage();
        bullet.markedForDeletion = true;
        break;
      }
    }
    
    // Check player bullet collision (optional - for enemy bullets that are red)
    if (player && bullet.color === 'red' && player.isColliding(bullet) && !player.invulnerable) {
      player.takeDamage(5); // Enemies always do 5 damage
      bullet.markedForDeletion = true;
      
      // Create hit particles
      for (let k = 0; k < 10; k++) {
        particles.push(new Particle(
          bullet.x, bullet.y,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          Math.random() * 8 + 3,
          'rgba(216, 216, 216, 0.8)'
        ));
      }
    }
  }
  
  // Check small asteroid collisions with enemies
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const asteroid = asteroids[i];
    if (asteroid.radius <= 25) { // Only small asteroids
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (asteroid.isColliding(enemy)) {
          enemy.takeDamage();
          asteroid.markedForDeletion = true;
          
          // Create collision particles
          for (let k = 0; k < 10; k++) {
            particles.push(new Particle(
              asteroid.x, asteroid.y,
              (Math.random() - 0.5) * 5,
              (Math.random() - 0.5) * 5,
              Math.random() * 8 + 3,
              'rgba(255, 200, 0, 0.8)'
            ));
          }
          break;
        }
      }
    }
  }
  
  // Check player collisions with asteroids
  if (player) {
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      if (player.isColliding(asteroid)) {
        player.takeDamage(asteroid.radius > 25 ? 15 : 5);
        
        // Create collision particles
        for (let k = 0; k < 10; k++) {
          particles.push(new Particle(
            asteroid.x, asteroid.y,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            Math.random() * 8 + 3,
            'rgba(150, 150, 150, 0.8)'
          ));
        }
        
        // Push player away
        const dx = player.x - asteroid.x;
        const dy = player.y - asteroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        player.velocity.x += (dx / dist) * 5;
        player.velocity.y += (dy / dist) * 5;
        
        // Damage asteroid
        asteroid.takeDamage();
      }
    }
  }
}

function drawBackground() {
    // Draw dark space background
    const bgWidth = WORLD_WIDTH;
    const bgHeight = WORLD_HEIGHT;
    
    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid FIRST (before stars)
    const gridSize = 200;
    const gridOpacity = 0.1;
    
    const startX = Math.floor(scrollX / gridSize) * gridSize;
    const startY = Math.floor(scrollY / gridSize) * gridSize;
    const endX = Math.ceil((scrollX + canvas.width) / gridSize) * gridSize;
    const endY = Math.ceil((scrollY + canvas.height) / gridSize) * gridSize;
    
    ctx.strokeStyle = `rgba(39, 39, 42)`;
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x - scrollX, 0);
      ctx.lineTo(x - scrollX, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y - scrollY);
      ctx.lineTo(canvas.width, y - scrollY);
      ctx.stroke();
    }
    
    // AFTER grid, draw stars and other background elements
    // Use the star assets instead of simple circles
    const starCount = 400;
    const starTypes = [
      { image: images.starTiny, size: 8, count: 200 },
      { image: images.starSmall, size: 12, count: 100 },
      { image: images.starMedium, size: 18, count: 70 },
      { image: images.starLarge, size: 24, count: 30 }
    ];
    
    // Draw each type of star
    let starIndex = 0;
    for (const starType of starTypes) {
      for (let i = 0; i < starType.count; i++) {
        const x = ((starIndex * 17) + (i * 37)) % bgWidth;
        const y = ((starIndex * 29) + (i * 53)) % bgHeight;
        
        const screenX = x - scrollX;
        const screenY = y - scrollY;
        
        // Only draw if on screen (with margin)
        if (screenX > -starType.size && screenX < canvas.width + starType.size &&
            screenY > -starType.size && screenY < canvas.height + starType.size) {
          
          const brightness = (Math.sin(gameTime / 1000 + i) + 1) * 0.3 + 0.7;
          ctx.globalAlpha = brightness;
          
          const size = starType.size * brightness;
          ctx.drawImage(starType.image, screenX - size/2, screenY - size/2, size, size);
        }
        starIndex++;
      }
    }
    
    ctx.globalAlpha = 1.0;
    
    // Add space stations in the distance (decorative)
    const stationCount = 8;
    for (let i = 0; i < stationCount; i++) {
      const x = (i * 977) % bgWidth;
      const y = (i * 887) % bgHeight;
      
      const screenX = x - scrollX;
      const screenY = y - scrollY;
      
      // Only draw if on screen
      if (screenX > -100 && screenX < canvas.width + 100 &&
          screenY > -100 && screenY < canvas.height + 100) {
        
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(i * Math.PI / 4);
        
        // Draw with a slight transparency to make it look distant
        ctx.globalAlpha = 0.6;
        ctx.drawImage(images.station, -80, -80, 160, 160);
        ctx.globalAlpha = 1.0;
        
        ctx.restore();
      }
    }
    
    // Draw world boundaries last
    ctx.strokeStyle = 'rgba(0, 0, 0)';
    ctx.lineWidth = 5;
    ctx.strokeRect(-scrollX, -scrollY, WORLD_WIDTH, WORLD_HEIGHT);
  }

function drawMinimap() {
  const mapSize = 150;
  const mapX = canvas.width - mapSize - 10;
  const mapY = 10;
  const scale = mapSize / WORLD_WIDTH;
  
  // Draw background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  
  // Draw borders
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
  
  // Draw player view area
  const viewX = scrollX * scale + mapX;
  const viewY = scrollY * scale + mapY;
  const viewWidth = canvas.width * scale;
  const viewHeight = canvas.height * scale;
  
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
  ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);
  
  // Draw entities
  // Player
  if (player) {
    const playerX = player.x * scale + mapX;
    const playerY = player.y * scale + mapY;
    
    ctx.fillStyle = 'rgba(0, 255, 0, 1)';
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Asteroids
  ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
  for (const asteroid of asteroids) {
    const x = asteroid.x * scale + mapX;
    const y = asteroid.y * scale + mapY;
    const radius = asteroid.radius > 25 ? 2 : 1;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Enemies
  ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
  for (const enemy of enemies) {
    const x = enemy.x * scale + mapX;
    const y = enemy.y * scale + mapY;
    
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Satellites
  ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
  for (const satellite of satellites) {
    const x = satellite.x * scale + mapX;
    const y = satellite.y * scale + mapY;
    
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Powerups
  ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
  for (const powerup of powerups) {
    const x = powerup.x * scale + mapX;
    const y = powerup.y * scale + mapY;
    
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gameOver() {
  gameRunning = false;
  gameOverScreen.style.display = 'block';
  finalScoreElement.textContent = `Score: ${score}`;
}

function resetGame() {
  // Reset game state
  player = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  bullets = [];
  asteroids = [];
  enemies = [];
  satellites = [];
  powerups = [];
  particles = [];
  clones = [];
  
  score = 0;
  gameTime = 0;
  difficultyLevel = 1;
  gameRunning = true;
  
  // Reset UI
  scoreElement.textContent = '0';
  timeElement.textContent = '0';
  healthBar.style.width = '100%';
  powerupIndicator.textContent = '';
  gameOverScreen.style.display = 'none';
  
  // Initialize starting entities
  for (let i = 0; i < 10; i++) {
    spawnAsteroid();
  }
  
  for (let i = 0; i < 3; i++) {
    spawnSatellite();
  }
}

function cleanupEntities() {
  bullets = bullets.filter(bullet => !bullet.markedForDeletion);
  asteroids = asteroids.filter(asteroid => !asteroid.markedForDeletion);
  enemies = enemies.filter(enemy => !enemy.markedForDeletion);
  satellites = satellites.filter(satellite => !satellite.markedForDeletion);
  powerups = powerups.filter(powerup => !powerup.markedForDeletion);
  particles = particles.filter(particle => !particle.markedForDeletion);
  clones = clones.filter(clone => clone.powerupTime > 0);
}

function initialize() {
  player = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  
  // Create initial asteroids
  for (let i = 0; i < 10; i++) {
    spawnAsteroid();
  }
  
  // Create initial satellites
  for (let i = 0; i < 3; i++) {
    spawnSatellite();
  }
  
  // Start game loop
  lastFrameTime = performance.now();
  requestAnimationFrame(gameLoop);
}

let lastFrameTime = 0;
let lastSecond = 0;

function gameLoop(timestamp) {
  const deltaTime = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  
  if (gameRunning) {
    gameTime += deltaTime;
    
    // Update time display once per second
    if (Math.floor(gameTime / 1000) > lastSecond) {
      lastSecond = Math.floor(gameTime / 1000);
      timeElement.textContent = lastSecond;
    }
    
    // Spawn entities based on difficulty
    if (timestamp - lastEnemySpawn > 5000 / difficultyLevel) {
      spawnEnemy();
      lastEnemySpawn = timestamp;
    }
    
    if (timestamp - lastSatelliteSpawn > 15000) {
      spawnSatellite();
      lastSatelliteSpawn = timestamp;
    }
    
    if (asteroids.length < 10 + difficultyLevel * 2) {
      spawnAsteroid();
    }
    
    // Update entities
    if (player) {
      player.update(deltaTime);
    }
    
    clones.forEach(clone => clone.update(deltaTime));
    bullets.forEach(bullet => bullet.update(deltaTime));
    asteroids.forEach(asteroid => asteroid.update(deltaTime));
    enemies.forEach(enemy => enemy.update(deltaTime));
    satellites.forEach(satellite => satellite.update(deltaTime));
    powerups.forEach(powerup => powerup.update(deltaTime));
    particles.forEach(particle => particle.update());
    
    // Check collisions
    checkCollisions();
    
    // Clean up entities marked for deletion
    cleanupEntities();
    
    // Update difficulty
    updateDifficulty();
  }
  
  // Update scroll position
  updateScrollPosition();
  
  // Draw everything
  drawBackground();
  
  particles.forEach(particle => particle.draw());
  powerups.forEach(powerup => powerup.draw());
  satellites.forEach(satellite => satellite.draw());
  asteroids.forEach(asteroid => asteroid.draw());
  bullets.forEach(bullet => bullet.draw());
  enemies.forEach(enemy => enemy.draw());
  
  // Draw clones before player so player appears on top
  clones.forEach(clone => clone.draw());
  
  if (player) {
    player.draw();
  }
  
  drawMinimap();
  
  requestAnimationFrame(gameLoop);
}

// Start loading images
loadImages();