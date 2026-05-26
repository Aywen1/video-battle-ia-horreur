import { Engine } from './core/Engine.js';
import { Player } from './core/Player.js';
import { Room } from './world/Room.js';
import { SoundManager } from './audio/SoundManager.js';

let engine, player, room, soundManager;
let isStarted = false;

function init() {
    engine = new Engine();
    player = new Player(engine.camera, engine.renderer.domElement, engine.scene);
    soundManager = new SoundManager(engine.camera);
    room = new Room(engine.scene, player, soundManager);

    setupUI();
    animate();
}

function setupUI() {
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', () => {
        player.controls.lock();
    });

    player.controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        
        if (!isStarted) {
            soundManager.init();
            isStarted = true;
        }
    });

    player.controls.addEventListener('unlock', () => {
        blocker.style.display = 'flex';
        instructions.style.display = '';
    });

    // Admin Menu
    const startAudioIfNeeded = () => {
        if (!isStarted) {
            soundManager.init();
            isStarted = true;
        }
    };

    document.getElementById('btn-tp-start').addEventListener('click', (e) => {
        e.stopPropagation();
        startAudioIfNeeded();
        room.forceGameState('INIT');
        player.controls.lock();
    });
    document.getElementById('btn-tp-elevator').addEventListener('click', (e) => {
        e.stopPropagation();
        startAudioIfNeeded();
        room.forceGameState('ELEVATOR');
        player.controls.lock();
    });
    document.getElementById('btn-tp-corrupted').addEventListener('click', (e) => {
        e.stopPropagation();
        startAudioIfNeeded();
        room.forceGameState('ANOMALY_HUNT');
        player.controls.lock();
    });
    document.getElementById('btn-tp-awake').addEventListener('click', (e) => {
        e.stopPropagation();
        startAudioIfNeeded();
        room.forceGameState('AWAKE');
        player.controls.lock();
    });
}

function animate() {
    requestAnimationFrame(animate);

    const delta = engine.render();
    
    if (player.controls.isLocked) {
        player.update(delta);
        room.update(delta);
        
        // Jouer le son de pas si le joueur bouge
        if (player.moveForward || player.moveBackward || player.moveLeft || player.moveRight) {
            soundManager.playFootstep(player.isSprinting);
        }
    }
}

init();