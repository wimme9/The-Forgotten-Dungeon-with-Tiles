const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 600,
    backgroundColor: '#2d2d2d',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let player, cursors, wasd;
let dialogBox, dialogText, typewriteTimer; 
let endScreen, endText; 
let choicesContainer; 

let gameState = {};

function resetGameState() {
    gameState = {
        hasSpell: false,
        hasLighter: false,
        hasKey: false,
        gameWon: false,
        isGameOver: false, 
        isCutscene: false, 
        statuesMoved: false,
        statueAngles: [90, 180, 270, 90], 
        statueSpins: [0, 0, 0, 0], 
        torchSequence: [],
        correctTorchOrder: [3, 1, 4, 2], 
        torchFails: 0, 
        gatesOpened: { statue: false, magic: false }, 
        npcTalkAfterSolve: 0,
        chestOpened: false, 
        correctChestId: 2,
        uncleFarewellTriggered: false
    };
}
resetGameState();

function preload() {
    this.load.spritesheet('character', 'sprite/character.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('bookItem', 'Notebook/book.png'); 
    this.load.image('moai', 'Statue/imagery.png'); 
    this.load.image('torch', 'torch/link.png'); 
    this.load.image('npcSprite', 'People/npc.png'); 
    this.load.image('chestSprite', 'Treasure chest/property.png'); 
    this.load.image('gate', 'door/gate.png'); 

    this.load.image('tiles', 'Tiled Map/mainlevbuild.png'); 
    this.load.tilemapTiledJSON('map', 'Wall2.tmj'); 

    // 🎵 โหลดไฟล์เสียง 
    this.load.audio('doorSound', 'minigame/sound/opening-a-door-roblox-doors.mp3');
    this.load.audio('bookSound', 'page-flip-sound-effect.mp3'); 
    this.load.audio('statueSound', 'the-rock-sound-effect.mp3');
    this.load.audio('torchSound', 'fire-whoosh.mp3');
    this.load.audio('chestSound', 'chest-opening.mp3'); 

    // 🟢 โหลดไฟล์เพลงพื้นหลัง
    this.load.audio('bgmDungeon', 'Dungeon.mp3'); 
}

function playSound(scene, key) {
    if (scene.cache.audio.exists(key)) {
        scene.sound.play(key);
    } else {
        console.warn(`หาไฟล์เสียง ${key} ไม่เจอ! โปรดเช็คชื่อไฟล์หรือนามสกุล`);
    }
}

function create() {
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // 🟢 แก้ไขปัญหาเรื่อง Browser บล็อกเสียง Autoplay
    // ฟังก์ชันสำหรับเริ่มเล่นเพลง
    const startBGM = () => {
        let bgm = this.sound.get('bgmDungeon');
        // ถ้ายังไม่มีเพลงอยู่ในระบบ ให้เล่นใหม่เลย
        if (!bgm) {
            this.sound.play('bgmDungeon', { loop: true, volume: 0.3 });
        } 
        // ถ้ามีอยู่แล้วแต่หยุดไป ให้สั่งเล่นต่อ
        else if (!bgm.isPlaying) {
            bgm.play({ loop: true, volume: 0.3 });
        }
    };

    // 🟢 สั่งให้รอผู้เล่น "คลิกเมาส์" หรือ "กดปุ่มคีย์บอร์ด" ครั้งแรก เพลงถึงจะดัง
    this.input.once('pointerdown', startBGM);
    this.input.keyboard.once('keydown', startBGM);

    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('mainlevbuild_1', 'tiles');
    
    const wallLayer = map.createLayer('Wall Layer', tileset, 0, 0);
    wallLayer.setCollisionByExclusion([-1]);

    const interactables = this.physics.add.staticGroup();

    // 📍 ห้อง 1 (ซ้ายบน) : ห้องหนังสือ
    const bookPositions = [{ x: 180, y: 120 }, { x: 430, y: 120 }, { x: 180, y: 240 }, { x: 430, y: 240 }];
    for (let i = 0; i < 4; i++) {
        let book = interactables.create(bookPositions[i].x, bookPositions[i].y, 'bookItem');
        book.setDisplaySize(40, 30).refreshBody().setData('type', 'book').setData('id', i + 1);
    }

    // 📍 ห้อง 2 (ขวาบน) : ห้องรูปปั้น
    const statuePositions = [{ x: 720, y: 120 }, { x: 900, y: 120 }, { x: 720, y: 240 }, { x: 900, y: 240 }];
    for (let i = 0; i < 4; i++) {
        let statue = interactables.create(statuePositions[i].x, statuePositions[i].y, 'moai');
        statue.setScale(0.1).refreshBody().setData('type', 'statue').setData('id', i).setAngle(gameState.statueAngles[i]); 
    }

    // 📍 ห้อง 3 (ซ้ายล่าง) : ห้องคบเพลิง
    const torchPositions = [{ x: 180, y: 430 }, { x: 430, y: 430 }, { x: 180, y: 550 }, { x: 430, y: 550 }];
    for (let i = 0; i < 4; i++) {
        let torch = interactables.create(torchPositions[i].x, torchPositions[i].y, 'torch');
        torch.setScale(0.05).refreshBody().setTint(0x333333).setData('type', 'torch').setData('id', i + 1);
        this.add.text(torchPositions[i].x - 5, torchPositions[i].y + 20, `${i+1}`, { font: "12px Arial", fill: "#bbb" });
    }

    // 📍 ห้อง 4 (ขวาล่าง) : NPC, หีบสมบัติ, ประตูทางออก
    let npc = interactables.create(680, 490, 'npcSprite'); 
    npc.setScale(0.075).refreshBody().setData('type', 'npc');

    const chestPositions = [{ x: 760, y: 490 }, { x: 830, y: 490 }, { x: 900, y: 490 }];
    for (let i = 0; i < 3; i++) {
        let chest = interactables.create(chestPositions[i].x, chestPositions[i].y, 'chestSprite');
        chest.setScale(0.035).refreshBody().setData('type', 'chest').setData('id', i + 1);
    }

    let exitGate = interactables.create(960, 490, 'gate');
    exitGate.setScale(0.09).refreshBody().setData('type', 'gate');

    // ตัวละครผู้เล่น เกิดที่ห้อง 1
    player = this.physics.add.sprite(100, 180, 'character', 0).setScale(1.5).setCollideWorldBounds(true);
    
    this.physics.add.collider(player, wallLayer);

    dialogBox = this.add.container(500, 510).setDepth(100); 
    let dialogBg = this.add.rectangle(0, 0, 800, 120, 0x000000).setStrokeStyle(4, 0xffffff);
    dialogText = this.add.text(-370, -40, "", { font: "20px Courier", fill: "#ffffff", wordWrap: { width: 740, useAdvancedWrap: true } });
    dialogBox.add([dialogBg, dialogText]).setVisible(false);

    choicesContainer = this.add.container(500, 360).setDepth(150).setVisible(false);
    const choiceStyle = { font: "18px Courier", fill: "#ffff00", backgroundColor: "#333333" };
    const choice1 = this.add.text(-350, -30, " ► [1] ลุงครับ หัวลุงหงอกหมดแล้ว เอาหัวจุดไฟแทนคบเพลิงได้ไหม? ", choiceStyle).setPadding(5).setInteractive({ useHandCursor: true });
    const choice2 = this.add.text(-350, 10, " ► [2] ลุงพอจะจำลำดับการจุดคบเพลิงได้ไหม? ", choiceStyle).setPadding(5).setInteractive({ useHandCursor: true });
    const choice3 = this.add.text(-350, 50, " ► [3] ไม่มีอะไรครับ ลาก่อน ", { font: "18px Courier", fill: "#ff5555", backgroundColor: "#333333" }).setPadding(5).setInteractive({ useHandCursor: true });

    choice1.on('pointerdown', () => { choicesContainer.setVisible(false); showDialog(this, "* NPC: 'เดี๋ยวปั๊ดเหนี่ยว! หัวคนนะเว้ยไม่ใช่ไม้ขีดไฟ! อยากได้ไฟก็ไปแก้ปริศนาห้องขวาสิวะไอ้หนุ่ม!'"); });
    choice2.on('pointerdown', () => { choicesContainer.setVisible(false); showDialog(this, "* NPC: 'ถ้าลุงจำไม่ผิด... ลำดับน่าจะเป็น 3-1-4-2 นะ อย่าลืมล่ะ!'"); });
    choice3.on('pointerdown', () => { choicesContainer.setVisible(false); dialogBox.setVisible(false); });

    [choice1, choice2, choice3].forEach((c, index) => {
        let originalColor = index === 2 ? '#ff5555' : '#ffff00';
        c.on('pointerover', () => c.setStyle({ fill: '#ffffff', backgroundColor: '#555555' }));
        c.on('pointerout', () => c.setStyle({ fill: originalColor, backgroundColor: '#333333' }));
    });
    choicesContainer.add([choice1, choice2, choice3]);

    endScreen = this.add.rectangle(500, 300, 1000, 600, 0x000000).setDepth(200).setAlpha(0);
    endText = this.add.text(500, 300, "คุณรอดแล้ว!", { font: "bold 60px Arial", fill: "#00ff00" }).setOrigin(0.5).setDepth(201).setAlpha(0);

    let lastInteractTime = 0; 

    this.physics.add.overlap(player, interactables, (p, obj) => {
        if (gameState.gameWon || gameState.isGameOver || gameState.isCutscene) return; 

        if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
            let currentTime = this.time.now;
            if (currentTime - lastInteractTime > 200) {
                lastInteractTime = currentTime;
                handleInteraction(obj, this); 
            }
        }
    }, null, this);

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('character', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('character', { start: 24, end: 31 }), frameRate: 10, repeat: -1 });
    player.play('idle');
}

