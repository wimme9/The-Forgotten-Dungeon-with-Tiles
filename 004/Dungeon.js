const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,   
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
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
let cursors;
let player;
let keyW, keyA, keyS, keyD;

// ตัวแปรสำหรับ Tilemap
let map;
let wallLayer;

// ตัวแปรสำหรับระบบพัซเซิล
let books;
let statues;
let torches; 
let popupText;
let popupBg;
let statueGate; 
let torchGate;  
let bossGate;   

let isBookSolved = false;
let isStatueSolved = false;
let isTorchSolved = false; 

// ตัวแปรห้องขวาล่าง
let npc;
let chests; 
let exitDoor;
let exitDoorCollider; 
let openedChestsCount = 0; 
let isDoorOpened = false;

// ตัวแปรควบคุมระบบ Cutscene
let isCutsceneActive = false;
let cutsceneStep = 0; 
let targetX = 0;
let targetY = 0;

// ตัวแปรสำหรับนับจำนวนคลิกคุยกับ NPC
let npcClickCount = 0; 

// ตัวแปรควบคุมเวลาและการแสดงข้อความ
let currentScene;
let dialogueTimer;
let isShowingImportantMessage = false; 

// ตัวแปรสำหรับฉากจบเกม
let endScreenBg;
let endScreenText;

// ตัวแปรสำหรับระบบคำใบ้ประจำด่าน (Hint UI)
let hintBg;
let hintText;

// === ตัวแปรระบบเสียง ===
let bgMusic;
let correctSound;
let winSound;

function preload() {
    // === โหลด Tilemap และ Asset ===
    this.load.tilemapTiledJSON('map', 'tilemap.tmj');
    this.load.image('dungeon_tiles', 'asset/Dungeon Tile Set.png');

    // === โหลด Asset รูปภาพ ===
    this.load.image('book', 'asset/book.png'); 
    this.load.image('statue', 'asset/rubpun.png');
    this.load.image('torch', 'asset/kobfire.png');
    this.load.image('heep', 'asset/heep.png');         
    this.load.image('heepopen', 'asset/heepopen.png'); 
    this.load.image('npc', 'asset/npc.png');           
    this.load.image('door', 'asset/door.png');         
    this.load.image('opendoor', 'asset/open door.png'); 
    
    this.load.spritesheet('player', 'asset/AnimationSheet_Character.png', {
        frameWidth: 32,
        frameHeight: 32 
    });

    // === โหลดไฟล์เสียง ===
    this.load.audio('bgm', 'asset/game sound.mp3');
    this.load.audio('correct', 'asset/correct_answer.mp3');
    this.load.audio('win', 'asset/winning.mp3');
}

