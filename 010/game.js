let player, cursors, wasd;
let walls;
let books, statues, chests, torchObjs;
let doorZones;              // { bookDoor, statueDoor, torchDoor, exitDoor } physics rectangles
let dialogueBox, dialogueText, dialogueName, nextBtn;
let dialogueState = 0;
let npcSprite;
let hasKey = false;
let hasMagicScroll = false;
let hasTalkedToNPC = false;
let torchOrder = [];
let correctTorchOrder = [0, 2, 1, 3];
let torchLit = [false, false, false, false];
let statueAngles = [0, 0, 0, 0];
let correctAngles = [90, 0, 270, 180];
let msgBox, msgText, msgTimer;
let scrollIcon;
let wallLayer;
let popSound;

// ระยะที่ผู้เล่นต้องเข้าใกล้ถึงจะกด interact กับวัตถุได้ (px)
const INTERACT_RANGE = 70;

// ขนาดแมพใหม่ (จาก map.tmj: 31x23 ช่อง x 32px = 992x736)
const MAP_W = 992;
const MAP_H = 736;

const config = {
    type: Phaser.AUTO,
    width: MAP_W,
    height: MAP_H,
    backgroundColor: '#111111',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload, create, update }
};
const game = new Phaser.Game(config);

function preload() {
    this.load.spritesheet('player', 'images/AnimationSheet_Character.png', {
        frameWidth: 32, frameHeight: 32
    });
    this.load.image('book',   'images/book.png');
    this.load.image('statue', 'images/stat.png');
    this.load.image('torch',  'images/torch.png');
    this.load.image('npc',    'images/mage.png');
    this.load.image('chest',  'images/box.png');

    // Tiled dungeon map + its tileset
    this.load.image('tiles', 'images/mainlevbuild.png');
    this.load.tilemapTiledJSON('dungeonMap', 'images/map.tmj');

    // Sound effects
    this.load.audio('pop', 'images/pop.mp3');
}

// ── Proximity helper ──
function isPlayerNear(x, y, range = INTERACT_RANGE) {
    if (!player) return false;
    const d = Phaser.Math.Distance.Between(player.x, player.y, x, y);
    return d <= range;
}

function tooFarMsg(scene) {
    playPop();
    showMsg(scene, '🚶 เข้าไปใกล้ๆ ก่อนถึงจะใช้งานได้', 0x333333);
}

function playPop() {
    if (popSound) popSound.play();
}