function showDialog(scene, text) {
    dialogBox.setVisible(true); 
    if (typewriteTimer) typewriteTimer.remove(); 
    dialogText.setText(""); 
    let i = 0;
    typewriteTimer = scene.time.addEvent({ delay: 30, callback: () => { dialogText.text += text[i]; i++; }, repeat: text.length - 1 });
}

async function startNpcTorchCutscene(scene, npc, torches) {
    gameState.isCutscene = true;
    const moveTo = (targetX, targetY, durationMs) => {
        return new Promise(resolve => {
            scene.tweens.add({ targets: npc, x: targetX, y: targetY, duration: durationMs, onUpdate: () => npc.refreshBody(), onComplete: resolve });
        });
    };
    const delay = (ms) => new Promise(resolve => scene.time.delayedCall(ms, resolve));

    await moveTo(550, 490, 800); 
    await moveTo(305, 490, 1500);  

    showDialog(scene, "* NPC: 'โอยยยย! ลุงทนดูไม่ได้แล้ว จุดผิดตั้ง 3 รอบ! หลบไปไอ้หนุ่ม ลุงจัดการเอง!'");
    await delay(3000);
    dialogBox.setVisible(false);

    const torchCoords = { 1: { x: 180, y: 430 }, 2: { x: 430, y: 430 }, 3: { x: 180, y: 550 }, 4: { x: 430, y: 550 } };

    for (let torchId of gameState.correctTorchOrder) {
        let coords = torchCoords[torchId];
        await moveTo(coords.x, coords.y, 600);
        let t = torches.find(child => child.getData('id') === torchId);
        if (t) t.clearTint(); 
        if (!gameState.torchSequence.includes(torchId)) {
            gameState.torchSequence.push(torchId);
            playSound(scene, 'torchSound'); 
        }
        await delay(300);
    }

    await moveTo(305, 490, 600); 
    showDialog(scene, "* NPC: 'เห็นไหม! 3-1-4-2 แค่นี้ก็จำไม่ได้ ทีหลังหัดกินปลาซะบ้างนะ!'");
    await delay(3500);
    dialogBox.setVisible(false);

    await moveTo(550, 490, 1500); 
    await moveTo(680, 490, 800);  

    gameState.isCutscene = false; 
}