function create() {
    currentScene = this; 

    // === 1. เล่นเพลง BGM วนลูป ===
    bgMusic = this.sound.add('bgm', { volume: 0.3, loop: true });
    bgMusic.play();

    correctSound = this.sound.add('correct', { volume: 0.7 });
    winSound = this.sound.add('win', { volume: 0.8 });

    // === 2. สร้าง Tilemap ===
    map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('Dungeon Tile Set', 'dungeon_tiles');

    if (!tileset) {
        console.error("❌ หา Tileset 'Dungeon Tile Set' ไม่พบ!");
    }

    const scaleX = 1280 / map.widthInPixels;
    const scaleY = 720 / map.heightInPixels;

    const bgLayer = map.createLayer('Floor layer', tileset, 0, 0); 
    if (bgLayer) bgLayer.setScale(scaleX, scaleY);

    wallLayer = map.createLayer('Wall layer', tileset, 0, 0); 
    if (wallLayer) {
        wallLayer.setScale(scaleX, scaleY);
        wallLayer.setCollisionByExclusion([-1]); 
    }

    this.physics.world.setBounds(0, 0, 1280, 720);

    // === 3. ประตูกั้นทางผ่าน ===
    statueGate = this.physics.add.staticSprite(608, 174, null).setSize(50, 100).setVisible(false);
    torchGate  = this.physics.add.staticSprite(192, 365, null).setSize(120, 50).setVisible(false);
    bossGate   = this.physics.add.staticSprite(602, 600, null).setSize(50, 80).setVisible(false);

    // === 4. สิ่งของในเกม ===
    
    // 4.1 ห้องซ้ายบน: สมุด
    books = this.physics.add.group();
    const bookData = [
        { x: 160, y: 108, text: "มีรอยฝุ่นเกาะหนาเตอะ... ไม่มีอะไรน่าสนใจ", isCorrect: false },
        { x: 320, y: 108, text: "คุณพบ 'กุญแจโบราณ' ซ่อนอยู่ข้างใน! ประตูห้องรูปปั้นเปิดออกแล้ว!", isCorrect: true }, 
        { x: 464, y: 108, text: "หนังสือบันทึกประวัติศาสตร์: 'รูปปั้นเหล่านี้เคารพต่อทิศทั้งสี่...'", isCorrect: false },
        { x: 160, y: 240, text: "ตำราอาหารโบราณ: 'สูตรต้มยำกุ้งพันปี...'", isCorrect: false },
        { x: 320, y: 240, text: "เป็นเพียงหน้ากระดาษที่ว่างเปล่า", isCorrect: false }
    ];

    bookData.forEach(data => {
        let b = books.create(data.x, data.y, 'book');
        b.setDisplaySize(50, 50);
        b.setData('popupText', data.text);
        b.setData('isCorrect', data.isCorrect);
    });

    // 4.2 ห้องขวาบน: รูปปั้น
    statues = this.physics.add.group();
    const statuePositions = [
        { x: 880, y: 132, targetAngle: 90 },  
        { x: 1040, y: 132, targetAngle: 180 }, 
        { x: 880, y: 228, targetAngle: 270 }, 
        { x: 1040, y: 228, targetAngle: 0 }    
    ];

    statuePositions.forEach((pos, index) => {
        let s = statues.create(pos.x, pos.y, 'statue');
        s.setDisplaySize(45, 65);
        s.setInteractive(); 
        s.setData('targetAngle', pos.targetAngle);
        s.setData('currentAngle', 0); 
        s.body.setSize(45, 65);

        s.on('pointerdown', () => {
            if (isCutsceneActive) return; 
            let distance = Phaser.Math.Distance.Between(player.x, player.y, s.x, s.y);
            if (distance > 80) return; 

            if (!isBookSolved) {
                showDialogue("คุณยังผ่านเข้าห้องนี้ไม่ได้อย่างเป็นทางการ!");
                return;
            }
            if (isStatueSolved) return; 

            let nextAngle = (s.getData('currentAngle') + 90) % 360;
            s.setData('currentAngle', nextAngle);
            s.setAngle(nextAngle); 

            showDialogue(`รูปปั้นที่ ${index + 1} ถูกหมุนไปที่ ${nextAngle} องศา`);
            checkStatuePuzzle();
        });
    });

    // 4.3 ห้องซ้ายล่าง: คบเพลิง (แก้ไขระบบแสดงข้อความแล้ว)
    torches = this.physics.add.group();
    const torchPositions = [
        { x: 152, y: 498 },  
        { x: 456, y: 498 }, 
        { x: 152, y: 612 },  
        { x: 456, y: 612 }   
    ];

    torchPositions.forEach((pos, index) => {
        let t = torches.create(pos.x, pos.y, 'torch');
        t.setDisplaySize(30, 58);
        t.setInteractive();
        t.setData('lit', true); 
        t.body.setSize(30, 58);

        t.on('pointerdown', () => {
            if (isCutsceneActive) return;
            let distance = Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y);
            if (distance > 100) return; 

            if (!isStatueSolved) {
                showTimedDialogue("คุณยังไม่ควรมาดับไฟที่นี่ในตอนนี้...", 2000);
                return;
            }
            if (isTorchSolved) return; 

            let isLit = !t.getData('lit');
            t.setData('lit', isLit);

            // นับจำนวนดวงที่ยังสว่างอยู่
            let remainingLit = 0;
            torches.children.iterate(torch => {
                if (torch && torch.getData('lit')) remainingLit++;
            });

            if (isLit) {
                t.setAlpha(1.0); 
                showTimedDialogue(`คุณจุดไฟคบเพลิงอันที่ ${index + 1} (เหลือไฟอีก ${remainingLit} ดวง)`, 2000);
            } else {
                t.setAlpha(0.4); 
                showTimedDialogue(`คุณดับไฟคบเพลิงอันที่ ${index + 1} แล้ว (เหลือไฟอีก ${remainingLit} ดวง)`, 2000);
            }

            checkTorchPuzzle(); 
        });
    });

    // 4.4 ห้องขวาล่าง: NPC, หีบสมบัติ และประตูทางออก
    npc = this.physics.add.staticSprite(720, 480, 'npc'); 
    npc.setDisplaySize(45, 75);
    npc.setInteractive();
    npc.body.setSize(45, 75);

    chests = this.physics.add.staticGroup();
    const chestPositions = [
        { x: 768, y: 588, id: 1 },
        { x: 880, y: 588, id: 2 },
        { x: 992, y: 588, id: 3 }
    ];

    chestPositions.forEach(pos => {
        let c = chests.create(pos.x, pos.y, 'heep');
        c.setDisplaySize(60, 50);
        c.setInteractive();
        c.body.setSize(60, 50);
        c.setData('id', pos.id);
        c.setData('opened', false);

        c.on('pointerdown', () => {
            if (isCutsceneActive) return;
            let distance = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
            if (distance > 80) return; 

            if (openedChestsCount < 3) {
                showDialogue("หีบเหล่านี้ถูกลงกลอนอย่างแน่นหนา... ลองไปคุยกับ NPC ดูก่อน!");
            } else {
                showDialogue("หีบสมบัติทั้งหมดถูกปลดล็อกแล้ว! รีบหนีออกไปเร็ว!");
            }
        });
    });

    exitDoor = this.physics.add.staticSprite(1136, 588, 'door');
    exitDoor.setDisplaySize(70, 95);
    exitDoor.body.setSize(45, 95);

    npc.on('pointerdown', () => {
        if (isCutsceneActive) return;
        let distance = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
        if (distance > 80) return; 

        if (openedChestsCount < 3) {
            npcClickCount++;

            if (npcClickCount === 1) {
                showDialogue("NPC: 'โอ้! ผู้กล้า... เจ้าผ่านบททดสอบทั้งหมดมาได้จนถึงห้องนี้!'");
            } 
            else if (npcClickCount === 2) {
                showDialogue("NPC: 'วิหารโบราณหลังนี้กำลังจะถล่มลงมาแล้ว เจ้าไม่มีเวลาเหลือมากแล้วนะ!'");
            } 
            else if (npcClickCount === 3) {
                showTimedDialogue("NPC: 'ข้าจะใช้เวทมนตร์เพื่อปลดล็อกหีบสมบัติทั้ง 3 ใบนี้ให้เจ้า... ไปเก็บให้ครบแล้วรีบหนีไปซะ!'", 3500);
                
                isCutsceneActive = true; 
                cutsceneStep = 1; 
                npcClickCount = 0; 
            }
        }
    });

    // === 5. สร้างตัวละครผู้เล่น ===
    player = this.physics.add.sprite(320, 180, 'player', 0).setScale(1.8);
    player.setBounce(0.1); 
    player.setCollideWorldBounds(true);
    player.setBodySize(20, 18); 
    player.setOffset(6, 14); 

    // === 6. แอนิเมชัน ===
    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player', { start: 24, end: 31 }), frameRate: 10, repeat: -1 });

    // === 7. การชน ===
    if (wallLayer) this.physics.add.collider(player, wallLayer); 
    this.physics.add.collider(player, statueGate); 
    this.physics.add.collider(player, torchGate);  
    this.physics.add.collider(player, bossGate);   
    this.physics.add.collider(player, npc);
    this.physics.add.collider(player, chests); 

    exitDoorCollider = this.physics.add.collider(player, exitDoor);

    // === 8. ปุ่มกดควบคุม ===
    cursors = this.input.keyboard.createCursorKeys();
    keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    // === 9. กล่องข้อความ UI ===
    popupBg = this.add.graphics();
    popupBg.fillStyle(0x000000, 0.8);
    popupBg.fillRect(150, 560, 980, 120);
    popupBg.lineStyle(4, 0xffffff, 1);
    popupBg.strokeRect(150, 560, 980, 120);
    popupBg.setDepth(10);
    popupBg.setVisible(false);

    popupText = this.add.text(180, 590, '', {
        fontSize: '20px',
        fill: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: 920, useAdvancedWrap: true },
        padding: { top: 4, bottom: 4 }
    });
    popupText.setDepth(11);
    popupText.setVisible(false);

    // === 10. UI ฉากจบเกม ===
    endScreenBg = this.add.graphics();
    endScreenBg.fillStyle(0x000000, 0.9); 
    endScreenBg.fillRect(0, 0, 1280, 720);
    endScreenBg.setVisible(false);
    endScreenBg.setDepth(100); 

    endScreenText = this.add.text(640, 360, '', {
        fontSize: '32px',
        fill: '#ffd700', 
        align: 'center',
        fontStyle: 'bold',
        wordWrap: { width: 900, useAdvancedWrap: true }
    });
    endScreenText.setOrigin(0.5); 
    endScreenText.setVisible(false);
    endScreenText.setDepth(101);

    // === 11. UI แสดงคำใบ้ประจำด่าน ===
    hintBg = this.add.graphics();
    hintBg.fillStyle(0x000000, 0.7);
    hintBg.fillRect(20, 20, 480, 65);
    hintBg.lineStyle(2, 0xffd700, 1);
    hintBg.strokeRect(20, 20, 480, 65);
    hintBg.setDepth(20);

    hintText = this.add.text(30, 30, '', {
        fontSize: '16px',
        fill: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: 460 }
    });
    hintText.setDepth(21);

    updateHintUI();
}