function create() {
    const scene = this;

    // ── Sound effect ──
    popSound = this.sound.add('pop', { volume: 0.5 });

    // ── Tilemap: floor (visual) + wall (visual only, collision is hardcoded below) ──
    const map = this.make.tilemap({ key: 'dungeonMap' });
    const tileset = map.addTilesetImage('dun', 'tiles');
    map.createLayer('floor', tileset, 0, 0).setDepth(0);
    wallLayer = map.createLayer('wall', tileset, 0, 0).setDepth(0);

    // ── Invisible collision walls, hardcoded to trace the 4 room borders ──
    // with gaps only where the locked doors are. Set DEBUG_SHOW_WALLS to true
    // to visualize the generated wall boxes in red.
    const DEBUG_SHOW_WALLS = false;
    walls = this.physics.add.staticGroup();

    function wallSeg(x, y, w, h) {
        const r = scene.add.rectangle(x, y, w, h, 0xff0000, DEBUG_SHOW_WALLS ? 0.35 : 0).setDepth(50);
        scene.physics.add.existing(r, true);
        walls.add(r);
        return r;
    }

    // Outer map boundary (gap on the right edge = exit)
    wallSeg(496, 8,   992, 16);   // top
    wallSeg(496, 728, 992, 16);   // bottom
    wallSeg(8,   368, 16,  736);  // left
    wallSeg(984, 256, 16,  512);  // right, above exit gap
    wallSeg(984, 688, 16,  96);   // right, below exit gap

    // Middle vertical wall (Statue room | Torch room), gap = statueDoor (y 128-224)
    wallSeg(496, 64,  12, 128);   // above the gap
    wallSeg(496, 480, 12, 512);   // below the gap

    // Middle horizontal wall (top rooms | bottom rooms)
    // gaps: x 192-288 (bookDoor) and x 704-832 (torchDoor)
    wallSeg(96,  368, 192, 12);   // left segment
    wallSeg(496, 368, 416, 12);   // middle segment (between the two doors)
    wallSeg(912, 368, 160, 12);   // right segment

    function roomLabel(x, y, w, text, color) {
        scene.add.rectangle(x, y, w, 26, 0x000000, 0.55).setOrigin(0, 0.5).setStrokeStyle(1, color, 0.6).setDepth(2);
        scene.add.text(x + 8, y, text, { fontSize: '15px', fill: color, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(2);
    }
    // ตำแหน่งห้องอิงจากพิกัดจริงในแมพใหม่ (statue=บนซ้าย, torch=บนขวา, library=ล่างซ้าย, trials=ล่างขวา)
    roomLabel(42,  44,  318, '🗿 Mission 2: Statue Room',       '#9fd3f0');
    roomLabel(585, 44,  282, '🔥 Mission 3: Torch Room',        '#ffb066');
    roomLabel(42,  429, 367, '📖 Mission 1: Forbidden Library', '#e8c667');
    roomLabel(585, 428, 384, '🗝️ Mission 4 & 5: Trials End',   '#d9b3ff');

    // ── Door zones (invisible physics rects placed over the map's connector openings) ──
    // แต่ละอันบล็อกทางเดินจนกว่าจะไขปริศนาสำเร็จ แล้วค่อยลบออก (เปิดประตู)
    function makeDoor(x, y, w, h) {
        const d = scene.add.rectangle(x, y, w, h, 0x8B0000);
        scene.physics.add.existing(d, true);
        return d;
    }

    doorZones = {
        // เชื่อม Library (ล่างซ้าย) <-> Statue Room (บนซ้าย)
        bookDoor:   makeDoor(240, 368, 96, 10),
        // เชื่อม Statue Room (บนซ้าย) <-> Torch Room (บนขวา)
        statueDoor: makeDoor(496, 176, 10, 96),
        // เชื่อม Torch Room (บนขวา) <-> Trials End (ล่างขวา)
        torchDoor:  makeDoor(768, 368, 128, 10),
        // ประตูทางออกสุดท้าย ที่ขอบขวาของห้อง Trials End
        exitDoor:   makeDoor(976, 576, 16, 128),
    };

    scene.add.text(240, 351, 'LOCKED', { fontSize: '14px', fill: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5, 1).setName('lbl_book');
    scene.add.text(518, 176, 'LOCKED', { fontSize: '14px', fill: '#ff4444', fontStyle: 'bold' }).setOrigin(0, 0.5).setName('lbl_statue');
    scene.add.text(768, 351, 'LOCKED', { fontSize: '14px', fill: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5, 1).setName('lbl_torch');

    scene.add.text(42, 459, 'Click a book to read it', { fontSize: '13px', fill: '#bbb' });
    scrollIcon = scene.add.text(42, 707, '', { fontSize: '16px', fill: '#cc88ff', fontStyle: 'bold' }).setDepth(10);

    // ── Books (Library room, bottom-left) ──
    const bookData = [
        { x: 69,  y: 589, title: 'Tome of Shadows',   msg: '"Darkness calls… but this is not the answer."',     correct: false },
        { x: 154, y: 589, title: 'Echo of Fallen',     msg: '"The fallen speak of sorrow, not of keys."',        correct: false },
        { x: 240, y: 589, title: 'Codex Veritas',      msg: '✅ "The truth reveals itself! A scroll appears!"',   correct: true  },
        { x: 326, y: 589, title: 'Book of Illusions',  msg: '"Nothing here but mirrors and lies."',              correct: false },
        { x: 411, y: 589, title: 'Ancient Ledger',     msg: '"Dusty numbers… a merchant\'s boring record."',     correct: false },
    ];

    books = scene.add.group();
    bookData.forEach(b => {
        const img = scene.add.image(b.x, b.y, 'book')
            .setDisplaySize(36, 44).setInteractive().setDepth(3);
        scene.add.text(b.x, b.y + 30, b.title,
            { fontSize: '10px', fill: '#eee', align: 'center', wordWrap: { width: 68 }, lineSpacing: 2 })
            .setOrigin(0.5, 0).setDepth(3);
        img.on('pointerover', () => img.setTint(0xffff88));
        img.on('pointerout',  () => img.clearTint());
        img.on('pointerdown', () => {
            playPop();
            if (!isPlayerNear(b.x, b.y)) { tooFarMsg(scene); return; }
            showMsg(scene, b.msg, b.correct ? 0x004400 : 0x550000);
            if (b.correct && !hasMagicScroll) {
                hasMagicScroll = true;
                const scroll = scene.add.text(b.x, b.y, '📜', { fontSize: '24px' }).setDepth(15);
                scene.tweens.add({
                    targets: scroll, y: b.y - 60, alpha: 0,
                    duration: 1200, ease: 'Power2',
                    onComplete: () => { scroll.destroy(); scrollIcon.setText('📜 Magic Scroll ✔'); }
                });
                scene.time.delayedCall(400,  () => showMsg(scene, '📜 You obtained the MAGIC SCROLL! Door opens!', 0x330055));
                scene.time.delayedCall(1000, () => openDoor(scene, 'bookDoor', 'lbl_book'));
                img.setTint(0xcc88ff).disableInteractive();
            }
        });
        books.add(img);
    });

    // ── Statues (Statue room, top-left) ──
    statues = [];
    const statuePos = [
        { x: 130, y: 128 }, { x: 252, y: 128 },
        { x: 130, y: 236 }, { x: 252, y: 236 },
    ];
    const dirLabels = ['↑','→','↓','←'];
    scene.add.text(42, 66, 'Rotate to:  →  ↑  ←  ↓', { fontSize: '14px', fill: '#bbb' });

    statuePos.forEach((pos, i) => {
        const img = scene.add.image(pos.x, pos.y, 'statue')
            .setDisplaySize(52, 52).setInteractive().setDepth(3);
        const arrow = scene.add.text(pos.x, pos.y + 34, dirLabels[0],
            { fontSize: '18px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
        let angle = 0;
        img.on('pointerover', () => img.setTint(0xaaddff));
        img.on('pointerout',  () => img.clearTint());
        img.on('pointerdown', () => {
            playPop();
            if (!isPlayerNear(pos.x, pos.y)) { tooFarMsg(scene); return; }
            angle = (angle + 90) % 360;
            statueAngles[i] = angle;
            img.setAngle(angle);
            arrow.setText(dirLabels[Math.round(angle / 90) % 4]);
            checkStatues(scene);
        });
        statues.push({ img, arrow });
    });

    // ── Torches (Torch room, top-right) ──
    torchObjs = [];
    const torchPos = [
        { x: 655, y: 134 }, { x: 768, y: 134 },
        { x: 655, y: 248 }, { x: 768, y: 248 },
    ];
    scene.add.text(585, 66, 'Light order:  1 → 3 → 2 → 4', { fontSize: '14px', fill: '#bbb' });

    torchPos.forEach((pos, i) => {
        const img = scene.add.image(pos.x, pos.y, 'torch')
            .setDisplaySize(44, 56).setInteractive().setTint(0x444444).setDepth(3);
        scene.add.text(pos.x + 24, pos.y - 32, String(i + 1),
            { fontSize: '16px', fill: '#ccc', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
        const litT = scene.add.text(pos.x, pos.y + 36, 'OFF',
            { fontSize: '13px', fill: '#999', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
        img.on('pointerover', () => img.setTint(torchLit[i] ? 0xffcc55 : 0x777777));
        img.on('pointerout',  () => img.setTint(torchLit[i] ? 0xffaa00 : 0x444444));
        img.on('pointerdown', () => {
            playPop();
            if (!isPlayerNear(pos.x, pos.y)) { tooFarMsg(scene); return; }
            toggleTorch(scene, i, img, litT);
        });
        torchObjs.push({ img, litT });
    });

    // ── NPC (Trials End room, bottom-right) ──
    npcSprite = scene.add.image(655, 524, 'npc').setDisplaySize(48, 56).setInteractive().setDepth(3);
    scene.add.text(655, 558, 'Elder Moren', { fontSize: '14px', fill: '#ccc', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(3);

    const dialogues = [
        'So… you made it this far. Most turn back at the Library.',
        'The Tower holds three trials. You have passed them all — tome, statue, and torch.',
        'But the greatest trial is trust. Choose wisely among the chests ahead.',
        'One chest holds the key to freedom. The other two… hold only despair.',
        '...I can say no more. Farewell, brave traveller. 🗝️',
    ];

    dialogueBox  = scene.add.rectangle(MAP_W / 2, MAP_H - 44, MAP_W - 20, 88, 0x111133, 0.95).setVisible(false).setDepth(10);
    dialogueName = scene.add.text(25, MAP_H - 82, '', { fontSize: '16px', fill: '#ffff88', fontStyle: 'bold' }).setVisible(false).setDepth(11);
    dialogueText = scene.add.text(25, MAP_H - 60, '', { fontSize: '15px', fill: '#fff', wordWrap: { width: MAP_W - 170 }, lineSpacing: 5 }).setVisible(false).setDepth(11);
    nextBtn = scene.add.text(MAP_W - 110, MAP_H - 82, '[ NEXT ▶ ]', { fontSize: '15px', fill: '#88ffff', fontStyle: 'bold' }).setVisible(false).setDepth(11).setInteractive();

    npcSprite.on('pointerover', () => npcSprite.setTint(0xffddaa));
    npcSprite.on('pointerout',  () => npcSprite.clearTint());
    npcSprite.on('pointerdown', () => {
        playPop();
        if (!isPlayerNear(npcSprite.x, npcSprite.y)) { tooFarMsg(scene); return; }
        dialogueState = 0;
        showDialogue(scene, dialogues);
    });
    nextBtn.on('pointerdown', () => {
        playPop();
        dialogueState++;
        if (dialogueState < dialogues.length) {
            showDialogue(scene, dialogues);
        } else {
            hideDialogue();
            if (!hasTalkedToNPC) {
                hasTalkedToNPC = true;
                showMsg(scene, '🗨️ Elder Moren ให้คำแนะนำแล้ว — ตอนนี้เลือกหีบได้', 0x113322);
            }
        }
    });

    // ── Chests (Trials End room, bottom-right) ──
    chests = [];
    const chestData = [
        { x: 774, y: 524, correct: false },
        { x: 853, y: 524, correct: true  },
        { x: 926, y: 524, correct: false },
    ];
    scene.add.text(766, 454, 'Choose a chest wisely...', { fontSize: '13px', fill: '#bbb' });

    chestData.forEach(c => {
        const img = scene.add.image(c.x, c.y, 'chest').setDisplaySize(44, 36).setInteractive().setDepth(3);
        img.on('pointerover', () => { if (!img.getData('opened')) img.setTint(0xffdd88); });
        img.on('pointerout',  () => { if (!img.getData('opened')) img.clearTint(); });
        img.on('pointerdown', () => {
            if (img.getData('opened')) return;
            playPop();
            if (!hasTalkedToNPC) {
                showMsg(scene, '🗨️ ต้องคุยกับ Elder Moren ก่อนถึงจะเปิดหีบได้', 0x333311);
                return;
            }
            if (!isPlayerNear(c.x, c.y)) { tooFarMsg(scene); return; }
            img.setData('opened', true).setAlpha(0.5).clearTint();
            if (c.correct) {
                hasKey = true;
                showMsg(scene, '🗝️ You found the KEY! The exit is now open!', 0x004400);
                openDoor(scene, 'exitDoor', null);
                scene.add.text(926, 560, 'EXIT OPEN!', { fontSize: '13px', fill: '#00ff00', align: 'center', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
            } else {
                showMsg(scene, '💀 TRAP! You triggered a trap!', 0x660000);
                player.setTint(0xff0000);
                scene.time.delayedCall(600, () => player.clearTint());
            }
        });
        chests.push(img);
    });

    scene.add.text(968, 500, 'EXIT', { fontSize: '13px', fill: '#00ff00', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
    const winRect = scene.add.rectangle(985, 576, 10, 128, 0x00ff00, 0);
    scene.physics.add.existing(winRect, true);
    winRect.body.enable = false;
    scene.winZone = winRect;
    scene.exitZoneVis = scene.add.rectangle(979, 576, 14, 128, 0x00aa00, 0.0);

    msgBox  = scene.add.rectangle(MAP_W / 2, MAP_H / 2 - 5, 540, 84, 0x000000, 0.92).setVisible(false).setDepth(20);
    msgText = scene.add.text(MAP_W / 2, MAP_H / 2 - 5, '', { fontSize: '17px', fill: '#fff', wordWrap: { width: 500 }, align: 'center', lineSpacing: 5 })
        .setOrigin(0.5).setVisible(false).setDepth(21);

    // ── Player ──
    player = this.physics.add.sprite(240, 629, 'player', 0);
    player.setCollideWorldBounds(true).setDepth(5);
    this.physics.add.collider(player, walls);
    Object.values(doorZones).forEach(d => this.physics.add.collider(player, d));
    this.physics.add.overlap(player, winRect, () => {
        if (!scene._winShown) { scene._winShown = true; showWin(scene); }
    }, null, scene);

    wasd = this.input.keyboard.addKeys({
        up:    Phaser.Input.Keyboard.KeyCodes.W,
        left:  Phaser.Input.Keyboard.KeyCodes.A,
        down:  Phaser.Input.Keyboard.KeyCodes.S,
        right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    cursors = this.input.keyboard.createCursorKeys();

    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 1 }),  frameRate: 3,  repeat: -1 });
    this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player', { start: 24, end: 31 }), frameRate: 10, repeat: -1 });
    player.anims.play('idle');
}

function update() {
    const speed = 160;
    const left  = wasd.left.isDown  || cursors.left.isDown;
    const right = wasd.right.isDown || cursors.right.isDown;
    const up    = wasd.up.isDown    || cursors.up.isDown;
    const down  = wasd.down.isDown  || cursors.down.isDown;

    player.setVelocity(0);
    if (left)  { player.setVelocityX(-speed); player.flipX = true; }
    if (right) { player.setVelocityX(speed);  player.flipX = false; }
    if (up)    player.setVelocityY(-speed);
    if (down)  player.setVelocityY(speed);

    if (left || right || up || down) player.anims.play('walk', true);
    else player.anims.play('idle', true);
}

function showMsg(scene, text, color) {
    msgBox.setFillStyle(color || 0x000000, 0.92).setVisible(true);
    msgText.setText(text).setVisible(true);
    if (msgTimer) msgTimer.remove();
    msgTimer = scene.time.delayedCall(2800, () => {
        msgBox.setVisible(false);
        msgText.setVisible(false);
    });
}

function openDoor(scene, doorKey, labelName) {
    const door = doorZones[doorKey];
    if (!door || !door.visible) return;
    door.setVisible(false);
    door.body.enable = false;
    if (labelName) {
        const lbl = scene.children.getByName(labelName);
        if (lbl) lbl.setText('OPEN').setStyle({ fill: '#00ff00' });
    }
    showMsg(scene, '🚪 Door unlocked!', 0x003300);
    if (doorKey === 'exitDoor' && scene.winZone) {
        scene.winZone.body.enable = true;
        scene.exitZoneVis.setFillStyle(0x00ff00, 0.6);
    }
}

function checkStatues(scene) {
    if (statueAngles.every((a, i) => a === correctAngles[i])) {
        showMsg(scene, '🗿 All statues aligned! Secret door opens!', 0x003355);
        openDoor(scene, 'statueDoor', 'lbl_statue');
    }
}

function toggleTorch(scene, i, img, litT) {
    torchLit[i] = !torchLit[i];
    if (torchLit[i]) {
        img.setTint(0xffaa00);
        litT.setText('ON').setStyle({ fill: '#ffaa00' });
        torchOrder.push(i);
    } else {
        img.setTint(0x444444);
        litT.setText('OFF').setStyle({ fill: '#888' });
        resetTorches(scene);
        return;
    }
    for (let k = 0; k < torchOrder.length; k++) {
        if (torchOrder[k] !== correctTorchOrder[k]) {
            showMsg(scene, '🔥 Wrong order! Torches reset.', 0x550000);
            scene.time.delayedCall(800, () => resetTorches(scene));
            return;
        }
    }
    if (torchOrder.length === 4) {
        showMsg(scene, '🔥 Correct order! Torch door opens!', 0x553300);
        openDoor(scene, 'torchDoor', 'lbl_torch');
    }
}

function resetTorches(scene) {
    torchOrder = [];
    torchLit = [false, false, false, false];
    torchObjs.forEach(t => { t.img.setTint(0x444444); t.litT.setText('OFF').setStyle({ fill: '#888' }); });
}

function showDialogue(scene, dialogues) {
    dialogueBox.setVisible(true);
    dialogueName.setText('Elder Moren').setVisible(true);
    dialogueText.setText(dialogues[dialogueState]).setVisible(true);
    nextBtn.setText(dialogueState === dialogues.length - 1 ? '[ CLOSE ✕ ]' : '[ NEXT ▶ ]').setVisible(true);
}

function hideDialogue() {
    [dialogueBox, dialogueName, dialogueText, nextBtn].forEach(o => o.setVisible(false));
}

function showWin(scene) {
    player.setVelocity(0).setActive(false);
    ['left','right','up','down'].forEach(k => wasd[k].enabled = false);
    scene.add.rectangle(MAP_W / 2, MAP_H / 2, MAP_W, MAP_H, 0x000000, 0.75).setDepth(30);
    scene.add.text(MAP_W / 2, MAP_H / 2 - 40, '🏆 YOU WIN! 🏆', { fontSize: '52px', fill: '#FFD700', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(31);
    scene.add.text(MAP_W / 2, MAP_H / 2 + 45, 'You escaped the Tower!', { fontSize: '22px', fill: '#ffffff' }).setOrigin(0.5).setDepth(31);
}