async function startMoaiRunawayCutscene(scene, triggeredMoai, triggeredId) {
    gameState.isCutscene = true;
    let allMoais = scene.children.list.filter(c => c.getData && c.getData('type') === 'statue');
    const delay = (ms) => new Promise(resolve => scene.time.delayedCall(ms, resolve));

    showDialog(scene, "* โมอาย: 'โอ๊ยยย! หมุนเล่นอยู่ได้ วิงเวียนศีรษะโว้ย! ไม่เฝ้าแล้วประตูบ้าบอเนี่ย!'");
    await delay(3500);
    
    scene.tweens.add({ targets: triggeredMoai, y: -100, angle: '+=720', duration: 1500 });
    
    await delay(1500);
    showDialog(scene, "* โมอายตัวที่เหลือ: 'อ้าวเฮ้ย! หนีงานนี่หว่า ทิ้งพวกเราเฉยเลย รอด้วยยยยยย!'");
    await delay(3500);
    dialogBox.setVisible(false);

    let otherMoais = allMoais.filter(m => m.getData('id') !== triggeredId);
    scene.tweens.add({ targets: otherMoais, y: -100, angle: '+=720', duration: 1500 });
    
    await delay(2000);
    
    gameState.isGameOver = true;
    player.setTint(0x555555); 
    showDialog(scene, "* ☠️ รูปปั้นทิ้งงานหนีไปหมดแล้ว... คุณทำปริศนาล้มเหลว (GAME OVER)");
    
    await delay(4000);
    scene.cameras.main.fadeOut(1000, 0, 0, 0);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        resetGameState();
        scene.sound.stopAll(); 
        scene.scene.restart();
    });
}