function updateHintUI() {
    if (!isBookSolved) {
        hintText.setText("💡 คำใบ้ (ด่าน 1): สำรวจหนังสือในห้องเพื่อหากุญแจปลดล็อกประตู");
    } else if (!isStatueSolved) {
        hintText.setText("💡 คำใบ้ (ด่าน 2): หมุนรูปปั้นทั้ง 4 ตัวให้อยู่ในทิศทางที่ถูกต้อง\n(90°, 180°, 270°, 0°)");
    } else if (!isTorchSolved) {
        hintText.setText("💡 คำใบ้ (ด่าน 3): ดับไฟคบเพลิงให้ครบทั้ง 4 อันเพื่อเปิดทางลับ");
    } else if (openedChestsCount < 3) {
        hintText.setText("💡 คำใบ้ (ด่าน 4): คุยกับ NPC ในห้องเพื่อทำพิธีเปิดหีบสมบัติ");
    } else {
        hintText.setText("💡 คำใบ้: ประตูทางออกเปิดแล้ว! หนีออกจากวิหารเร็ว!");
    }
}

function update() {
    const speed = 200;

    // === ระบบ Cutscene ===
    if (isCutsceneActive) {
        let chestList = chests.getChildren();
        let chest1 = chestList[0];
        let chest2 = chestList[1];
        let chest3 = chestList[2];

        if (cutsceneStep === 1) {
            if (!isShowingImportantMessage) {
                cutsceneStep = 2; 
                targetX = chest1.x; 
                targetY = chest1.y - 50; 
            }
            player.setVelocity(0, 0);
            player.play('idle', true);
        } 
        else if (cutsceneStep === 2) {
            let distance = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);

            if (distance > 5) {
                this.physics.moveTo(player, targetX, targetY, 150);
                player.play('walk', true);
                player.flipX = (player.body.velocity.x < 0);
            } else {
                player.setVelocity(0, 0);
                player.play('idle', true);
                
                chest1.setTexture('heepopen');
                openedChestsCount = 1;
                showTimedDialogue("เปิดหีบใบที่ 1 สำเร็จ! คุณพบชิ้นส่วนกุญแจส่วนที่ 1", 1200);

                cutsceneStep = 3;
                targetX = chest2.x;
                targetY = chest2.y - 50;
            }
        }
        else if (cutsceneStep === 3) {
            if (!isShowingImportantMessage) {
                cutsceneStep = 4;
            }
        }
        else if (cutsceneStep === 4) {
            let distance = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);

            if (distance > 5) {
                this.physics.moveTo(player, targetX, targetY, 150);
                player.play('walk', true);
                player.flipX = (player.body.velocity.x < 0);
            } else {
                player.setVelocity(0, 0);
                player.play('idle', true);

                chest2.setTexture('heepopen');
                openedChestsCount = 2;
                showTimedDialogue("เปิดหีบใบที่ 2 สำเร็จ! คุณพบชิ้นส่วนกุญแจส่วนที่ 2", 1200);

                cutsceneStep = 5;
                targetX = chest3.x;
                targetY = chest3.y - 50;
            }
        }
        else if (cutsceneStep === 5) {
            if (!isShowingImportantMessage) {
                cutsceneStep = 6;
            }
        }
        else if (cutsceneStep === 6) {
            let distance = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);

            if (distance > 5) {
                this.physics.moveTo(player, targetX, targetY, 150);
                player.play('walk', true);
                player.flipX = (player.body.velocity.x < 0);
            } else {
                player.setVelocity(0, 0);
                player.play('idle', true);

                chest3.setTexture('heepopen');
                openedChestsCount = 3;

                isDoorOpened = true;
                exitDoor.setTexture('opendoor');
                if (exitDoorCollider) {
                    exitDoorCollider.destroy(); 
                }

                showTimedDialogue("เปิดหีบใบสุดท้ายสำเร็จ! ประตูทางออกบานใหญ่เปิดออกแล้ว!", 1800);
                updateHintUI();

                cutsceneStep = 7;
                targetX = exitDoor.x;
                targetY = exitDoor.y;
            }
        }
        else if (cutsceneStep === 7) {
            if (!isShowingImportantMessage) {
                cutsceneStep = 8;
            }
        }
        else if (cutsceneStep === 8) {
            let distance = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);

            if (distance > 5) {
                this.physics.moveTo(player, targetX, targetY, 150);
                player.play('walk', true);
                player.flipX = (player.body.velocity.x < 0);

                if (distance < 50) {
                    player.setAlpha(distance / 50);
                }
            } else {
                player.setVelocity(0, 0);
                player.setVisible(false); 
                
                hideDialogue();
                showVictoryScreen(); 
                
                cutsceneStep = 9; 
            }
        }
        else if (cutsceneStep === 9) {
            player.setVelocity(0, 0);
        }
        return; 
    }

    // --- ควบคุมการเคลื่อนที่ปกติ ---
    player.setVelocity(0);

    if (cursors.right.isDown || keyD.isDown) {
        player.setVelocityX(speed);
        player.flipX = false;
    }
    else if (cursors.left.isDown || keyA.isDown) {
        player.setVelocityX(-speed);
        player.flipX = true;
    }

    if (cursors.down.isDown || keyS.isDown) {
        player.setVelocityY(speed);
    }
    else if (cursors.up.isDown || keyW.isDown) {
        player.setVelocityY(-speed);
    }

    if (player.body.velocity.x !== 0 || player.body.velocity.y !== 0) {
        player.play('walk', true); 
    } else {
        player.play('idle', true); 
    }

    // === ปิดข้อความอัตโนมัติ (แก้ไขเพิ่มเติมส่วนคบเพลิง) ===
    let isTouchingSomething = false;

    this.physics.overlap(player, books, (p, book) => {
        isTouchingSomething = true;
        readBook(p, book);
    });

    this.physics.overlap(player, statues, () => { isTouchingSomething = true; });

    // เช็กว่าอยู่ใกล้คบเพลิงดวงไหนหรือไม่
    torches.children.iterate(t => {
        if (t && Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y) < 100) {
            isTouchingSomething = true;
        }
    });

    let distToNpc = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
    let distToDoor = Phaser.Math.Distance.Between(player.x, player.y, exitDoor.x, exitDoor.y);
    
    let distToChests = false;
    chests.children.iterate(c => {
        if (c && Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y) < 80) {
            distToChests = true;
        }
    });

    if (distToNpc < 80 || distToChests || distToDoor < 80) {
        isTouchingSomething = true;
    }

    if (!isTouchingSomething && popupText.visible && !isShowingImportantMessage) {
        hideDialogue();
    }
}

