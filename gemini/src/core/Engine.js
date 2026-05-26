import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';

export class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        // Brouillard pastel dense
        this.scene.background = new THREE.Color(0xf0f4f8);
        this.scene.fog = new THREE.FogExp2(0xf0f4f8, 0.04);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.y = 1.45; // Hauteur des yeux rabaissée pour correspondre au Player
        this.scene.add(this.camera); // Add camera to scene

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.9; // Réduit pour moins éblouir
        
        document.body.appendChild(this.renderer.domElement);

        this.initPostProcessing();
        this.initLights();

        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        this.clock = new THREE.Clock();
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Bloom pour les néons (réduit pour éviter d'aveugler)
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3,  // strength (réduit de 0.8 à 0.3)
            0.4,  // radius
            0.9   // threshold (augmenté de 0.85 à 0.9 pour cibler uniquement les néons)
        );
        this.composer.addPass(bloomPass);

        // Grain de pellicule (intensité très réduite)
        const filmPass = new FilmPass(
            0.03, // noise intensity
            false // grayscale
        );
        filmPass.renderToScreen = true; // Ensure the last pass renders to screen
        this.composer.addPass(filmPass);
    }

    initLights() {
        // Éclairage global très fort (dissonance cognitive)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0e0e0, 0.6);
        this.scene.add(this.hemiLight);

        // Écouter les changements de phase pour assombrir l'ambiance
        window.addEventListener('phase-searching', () => {
            this.ambientLight.intensity = 0.2;
            this.hemiLight.intensity = 0.1;
            this.scene.fog.density = 0.08; // Brouillard plus épais
        });

        window.addEventListener('phase-escape', () => {
            this.ambientLight.intensity = 0.05;
            this.hemiLight.intensity = 0.05;
            this.scene.fog.color.setHex(0xaa0000); // Le brouillard devient rouge
            this.scene.background.setHex(0xaa0000);
        });

        window.addEventListener('phase-elevator', () => {
            this.ambientLight.intensity = 0.8;
            this.hemiLight.intensity = 0.6;
            this.scene.fog.color.setHex(0xf0f4f8); // Brouillard blanc
            this.scene.background.setHex(0xf0f4f8);
            this.scene.fog.density = 0.04;
        });

        window.addEventListener('phase-corrupted', () => {
            this.ambientLight.intensity = 0.2;
            this.ambientLight.color.setHex(0xff0000); // Lumière ambiante rouge
            this.hemiLight.intensity = 0.2;
            this.scene.fog.color.setHex(0x330000); // Brouillard rouge sang
            this.scene.background.setHex(0x330000);
            this.scene.fog.density = 0.1; // Très dense
        });

        window.addEventListener('phase-sick', () => {
            this.ambientLight.intensity = 0.4;
            this.ambientLight.color.setHex(0x88aa00); // Jaune/vert maladif
            this.hemiLight.intensity = 0.2;
            this.scene.fog.color.setHex(0x223300);
            this.scene.background.setHex(0x223300);
            this.scene.fog.density = 0.06;
        });

        window.addEventListener('phase-void', () => {
            this.ambientLight.intensity = 0.1;
            this.ambientLight.color.setHex(0xffffff);
            this.hemiLight.intensity = 0.05;
            this.scene.fog.color.setHex(0x000000); // Noir absolu
            this.scene.background.setHex(0x000000);
            this.scene.fog.density = 0.08;
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const delta = this.clock.getDelta();
        this.composer.render(delta);
        return delta;
    }
}