async function startFarewellCutscene(scene, gate) {
    gameState.isCutscene = true;
    gameState.uncleFarewellTriggered = true; 
    
    let npc = scene.children.list.find(c => c.getData && c.getData('type') === 'npc');
    const delay = (ms) => new Promise(resolve => scene.time.delayedCall(ms, resolve));
    
    const moveTo = (targetX, targetY, durationMs) => {
        return new Promise(resolve => {
            scene.tweens.add({ targets: npc, x: targetX, y: targetY, duration: durationMs, onUpdate: () => npc.refreshBody(), onComplete: resolve });
        });
    };

    await moveTo(900, 490, 1000); 

    showDialog(scene, "* NPC: 'เดี๋ยวก่อนไอ้หนุ่ม! จะไปแล้วเรอะ...'");
    await delay(2500);
    showDialog(scene, "* NPC: 'ออกไปแล้วก็อย่าลืมกันล่ะ ว่างๆ ก็แวะมาเยี่ยมลุงบ้างนะเว้ย!'");
    await delay(3500);
    
    dialogBox.setVisible(false);

    await moveTo(900, 400, 800); 

    showDialog(scene, "* 🗝️ คุณไขประตูด้วยกุญแจทองคำ! กำลังหลบหนีออกจากดันเจี้ยน...");
    
    gameState.gameWon = true; 
    gameState.isCutscene = false; 
    
    player.setCollideWorldBounds(false); 
    gate.setAlpha(0.5); 
    playSound(scene, 'doorSound'); 
    
    scene.time.delayedCall(1500, () => {
        dialogBox.setVisible(false); 
        if (!gameState.isEnding) {
            gameState.isEnding = true;
            scene.tweens.add({ targets: [endScreen, endText], alpha: 1, duration: 1500 });
        }
    });
}

