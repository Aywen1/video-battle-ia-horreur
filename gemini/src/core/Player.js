import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, scene) {
        this.camera = camera;
        this.scene = scene;
        this.controls = new PointerLockControls(camera, domElement);
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isSprinting = false;

        this.speed = 5.5;
        this.sprintSpeed = 8.5;
        this.mass = 100.0;
        
        this.headBobTimer = 0;
        this.baseY = 1.45; // Hauteur des yeux légèrement rabaissée

        // Raycaster pour les collisions
        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 2);
        this.interactRaycaster = new THREE.Raycaster();
        
        this.collidableObjects = [];
        this.interactableObjects = [];

        // Lampe torche
        this.flashlight = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 6, 0.5, 1);
        this.flashlight.position.set(0, 0, 0);
        this.flashlight.target.position.set(0, 0, -1);
        this.camera.add(this.flashlight);
        this.camera.add(this.flashlight.target);

        this.initEventListeners();
    }

    initEventListeners() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = true;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = true;
                    break;
                case 'ShiftLeft':
                    this.isSprinting = true;
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = false;
                    break;
                case 'ShiftLeft':
                    this.isSprinting = false;
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        
        document.addEventListener('mousedown', (event) => {
            if (this.controls.isLocked && event.button === 0) {
                this.interact();
            }
        });
    }

    addCollidable(mesh) {
        this.collidableObjects.push(mesh);
    }
    
    addInteractable(mesh, callback) {
        mesh.userData.interactCallback = callback;
        this.interactableObjects.push(mesh);
    }

    interact() {
        this.interactRaycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.interactRaycaster.intersectObjects(this.interactableObjects, false);
        
        if (intersects.length > 0 && intersects[0].distance < 3) {
            const object = intersects[0].object;
            if (object.userData.interactCallback) {
                object.userData.interactCallback();
            }
        }
    }

    checkCollisions(dir, distance) {
        // Simple raycast collision check
        this.raycaster.set(this.camera.position, dir);
        const intersects = this.raycaster.intersectObjects(this.collidableObjects, false);
        return intersects.length > 0 && intersects[0].distance < distance;
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        // Friction
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        const currentSpeed = this.isSprinting ? this.sprintSpeed : this.speed;

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * (currentSpeed * 10.0) * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * (currentSpeed * 10.0) * delta;

        // Collision detection (très basique pour l'instant)
        const controlObj = this.controls.getObject();
        const oldPos = controlObj.position.clone();

        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);

        // Effet de caméra de pas (Head bobbing)
        const speedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
        if (speedSq > 0.1) {
            const speed = Math.sqrt(speedSq);
            // La vitesse du balancement dépend de la vitesse de déplacement (encore plus rapide)
            this.headBobTimer += delta * (speed * 2.5);
            
            // Intensité réduite
            const bobAmount = this.isSprinting ? 0.08 : 0.04;
            // Mouvement vertical (rebond)
            controlObj.position.y = this.baseY + Math.sin(this.headBobTimer) * bobAmount;
        } else {
            // Retour en douceur à la hauteur de base
            this.headBobTimer = 0;
            controlObj.position.y += (this.baseY - controlObj.position.y) * 10.0 * delta;
        }

        // Si on a des objets de collision, on pourrait vérifier ici et annuler le mouvement si besoin
        // Pour une première salle, on va juste laisser le mouvement libre ou ajouter des murs simples
    }
}