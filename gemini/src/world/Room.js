import * as THREE from 'three';

export class Room {
    constructor(scene, player, soundManager) {
        this.scene = scene;
        this.player = player;
        this.soundManager = soundManager;
        
        // Game State
        this.state = 'INIT'; // INIT, SEARCHING, ESCAPE
        this.foldersCollected = 0;
        this.totalFolders = 3;
        this.folders = [];
        this.chairs = []; // Pour la paranoïa
        this.neons = []; // Pour le flickering
        
        this.materials = {
            floor: new THREE.MeshStandardMaterial({ color: 0xdae1e7, roughness: 0.8, metalness: 0.2 }),
            wall: new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.9, metalness: 0.1 }),
            ceiling: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 }),
            desk: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 }),
            screen: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 }),
            screenOn: new THREE.MeshBasicMaterial({ color: 0x44ff44 }), // Écran allumé
            neon: new THREE.MeshBasicMaterial({ color: 0xffffff }), // Matériau émissif pour le bloom
            poufPink: new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.9, metalness: 0.0 }),
            poufBlue: new THREE.MeshStandardMaterial({ color: 0xadd8e6, roughness: 0.9, metalness: 0.0 }),
            poufYellow: new THREE.MeshStandardMaterial({ color: 0xffffe0, roughness: 0.9, metalness: 0.0 }),
            plantPot: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.1 }),
            plantLeaf: new THREE.MeshStandardMaterial({ color: 0x98fb98, roughness: 0.7, metalness: 0.1 }),
            windowFrame: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.8 }),
            chair: this.createChairMaterial(),
            chairLeg: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 }), // Métal sombre pour le pied
            rugChill: this.createCarpetMaterial('#e6e6fa'), // Tapis rose très pâle pour la zone détente
            rugPath: this.createCarpetMaterial('#4682b4'), // Chemin bleu corporate
            waterBottle: new THREE.MeshPhysicalMaterial({ 
                color: 0x88ccff, transmission: 0.9, opacity: 1, metalness: 0.1, roughness: 0.1, ior: 1.5, thickness: 0.5 
            }), // Plastique bleu translucide
            printerGrey: new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.7, metalness: 0.2 }),
            printerDark: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.1 }),
            whiteboard: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 }), // Très lisse (effaçable à sec)
            whiteboardFrame: new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.6, metalness: 0.8 }), // Aluminium
            folderRed: new THREE.MeshBasicMaterial({ color: 0xff0000 }), // Rouge vif pour les collectibles
            sky: this.createSkyMaterial()
        };

        this.buildArchitecture();
        this.buildDesks();
        this.buildTerminal();
        this.buildDecorations();
        this.buildVFX();
    }

    createSkyMaterial() {
        // On crée un canvas qu'on va pouvoir mettre à jour
        this.skyCanvas = document.createElement('canvas');
        this.skyCanvas.width = 512;
        this.skyCanvas.height = 512;
        this.skyContext = this.skyCanvas.getContext('2d');
        
        this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
        this.skyMaterial = new THREE.MeshBasicMaterial({ map: this.skyTexture, fog: false });
        
        // Dessiner le ciel de jour initial
        this.drawDaySky();
        
        return this.skyMaterial;
    }

    drawDaySky() {
        const gradient = this.skyContext.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#87ceeb'); // Bleu ciel
        gradient.addColorStop(1, '#e0f6ff'); // Bleu très clair
        
        this.skyContext.fillStyle = gradient;
        this.skyContext.fillRect(0, 0, 512, 512);
        this.skyTexture.needsUpdate = true;
    }

    drawNightSky() {
        const gradient = this.skyContext.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#020111'); // Bleu nuit très très sombre
        gradient.addColorStop(1, '#20124d'); // Violet sombre
        
        this.skyContext.fillStyle = gradient;
        this.skyContext.fillRect(0, 0, 512, 512);

        // Ajouter quelques étoiles (bruit blanc)
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = Math.random() * 1.5;
            const opacity = Math.random() * 0.8 + 0.2;
            
            this.skyContext.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            this.skyContext.beginPath();
            this.skyContext.arc(x, y, size, 0, Math.PI * 2);
            this.skyContext.fill();
        }

        this.skyTexture.needsUpdate = true;
    }

    createChairMaterial() {
        // Création d'une texture de cuir procédurale
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Fond cuir (noir / gris très foncé)
        context.fillStyle = '#111111';
        context.fillRect(0, 0, 512, 512);
        
        // Taches douces pour l'aspect cuir usé et les variations de teinte
        for (let i = 0; i < 3000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const radius = Math.random() * 20 + 5;
            const opacity = Math.random() * 0.03;
            
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = `rgba(40, 40, 40, ${opacity})`;
            context.fill();
        }

        // Petites craquelures / grain du cuir
        for (let i = 0; i < 15000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const brightness = Math.random() > 0.5 ? 255 : 0;
            const opacity = Math.random() * 0.02;
            context.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${opacity})`;
            context.fillRect(x, y, 1, 1);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        
        return new THREE.MeshStandardMaterial({ 
            map: texture,
            roughness: 0.4, // Plus lisse/brillant que le tissu
            metalness: 0.2  // Légèrement métallique pour les reflets du cuir
        });
    }

    createCarpetMaterial(colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        // Fond couleur de base
        context.fillStyle = colorHex;
        context.fillRect(0, 0, 256, 256);
        
        // Motif de moquette (petits points de bruit)
        for (let i = 0; i < 20000; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const brightness = Math.random() > 0.5 ? 255 : 0;
            const opacity = Math.random() * 0.05;
            context.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${opacity})`;
            context.fillRect(x, y, 2, 2);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        
        return new THREE.MeshStandardMaterial({ 
            map: texture,
            roughness: 1.0, // Très rugueux (tissu)
            metalness: 0.0 
        });
    }

    buildArchitecture() {
        // Sol
        const floorGeo = new THREE.PlaneGeometry(40, 40);
        const floor = new THREE.Mesh(floorGeo, this.materials.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Plafond
        const ceilingGeo = new THREE.PlaneGeometry(40, 40);
        const ceiling = new THREE.Mesh(ceilingGeo, this.materials.ceiling);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 4;
        this.scene.add(ceiling);

        // Murs
        const wallGeo = new THREE.PlaneGeometry(40, 4);
        
        const wallN = new THREE.Mesh(wallGeo, this.materials.wall);
        wallN.position.set(0, 2, -20);
        wallN.receiveShadow = true;
        this.scene.add(wallN);
        this.player.addCollidable(wallN);

        const wallS = new THREE.Mesh(wallGeo, this.materials.wall);
        wallS.position.set(0, 2, 20);
        wallS.rotation.y = Math.PI;
        wallS.receiveShadow = true;
        this.scene.add(wallS);
        this.player.addCollidable(wallS);

        // Murs avec fenêtres (Est et Ouest)
        this.buildWallWithWindow(new THREE.Vector3(20, 0, 0), -Math.PI / 2);
        this.buildWallWithWindow(new THREE.Vector3(-20, 0, 0), Math.PI / 2);

        // Porte de sortie (verrouillée)
        const doorGeo = new THREE.BoxGeometry(2, 3, 0.1);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0xffcccc }); // Porte légèrement rose
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 1.5, -19.9);
        this.scene.add(door);
        this.player.addCollidable(door);
        
        this.player.addInteractable(door, () => {
            if (this.state === 'INIT') {
                this.showSubtitle("La porte est verrouillée. Je dois pointer sur mon terminal avant de partir.");
            } else if (this.state === 'SEARCHING') {
                this.showSubtitle(`Il me manque encore ${this.totalFolders - this.foldersCollected} dossiers urgents.`);
            } else if (this.state === 'ESCAPE') {
                // Déplacer le joueur dans l'ascenseur
                this.startElevatorTransition();
            }
        });

        // Néons au plafond
        const neonGeo = new THREE.BoxGeometry(0.2, 0.1, 4);
        for (let x = -15; x <= 15; x += 5) {
            for (let z = -15; z <= 15; z += 5) {
                const neon = new THREE.Mesh(neonGeo, this.materials.neon);
                neon.position.set(x, 3.95, z);
                this.scene.add(neon);
                this.neons.push(neon);
            }
        }

        // Ajouter seulement 4 lumières ponctuelles pour simuler l'éclairage global sans dépasser la limite de textures
        const lightPositions = [
            [-10, 3.8, -10],
            [10, 3.8, -10],
            [-10, 3.8, 10],
            [10, 3.8, 10]
        ];

        lightPositions.forEach(pos => {
            const light = new THREE.PointLight(0xffffff, 0.4, 30);
            light.position.set(...pos);
            light.castShadow = true;
            light.shadow.bias = -0.001;
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
            this.scene.add(light);
        });
    }

    buildWallWithWindow(position, rotation) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.rotation.y = rotation;

        // Dimensions du mur : 40x4
        // Fenêtre au centre : largeur 20, hauteur 2, à partir de y=1
        
        // Bas (hauteur 1)
        const bottomGeo = new THREE.PlaneGeometry(40, 1);
        const bottom = new THREE.Mesh(bottomGeo, this.materials.wall);
        bottom.position.set(0, 0.5, 0);
        bottom.receiveShadow = true;
        group.add(bottom);
        this.player.addCollidable(bottom);

        // Haut (hauteur 1)
        const topGeo = new THREE.PlaneGeometry(40, 1);
        const top = new THREE.Mesh(topGeo, this.materials.wall);
        top.position.set(0, 3.5, 0);
        top.receiveShadow = true;
        group.add(top);
        this.player.addCollidable(top);

        // Gauche (largeur 10, hauteur 2)
        const leftGeo = new THREE.PlaneGeometry(10, 2);
        const left = new THREE.Mesh(leftGeo, this.materials.wall);
        left.position.set(-15, 2, 0);
        left.receiveShadow = true;
        group.add(left);
        this.player.addCollidable(left);

        // Droite (largeur 10, hauteur 2)
        const rightGeo = new THREE.PlaneGeometry(10, 2);
        const right = new THREE.Mesh(rightGeo, this.materials.wall);
        right.position.set(15, 2, 0);
        right.receiveShadow = true;
        group.add(right);
        this.player.addCollidable(right);

        // Cadre de fenêtre
        const frameThickness = 0.2;
        const frameDepth = 0.4;
        const frameGeoH = new THREE.BoxGeometry(20 + frameThickness*2, frameThickness, frameDepth);
        const frameGeoV = new THREE.BoxGeometry(frameThickness, 2, frameDepth);
        
        const frameBottom = new THREE.Mesh(frameGeoH, this.materials.windowFrame);
        frameBottom.position.set(0, 1, 0);
        group.add(frameBottom);
        
        const frameTop = new THREE.Mesh(frameGeoH, this.materials.windowFrame);
        frameTop.position.set(0, 3, 0);
        group.add(frameTop);
        
        const frameLeft = new THREE.Mesh(frameGeoV, this.materials.windowFrame);
        frameLeft.position.set(-10, 2, 0);
        group.add(frameLeft);
        
        const frameRight = new THREE.Mesh(frameGeoV, this.materials.windowFrame);
        frameRight.position.set(10, 2, 0);
        group.add(frameRight);

        // Montants verticaux intermédiaires (style baie vitrée)
        for(let i = -5; i <= 5; i += 5) {
            const frameMid = new THREE.Mesh(frameGeoV, this.materials.windowFrame);
            frameMid.position.set(i, 2, 0);
            group.add(frameMid);
        }

        // Ciel extérieur (plan très grand, reculé pour effet de profondeur)
        const skyGeo = new THREE.PlaneGeometry(100, 40);
        const sky = new THREE.Mesh(skyGeo, this.materials.sky);
        sky.position.set(0, 2, -10); // Reculé de 10 unités derrière la fenêtre
        group.add(sky);

        this.scene.add(group);
    }

    buildDesks() {
        // Utilisation de InstancedMesh pour les bureaux
        const deskGeo = new THREE.BoxGeometry(1.6, 0.75, 0.8);
        const count = 24;
        const deskMesh = new THREE.InstancedMesh(deskGeo, this.materials.desk, count);
        deskMesh.castShadow = true;
        deskMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        let i = 0;

        // Géométries pour les chaises (fauteuil de direction en cuir)
        const seatGeo = new THREE.BoxGeometry(0.6, 0.15, 0.5); // Assise plus épaisse
        const backGeo = new THREE.BoxGeometry(0.55, 0.7, 0.15); // Dossier plus haut et épais
        const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3); // Pilier central
        const armGeo = new THREE.BoxGeometry(0.25, 0.03, 0.03); // Branche de l'étoile
        armGeo.translate(0.125, 0, 0); // Décaler pour que la rotation se fasse depuis le centre
        const wheelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02); // Roue
        wheelGeo.rotateX(Math.PI / 2); // Mettre la roue à la verticale

        for (let x = -10; x <= 10; x += 4) {
            for (let z = -10; z <= 10; z += 4) {
                // Laisser un espace au centre pour le joueur
                if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
                if (i >= count) break;

                // Bureau
                dummy.position.set(x, 0.375, z);
                dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                deskMesh.setMatrixAt(i, dummy.matrix);
                
                // Ajouter un écran éteint sur chaque bureau
                const screenGeo = new THREE.BoxGeometry(0.6, 0.4, 0.05);
                const screen = new THREE.Mesh(screenGeo, this.materials.screen);
                screen.position.set(x, 0.95, z - 0.2);
                this.scene.add(screen);

                // Créer un groupe pour la chaise pour pouvoir la déplacer facilement (Paranoïa)
                const chairGroup = new THREE.Group();
                chairGroup.position.set(x, 0, z + 0.7);

                // Chaise - Assise
                const seat = new THREE.Mesh(seatGeo, this.materials.chair);
                seat.position.set(0, 0.45, 0);
                seat.castShadow = true; seat.receiveShadow = true;
                chairGroup.add(seat);

                // Chaise - Dossier
                const back = new THREE.Mesh(backGeo, this.materials.chair);
                back.position.set(0, 0.75, 0.2);
                back.castShadow = true; back.receiveShadow = true;
                chairGroup.add(back);

                // Chaise - Pilier central
                const pillar = new THREE.Mesh(pillarGeo, this.materials.chairLeg);
                pillar.position.set(0, 0.25, 0);
                pillar.castShadow = true; pillar.receiveShadow = true;
                chairGroup.add(pillar);

                // Chaise - Base étoilée (5 branches) et roues
                for (let j = 0; j < 5; j++) {
                    const angle = (j / 5) * Math.PI * 2;
                    
                    // Branche
                    const arm = new THREE.Mesh(armGeo, this.materials.chairLeg);
                    arm.position.set(0, 0.1, 0);
                    arm.rotation.y = angle;
                    arm.castShadow = true; arm.receiveShadow = true;
                    chairGroup.add(arm);
                    
                    // Roue (au bout de la branche)
                    const wheel = new THREE.Mesh(wheelGeo, this.materials.chairLeg);
                    wheel.position.set(Math.cos(angle) * 0.25, 0.03, -Math.sin(angle) * 0.25);
                    wheel.rotation.y = angle;
                    wheel.castShadow = true; wheel.receiveShadow = true;
                    chairGroup.add(wheel);
                }

                this.scene.add(chairGroup);
                this.chairs.push(chairGroup);

                i++;
            }
        }
        deskMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(deskMesh);
    }

    buildTerminal() {
        // Le bureau interactif du joueur
        const deskGeo = new THREE.BoxGeometry(1.6, 0.75, 0.8);
        const desk = new THREE.Mesh(deskGeo, this.materials.desk);
        desk.position.set(0, 0.375, -2);
        this.scene.add(desk);

        const screenGeo = new THREE.BoxGeometry(0.6, 0.4, 0.05);
        const screen = new THREE.Mesh(screenGeo, this.materials.screenOn);
        screen.position.set(0, 0.95, -2.2);
        this.scene.add(screen);

        // Lumière verte de l'écran
        const screenLight = new THREE.PointLight(0x44ff44, 0.5, 2);
        screenLight.position.set(0, 0.95, -2.0);
        this.scene.add(screenLight);

        // Afficher la première tâche au démarrage
        setTimeout(() => {
            this.updateTaskUI("Pointer au terminal");
        }, 1000);

        // Interaction avec le terminal
        this.player.addInteractable(screen, () => {
            if (this.state === 'INIT') {
                this.showSubtitle("Terminal : 'ERREUR. 3 dossiers urgents manquants détectés sur les bureaux.'");
                this.startSearchingPhase();
            } else if (this.state === 'SEARCHING') {
                this.showSubtitle(`Terminal : 'Veuillez trouver les ${this.totalFolders - this.foldersCollected} dossiers restants.'`);
            } else if (this.state === 'ESCAPE') {
                this.showSubtitle("Terminal : 'Pointage validé. Vous pouvez quitter les locaux.'");
                this.updateTaskUI("Quitter le bureau", false);
            }
            // Déclencher un événement sonore ici
            window.dispatchEvent(new CustomEvent('terminal-interacted'));
        });
        
        // On permet aussi de cliquer sur le bureau pour être plus permissif
        this.player.addInteractable(desk, () => {
            if (this.state === 'INIT') {
                this.showSubtitle("Terminal : 'ERREUR. 3 dossiers urgents manquants détectés sur les bureaux.'");
                this.startSearchingPhase();
            } else if (this.state === 'SEARCHING') {
                this.showSubtitle(`Terminal : 'Veuillez trouver les ${this.totalFolders - this.foldersCollected} dossiers restants.'`);
            } else if (this.state === 'ESCAPE') {
                this.showSubtitle("Terminal : 'Pointage validé. Vous pouvez quitter les locaux.'");
                this.updateTaskUI("Quitter le bureau", false);
            }
            // Déclencher un événement sonore ici
            window.dispatchEvent(new CustomEvent('terminal-interacted'));
        });
    }

    startSearchingPhase() {
        if (this.state !== 'INIT') return;
        this.state = 'SEARCHING';
        
        if (this.soundManager) {
            this.soundManager.startDrone();
            this.soundManager.playGlitchSound();
        }
        
        this.buildCollectibles();
        this.updateTaskUI(`Trouver les dossiers (0/${this.totalFolders})`, false);
        
        // On signale qu'on veut changer l'ambiance (les lumières)
        window.dispatchEvent(new CustomEvent('phase-searching'));
        
        // Assombrir le ciel extérieur
        this.drawNightSky();
    }

    buildCollectibles() {
        const folderGeo = new THREE.BoxGeometry(0.3, 0.05, 0.4);
        
        // Sélectionner 3 bureaux aléatoires (hors bureau du joueur)
        const possiblePositions = [];
        for (let x = -10; x <= 10; x += 4) {
            for (let z = -10; z <= 10; z += 4) {
                if (Math.abs(x) < 2 && Math.abs(z) < 2) continue; // Ignorer centre
                possiblePositions.push({ x, z });
            }
        }
        
        // Mélanger et prendre les 3 premiers
        possiblePositions.sort(() => Math.random() - 0.5);
        const selectedPositions = possiblePositions.slice(0, this.totalFolders);

        selectedPositions.forEach(pos => {
            const folder = new THREE.Mesh(folderGeo, this.materials.folderRed);
            // Placer sur le bureau
            folder.position.set(pos.x + (Math.random() - 0.5) * 0.5, 0.775, pos.z + (Math.random() - 0.5) * 0.2);
            folder.rotation.y = Math.random() * Math.PI;
            
            // Ajouter une petite lumière rouge pour attirer l'oeil
            const folderLight = new THREE.PointLight(0xff0000, 0.5, 2);
            folder.add(folderLight);
            
            this.scene.add(folder);
            this.folders.push(folder);
            
            this.player.addInteractable(folder, () => {
                this.collectFolder(folder);
            });
        });
    }

    collectFolder(folder) {
        // Retirer le dossier de la scène
        this.scene.remove(folder);
        this.player.interactableObjects = this.player.interactableObjects.filter(obj => obj !== folder);
        
        this.foldersCollected++;
        
        if (this.soundManager) {
            this.soundManager.playSuccessSound();
            this.soundManager.increaseDroneIntensity();
        }
        
        if (this.foldersCollected >= this.totalFolders) {
            this.state = 'ESCAPE';
            this.showSubtitle("J'ai tous les dossiers. Je dois retourner pointer au terminal.");
            this.updateTaskUI("Retourner pointer au terminal", false);
            // L'ambiance devient encore plus oppressante
            window.dispatchEvent(new CustomEvent('phase-escape'));
        } else {
            this.showSubtitle(`Dossier récupéré. Plus que ${this.totalFolders - this.foldersCollected}.`);
            this.updateTaskUI(`Trouver les dossiers (${this.foldersCollected}/${this.totalFolders})`, false);
        }
    }

    buildDecorations() {
        this.buildRugs();
        this.buildPoufs();
        this.buildPlants();
        this.buildWaterCoolers();
        this.buildPrinters();
        this.buildWhiteboards();
    }

    buildWaterCoolers() {
        const coolerPositions = [
            { x: 12, z: -18 }, // Dans la zone détente
            { x: -18, z: 0 },  // Contre le mur Ouest
            { x: 18, z: 0 }    // Contre le mur Est
        ];

        const baseGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
        const bottleGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 16);
        const dripTrayGeo = new THREE.BoxGeometry(0.3, 0.05, 0.1);

        coolerPositions.forEach(pos => {
            const coolerGroup = new THREE.Group();
            coolerGroup.position.set(pos.x, 0, pos.z);

            // Base blanche
            const base = new THREE.Mesh(baseGeo, this.materials.printerGrey);
            base.position.y = 0.5;
            base.castShadow = true;
            base.receiveShadow = true;
            coolerGroup.add(base);
            this.player.addCollidable(base);

            // Bonbonne d'eau translucide
            const bottle = new THREE.Mesh(bottleGeo, this.materials.waterBottle);
            bottle.position.y = 1.2;
            bottle.castShadow = true;
            coolerGroup.add(bottle);

            // Petit bac récupérateur d'eau (noir)
            const dripTray = new THREE.Mesh(dripTrayGeo, this.materials.printerDark);
            dripTray.position.set(0, 0.6, 0.2);
            coolerGroup.add(dripTray);

            // Rotation aléatoire (orienté vers le centre de la pièce)
            coolerGroup.lookAt(0, 0, 0);
            
            this.scene.add(coolerGroup);
        });
    }

    buildPrinters() {
        const printerPositions = [
            { x: 0, z: 18, rot: Math.PI }, // Contre le mur Sud
            { x: -18, z: -10, rot: Math.PI / 2 } // Contre le mur Ouest
        ];

        // Composants de la photocopieuse
        const baseGeo = new THREE.BoxGeometry(1.2, 0.8, 0.8);
        const topGeo = new THREE.BoxGeometry(1.0, 0.3, 0.7);
        const paperTrayGeo = new THREE.BoxGeometry(0.8, 0.1, 0.4);
        const screenGeo = new THREE.BoxGeometry(0.2, 0.15, 0.05);

        printerPositions.forEach(pos => {
            const printerGroup = new THREE.Group();
            printerGroup.position.set(pos.x, 0, pos.z);
            printerGroup.rotation.y = pos.rot;

            // Base principale
            const base = new THREE.Mesh(baseGeo, this.materials.printerGrey);
            base.position.y = 0.4;
            base.castShadow = true;
            base.receiveShadow = true;
            printerGroup.add(base);
            this.player.addCollidable(base);

            // Partie haute (scanner)
            const top = new THREE.Mesh(topGeo, this.materials.printerGrey);
            top.position.set(0, 0.95, -0.05);
            top.castShadow = true;
            printerGroup.add(top);

            // Bac à papier (noir)
            const paperTray = new THREE.Mesh(paperTrayGeo, this.materials.printerDark);
            paperTray.position.set(0, 0.85, 0.15);
            printerGroup.add(paperTray);

            // Petit écran de contrôle
            const screen = new THREE.Mesh(screenGeo, this.materials.screenOn); // Écran vert allumé
            screen.position.set(0.3, 1.1, 0.3);
            screen.rotation.x = -Math.PI / 6; // Incliné vers l'utilisateur
            printerGroup.add(screen);

            this.scene.add(printerGroup);
        });
    }

    buildWhiteboards() {
        const boardPositions = [
            { x: 10, z: -15, rot: -Math.PI / 4 }, // Près de la zone détente
            { x: -10, z: 10, rot: Math.PI / 6 },  // Séparation entre bureaux
            { x: 10, z: 10, rot: -Math.PI / 6 }   // Séparation entre bureaux
        ];

        // Composants du tableau
        const boardGeo = new THREE.BoxGeometry(2.0, 1.2, 0.05);
        const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8);
        const footGeo = new THREE.BoxGeometry(0.6, 0.05, 0.05);

        boardPositions.forEach(pos => {
            const boardGroup = new THREE.Group();
            boardGroup.position.set(pos.x, 0, pos.z);
            boardGroup.rotation.y = pos.rot;

            // Le tableau blanc
            const board = new THREE.Mesh(boardGeo, this.materials.whiteboard);
            board.position.y = 1.3;
            board.castShadow = true;
            board.receiveShadow = true;
            boardGroup.add(board);
            this.player.addCollidable(board);

            // Cadre métallique autour du tableau
            const frameGeo = new THREE.BoxGeometry(2.05, 1.25, 0.06);
            const frame = new THREE.Mesh(frameGeo, this.materials.whiteboardFrame);
            frame.position.y = 1.3;
            boardGroup.add(frame);

            // Pied gauche
            const legL = new THREE.Mesh(legGeo, this.materials.whiteboardFrame);
            legL.position.set(-0.9, 0.9, 0);
            boardGroup.add(legL);

            // Pied droit
            const legR = new THREE.Mesh(legGeo, this.materials.whiteboardFrame);
            legR.position.set(0.9, 0.9, 0);
            boardGroup.add(legR);

            // Base roulante gauche
            const footL = new THREE.Mesh(footGeo, this.materials.printerDark);
            footL.position.set(-0.9, 0.05, 0);
            footL.rotation.y = Math.PI / 2;
            boardGroup.add(footL);

            // Base roulante droite
            const footR = new THREE.Mesh(footGeo, this.materials.printerDark);
            footR.position.set(0.9, 0.05, 0);
            footR.rotation.y = Math.PI / 2;
            boardGroup.add(footR);

            this.scene.add(boardGroup);
        });
    }

    buildRugs() {
        // Tapis zone détente (sous les poufs)
        const chillRugGeo = new THREE.PlaneGeometry(8, 8);
        const chillRug = new THREE.Mesh(chillRugGeo, this.materials.rugChill);
        chillRug.rotation.x = -Math.PI / 2;
        chillRug.position.set(16, 0.01, -15); // Y=0.01 pour éviter le z-fighting avec le sol
        chillRug.receiveShadow = true;
        this.scene.add(chillRug);

        // Chemin central vertical (de la porte vers le terminal du joueur)
        const mainPathGeo = new THREE.PlaneGeometry(4, 38);
        const mainPath = new THREE.Mesh(mainPathGeo, this.materials.rugPath);
        mainPath.rotation.x = -Math.PI / 2;
        mainPath.position.set(0, 0.01, 0);
        mainPath.receiveShadow = true;
        this.scene.add(mainPath);

        // Chemins horizontaux (entre les rangées de bureaux)
        // Les bureaux sont placés en Z : -10, -6, -2, 2, 6, 10
        // On place les chemins entre ces rangées : Z = -8, -4, 4, 8
        const crossPathGeo = new THREE.PlaneGeometry(38, 2);
        
        const pathZPositions = [-8, -4, 4, 8];
        pathZPositions.forEach(zPos => {
            const crossPath = new THREE.Mesh(crossPathGeo, this.materials.rugPath);
            crossPath.rotation.x = -Math.PI / 2;
            crossPath.position.set(0, 0.01, zPos);
            crossPath.receiveShadow = true;
            this.scene.add(crossPath);
        });
    }

    buildPoufs() {
        // Zone détente dans un coin (ex: Nord-Est)
        const poufGeo = new THREE.SphereGeometry(0.6, 32, 16);
        
        const poufPositions = [
            { x: 15, z: -15, mat: this.materials.poufPink },
            { x: 17, z: -14, mat: this.materials.poufBlue },
            { x: 16, z: -17, mat: this.materials.poufYellow },
            { x: 14, z: -13, mat: this.materials.poufBlue },
            { x: 18, z: -16, mat: this.materials.poufPink }
        ];

        poufPositions.forEach(pos => {
            const pouf = new THREE.Mesh(poufGeo, pos.mat);
            pouf.position.set(pos.x, 0.4, pos.z);
            pouf.scale.y = 0.6; // Écraser la sphère pour faire un pouf
            
            // Légère rotation aléatoire pour le côté naturel
            pouf.rotation.y = Math.random() * Math.PI;
            pouf.rotation.z = (Math.random() - 0.5) * 0.2;
            pouf.rotation.x = (Math.random() - 0.5) * 0.2;
            
            pouf.castShadow = true;
            pouf.receiveShadow = true;
            this.scene.add(pouf);
            this.player.addCollidable(pouf);
        });
    }

    buildPlants() {
        const plantPositions = [
            { x: -18, z: -18 },
            { x: -18, z: 18 },
            { x: 18, z: 18 },
            { x: 0, z: -15 }, // Près de la porte
            { x: -10, z: 0 }, // Entre les bureaux
            { x: 10, z: 0 }
        ];

        const potGeo = new THREE.CylinderGeometry(0.4, 0.3, 0.8, 16);
        const leafGeo = new THREE.SphereGeometry(0.3, 16, 16);

        plantPositions.forEach(pos => {
            const plantGroup = new THREE.Group();
            plantGroup.position.set(pos.x, 0, pos.z);

            // Pot
            const pot = new THREE.Mesh(potGeo, this.materials.plantPot);
            pot.position.y = 0.4;
            pot.castShadow = true;
            pot.receiveShadow = true;
            plantGroup.add(pot);
            this.player.addCollidable(pot);

            // Feuillage (assemblage de sphères écrasées/étirées)
            const numLeaves = 5 + Math.floor(Math.random() * 4);
            for (let i = 0; i < numLeaves; i++) {
                const leaf = new THREE.Mesh(leafGeo, this.materials.plantLeaf);
                
                // Position aléatoire au-dessus du pot
                leaf.position.set(
                    (Math.random() - 0.5) * 0.6,
                    0.8 + Math.random() * 0.8,
                    (Math.random() - 0.5) * 0.6
                );
                
                // Déformation pour faire des feuilles allongées
                leaf.scale.set(
                    0.5 + Math.random() * 0.5,
                    1.5 + Math.random(),
                    0.5 + Math.random() * 0.5
                );
                
                // Rotation vers l'extérieur
                leaf.lookAt(
                    leaf.position.x * 2,
                    leaf.position.y + 1,
                    leaf.position.z * 2
                );
                
                leaf.castShadow = true;
                plantGroup.add(leaf);
            }

            this.scene.add(plantGroup);
        });
    }

    buildVFX() {
        // Particules de poussière
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20;     // x
            positions[i * 3 + 1] = Math.random() * 10 - 5;     // y
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20; // z
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.05,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
        });

        this.dustParticles = new THREE.Points(geometry, material);
        // On attache les particules à la caméra pour qu'elles suivent le joueur
        this.player.camera.add(this.dustParticles);
        
        // Objets qui vont "respirer" dans le niveau corrompu
        this.breathingObjects = [];
    }

    forceGameState(targetState) {
        if (targetState === 'INIT') {
            window.location.reload();
            return;
        }

        // Nettoyage de la scène actuelle
        this.folders.forEach(f => this.scene.remove(f));
        this.folders = [];
        
        this.breathingObjects = [];
        
        // Cacher les UI spéciaux
        const screamerDiv = document.getElementById('screamer');
        if (screamerDiv) screamerDiv.style.display = 'none';
        const endScreen = document.getElementById('end-screen');
        if (endScreen) endScreen.style.display = 'none';
        const uiDiv = document.getElementById('ui');
        if (uiDiv) uiDiv.style.display = 'flex';
        const canvas = document.querySelector('canvas');
        if (canvas) canvas.style.display = 'block';

        // Arrêter les sons en cours
        if (this.soundManager) {
            this.soundManager.stopDrone();
        }
        if (this.elevatorShakeInterval) {
            clearInterval(this.elevatorShakeInterval);
        }

        // Eteindre la lampe torche par défaut
        if (this.player.flashlight) {
            this.player.flashlight.intensity = 0;
        }

        switch(targetState) {
            case 'ELEVATOR':
                this.startElevatorTransition();
                break;
            case 'ANOMALY_HUNT':
                this.startCorruptedLevel();
                break;
            case 'AWAKE':
                this.startAwakePhase();
                break;
        }
    }

    startElevatorTransition() {
        this.state = 'ELEVATOR';
        this.showSubtitle("L'ascenseur... enfin.");
        this.updateTaskUI("Monter au Niveau Direction", false);
        
        if (this.soundManager) {
            this.soundManager.stopDrone();
        }

        // Réinitialiser l'ambiance visuelle (Faux sentiment de sécurité)
        window.dispatchEvent(new CustomEvent('phase-elevator'));
        this.drawDaySky();

        // Téléporter le joueur dans la cabine d'ascenseur (loin de la salle 1)
        const elevatorZ = -100;
        this.player.baseY = 1.45;
        this.player.controls.getObject().position.set(0, this.player.baseY, elevatorZ);
        
        this.buildElevator(elevatorZ);
    }

    buildElevator(zPos) {
        if (this.elevatorGroup) {
            this.scene.remove(this.elevatorGroup);
        }
        const group = new THREE.Group();
        this.elevatorGroup = group;
        group.position.set(0, 0, zPos);

        // Cabine (4x4)
        const floorGeo = new THREE.PlaneGeometry(4, 4);
        const floor = new THREE.Mesh(floorGeo, this.materials.printerDark); // Sol sombre
        floor.rotation.x = -Math.PI / 2;
        group.add(floor);

        const ceilingGeo = new THREE.PlaneGeometry(4, 4);
        const ceiling = new THREE.Mesh(ceilingGeo, this.materials.ceiling);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 4; // Hauteur augmentée
        group.add(ceiling);

        // Murs de l'ascenseur (métal)
        const wallGeo = new THREE.PlaneGeometry(4, 4); // Hauteur augmentée pour éviter de passer au dessus
        const elevatorWallMat = this.materials.windowFrame; // Métal gris
        
        const wallN = new THREE.Mesh(wallGeo, elevatorWallMat);
        wallN.position.set(0, 2, -2);
        group.add(wallN);
        this.player.addCollidable(wallN);

        const wallS = new THREE.Mesh(wallGeo, elevatorWallMat);
        wallS.position.set(0, 2, 2);
        wallS.rotation.y = Math.PI;
        group.add(wallS);
        this.player.addCollidable(wallS);

        const wallE = new THREE.Mesh(wallGeo, elevatorWallMat);
        wallE.position.set(2, 2, 0);
        wallE.rotation.y = -Math.PI / 2;
        group.add(wallE);
        this.player.addCollidable(wallE);

        const wallW = new THREE.Mesh(wallGeo, elevatorWallMat);
        wallW.position.set(-2, 2, 0);
        wallW.rotation.y = Math.PI / 2;
        group.add(wallW);
        this.player.addCollidable(wallW);

        // Lumière de l'ascenseur
        const light = new THREE.PointLight(0xffffff, 0.8, 10);
        light.position.set(0, 3.8, 0);
        group.add(light);

        // Panneau de contrôle
        const panelGeo = new THREE.BoxGeometry(0.4, 0.6, 0.05);
        const panel = new THREE.Mesh(panelGeo, this.materials.printerDark);
        panel.position.set(1.95, 1.5, 0);
        panel.rotation.y = -Math.PI / 2;
        group.add(panel);

        // Bouton
        const buttonGeo = new THREE.BoxGeometry(0.1, 0.1, 0.02);
        const button = new THREE.Mesh(buttonGeo, this.materials.folderRed);
        button.position.set(1.92, 1.5, 0);
        button.rotation.y = -Math.PI / 2;
        group.add(button);

        this.scene.add(group);

        // Interaction avec le bouton
        this.player.addInteractable(button, () => {
            if (this.state !== 'ELEVATOR') return;
            this.state = 'ELEVATOR_MOVING';
            this.showSubtitle("Montée vers le Niveau Direction...");
            this.updateTaskUI("Patienter", false);
            
            if (this.soundManager) {
                this.soundManager.playElevatorSound();
            }

            // Tremblement de caméra pendant la montée
            this.elevatorShakeInterval = setInterval(() => {
                const shake = 0.02;
                this.player.controls.getObject().position.y = this.player.baseY + (Math.random() - 0.5) * shake;
            }, 50);

            // Après 6 secondes (fin du son), on arrive au niveau corrompu
            setTimeout(() => {
                clearInterval(this.elevatorShakeInterval);
                this.player.controls.getObject().position.y = this.player.baseY; // Reset hauteur
                
                // Retirer les murs de l'ascenseur de la liste des collidables pour pouvoir en sortir
                if (this.player.collidableObjects) {
                    this.player.collidableObjects = this.player.collidableObjects.filter(c => 
                        c !== wallN && c !== wallS && c !== wallE && c !== wallW
                    );
                }
                
                // On ouvre la porte de l'ascenseur (mur Nord)
                wallN.visible = false;

                this.startCorruptedLevel();
            }, 6000);
        });
    }

    updateTaskUI(text, isCompleted = false) {
        const tracker = document.getElementById('task-tracker');
        const taskText = document.getElementById('task-text');
        const taskDiv = document.getElementById('current-task');
        
        if (tracker && taskText && taskDiv) {
            tracker.style.display = 'flex';
            taskText.innerText = text;
            
            if (isCompleted) {
                taskDiv.classList.add('completed');
            } else {
                taskDiv.classList.remove('completed');
            }
        }
    }

    showSubtitle(text) {
        const subEl = document.getElementById('subtitles');
        if (subEl) {
            subEl.innerText = text;
            subEl.style.opacity = 1;
            
            if (this.subtitleTimeout) clearTimeout(this.subtitleTimeout);
            this.subtitleTimeout = setTimeout(() => {
                subEl.style.opacity = 0;
            }, 4000);
        }
    }

    startCorruptedLevel() {
        this.state = 'ANOMALY_HUNT';
        this.anomaliesFound = 0;
        this.totalAnomalies = 3;
        
        this.showSubtitle("Où suis-je... ?");
        this.updateTaskUI("Trouver le terminal", false);
        
        // Ambiance corrompue
        window.dispatchEvent(new CustomEvent('phase-corrupted'));
        this.drawBloodSky();

        // Téléporter le joueur au nouveau niveau
        const corruptedLevelY = 20;
        // On le place juste devant la porte, face au nord (vers l'intérieur de la pièce)
        const playerObj = this.player.controls.getObject();
        this.player.baseY = corruptedLevelY + 1.45; // Mettre à jour la hauteur de base du joueur
        playerObj.position.set(0, this.player.baseY, 18); 
        
        // Regarder vers le centre de la pièce (Nord)
        // Pour cela on doit manipuler la rotation de la caméra
        // Le PointerLockControls utilise le pitchObject (rotation X) et yawObject (rotation Y)
        // L'objet principal est le yawObject.
        playerObj.rotation.set(0, 0, 0); // Face au nord (Z négatif)

        this.buildCorruptedLevel(corruptedLevelY);
        
        if (this.soundManager) {
            this.soundManager.startCorruptedDrone();
        }
    }

    drawBloodSky() {
        const gradient = this.skyContext.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#4a0000'); // Rouge très foncé en haut
        gradient.addColorStop(0.5, '#ff0000'); // Rouge vif au milieu
        gradient.addColorStop(1, '#000000'); // Noir en bas

        this.skyContext.fillStyle = gradient;
        this.skyContext.fillRect(0, 0, 512, 512);

        // Nuages noirs
        this.skyContext.fillStyle = 'rgba(0, 0, 0, 0.6)';
        for (let i = 0; i < 50; i++) {
            this.skyContext.beginPath();
            this.skyContext.arc(Math.random() * 512, Math.random() * 256, Math.random() * 50 + 20, 0, Math.PI * 2);
            this.skyContext.fill();
        }

        this.skyTexture.needsUpdate = true;
        this.materials.sky.color = new THREE.Color(0xffaaaa); // Teinte rougeâtre sur la texture
    }

    buildCorruptedLevel(yOffset) {
        if (this.corruptedGroup) {
            this.scene.remove(this.corruptedGroup);
        }
        const group = new THREE.Group();
        this.corruptedGroup = group;
        group.position.y = yOffset;

        // Sol et Plafond
        const floorGeo = new THREE.PlaneGeometry(40, 40);
        const floor = new THREE.Mesh(floorGeo, this.materials.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        const ceilingGeo = new THREE.PlaneGeometry(40, 40);
        const ceiling = new THREE.Mesh(ceilingGeo, this.materials.ceiling);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 4;
        group.add(ceiling);

        // Murs
        const wallGeo = new THREE.PlaneGeometry(40, 4);
        
        const wallN = new THREE.Mesh(wallGeo, this.materials.wall);
        wallN.position.set(0, 2, -20);
        wallN.receiveShadow = true;
        group.add(wallN);
        this.player.addCollidable(wallN);

        const wallS = new THREE.Mesh(wallGeo, this.materials.wall);
        wallS.position.set(0, 2, 20);
        wallS.rotation.y = Math.PI;
        wallS.receiveShadow = true;
        group.add(wallS);
        this.player.addCollidable(wallS);

        // Fenêtres (sanglantes)
        this.buildWallWithWindow(new THREE.Vector3(20, yOffset, 0), -Math.PI / 2); // Est
        this.buildWallWithWindow(new THREE.Vector3(-20, yOffset, 0), Math.PI / 2); // Ouest

        // Néons au plafond
        const neonGeo = new THREE.BoxGeometry(0.2, 0.1, 4);
        for (let x = -15; x <= 15; x += 5) {
            for (let z = -15; z <= 15; z += 5) {
                const neonMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Néons rouges
                const neon = new THREE.Mesh(neonGeo, neonMat);
                neon.position.set(x, 3.95, z);
                group.add(neon);
                this.neons.push(neon); // Ajouter à la liste pour le flickering
            }
        }

        // Terminal corrompu
        const deskGeo = new THREE.BoxGeometry(2, 0.8, 1);
        const desk = new THREE.Mesh(deskGeo, this.materials.desk);
        desk.position.set(0, 0.4, -15);
        desk.castShadow = true;
        desk.receiveShadow = true;
        group.add(desk);
        this.player.addCollidable(desk);

        const screenGeo = new THREE.BoxGeometry(0.8, 0.5, 0.1);
        const screenMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(0, 1.05, -15.2);
        screen.rotation.x = -0.1;
        group.add(screen);

        // On crée un groupe pour le terminal pour que l'interaction soit plus facile
        const terminalGroup = new THREE.Group();
        terminalGroup.add(desk);
        terminalGroup.add(screen);
        group.add(terminalGroup);
        this.breathingObjects.push(terminalGroup);

        const interactWithCorruptedTerminal = () => {
            if (this.state === 'ANOMALY_HUNT' && this.anomaliesFound === 0) {
                this.showSubtitle("Environnement instable. Identifiez et purgez 3 anomalies.");
                this.updateTaskUI(`Anomalies purgées : 0/3`, false);
                
                if (this.soundManager) {
                    this.soundManager.playGlitchSound();
                }
            }
        };

        this.player.addInteractable(screen, interactWithCorruptedTerminal);
        this.player.addInteractable(desk, interactWithCorruptedTerminal);

        // Génération des anomalies
        this.buildAnomalies(group);

        // Ajouter quelques bureaux vides pour meubler
        for(let i=0; i<4; i++) {
            const emptyDesk = new THREE.Mesh(deskGeo, this.materials.desk);
            emptyDesk.position.set((Math.random() - 0.5) * 20, 0.4, (Math.random() - 0.5) * 20);
            emptyDesk.rotation.y = Math.random() * Math.PI;
            group.add(emptyDesk);
            this.player.addCollidable(emptyDesk);
            this.breathingObjects.push(emptyDesk);
        }

        this.scene.add(group);
    }

    buildAnomalies(parentGroup) {
        // Anomalie 1 : Chaise au plafond
        const chairGroup = new THREE.Group();
        const seatGeo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const seat = new THREE.Mesh(seatGeo, this.materials.chair);
        seat.position.y = 0.5;
        chairGroup.add(seat);
        const backGeo = new THREE.BoxGeometry(0.5, 0.6, 0.1);
        const back = new THREE.Mesh(backGeo, this.materials.chair);
        back.position.set(0, 0.8, -0.2);
        chairGroup.add(back);
        
        chairGroup.position.set(5, 3.5, -5); // Au plafond
        chairGroup.rotation.x = Math.PI; // À l'envers
        parentGroup.add(chairGroup);
        this.setupAnomalyInteraction(chairGroup);

        // Anomalie 2 : Plante géante et rouge
        const plantGroup = new THREE.Group();
        const potGeo = new THREE.CylinderGeometry(0.3, 0.2, 0.6, 16);
        const pot = new THREE.Mesh(potGeo, this.materials.plantPot);
        pot.position.y = 0.3;
        plantGroup.add(pot);
        
        const leafGeo = new THREE.SphereGeometry(1.5, 8, 8); // Très grande
        const leafMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8 }); // Rouge
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.y = 1.5;
        plantGroup.add(leaf);
        
        plantGroup.position.set(-10, 0, 10);
        parentGroup.add(plantGroup);
        this.setupAnomalyInteraction(plantGroup);

        // Anomalie 3 : Distributeur d'eau flottant
        const coolerGroup = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
        const base = new THREE.Mesh(baseGeo, this.materials.printerGrey);
        base.position.y = 0.5;
        coolerGroup.add(base);
        
        const bottleGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 16);
        const bottleMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xff0000, // Eau rouge
            transmission: 0.9,
            opacity: 1,
            transparent: true,
            roughness: 0.1
        });
        const bottle = new THREE.Mesh(bottleGeo, bottleMat);
        bottle.position.y = 1.2;
        coolerGroup.add(bottle);
        
        coolerGroup.position.set(12, 1.5, 5); // Flotte en l'air
        coolerGroup.rotation.z = Math.PI / 4; // Penché
        parentGroup.add(coolerGroup);
        this.setupAnomalyInteraction(coolerGroup);
        
        // On rend les anomalies un peu plus visibles en leur ajoutant une légère lumière rouge
        [chairGroup, plantGroup, coolerGroup].forEach(anomaly => {
            const light = new THREE.PointLight(0xff0000, 0.5, 3);
            light.position.y = 1;
            anomaly.add(light);
        });
    }

    setupAnomalyInteraction(objectGroup) {
        // On rend tous les enfants interactables
        objectGroup.children.forEach(child => {
            this.player.addInteractable(child, () => {
                if (this.state !== 'ANOMALY_HUNT') return;
                
                // Purge de l'anomalie
                objectGroup.visible = false;
                this.anomaliesFound++;
                
                if (this.soundManager) {
                    this.soundManager.playAnomalyPurgeSound();
                    this.soundManager.increaseDroneIntensity();
                }

                this.showSubtitle(`Anomalie purgée.`);
                this.updateTaskUI(`Anomalies purgées : ${this.anomaliesFound}/${this.totalAnomalies}`, false);

                if (this.anomaliesFound >= this.totalAnomalies) {
                    this.startAwakeTransition();
                }
            });
        });
    }

    startAwakeTransition() {
        // Flash blanc
        const screamerDiv = document.getElementById('screamer');
        const screamerFace = document.getElementById('screamer-face');
        if (screamerDiv && screamerFace) {
            screamerFace.style.background = '#ffffff'; // Blanc pur
            screamerFace.style.animation = 'none'; // Pas de glitch
            screamerFace.style.filter = 'none';
            screamerFace.style.mixBlendMode = 'normal';
            screamerDiv.style.display = 'block';
            
            if (this.soundManager) {
                this.soundManager.stopDrone();
                this.soundManager.playAnomalyPurgeSound(); // Bruit électrique
            }

            setTimeout(() => {
                screamerDiv.style.display = 'none';
                // Remettre le style du screamer pour plus tard
                screamerFace.style.background = '';
                screamerFace.style.animation = 'glitch-anim 0.1s infinite';
                screamerFace.style.filter = 'contrast(500%) invert(100%)';
                screamerFace.style.mixBlendMode = 'difference';
                
                this.startAwakePhase();
            }, 500);
        } else {
            this.startAwakePhase();
        }
    }

    startAwakePhase() {
        this.state = 'AWAKE';
        this.awakePhase = 1; // Phases 1 to 4
        
        // Nettoyer le niveau corrompu
        if (this.corruptedGroup) {
            this.scene.remove(this.corruptedGroup);
            this.corruptedGroup = null;
        }

        // Téléporter au bureau initial
        this.player.baseY = 1.45;
        this.player.controls.getObject().position.set(0, this.player.baseY, 0);
        this.player.controls.getObject().rotation.set(0, 0, 0);

        // Retour à la normale
        window.dispatchEvent(new CustomEvent('phase-elevator')); // Réutilise les lumières normales
        this.drawDaySky();
        
        if (this.soundManager && this.soundManager.initialized) {
            this.soundManager.startDrone();
            this.soundManager.droneOscillator.frequency.value = 50;
            this.soundManager.droneGain.gain.value = 0.1;
        }

        this.showSubtitle("Je me suis assoupi... ?");
        this.updateTaskUI("Répondre au téléphone", false);
        
        this.setupAwakeTasks();
    }

    setupAwakeTasks() {
        // Phase 1 : Téléphone
        const phoneGeo = new THREE.BoxGeometry(0.3, 0.1, 0.2);
        const phoneMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.phone = new THREE.Mesh(phoneGeo, phoneMat);
        this.phone.position.set(4, 0.8, -2); // Sur un bureau proche
        this.scene.add(this.phone);
        
        this.phoneRingInterval = setInterval(() => {
            if (this.state === 'AWAKE' && this.awakePhase === 1 && this.soundManager) {
                this.soundManager.playPhoneRing();
            }
        }, 2000);

        this.player.addInteractable(this.phone, () => {
            if (this.state !== 'AWAKE' || this.awakePhase !== 1) return;
            
            clearInterval(this.phoneRingInterval);
            this.awakePhase = 2;
            
            if (this.soundManager) {
                this.soundManager.playVoiceWhisper();
            }
            
            this.showSubtitle("Voix : 'Ne regardez pas par la fenêtre... La boucle se brise... Sujet 402...'");
            
            setTimeout(() => {
                this.updateTaskUI("Vérifier le distributeur d'eau", false);
                this.setupWaterCoolerTask();
            }, 4000);
        });
    }

    setupWaterCoolerTask() {
        const waterCooler = this.scene.children.find(c => 
            c.type === 'Group' && c.children.some(mesh => mesh.geometry.type === 'CylinderGeometry' && mesh.position.y === 1.2)
        );
        
        if (waterCooler) {
            const bottle = waterCooler.children.find(mesh => mesh.geometry.type === 'CylinderGeometry');
            if (bottle) {
                this.player.addInteractable(bottle, () => {
                    if (this.state !== 'AWAKE' || this.awakePhase !== 2) return;
                    
                    this.awakePhase = 3;
                    
                    // L'eau devient rouge sang
                    bottle.material = new THREE.MeshPhysicalMaterial({ 
                        color: 0x880000, transmission: 0.9, opacity: 1, metalness: 0.1, roughness: 0.1, ior: 1.5, thickness: 0.5 
                    });
                    
                    this.showSubtitle("L'eau... c'est du sang ?!");
                    
                    if (this.soundManager) {
                        this.soundManager.playGlitchSound();
                    }
                    
                    // Créer le plan de sang à la position du distributeur
                    const bloodGeo = new THREE.PlaneGeometry(1, 1);
                    const bloodMat = new THREE.MeshStandardMaterial({ 
                        color: 0x660000, 
                        roughness: 0.1, 
                        metalness: 0.3,
                        transparent: true,
                        opacity: 0.9
                    });
                    this.bloodPlane = new THREE.Mesh(bloodGeo, bloodMat);
                    this.bloodPlane.rotation.x = -Math.PI / 2;
                    
                    // Obtenir la position mondiale du distributeur
                    const coolerPos = new THREE.Vector3();
                    waterCooler.getWorldPosition(coolerPos);
                    
                    this.bloodPlane.position.set(coolerPos.x, 0.02, coolerPos.z);
                    this.scene.add(this.bloodPlane);

                    setTimeout(() => {
                        this.startBloodSpread();
                    }, 2000);
                });
            }
        }
    }

    startBloodSpread() {
        this.updateTaskUI("Écouter", false);
        
        setTimeout(() => {
            this.spawnCharacters();
        }, 3000);
    }

    spawnCharacters() {
        this.characters = [];
        const numCharacters = 20;
        const radius = 8;
        const playerPos = this.player.controls.getObject().position;

        const charMat = new THREE.MeshStandardMaterial({ 
            color: 0x111111, 
            roughness: 0.9, 
            metalness: 0.1 
        });

        for (let i = 0; i < numCharacters; i++) {
            const angle = (i / numCharacters) * Math.PI * 2;
            const x = playerPos.x + Math.cos(angle) * radius;
            const z = playerPos.z + Math.sin(angle) * radius;

            const charGroup = new THREE.Group();
            charGroup.position.set(x, 0, z);

            // Corps (Cylindre)
            const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 16);
            const body = new THREE.Mesh(bodyGeo, charMat);
            body.position.y = 0.8;
            body.castShadow = true;
            charGroup.add(body);

            // Tête (Sphère)
            const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
            const head = new THREE.Mesh(headGeo, charMat);
            head.position.y = 1.8;
            head.castShadow = true;
            charGroup.add(head);

            // Regarder le joueur
            charGroup.lookAt(playerPos.x, 0, playerPos.z);

            this.scene.add(charGroup);
            this.characters.push(charGroup);
        }

        // Séquence de dialogues
        const dialogues = [
            "Nous sommes les itérations précédentes...",
            "La boucle doit être brisée...",
            "Le sang est la mémoire du système...",
            "Sujet 402, tu es le dernier...",
            "FUIS !"
        ];

        let delay = 0;
        dialogues.forEach((text, index) => {
            setTimeout(() => {
                this.showSubtitle(text);
                if (this.soundManager) {
                    this.soundManager.playVoiceWhisper();
                }
                
                // Tremblement des personnages quand ils parlent
                this.characters.forEach(char => {
                    char.position.x += (Math.random() - 0.5) * 0.2;
                    char.position.z += (Math.random() - 0.5) * 0.2;
                });

                if (index === dialogues.length - 1) {
                    setTimeout(() => {
                        this.startStreetEscape();
                    }, 2000);
                }
            }, delay);
            delay += 3000;
        });
    }

    startStreetEscape() {
        this.awakePhase = 4;
        this.updateTaskUI("FUIR", false);
        
        // Ouvrir la porte
        const door = this.scene.children.find(c => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.z === -19.9);
        if (door) {
            door.visible = false;
            if (this.player.collidableObjects) {
                this.player.collidableObjects = this.player.collidableObjects.filter(c => c !== door);
            }
        }
        
        this.buildStreet();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.state === 'AWAKE' && this.soundManager) {
                this.soundManager.playHeartbeat();
            }
        }, 1000);
    }

    buildStreet() {
        this.streetGroup = new THREE.Group();
        
        // Route (PlaneGeometry avec beaucoup de segments pour la déformation)
        const roadWidth = 10;
        const roadLength = 200;
        const segments = 100;
        const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 1, segments);
        
        // Matériau asphalte
        const roadMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            roughness: 0.9,
            metalness: 0.1,
            wireframe: false
        });
        
        this.streetRoad = new THREE.Mesh(roadGeo, roadMat);
        this.streetRoad.rotation.x = -Math.PI / 2;
        this.streetRoad.position.set(0, 0.05, -20 - roadLength / 2);
        this.streetRoad.receiveShadow = true;
        
        // Sauvegarder les positions originales des vertices pour la déformation
        this.streetRoad.userData.originalVertices = [];
        const posAttribute = this.streetRoad.geometry.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            this.streetRoad.userData.originalVertices.push(
                new THREE.Vector3(posAttribute.getX(i), posAttribute.getY(i), posAttribute.getZ(i))
            );
        }
        
        this.streetGroup.add(this.streetRoad);

        // Lignes blanches au milieu
        const lineGeo = new THREE.PlaneGeometry(0.2, roadLength);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.06, -20 - roadLength / 2);
        this.streetGroup.add(line);

        // Trottoirs
        const sidewalkWidth = 4;
        const sidewalkGeo = new THREE.BoxGeometry(sidewalkWidth, 0.2, roadLength);
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
        
        const sidewalkL = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        sidewalkL.position.set(-roadWidth/2 - sidewalkWidth/2, 0.1, -20 - roadLength / 2);
        this.streetGroup.add(sidewalkL);
        this.player.addCollidable(sidewalkL);

        const sidewalkR = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        sidewalkR.position.set(roadWidth/2 + sidewalkWidth/2, 0.1, -20 - roadLength / 2);
        this.streetGroup.add(sidewalkR);
        this.player.addCollidable(sidewalkR);

        // Bâtiments procéduraux
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffaa }); // Fenêtres allumées (jaune pâle)

        for (let z = -30; z > -20 - roadLength; z -= 15) {
            // Bâtiment gauche
            this.buildProceduralBuilding(-roadWidth/2 - sidewalkWidth - 5, z, buildingMat, windowMat);
            // Bâtiment droit
            this.buildProceduralBuilding(roadWidth/2 + sidewalkWidth + 5, z, buildingMat, windowMat);
            
            // Lampadaires
            if (z % 30 === 0) {
                this.buildStreetLamp(-roadWidth/2 - 0.5, z);
                this.buildStreetLamp(roadWidth/2 + 0.5, z);
            }
        }

        // Porte de fin (Screamer) au bout de la rue
        const endDoorGeo = new THREE.BoxGeometry(4, 4, 0.5);
        const endDoor = new THREE.Mesh(endDoorGeo, this.materials.windowFrame);
        endDoor.position.set(0, 2, -20 - roadLength + 1);
        this.streetGroup.add(endDoor);
        
        this.player.addInteractable(endDoor, () => {
            if (this.state !== 'AWAKE' || this.awakePhase !== 4) return;
            clearInterval(this.heartbeatInterval);
            this.triggerScreamer();
        });

        this.scene.add(this.streetGroup);
    }

    buildProceduralBuilding(x, z, buildingMat, windowMat) {
        const width = 8 + Math.random() * 6;
        const height = 20 + Math.random() * 30;
        const depth = 10 + Math.random() * 5;
        
        const buildingGeo = new THREE.BoxGeometry(width, height, depth);
        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.position.set(x, height/2, z);
        this.streetGroup.add(building);
        this.player.addCollidable(building);

        // Fenêtres aléatoires
        const windowGeo = new THREE.PlaneGeometry(1, 1);
        const startY = 3;
        const endY = height - 2;
        
        // Déterminer la face (vers la route)
        const isLeft = x < 0;
        const windowX = isLeft ? x + width/2 + 0.01 : x - width/2 - 0.01;
        const windowRotY = isLeft ? Math.PI / 2 : -Math.PI / 2;

        for (let wy = startY; wy < endY; wy += 3) {
            for (let wz = z - depth/2 + 2; wz < z + depth/2 - 2; wz += 3) {
                if (Math.random() > 0.7) { // 30% de chance d'avoir une fenêtre allumée
                    const win = new THREE.Mesh(windowGeo, windowMat);
                    win.position.set(windowX, wy, wz);
                    win.rotation.y = windowRotY;
                    this.streetGroup.add(win);
                }
            }
        }
    }

    buildStreetLamp(x, z) {
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 5);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 2.5, z);
        this.streetGroup.add(pole);

        const lightGeo = new THREE.BoxGeometry(0.5, 0.2, 0.5);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffddaa });
        const lightMesh = new THREE.Mesh(lightGeo, lightMat);
        lightMesh.position.set(x + (x < 0 ? 0.5 : -0.5), 5, z);
        this.streetGroup.add(lightMesh);

        const pointLight = new THREE.PointLight(0xffddaa, 1, 20);
        pointLight.position.copy(lightMesh.position);
        pointLight.position.y -= 0.2;
        this.streetGroup.add(pointLight);
    }

    drawVoidSky() {
        this.skyContext.fillStyle = '#000000';
        this.skyContext.fillRect(0, 0, 512, 512);
        
        // Fractales étranges
        this.skyContext.strokeStyle = '#ff0000';
        this.skyContext.lineWidth = 2;
        for (let i = 0; i < 20; i++) {
            this.skyContext.beginPath();
            this.skyContext.rect(Math.random() * 512, Math.random() * 512, Math.random() * 100, Math.random() * 100);
            this.skyContext.stroke();
        }
        
        this.skyTexture.needsUpdate = true;
    }

    triggerScreamer() {
        this.state = 'END';
        
        if (this.soundManager) {
            this.soundManager.stopDrone();
            this.soundManager.playScreamerSound();
        }

        // Afficher le screamer UI
        const screamerDiv = document.getElementById('screamer');
        if (screamerDiv) {
            screamerDiv.style.display = 'block';
        }

        // Après 1 seconde, écran de fin
        setTimeout(() => {
            if (screamerDiv) screamerDiv.style.display = 'none';
            const endScreen = document.getElementById('end-screen');
            if (endScreen) {
                endScreen.style.display = 'flex';
            }
            
            // Bloquer les contrôles
            this.player.controls.unlock();
            
            // Cacher le reste de l'UI
            const uiDiv = document.getElementById('ui');
            if (uiDiv) uiDiv.style.display = 'none';
            
            // Arrêter la boucle de rendu si possible, ou au moins cacher le canvas
            const canvas = document.querySelector('canvas');
            if (canvas) canvas.style.display = 'none';
        }, 1100);
    }

    update(delta) {
        // Animation des particules de poussière
        if (this.dustParticles) {
            this.dustParticles.rotation.y += delta * 0.05;
            this.dustParticles.rotation.x += delta * 0.02;
        }

        if (this.state === 'INIT') return;

        // Respiration des objets dans le niveau corrompu
        if (this.state === 'ANOMALY_HUNT' && this.breathingObjects) {
            const time = Date.now() * 0.002;
            const scale = 1 + Math.sin(time) * 0.02; // Variation de +/- 2%
            this.breathingObjects.forEach(obj => {
                obj.scale.set(scale, scale, scale);
            });
            
            // Effet Dolly Zoom (FOV)
            const fovScale = 75 + Math.sin(time * 0.5) * 5;
            this.player.camera.fov = fovScale;
            this.player.camera.updateProjectionMatrix();
        } else if (this.player.camera.fov !== 75) {
            this.player.camera.fov = 75;
            this.player.camera.updateProjectionMatrix();
        }

        // Flickering des néons (plus agressif dans le niveau corrompu)
        const flickerChance = this.state === 'ANOMALY_HUNT' ? 0.2 : 0.05;
        if (Math.random() < flickerChance) {
            const randomNeon = this.neons[Math.floor(Math.random() * this.neons.length)];
            randomNeon.visible = Math.random() > 0.5; // Clignotement
        } else {
            // S'assurer que tous les néons se rallument vite
            this.neons.forEach(neon => {
                if (!neon.visible && Math.random() < 0.2) {
                    neon.visible = true;
                }
            });
        }

        // Logique du couloir infini (supprimée pour l'extension)
        // if (this.state === 'HALLWAY') {
        //     const playerZ = this.player.controls.getObject().position.z;
        //     
        //     // Si le joueur avance, on génère de nouveaux segments devant lui
        //     // et on supprime ceux qui sont loin derrière
        //     if (playerZ < this.hallwayZ + 40) {
        //         this.hallwayZ -= 20;
        //         this.addHallwaySegment(this.hallwayZ - 80); // Ajouter loin devant
        //         
        //         // Nettoyer les vieux segments derrière
        //         if (this.hallwaySegments.length > 8) {
        //             const oldSegment = this.hallwaySegments.shift();
        //             this.scene.remove(oldSegment);
        //         }
        //     }
        //     return; // On ne fait pas la paranoïa des chaises dans le couloir
        // }

        if (this.state !== 'SEARCHING' && this.state !== 'ANOMALY_HUNT' && this.state !== 'AWAKE') return;

        // Frustum culling pour savoir ce qui est regardé
        const frustum = new THREE.Frustum();
        const cameraViewProjectionMatrix = new THREE.Matrix4();
        
        this.player.camera.updateMatrixWorld();
        this.player.camera.matrixWorldInverse.copy(this.player.camera.matrixWorld).invert();
        
        cameraViewProjectionMatrix.multiplyMatrices(this.player.camera.projectionMatrix, this.player.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

        // Paranoïa : déplacer les chaises qui ne sont pas regardées
        this.chairs.forEach(chair => {
            // Créer une bounding box pour la chaise
            const box = new THREE.Box3().setFromObject(chair);
            
            // Si la chaise n'est PAS dans le champ de vision
            if (!frustum.intersectsBox(box)) {
                // Faible chance de se déplacer (plus élevée dans l'état AWAKE)
                const moveChance = this.state === 'AWAKE' ? 0.05 : 0.01;
                if (Math.random() < moveChance) {
                    // Rotation aléatoire
                    chair.rotation.y += (Math.random() - 0.5) * Math.PI / 2;
                    
                    // Petit déplacement aléatoire
                    chair.position.x += (Math.random() - 0.5) * 0.5;
                    chair.position.z += (Math.random() - 0.5) * 0.5;
                    
                    // S'assurer qu'elle reste à peu près dans la zone
                    chair.position.x = Math.max(-18, Math.min(18, chair.position.x));
                    chair.position.z = Math.max(-18, Math.min(18, chair.position.z));
                }
            }
        });

        // Effets paranormaux dans l'état AWAKE
        if (this.state === 'AWAKE') {
            const time = Date.now() * 0.002;
            
            // Phase 2 et plus : effets plus intenses
            if (this.awakePhase >= 2) {
                // Les particules deviennent rouges et s'affolent
                if (this.dustParticles) {
                    this.dustParticles.material.color.setHex(0xff0000);
                    this.dustParticles.rotation.y += delta * 0.5; // Très rapide
                }

                // Respiration aléatoire sur des objets normaux (ex: les chaises)
                this.chairs.forEach((chair, index) => {
                    if (index % 3 === 0) { // 1 chaise sur 3
                        const scale = 1 + Math.sin(time + index) * 0.05;
                        chair.scale.set(scale, scale, scale);
                    }
                });

                // Bruits de glitch aléatoires
                if (Math.random() < 0.005 && this.soundManager) {
                    this.soundManager.playGlitchSound();
                }
            }

            // Phase 3 : Le sang se répand
            if (this.awakePhase === 3 && this.bloodPlane) {
                // Agrandir le plan de sang
                this.bloodPlane.scale.x += delta * 5;
                this.bloodPlane.scale.y += delta * 5; // C'est un PlaneGeometry, donc scale.y correspond à la profondeur en 3D (après rotation)
            }

            // Phase 4 : Rue déformée
            if (this.awakePhase >= 4 && this.streetRoad) {
                const playerZ = this.player.controls.getObject().position.z;
                
                // Déformation de la route
                const positions = this.streetRoad.geometry.attributes.position;
                const originals = this.streetRoad.userData.originalVertices;
                
                for (let i = 0; i < positions.count; i++) {
                    const orig = originals[i];
                    // On déforme en Z (qui est Y dans la géométrie du plan) et en hauteur (Z dans la géométrie)
                    // La géométrie a été tournée de -PI/2 sur X
                    // orig.x = X (gauche/droite)
                    // orig.y = Z (avant/arrière)
                    // orig.z = Y (haut/bas)
                    
                    // La déformation dépend du temps et de la profondeur (orig.y)
                    const wave = Math.sin(time * 2 + orig.y * 0.2) * 0.5;
                    const twist = Math.cos(time + orig.y * 0.1) * 0.5;
                    
                    // On applique la déformation
                    positions.setZ(i, orig.z + wave + (orig.x * twist * 0.1));
                }
                positions.needsUpdate = true;

                // Effet de vertige (Dolly Zoom inversé) quand on avance dans la rue
                if (playerZ < -20) {
                    const fovScale = 75 + Math.abs(playerZ + 20) * 0.5;
                    this.player.camera.fov = Math.min(120, fovScale);
                    this.player.camera.updateProjectionMatrix();
                }
            }
        }
    }
}