function handleInteraction(obj, scene) { 
    const type = obj.getData('type');

    if (type === 'book') {
        playSound(scene, 'bookSound');
        let id = obj.getData('id');
        if (id === 1) showDialog(scene, "* คำใบ้ที่ 1: รูปปั้นทั้งหมดต้องหันหน้าไปในทิศทางเดียวกันเป๊ะๆ"); 
        else if (id === 2) showDialog(scene, "* คำใบ้ที่ 2: รูปปั้นแสวงหาทิศเหนือ (หันหน้ามันขึ้นด้านบน)"); 
        else {
            if (!gameState.hasSpell) {
                gameState.hasSpell = true; gameState.gatesOpened.magic = true; 
                showDialog(scene, "* คุณเจอคาถาเวทมนตร์แล้ว! ตอนนี้คุณพร้อมไปแก้ปริศนารูปปั้นแล้วล่ะ"); 
            } else { showDialog(scene, "* นี่คือหนังสือเล่มที่คุณเจอคาถาเวทมนตร์ไปแล้ว"); }
        }
    }

    if (type === 'statue') {
        if (!gameState.hasSpell) { showDialog(scene, "* รูปปั้นถูกผนึกแน่นหนา คุณต้องมีคาถาเวทมนตร์ก่อนถึงจะขยับมันได้!"); return; }
        if (gameState.hasLighter) return;

        let id = obj.getData('id');
        gameState.statueSpins[id]++;
        
        playSound(scene, 'statueSound'); 
        
        if (gameState.statueSpins[id] > 3) {
            startMoaiRunawayCutscene(scene, obj, id);
            return;
        }

        gameState.statueAngles[id] = (gameState.statueAngles[id] + 90) % 360;
        obj.setAngle(gameState.statueAngles[id]);

        if (gameState.statueAngles.every(angle => angle === 0)) {
            gameState.hasLighter = true; gameState.gatesOpened.statue = true;
            showDialog(scene, "* สำเร็จ! รูปปั้นหันถูกทิศทั้งหมด ได้รับ 'ไฟแช็ก' สำหรับใช้จุดคบเพลิงแล้ว!");
        } else { showDialog(scene, `* รูปปั้นหมุนอย่างหนักหน่วง...`); }
    }

    if (type === 'torch') {
        if (!gameState.hasLighter) { showDialog(scene, "* คบเพลิงพวกนี้ยังจุดไม่ได้ คุณต้องไปหาไฟแช็กจากห้องรูปปั้นมาก่อน!"); return; }

        let id = obj.getData('id');
        if (gameState.torchSequence.includes(id)) return;

        gameState.torchSequence.push(id);
        obj.clearTint(); 
        playSound(scene, 'torchSound'); 

        let step = gameState.torchSequence.length - 1;
        
        if (gameState.torchSequence[step] !== gameState.correctTorchOrder[step]) {
            gameState.torchFails++; 
            gameState.torchSequence = []; 
            
            obj.scene.children.list.forEach(child => {
                if (child.getData && child.getData('type') === 'torch') child.setTint(0x333333);
            });

            if (gameState.torchFails >= 3) {
                let npc = scene.children.list.find(c => c.getData && c.getData('type') === 'npc');
                let torches = scene.children.list.filter(c => c.getData && c.getData('type') === 'torch');
                startNpcTorchCutscene(scene, npc, torches); 
            } else {
                showDialog(scene, `* ผิดลำดับ! เปลวไฟมอดดับลงทั้งหมด (ผิดไปแล้ว ${gameState.torchFails}/3 ครั้ง)`);
            }
        } 
        else if (gameState.torchSequence.length === 4) {
            showDialog(scene, "* จุดคบเพลิงถูกต้องครบถ้วน! ทางไปหา NPC ปลอดภัยแล้ว");
        } 
        else {
            showDialog(scene, `* จุดไฟสำเร็จ! ลำดับที่: ${gameState.torchSequence.length}/4`);
        }
    }

    if (type === 'npc') {
        if (gameState.torchSequence.length < 4) {
            showDialog(scene, "* NPC: 'ว่าไงเจ้าหนุ่ม มีอะไรให้ลุงช่วยไหม? (ใช้เมาส์คลิกเลือกคำถาม)'");
            scene.time.delayedCall(1000, () => { choicesContainer.setVisible(true); });
        } else {
            let dialogues = [];
            if (gameState.torchFails >= 3) {
                dialogues = [
                    "* NPC: 'เฮ้อ... คราวหน้าคราวหลังหัดกินปลาเยอะๆ นะไอ้หนุ่ม!'",
                    "* NPC: 'เอาล่ะ ไปเลือกเปิดหีบซะ เล็งให้ดีล่ะ มีแค่ใบเดียวที่รอด'",
                    "* NPC: 'ถ้าโดนกับดักตาย ลุงไม่ช่วยทำศพให้นะเว้ย!'"
                ];
            } else {
                dialogues = [
                    "* NPC: 'โอ้! หลานเก่งมากที่แก้ปริศนาได้ทั้งหมดด้วยตัวเอง'",
                    "* NPC: 'ตอนนี้หลานสามารถเลือกเปิดหีบได้ 1 ใบเท่านั้นเพื่อหากุญแจ'",
                    "* NPC: 'ระวังให้ดีล่ะ หีบปลอมมีกับดักมรณะซ่อนอยู่!'"
                ];
            }

            showDialog(scene, dialogues[gameState.npcTalkAfterSolve]);
            if (gameState.npcTalkAfterSolve < dialogues.length - 1) gameState.npcTalkAfterSolve++;
        }
    }

    if (type === 'chest') {
        if (gameState.torchSequence.length < 4) { showDialog(scene, "* หีบสมบัติถูกล็อกไว้อย่างแน่นหนาด้วยมนต์ดำ (ต้องจุดคบเพลิงให้ครบก่อน)"); return; }
        if (gameState.chestOpened) return;
        gameState.chestOpened = true; 
        
        playSound(scene, 'chestSound'); 

        let chestId = obj.getData('id');
        if (chestId === gameState.correctChestId) {
            gameState.hasKey = true; 
            showDialog(scene, "* 🌟 คุณเปิดหีบ... พบกุญแจทองคำ! 🌟 รีบเอาไปไขประตูทางออกเลย!");
            obj.setTint(0x00ff00); 
        } else {
            gameState.isGameOver = true; 
            showDialog(scene, "* ☠️ งับบ! มันคือหีบมิมิค (กับดัก)! แก๊สพิษพ่นกระจายเต็มห้อง... (GAME OVER)");
            obj.setTint(0xff0000); 
            player.setTint(0x55ff55); 
            
            scene.time.delayedCall(2500, () => { scene.cameras.main.fadeOut(1000, 0, 0, 0); });
            scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                resetGameState(); 
                scene.sound.stopAll(); 
                scene.scene.restart(); 
            });
        }
    }

    if (type === 'gate') {
        if (gameState.hasKey) {
            if (!gameState.uncleFarewellTriggered) {
                startFarewellCutscene(scene, obj);
            }
        } else { 
            showDialog(scene, "* ประตูล็อกอย่างแน่นหนา คุณต้องไปหากุญแจทองคำมาก่อน"); 
        }
    }
}

