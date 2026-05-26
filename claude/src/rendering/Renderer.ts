/**
 * Renderer : encapsule WebGLRenderer + scène + caméra + post-processing.
 * Aucune logique gameplay ici — il rend ce qu'on lui présente.
 */
import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { PostFX } from './PostFX';
import { PALETTE } from '../utils/palette';

export class Renderer {
  webgl: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  postFX: PostFX;
  canvas: HTMLCanvasElement;

  constructor(container: HTMLElement) {
    this.webgl = new WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.webgl.setSize(window.innerWidth, window.innerHeight);
    this.webgl.outputColorSpace = SRGBColorSpace;
    this.webgl.toneMapping = ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.0;
    this.canvas = this.webgl.domElement;
    container.appendChild(this.canvas);

    this.scene = new Scene();
    this.scene.background = new Color(PALETTE.charcoal);
    // Brouillard volumétrique léger teinté magenta très sombre (sera modulé par la salle)
    this.scene.fog = new Fog(new Color('#241222'), 4, 28);

    this.camera = new PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 80);
    this.camera.position.set(0, 1.65, 0);

    this.postFX = new PostFX(this.webgl, this.scene, this.camera);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.webgl.setSize(w, h);
    this.postFX.setSize(w, h);
  };

  render(dt: number): void {
    this.postFX.render(dt);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.postFX.dispose();
    this.webgl.dispose();
    this.canvas.remove();
  }
}
