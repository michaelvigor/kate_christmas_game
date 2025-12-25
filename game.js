// Food configuration (smallest to largest)
const FOODS = [
    { name: 'cranberry', svg: 'assets/cranberry.svg', radius: 25, score: 1 },
    { name: 'sprout', svg: 'assets/sprout.svg', radius: 30, score: 2 },
    { name: 'carrot', svg: 'assets/carrot.svg', radius: 35, score: 4 },
    { name: 'cabbage', svg: 'assets/cabbage.svg', radius: 40, score: 8 },
    { name: 'potato', svg: 'assets/potato.svg', radius: 45, score: 16 },
    { name: 'broccoli', svg: 'assets/broccoli.svg', radius: 50, score: 32 },
    { name: 'yorkshire', svg: 'assets/yorkshire.svg', radius: 55, score: 64 },
    { name: 'sausage', svg: 'assets/sausage.svg', radius: 60, score: 128 },
    { name: 'stuffing', svg: 'assets/stuffing.svg', radius: 68, score: 256 },
    { name: 'turkey', svg: 'assets/turkey.svg', radius: 75, score: 512 },
    { name: 'pudding', svg: 'assets/pudding.svg', radius: 85, score: 1024 }
];

// Weighted spawn probabilities (only first 5 can spawn)
const SPAWN_WEIGHTS = [30, 25, 20, 15, 10, 0, 0, 0, 0, 0, 0];

// Matter.js aliases
const { Engine, Render, Runner, Bodies, Body, Composite, Events } = Matter;

class ChristmasGame {
    constructor() {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.score = 0;
        this.gameOver = false;
        this.currentFood = null;
        this.nextFoodIndex = this.getWeightedRandomFood();
        this.dropCooldown = false;
        this.foodBodies = new Map(); // Map body.id to food index
        this.mergeQueue = []; // Queue for merges to process
        this.gameOverTimer = null;

        this.setupCanvas();
        this.setupPhysics();
        this.setupWalls();
        this.setupCollisionDetection();
        this.setupTouchControls();
        this.preloadImages();
        this.spawnNextFood();
        this.startGameLoop();
    }

