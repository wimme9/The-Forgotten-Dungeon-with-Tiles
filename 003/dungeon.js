const config = {
    type: Phaser.AUTO,
    width: 1536,
    height: 1024,
    physics: {
        default: 'arcade',
        arcade: { 
            gravity: { y: 0 }, 
            debug: false 
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let player, keyW, keyA, keyS, keyD, targetExitZone;
let wallGate2, wallGate3, wallGate4; 
let books, fires, stones, chestGroup, npc, exitDoor; 
let questStage = 0;
let correctBookIndex, correctFireIndex;
let hasKey = false;
let isGameOver = false;
let questText, hintText, alertText, dialogueText, dialogueBubble;
let dialoguePages = [];
let currentPage = 0;
let wallsLayer;

function preload() {
    this.load.audio('win', 'win.mp3');
    this.load.audio('gameover', 'gameover.mp3');
    this.load.audio('ston', 'ston.mp3');
    this.load.audio('fale', 'fale.mp3');
    this.load.audio('ture', 'true.mp3');
    this.load.audio('heepopen', 'heepopen.mp3');

    this.load.image('book1', 'book1.png');
    this.load.image('book2', 'book2.png');
    this.load.image('book3', 'book3.png');
    this.load.image('book4', 'book4.png');
    this.load.image('book5', 'book5.png');
    this.load.image('fire', 'fire.png');
    this.load.image('ground', 'tile.jpg');
    this.load.image('ston', 'ston.png');
    this.load.image('heepopen', 'heepopen.png');
    this.load.image('heep', 'heep.png');
    this.load.image('npc', 'npc.png');
    this.load.image('door', 'door.png');
    this.load.image('dooropen', 'dooropen.png');
    this.load.image('backg', 'backg.png');

    this.load.image('tiles', 'world_tileset.png');
    this.load.tilemapTiledJSON('map', 'DungeonMap.tmj');
    
    this.load.spritesheet('player', 'sprites/AnimationSheet_Character.png', { frameWidth: 32, frameHeight: 32 });
}

function create() {
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('world_tileset', 'tiles');

    const floorLayer = map.createLayer('Floor Layer', tileset, 0, 0);
    wallsLayer = map.createLayer('Wall Layer', tileset, 0, 0);

    if (wallsLayer) {
        wallsLayer.setCollisionByExclusion([-1]);
    }

    alertText = this.add.text(768, 512, '', {
        font: '22px Arial', fill: '#ff4444', backgroundColor: '#000000', padding: { x: 15, y: 10 }, align: 'center'
    }).setOrigin(0.5).setDepth(100).setVisible(false);
    
    this.input.mouse.disableContextMenu();
    isGameOver = false;

    keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    wallGate2 = this.physics.add.staticImage(768, 400, 'ground').setDisplaySize(20, 200).refreshBody();
    wallGate2.setTint(0xff0000);
    wallGate2.setAlpha(0.4);

    wallGate3 = this.physics.add.staticImage(655, 512, 'ground').setDisplaySize(200, 20).refreshBody();
    wallGate3.setTint(0xff0000);
    wallGate3.setAlpha(0.4);

    wallGate4 = this.physics.add.staticImage(768, 600, 'ground').setDisplaySize(20, 200).refreshBody();
    wallGate4.setTint(0xff0000);
    wallGate4.setAlpha(0.4);

    exitDoor = this.physics.add.staticImage(1400, 870, 'door').setScale(0.3).refreshBody();
    targetExitZone = this.physics.add.staticImage(1400, 870, 'ground').setDisplaySize(15, 60).refreshBody().setVisible(false);

    questText = this.add.text(20, 25, 'เควส: ตามหาหนังสือที่ถูกต้อง', { fontSize: '20px', fill: '#ffffff', backgroundColor: '#00000088', padding: { x: 10, y: 10 } }).setScrollFactor(0).setDepth(100);
    hintText = this.add.text(768, 512, '', { fontSize: '24px', fill: '#ff3333', fontWeight: 'bold', backgroundColor: '#000000aa', padding: { x: 15, y: 15 } }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

    let showHint = (msg, isWarning = true) => {
        hintText.setText(msg);
        hintText.setStyle({ fill: isWarning ? '#ff3333' : '#ffff33' });
        hintText.setVisible(true).setAlpha(1);
        this.tweens.killTweensOf(hintText);
        this.tweens.add({ targets: hintText, alpha: 0, delay: 2000, duration: 500, onComplete: () => hintText.setVisible(false) });
    };

    books = this.physics.add.staticGroup();
    let bookIds = [1, 2, 3, 4, 5];
    Phaser.Utils.Array.Shuffle(bookIds);
    correctBookIndex = bookIds[Phaser.Math.Between(0, 4)];
    for (let i = 0; i < 5; i++) {
        let book = books.create(960 + (i * 90), 230, `book${bookIds[i]}`).setScale(0.12).refreshBody().setInteractive();
        book.setData('id', bookIds[i]);
        book.on('pointerdown', () => {
            if (isGameOver || Phaser.Math.Distance.Between(player.x, player.y, book.x, book.y) > 200) return;
            if (questStage === 0) {
                if (book.getData('id') === correctBookIndex) {
                    questStage = 1; 
                    wallGate2.destroy(); 
                    this.sound.play('ture');
                    questText.setText('เควส: หากองไฟที่ถูกต้อง'); 
                    showHint("ไขปริศนาหนังสือสำเร็จ! เปิดทางไปห้องถัดไปแล้ว", false);
                } else {
                    this.sound.play('fale');
                    showHint("หนังสือเล่มนี้ไม่ใช่! ลองเล่มอื่นดูนะ");
                }
            }
        });
    }

    fires = this.physics.add.staticGroup();
    correctFireIndex = Phaser.Math.Between(0, 4);
    for (let i = 0; i < 5; i++) {
        let fire = fires.create(200 + (i * 95), 230, 'fire').setScale(0.07).refreshBody().setInteractive();
        fire.setData('id', i);
        fire.on('pointerdown', () => {
            if (isGameOver || Phaser.Math.Distance.Between(player.x, player.y, fire.x, fire.y) > 200) return;
            if (questStage === 1) {
                if (fire.getData('id') === correctFireIndex) {
                    questStage = 2; 
                    wallGate3.destroy(); 
                    this.sound.play('ture');
                    questText.setText('เควส: หมุนหินให้ตั้งตรง'); 
                    showHint("ไขปริศนากองไฟสำเร็จ! เปิดทางลงโซนล่างแล้ว", false);
                } else {
                    this.sound.play('fale');
                    showHint("กองไฟดวงนี้ไม่ใช่!");
                }
            }
        });
    }

    stones = this.physics.add.staticGroup();
    [{ x: 230, y: 700 }, { x: 480, y: 700 }, { x: 230, y: 900 }, { x: 480, y: 900 }].forEach(pos => {
        let stone = stones.create(pos.x, pos.y, 'ston').setScale(0.12).refreshBody().setInteractive();
        stone.setAngle(Phaser.Math.RND.pick([90, 180, 270]));
        stone.on('pointerdown', () => {
            if (isGameOver || questStage !== 2 || Phaser.Math.Distance.Between(player.x, player.y, stone.x, stone.y) > 200) return;
            stone.angle += 90;
            this.sound.play('ston');
            let allCorrect = true;
            stones.children.iterate(s => { if (Math.abs(s.angle) % 360 !== 0) allCorrect = false; });
            if (allCorrect) { 
                questStage = 3; 
                wallGate4.destroy(); 
                questText.setText('เควส: คุยกับ NPC'); 
                showHint("กลไกหินปลดล็อกแล้ว! เปิดทางไปหา NPC", false); 
            }
        });
    });

    npc = this.physics.add.staticImage(1150, 750, 'npc').setScale(1.5).refreshBody().setInteractive();
    
    dialogueBubble = this.add.graphics().setDepth(150).setVisible(false);
    dialogueText = this.add.text(0, 0, '', { 
        fontSize: '20px', fill: '#000000', align: 'center', wordWrap: { width: 440 }, 
        padding: { top: 20, bottom: 20, left: 10, right: 10 } 
    }).setDepth(151).setVisible(false);
    
    npc.on('pointerdown', () => {
        if (isGameOver || Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y) > 200) return;
        
        // เล่นเสียง ture ตอนคลิกคุยกับ NPC สำเร็จ
        this.sound.play('ture');

        if (questStage === 3) {
            dialoguePages = ["ขอบคุณที่ช่วยแก้กลไกหินนะ!", "ฉันปลดล็อกหีบสมบัติให้แล้วในห้องตรงกลาง", "เลือกให้ดีล่ะ มีแค่ใบเดียวที่มีกุญแจ!"];
            currentPage = 0;
            showDialogue(this, npc.x, npc.y - 80);
            questStage = 4; 
            questText.setText('เควส: เปิดหีบสมบัติห้องตรงกลาง (ระวังกับดัก!)');
        } else if (questStage < 3) {
            dialoguePages = ["เธอต้องเคลียร์ปริศนาห้องอื่นก่อนนะ"];
            currentPage = 0;
            showDialogue(this, npc.x, npc.y - 80);
        }
    });

    chestGroup = this.physics.add.staticGroup();
    let correctChestIndex = Phaser.Math.Between(0, 2);
    [{x: 920, y: 700}, {x: 1080, y: 700}, {x: 1240, y: 700}].forEach((pos, index) => {
        let chest = chestGroup.create(pos.x, pos.y, 'heep').setScale(1.2).refreshBody().setInteractive();
        chest.on('pointerdown', () => {
            if (isGameOver || questStage !== 4 || Phaser.Math.Distance.Between(player.x, player.y, chest.x, chest.y) > 200) return;
            chest.setTexture('heepopen');
            this.sound.play('heepopen');
            if (index === correctChestIndex) { 
                questStage = 5; 
                hasKey = true; 
                questText.setText('เควส: ไขประตูออกไป!'); 
                showHint("ได้รับกุญแจแล้ว รีบไปที่ประตู!", false); 
            } else { 
                isGameOver = true; 
                showGameOverScreen(this); 
            }
        });
    });

    player = this.physics.add.sprite(1020, 320, 'player', 0).setScale(1.6).setCollideWorldBounds(true);

    if (wallsLayer) {
        this.physics.add.collider(player, wallsLayer);
    }

    this.physics.add.collider(player, wallGate2);
    this.physics.add.collider(player, wallGate3);
    this.physics.add.collider(player, wallGate4);

    this.physics.add.collider(player, exitDoor, () => {
        if (hasKey) { 
            exitDoor.setTexture('dooropen'); 
            exitDoor.body.enable = false; 
            showHint("ไขกุญแจเปิดประตูสำเร็จ! เดินออกไปเลย!", false); 
        } else {
            showHint("ประตูถูกล็อกแน่นหนา! ต้องใช้กุญแจจากหีบสมบัติมาไข");
        }
    });
    
    this.physics.add.overlap(player, targetExitZone, () => { 
        if (hasKey && !isGameOver) { 
            isGameOver = true; 
            showWinScreen(this); 
        } 
    });

    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('player', { start: 16, end: 19 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player', { start: 24, end: 31 }), frameRate: 10, repeat: -1 });
}

function showDialogue(scene, x, y) {
    let boxWidth = 480;
    let boxHeight = 120;
    let boxY = y - 130; 

    dialogueBubble.clear()
        .fillStyle(0xffffff, 1)
        .fillRoundedRect(x - boxWidth / 2, boxY, boxWidth, boxHeight, 10)
        .lineStyle(2, 0x000000, 1)
        .strokeRoundedRect(x - boxWidth / 2, boxY, boxWidth, boxHeight, 10)
        .setVisible(true).setAlpha(1);
    
    dialogueText.setText(dialoguePages[currentPage])
        .setPosition(x, boxY + 20) 
        .setOrigin(0.5, 0)
        .setVisible(true)
        .setAlpha(1);
    
    let advanceDialogue = (pointer) => {
        pointer.event.stopPropagation();

        if (currentPage < dialoguePages.length - 1) {
            currentPage++;
            dialogueText.setText(dialoguePages[currentPage]);
        } else {
            dialogueBubble.setVisible(false);
            dialogueText.setVisible(false);
            scene.input.off('pointerdown', advanceDialogue);
        }
    };

    scene.input.off('pointerdown', advanceDialogue);
    scene.input.on('pointerdown', advanceDialogue);
}

function showWinScreen(scene) {
    scene.sound.play('win');
    scene.add.graphics().fillStyle(0x000000, 0.75).fillRect(0, 0, 1536, 1024).setDepth(200);
    scene.add.text(768, 480, "ยินดีด้วย! คุณหนีรอดได้สำเร็จ!", { fontSize: '36px', fill: '#ffffff', padding: { x: 20, y: 20 } }).setOrigin(0.5).setDepth(201);
    scene.add.text(768, 580, "เล่นอีกครั้ง", { fontSize: '24px', backgroundColor: '#27ae60', padding: {x:20, y:15} }).setOrigin(0.5).setDepth(201).setInteractive().on('pointerdown', () => location.reload());
}

function showGameOverScreen(scene) {
    scene.sound.play('gameover');
    scene.add.graphics().fillStyle(0xcc0000, 0.8).fillRect(0, 0, 1536, 1024).setDepth(200);
    scene.add.text(768, 480, "GAME OVER!\nคุณเปิดหีบผิดและติดกับดัก!", { fontSize: '40px', fill: '#ffffff', align: 'center', padding: { x: 20, y: 20 } }).setOrigin(0.5).setDepth(201);
    scene.add.text(768, 580, "ลองใหม่อีกครั้ง", { fontSize: '24px', backgroundColor: '#000', padding: {x:20, y:15} }).setOrigin(0.5).setDepth(201).setInteractive().on('pointerdown', () => location.reload());
}

function update() {
    if (isGameOver) { player.setVelocity(0); return; }
    player.setVelocity(0);
    let moving = false;
    if (keyA.isDown) { player.setVelocityX(-250); player.setFlipX(true); moving = true; }
    else if (keyD.isDown) { player.setVelocityX(250); player.setFlipX(false); moving = true; }
    if (keyW.isDown) { player.setVelocityY(-250); moving = true; }
    else if (keyS.isDown) { player.setVelocityY(250); moving = true; }
    player.anims.play(moving ? 'walk' : 'idle', true);
}