function update() {
    const speed = 180;
    
    if (gameState.gameWon || gameState.isGameOver || gameState.isCutscene) {
        if (gameState.gameWon) {
            player.setVelocityX(100); player.setVelocityY(0); player.setFlipX(false);
            if (player.anims.currentAnim.key !== 'walk') player.play('walk');
        } else {
            player.setVelocity(0);
            if (player.anims.currentAnim.key !== 'idle') player.play('idle');
        }
        return; 
    }

    player.setVelocity(0);
    let moving = false;

    if (cursors.left.isDown || wasd.left.isDown) { player.setVelocityX(-speed); player.setFlipX(true); moving = true; } 
    else if (cursors.right.isDown || wasd.right.isDown) { player.setVelocityX(speed); player.setFlipX(false); moving = true; }
    if (cursors.up.isDown || wasd.up.isDown) { player.setVelocityY(-speed); moving = true; } 
    else if (cursors.down.isDown || wasd.down.isDown) { player.setVelocityY(speed); moving = true; }

    if (moving) {
        if (player.anims.currentAnim.key !== 'walk') player.play('walk');
        if (dialogBox.visible || choicesContainer.visible) {
            dialogBox.setVisible(false); choicesContainer.setVisible(false); 
            if (typewriteTimer) typewriteTimer.remove(); 
        }
    } else { if (player.anims.currentAnim.key !== 'idle') player.play('idle'); }
}