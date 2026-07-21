const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let player, cursors, wasd, uiText, interactables;
let activeDialogueInstance = null;
let victoryTriggered = false;

// Sound instances
let sfxSfxBgMusic, sfxNpcSpeak, sfxStatueMove, sfxTorchWhoosh, sfxTorchCrack, sfxPageFlip, sfxSuccessMission, sfxSpellLearned, sfxSuccessChime, sfxOpenChest;

const gameState = {
    hasSpell: false,
    hasLighter: false,
    torchSequence: [],
    correctTorchOrder: [], 
    correctStatueAngles: [], 
    statueAngles: [0, 0, 0, 0],
    correctBookIndex: 0, 
    gatesOpened: { torchRoomAccess: false, endHallwayAccess: false },
    chestOpened: false
};

const colors = ['Red', 'Blue', 'Green', 'Brown'];
const hexColors = [0xff0000, 0x0000ff, 0x00ff00, 0x8b4513];
const possibleAngles = [0, 45, 90, 135, 180, 225, 270, 315];

function preload() {
    // --- SPRITES & ANIMS ---
    this.load.spritesheet('character', 'sprite/character.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('bookAsset', 'sprite/book.png'); 
    this.load.image('dragonAsset', 'sprite/dragon.png'); 
    this.load.image('npcAsset', 'sprite/npc.png'); 
    this.load.image('torchAsset', 'sprite/torch.png'); 
    this.load.spritesheet('torchAnimated', 'sprite/Torch Animated.png', { frameWidth: 64, frameHeight: 64 }); 
    this.load.image('chestStatic', 'sprite/Wooden Chest 2 - frame  00.png'); 
    this.load.spritesheet('chestAnimated', 'sprite/Wooden Chest 2 - Spritesheet.png', { frameWidth: 48, frameHeight: 32 }); 

    // --- MAP & TILESET ---
    this.load.tilemapTiledJSON('dungeonMap', 'assets/dungeonv4.json');
    this.load.image('dungeonTiles', 'tileset/Dungeon_FloorsWallsA5.png'); 

    // --- SOUND EFFECTS ---
    this.load.audio('npcSpeak', 'sound/blue-archive-respond-chat.mp3');
    this.load.audio('statueMove', 'sound/concrete-tap-gtag.mp3');
    this.load.audio('bgMusic', 'sound/deuslower-dark-fantasy-ambient-dungeon-synth-music-281592.mp3');
    this.load.audio('torchWhoosh', 'sound/fire-whoosh.mp3');
    this.load.audio('torchCrack', 'sound/fogo-lighter.mp3');
    this.load.audio('pageFlip', 'sound/page-flip-sound-effect.mp3');
    this.load.audio('successMission', 'sound/pokemon-black-and-white-ost-disc-3-mission-success.mp3');
    this.load.audio('spellLearned', 'sound/spell-learned.mp3');
    this.load.audio('successChime', 'sound/success-chime.mp3');
    this.load.audio('openChest', 'sound/zelda-chest.mp3');
}

function create() {
    interactables = this.physics.add.staticGroup();

    // --- AUDIO INITIALIZATION ---
    sfxSfxBgMusic = this.sound.add('bgMusic', { volume: 0.25, loop: true });
    sfxSfxBgMusic.play();

    sfxNpcSpeak = this.sound.add('npcSpeak', { volume: 0.6 });
    sfxStatueMove = this.sound.add('statueMove', { volume: 0.7 });
    sfxTorchWhoosh = this.sound.add('torchWhoosh', { volume: 0.6 });
    sfxTorchCrack = this.sound.add('torchCrack', { volume: 0.4, loop: true });
    sfxPageFlip = this.sound.add('pageFlip', { volume: 0.6 });
    sfxSuccessMission = this.sound.add('successMission', { volume: 0.7 });
    sfxSpellLearned = this.sound.add('spellLearned', { volume: 0.7 });
    sfxSuccessChime = this.sound.add('successChime', { volume: 0.7 });
    sfxOpenChest = this.sound.add('openChest', { volume: 0.7 });

    // --- 1. RENDER TILED MAP & LAYERS ---
    const map = this.make.tilemap({ key: 'dungeonMap' });
    const tilesetName = (map.tilesets && map.tilesets.length > 0) ? map.tilesets[0].name : 'dungeon';
    const tileset = map.addTilesetImage(tilesetName, 'dungeonTiles');

    if (tileset) {
        const voidLayer = map.createLayer('void', tileset, 0, 0);
        const floorLayer = map.createLayer('Floor Layers', tileset, 0, 0);
        const wallLayer = map.createLayer('Wall Layers', tileset, 0, 0);
        const wall2Layer = map.createLayer('Wall 2 Layers', tileset, 0, 0);

        if (voidLayer) voidLayer.setDepth(-15);
        if (floorLayer) floorLayer.setDepth(-10);
        if (wallLayer) {
            wallLayer.setDepth(-5);
            wallLayer.setCollisionByExclusion([-1]);
        }
        if (wall2Layer) {
            wall2Layer.setDepth(-5);
            wall2Layer.setCollisionByExclusion([-1]);
        }
    }

    // --- 2. RANDOMIZE PUZZLE SOLUTIONS ---
    gameState.correctBookIndex = Phaser.Math.Between(0, 4);
    
    let torchPool = [1, 2, 3, 4];
    gameState.correctTorchOrder = Phaser.Utils.Array.Shuffle(torchPool);

    let angleClues = [];
    for (let i = 0; i < 4; i++) {
        let randAngle = possibleAngles[Phaser.Math.Between(0, possibleAngles.length - 1)];
        gameState.correctStatueAngles.push(randAngle);
        gameState.statueAngles[i] = (randAngle + 90) % 360;
        angleClues.push(`${colors[i]} = ${randAngle}°`);
    }

    let clueIndex = 0;
    const bookClues = [];
    for (let i = 0; i < 5; i++) {
        if (i === gameState.correctBookIndex) {
            bookClues.push("✨ This book contains the ancient Magic Spell scroll! ✨");
        } else {
            bookClues.push(`📜 Clue Fragment: "${angleClues[clueIndex]}"`);
            clueIndex++;
        }
    }

    // Header title style
    const titleStyle = { font: "bold 15px Arial", fill: "#ffffff", stroke: "#000000", strokeThickness: 4 };

    // --- 3. TOP-LEFT ROOM: THE LIBRARY ---
    // Shifted right to 90px and up to 35px
    this.add.text(100, 45, "📚 THE LIBRARY", { ...titleStyle, fill: "#88ccff" }).setDepth(10);
    for (let i = 0; i < 5; i++) {
        let posX = 120 + (i * 90);
        let posY = 150;
        this.add.circle(posX, posY, 18, 0x5d4037).setStrokeStyle(2, 0xd7ccc8);
        this.add.sprite(posX, posY, 'bookAsset').setScale(0.04);

        let hitZone = this.add.rectangle(posX, posY, 48, 48, 0x000, 0).setInteractive();
        interactables.add(hitZone);
        
        this.add.text(posX, posY + 24, `${i + 1}`, { font: "bold 12px Arial", fill: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5);
        hitZone.setData('type', 'book').setData('id', i).setData('clue', bookClues[i]);
    }

    // --- 4. BOTTOM-LEFT ROOM: DRAGON CHAMBER ---
    // Shifted Y positions up by 12px so dragons sit perfectly centered on pedestals
    const pedestalPositions = [
        { x: 120, y: 460 }, // Top-Left Pedestal
        { x: 248, y: 460 }, // Top-Right Pedestal
        { x: 120, y: 590 }, // Bottom-Left Pedestal
        { x: 248, y: 590 }  // Bottom-Right Pedestal
    ];

    // Shifted room title up to 380px and right to 90px
    this.add.text(90, 380, "🗿 DRAGON CHAMBER", { ...titleStyle, fill: "#ffcc88" }).setDepth(10);
    for (let i = 0; i < 4; i++) {
        let posX = pedestalPositions[i].x;
        let posY = pedestalPositions[i].y;
        let dragon = this.add.sprite(posX, posY, 'dragonAsset').setTint(hexColors[i]).setScale(0.045);
        
        let dragonHitZone = this.add.rectangle(posX, posY, 50, 60, 0x000, 0).setInteractive();
        interactables.add(dragonHitZone);
        dragonHitZone.setData('type', 'statue').setData('id', i).setData('art', dragon);

        // High contrast text label
        let label = this.add.text(posX, posY - 28, `${gameState.statueAngles[i]}°`, { font: "bold 13px monospace", fill: "#000000", stroke: "#ffffff", strokeThickness: 3 }).setOrigin(0.5).setDepth(5);
        dragonHitZone.setData('labelText', label);
    }

    // --- 5. TOP-RIGHT ROOM: TORCH ROOM ---
    // Shifted room title up to 35px and right to 810px
    this.add.text(810, 45, "🔥 TORCH ROOM", { ...titleStyle, fill: "#ff8888" }).setDepth(10);
    this.anims.create({
        key: 'burn',
        frames: this.anims.generateFrameNumbers('torchAnimated', { start: 0, end: 7 }),
        frameRate: 12,
        repeat: -1
    });

    for (let i = 0; i < 4; i++) {
        let posX = 800 + (i * 120);
        let posY = 150;
        let base = this.add.sprite(posX, posY, 'torchAsset');
        let fire = this.add.sprite(posX, posY - 17, 'torchAnimated').setVisible(false).setScale(0.7);
        let hitArea = this.add.rectangle(posX, posY, 50, 60, 0x000, 0).setInteractive();
        let light = this.add.circle(posX, posY - 17, 50, 0xffaa00, 0.15).setVisible(false);
        
        interactables.add(hitArea);
        hitArea.setData('type', 'torch').setData('id', i + 1).setData('fire', fire).setData('light', light);
        this.add.text(posX, posY + 24, `${i+1}`, { font: "bold 12px monospace", fill: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5);
    }

    // --- 6. BOTTOM-RIGHT ROOM: TREASURE & NPC ---
    // Shifted room title up to 380px and right to 810px
    this.add.text(810, 350, "👑 TREASURE ROOM", { ...titleStyle, fill: "#88ff88" }).setDepth(10);

    let npc = this.add.sprite(1000, 520, 'npcAsset').setScale(0.06); 
    let npcHitZone = this.add.rectangle(1000, 520, 50, 60, 0x000, 0).setInteractive();
    interactables.add(npcHitZone);
    npcHitZone.setData('type', 'npc');

    let chest = this.add.sprite(1120, 520, 'chestStatic');
    let chestHitZone = this.add.rectangle(1120, 520, 50, 50, 0x000, 0).setInteractive();
    interactables.add(chestHitZone);
    chestHitZone.setData('type', 'chest').setData('art', chest);

    this.anims.create({
        key: 'chestOpen',
        frames: this.anims.generateFrameNumbers('chestAnimated', { start: 0, end: 4 }),
        frameRate: 8,
        repeat: 0
    });

    // --- 7. PLAYER SPAWN & MAP COLLIDERS ---
    player = this.physics.add.sprite(100, 150, 'character', 0).setScale(1.2).setCollideWorldBounds(true);
    
    let wallLayer = map.getLayer('Wall Layers') ? map.getLayer('Wall Layers').tilemapLayer : null;
    let wall2Layer = map.getLayer('Wall 2 Layers') ? map.getLayer('Wall 2 Layers').tilemapLayer : null;

    if (wallLayer) this.physics.add.collider(player, wallLayer);
    if (wall2Layer) this.physics.add.collider(player, wall2Layer);

    // --- 8. UI TEXT & CONTROLS ---
    let uiBg = this.add.rectangle(640, 685, 1200, 40, 0x000000, 0.75).setDepth(100);
    uiText = this.add.text(40, 675, "Objective: Walk up to a book and press SPACEBAR to inspect it.", { font: "15px Arial", fill: "#ffffff" }).setDepth(101);

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('character', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('character', { start: 24, end: 31 }), frameRate: 10, repeat: -1 });
    player.play('idle');
}

function handleInteraction(obj) {
    const type = obj.getData('type');

    if (type === 'book') {
        sfxPageFlip.play();

        let isCorrect = (obj.getData('id') === gameState.correctBookIndex);
        let textClue = obj.getData('clue');

        if (isCorrect && !gameState.hasSpell) {
            gameState.hasSpell = true;
            sfxSpellLearned.play();

            uiText.setText("✨ Magic spell learned! Rotate the Dragon Statues in the bottom-left chamber.");
            
            let particles = this.add.particles(0, 0, 'bookAsset', {
                speed: 120,
                scale: { start: 0.02, end: 0 },
                blendMode: 'ADD',
                lifespan: 800,
                tint: 0x00aaff
            });
            particles.startFollow(player);
            this.time.delayedCall(1000, () => particles.destroy());
        } else {
            uiText.setText(textClue);
        }
    }

    if (type === 'statue') {
        if (!gameState.hasSpell) {
            uiText.setText("🔒 The dragons are completely static. You need a magic spell!");
            return;
        }
        if (gameState.hasLighter) return;

        sfxStatueMove.play();

        let id = obj.getData('id');
        gameState.statueAngles[id] = (gameState.statueAngles[id] + 45) % 360;
        obj.getData('labelText').setText(`${gameState.statueAngles[id]}°`);

        if (gameState.statueAngles.every((angle, idx) => angle === gameState.correctStatueAngles[idx])) {
            gameState.hasLighter = true;
            gameState.gatesOpened.torchRoomAccess = true;
            sfxSuccessChime.play();

            uiText.setText("⚡ Success! Dragons aligned. Obtained the LIGHTER! Proceed to the Torch Room (top right).");
        }
    }

    if (type === 'torch') {
        if (!gameState.hasLighter) {
            uiText.setText("❌ You cannot ignite these torches. You need the Lighter!");
            return;
        }

        let id = obj.getData('id');
        let fireSprite = obj.getData('fire');
        let lightSprite = obj.getData('light');

        if (gameState.torchSequence.includes(id)) return;

        sfxTorchWhoosh.play();
        if (!sfxTorchCrack.isPlaying) sfxTorchCrack.play();

        gameState.torchSequence.push(id);
        fireSprite.setVisible(true).play('burn');
        lightSprite.setVisible(true);

        let step = gameState.torchSequence.length - 1;
        if (gameState.torchSequence[step] !== gameState.correctTorchOrder[step]) {
            uiText.setText("💨 Wrong order! The flames fizzle out. Start over!");
            gameState.torchSequence = [];
            
            sfxTorchCrack.stop();

            this.children.list.forEach(child => {
                if (child.getData && child.getData('type') === 'torch') {
                    child.getData('fire').setVisible(false).stop();
                    child.getData('light').setVisible(false);
                }
            });
        } else if (gameState.torchSequence.length === 4) {
            sfxSuccessChime.play();
            uiText.setText("🔥 Fantastic! All torches burning. Speak to the NPC in the Treasure Room.");
        }
    }

    if (type === 'npc') {
        sfxNpcSpeak.play();
        triggerDialogueTree.call(this);
    }

    if (type === 'chest') {
        if (gameState.torchSequence.length < 4) {
            uiText.setText("The treasure chest is locked down tight by protective spells.");
            return;
        }
        if (gameState.chestOpened) return;

        gameState.chestOpened = true;
        sfxOpenChest.play();

        let chestArt = obj.getData('art');
        chestArt.setTexture('chestAnimated');
        chestArt.play('chestOpen');

        uiText.setText("💰 Opened! Found legendary relic contents. Head right through the wall opening to complete the level!");

        let alert = this.add.text(640, 250, "+5000 GOLD", { font: "bold 40px Arial", fill: "#ffd700", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(200);
        this.tweens.add({ targets: alert, y: 180, alpha: 0, duration: 2000, onComplete: () => alert.destroy() });

        gameState.gatesOpened.endHallwayAccess = true;
        openEndHallway.call(this);
    }
}

function triggerDialogueTree() {
    if (activeDialogueInstance) return;

    let dialogues = [];
    if (gameState.torchSequence.length < 4) {
        dialogues = [
            { text: "NPC: 'Hello there.'", options: [{ text: "Hello", next: 2 }, { text: "Goodbye", next: -1 }] },
            { text: "NPC: 'Hello adventurer, nice to see you here.'", options: [{ text: "What are you doing here?", next: 3 }] },
            { text: "NPC: 'I am guarding this ancient space.'", options: [{ text: "I'm trying to figure out the torch puzzle.", next: 4 }, { text: "Just passing by.", next: -1 }] },
            { text: "NPC: 'I can help you with that.'", options: [{ text: "Really? That would be nice.", next: 5 }, { text: "No, thanks.", next: -1 }] },
            { text: `NPC: 'The order of torches is: [ ${gameState.correctTorchOrder.join(' - ')} ]'`, options: [{ text: "Thanks!", next: -1 }] }
        ];
    } else {
        dialogues = [
            { text: "NPC: 'Great job adventurer, the treasure is yours!'", options: [{ text: "Thanks again, good luck now.", next: 1 }] },
            { text: "NPC: 'See you around!'", options: [{ text: "[Leave Conversation]", next: -1 }] }
        ];
    }

    renderDialogueWindow.call(this, dialogues, 0);
}

function renderDialogueWindow(tree, index) {
    if (index === -1) {
        if (activeDialogueInstance) activeDialogueInstance.destroy();
        activeDialogueInstance = null;
        return;
    }

    if (activeDialogueInstance) activeDialogueInstance.destroy();

    const node = tree[index];
    const box = this.add.container(390, 480).setDepth(300);
    activeDialogueInstance = box;

    let bg = this.add.rectangle(0, 0, 500, 160, 0x000000, 0.85).setOrigin(0).setStrokeStyle(2, 0xffffff);
    let mainTxt = this.add.text(20, 20, node.text, { font: "15px Arial", fill: "#fff", wordWrap: { width: 460 } });
    box.add([bg, mainTxt]);

    node.options.forEach((opt, i) => {
        let optText = this.add.text(30, 80 + (i * 30), `> ${opt.text}`, { font: "14px Arial", fill: "#00ff66" }).setInteractive();
        box.add(optText);
        optText.on('pointerdown', () => {
            sfxNpcSpeak.play();
            renderDialogueWindow.call(this, tree, opt.next);
        });
    });
}

function openEndHallway() {
    let wallBreaker = this.add.rectangle(1255, 512, 30, 80, 0x00ff00, 0);
    this.physics.add.existing(wallBreaker, true);
    
    this.physics.add.overlap(player, wallBreaker, () => {
        if (!victoryTriggered) {
            victoryTriggered = true;
            triggerVictoryScene.call(this);
        }
    });
}

function triggerVictoryScene() {
    player.setVelocity(0);
    this.physics.world.colliders.destroy();

    if (sfxSfxBgMusic) sfxSfxBgMusic.stop();
    if (sfxTorchCrack) sfxTorchCrack.stop();
    sfxSuccessMission.play();

    let view = this.add.container(0, 720).setDepth(500);
    let cover = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.95).setOrigin(0);
    let vicText = this.add.text(640, 250, "LEVEL PASSED", { font: "bold 52px Arial", fill: "#00ff66" }).setOrigin(0.5);
    view.add([cover, vicText]);

    let btnReset = this.add.text(520, 400, "[ Play Again ]", { font: "22px Arial", fill: "#ffffff" }).setInteractive();
    let btnNext = this.add.text(720, 400, "[ Progress Next ]", { font: "22px Arial", fill: "#ffffff" }).setInteractive();
    view.add([btnReset, btnNext]);

    this.tweens.add({
        targets: view,
        y: 0,
        duration: 1500,
        ease: 'Power2'
    });

    btnReset.on('pointerdown', () => {
        victoryTriggered = false;
        this.scene.restart();
    });

    btnNext.on('pointerdown', () => {
        let devNotice = this.add.text(640, 500, "Oops, looks like the level is under development. Stay tuned!", { font: "18px Arial", fill: "#ffaa00" }).setOrigin(0.5);
        this.tweens.add({ targets: devNotice, alpha: 0, delay: 3000, duration: 1000, onComplete: () => devNotice.destroy() });
    });
}

function update() {
    if (victoryTriggered || activeDialogueInstance) {
        player.setVelocity(0);
        player.play('idle', true);
        return;
    }

    this.children.list.forEach(child => {
        if (child.getData && child.getData('type') === 'torch' && child.getData('light').visible) {
            child.getData('light').setAlpha(Phaser.Math.FloatBetween(0.12, 0.25));
        }
    });

    const speed = 180;
    player.setVelocity(0);
    let moving = false;

    if (cursors.left.isDown || wasd.left.isDown) {
        player.setVelocityX(-speed); player.setFlipX(true); moving = true;
    } else if (cursors.right.isDown || wasd.right.isDown) {
        player.setVelocityX(speed); player.setFlipX(false); moving = true;
    }

    if (cursors.up.isDown || wasd.up.isDown) {
        player.setVelocityY(-speed); moving = true;
    } else if (cursors.down.isDown || wasd.down.isDown) {
        player.setVelocityY(speed); moving = true;
    }

    if (moving) {
        player.play('walk', true);
    } else {
        player.play('idle', true);
    }

    this.physics.overlap(player, interactables, (p, obj) => {
        if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
            handleInteraction.call(this, obj);
        }
    });
}