function showVictoryScreen() {
    if (bgMusic) bgMusic.stop();
    winSound.play();

    endScreenBg.setVisible(true);
    endScreenText.setText(
        "🏆 VICTORY! 🏆\n\n" +
        "ยินดีด้วย! คุณเปิดหีบครบทั้ง 3 ใบ\n" +
        "และหลบหนีออกจากดันเจี้ยนได้สำเร็จ!\n\n" +
        "ขอบคุณที่เล่นเกมของเรา"
    );
    endScreenText.setVisible(true);
}

function showDialogue(message) {
    popupBg.setVisible(true);
    popupText.setText(message);
    popupText.setVisible(true);
}

function showTimedDialogue(message, duration = 3000) {
    isShowingImportantMessage = true; 
    showDialogue(message);
    
    if (dialogueTimer) dialogueTimer.destroy();
    
    dialogueTimer = currentScene.time.delayedCall(duration, () => {
        hideDialogue();
    }, [], currentScene);
}

function hideDialogue() {
    popupBg.setVisible(false);
    popupText.setVisible(false);
    popupText.setText('');
    isShowingImportantMessage = false; 
}

function readBook(player, book) {
    let msg = book.getData('popupText');

    if (book.getData('isCorrect') && !isBookSolved) {
        isBookSolved = true;
        statueGate.destroy(); 
        
        correctSound.play();

        showTimedDialogue(msg, 3000); 
        updateHintUI();
    } else {
        showDialogue(msg);
    }
}

function checkStatuePuzzle() {
    let correctCount = 0;
    
    statues.children.iterate(s => {
        if (s && s.getData('currentAngle') === s.getData('targetAngle')) {
            correctCount++;
        }
    });

    if (correctCount === 4 && !isStatueSolved) {
        isStatueSolved = true;
        torchGate.destroy(); 

        correctSound.play();

        showTimedDialogue("กลไกส่งเสียงครืนนน... ประตูทางลงห้องคบเพลิงถูกเปิดออกแล้ว!", 3000); 
        updateHintUI();
    }
}

function checkTorchPuzzle() {
    let activeTorches = 0;

    torches.children.iterate(t => {
        if (t && t.getData('lit') === true) {
            activeTorches++;
        }
    });

    if (activeTorches === 0 && !isTorchSolved) {
        isTorchSolved = true;
        bossGate.destroy(); 

        correctSound.play();

        showTimedDialogue("ประตูลับเปิดออกแล้ว! ทางไปห้องขวาด้านล่างเปิดออกแล้ว!", 3000); 
        updateHintUI();
    }
}