    setupCanvas() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupPhysics() {
        this.engine.gravity.y = 1.5;
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);
    }

    setupWalls() {
        const thickness = 60;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Container dimensions
        this.containerPadding = 20;
        this.containerTop = 175;
        this.containerBottom = height - 80;
        this.containerLeft = this.containerPadding;
        this.containerRight = width - this.containerPadding;

        // Death line (game over if food stays above this)
        this.deathLineY = this.containerTop + 50;

        // Physics walls
        this.leftWall = Bodies.rectangle(
            this.containerLeft - thickness/2,
            (this.containerTop + this.containerBottom) / 2,
            thickness,
            this.containerBottom - this.containerTop,
            { isStatic: true, label: 'wall', friction: 0.5 }
        );

        this.rightWall = Bodies.rectangle(
            this.containerRight + thickness/2,
            (this.containerTop + this.containerBottom) / 2,
            thickness,
            this.containerBottom - this.containerTop,
            { isStatic: true, label: 'wall', friction: 0.5 }
        );

        this.floor = Bodies.rectangle(
            width / 2,
            this.containerBottom + thickness/2,
            width,
            thickness,
            { isStatic: true, label: 'floor', friction: 0.8 }
        );

        Composite.add(this.world, [this.leftWall, this.rightWall, this.floor]);
    }

    preloadImages() {
        this.images = {};
        this.imagesLoaded = 0;

        FOODS.forEach((food, index) => {
            const img = new Image();
            img.onload = () => {
                this.imagesLoaded++;
            };
            img.src = food.svg;
            this.images[index] = img;
        });
    }

    getWeightedRandomFood() {
        const totalWeight = SPAWN_WEIGHTS.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < SPAWN_WEIGHTS.length; i++) {
            random -= SPAWN_WEIGHTS[i];
            if (random <= 0) {
                return i;
            }
        }
        return 0;
    }

    spawnNextFood() {
        if (this.gameOver) return;

        const foodIndex = this.nextFoodIndex;
        this.nextFoodIndex = this.getWeightedRandomFood();

        // Update next food preview
        document.getElementById('next-food-img').src = FOODS[this.nextFoodIndex].svg;

        // Create preview food at top (position so top of food is at containerTop)
        const food = FOODS[foodIndex];
        this.currentFood = {
            index: foodIndex,
            x: this.canvas.width / 2,
            y: this.containerTop + food.radius,
            dropped: false
        };
    }

    setupTouchControls() {
        let isDragging = false;

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameOver || this.dropCooldown) return;
            isDragging = true;
            this.updateFoodPosition(e.touches[0]);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isDragging || !this.currentFood || this.currentFood.dropped) return;
            this.updateFoodPosition(e.touches[0]);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.gameOver || !isDragging) return;
            isDragging = false;
            this.dropFood();
        }, { passive: false });

        // Mouse events for desktop testing
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.gameOver || this.dropCooldown) return;
            isDragging = true;
            this.updateFoodPosition(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.currentFood || this.currentFood.dropped) return;
            this.updateFoodPosition(e);
        });

        this.canvas.addEventListener('mouseup', () => {
            if (this.gameOver || !isDragging) return;
            isDragging = false;
            this.dropFood();
        });
    }

    updateFoodPosition(event) {
        if (!this.currentFood || this.currentFood.dropped) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX || event.pageX) - rect.left;
        const radius = FOODS[this.currentFood.index].radius;

        // Clamp within container
        this.currentFood.x = Math.max(
            this.containerLeft + radius,
            Math.min(this.containerRight - radius, x)
        );
    }

    dropFood() {
        if (!this.currentFood || this.currentFood.dropped || this.dropCooldown) return;

        this.currentFood.dropped = true;
        this.dropCooldown = true;

        const food = FOODS[this.currentFood.index];

        // Create physics body
        const body = Bodies.circle(
            this.currentFood.x,
            this.currentFood.y,
            food.radius,
            {
                restitution: 0.3,
                friction: 0.5,
                frictionAir: 0.01,
                density: 0.001,
                label: 'food'
            }
        );

        body.foodIndex = this.currentFood.index;

        Composite.add(this.world, body);
        this.foodBodies.set(body.id, this.currentFood.index);

        // Cooldown before next spawn
        setTimeout(() => {
            this.dropCooldown = false;
            this.spawnNextFood();
        }, 500);
    }

    setupCollisionDetection() {
        Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;

            for (const pair of pairs) {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;

                // Both must be food items
                if (bodyA.label === 'food' && bodyB.label === 'food') {
                    const indexA = this.foodBodies.get(bodyA.id);
                    const indexB = this.foodBodies.get(bodyB.id);

                    // Same type and not already queued for merge?
                    if (indexA === indexB && indexA !== undefined) {
                        // Check if these bodies are already in merge queue
                        const alreadyQueued = this.mergeQueue.some(m =>
                            (m.bodyA.id === bodyA.id || m.bodyB.id === bodyA.id ||
                             m.bodyA.id === bodyB.id || m.bodyB.id === bodyB.id)
                        );

                        if (!alreadyQueued) {
                            this.mergeQueue.push({ bodyA, bodyB, index: indexA });
                        }
                    }
                }
            }
        });
    }

    processMerges() {
        if (this.mergeQueue.length === 0) return;

        const merge = this.mergeQueue.shift();
        const { bodyA, bodyB, index } = merge;

        // Verify bodies still exist
        if (!this.foodBodies.has(bodyA.id) || !this.foodBodies.has(bodyB.id)) {
            return;
        }

        // Calculate merge position
        const midX = (bodyA.position.x + bodyB.position.x) / 2;
        const midY = (bodyA.position.y + bodyB.position.y) / 2;

        // Remove old bodies
        Composite.remove(this.world, bodyA);
        Composite.remove(this.world, bodyB);
        this.foodBodies.delete(bodyA.id);
        this.foodBodies.delete(bodyB.id);

        // Add score
        this.score += FOODS[index].score * 2;
        document.getElementById('score').textContent = this.score;

        // Check if max level (Christmas puddings)
        if (index >= FOODS.length - 1) {
            // Puddings disappear when merged!
            return;
        }

        // Create upgraded food
        const newIndex = index + 1;
        const newFood = FOODS[newIndex];

        const newBody = Bodies.circle(
            midX, midY,
            newFood.radius,
            {
                restitution: 0.3,
                friction: 0.5,
                frictionAir: 0.01,
                density: 0.001,
                label: 'food'
            }
        );

        newBody.foodIndex = newIndex;

        Composite.add(this.world, newBody);
        this.foodBodies.set(newBody.id, newIndex);
    }

    startGameLoop() {
        const loop = () => {
            if (this.gameOver) return;

            this.update();
            this.render();
            requestAnimationFrame(loop);
        };

        loop();
    }

    update() {
        // Process any pending merges
        this.processMerges();

        // Check for game over condition
        let foodAboveLine = false;
        const bodies = Composite.allBodies(this.world);

        for (const body of bodies) {
            if (body.label === 'food') {
                const foodIndex = this.foodBodies.get(body.id);
                if (foodIndex !== undefined) {
                    const foodRadius = FOODS[foodIndex].radius;
                    // Check if top of food is above death line
                    if (body.position.y - foodRadius < this.deathLineY) {
                        // Check if mostly settled (not just passing through)
                        if (Math.abs(body.velocity.y) < 0.5 && Math.abs(body.velocity.x) < 0.5) {
                            foodAboveLine = true;
                            break;
                        }
                    }
                }
            }
        }

        if (foodAboveLine && !this.gameOverTimer) {
            // Start game over countdown
            this.gameOverTimer = setTimeout(() => {
                this.endGame();
            }, 2000);
        } else if (!foodAboveLine && this.gameOverTimer) {
            // Cancel countdown if food moved below line
            clearTimeout(this.gameOverTimer);
            this.gameOverTimer = null;
        }
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw container box
        this.drawContainer();

        // Draw death line
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.containerLeft, this.deathLineY);
        this.ctx.lineTo(this.containerRight, this.deathLineY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw current food preview (before drop)
        if (this.currentFood && !this.currentFood.dropped) {
            this.drawFood(
                this.currentFood.x,
                this.currentFood.y,
                this.currentFood.index,
                0.7
            );

            // Draw drop guide line
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([10, 10]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentFood.x, this.currentFood.y);
            this.ctx.lineTo(this.currentFood.x, this.containerBottom);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // Draw all physics food bodies
        const bodies = Composite.allBodies(this.world);
        for (const body of bodies) {
            if (body.label === 'food') {
                const foodIndex = this.foodBodies.get(body.id);
                if (foodIndex !== undefined) {
                    this.drawFood(
                        body.position.x,
                        body.position.y,
                        foodIndex,
                        1,
                        body.angle
                    );
                }
            }
        }
    }

    drawFood(x, y, foodIndex, alpha = 1, angle = 0) {
        const food = FOODS[foodIndex];
        const img = this.images[foodIndex];

        if (!img || !img.complete) return;

        const size = food.radius * 2;

        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        this.ctx.drawImage(img, -size/2, -size/2, size, size);
        this.ctx.restore();
    }

    drawContainer() {
        // Draw container box outline
        this.ctx.strokeStyle = 'rgba(139, 69, 19, 0.9)';
        this.ctx.lineWidth = 5;
        this.ctx.lineJoin = 'round';

        // Draw container as a U-shape
        this.ctx.beginPath();
        this.ctx.moveTo(this.containerLeft - 5, this.containerTop);
        this.ctx.lineTo(this.containerLeft - 5, this.containerBottom);
        this.ctx.lineTo(this.containerRight + 5, this.containerBottom);
        this.ctx.lineTo(this.containerRight + 5, this.containerTop);
        this.ctx.stroke();

        // Add inner shadow effect
        this.ctx.strokeStyle = 'rgba(89, 44, 13, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.containerLeft, this.containerTop);
        this.ctx.lineTo(this.containerLeft, this.containerBottom - 3);
        this.ctx.lineTo(this.containerRight, this.containerBottom - 3);
        this.ctx.lineTo(this.containerRight, this.containerTop);
        this.ctx.stroke();
    }

    endGame() {
        this.gameOver = true;
        Runner.stop(this.runner);

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('game-over-overlay').classList.remove('hidden');
    }

    restart() {
        // Clear all bodies except walls
        const bodies = Composite.allBodies(this.world);
        for (const body of bodies) {
            if (body.label === 'food') {
                Composite.remove(this.world, body);
            }
        }
        this.foodBodies.clear();
        this.mergeQueue = [];

        // Reset state
        this.score = 0;
        this.gameOver = false;
        this.dropCooldown = false;
        this.gameOverTimer = null;
        document.getElementById('score').textContent = '0';
        document.getElementById('game-over-overlay').classList.add('hidden');

        // Restart physics
        Runner.run(this.runner, this.engine);

        // Spawn first food
        this.nextFoodIndex = this.getWeightedRandomFood();
        this.spawnNextFood();
        this.startGameLoop();
    }
}

// Initialize game when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ChristmasGame();

    document.getElementById('restart-btn').addEventListener('click', () => {
        window.game.restart();
    });
});
