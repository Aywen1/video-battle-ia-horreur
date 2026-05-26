/**
 * SmileDetector : wrapper MediaPipe Face Landmarker.
 * - Charge le modèle via CDN (seule dépendance externe acceptée — voir .cursorrules)
 * - Lit la webcam à 15 fps de détection
 * - Expose un score "smile" 0..1 normalisé par la calibration
 */
import {
  FaceLandmarker,
  FilesetResolver,
  FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const TARGET_FPS = 15;
const MIN_FRAME_MS = 1000 / TARGET_FPS;

export interface CalibrationData {
  neutralSmile: number;
  maxSmile: number;
}

/**
 * Points cles de la bouche (coords normalisees 0..1 dans le flux video,
 * ATTENTION : x=0 = gauche dans la video brute. Pour un affichage miroir
 * (selfie style), il faut inverser : x' = 1 - x).
 *
 * leftCorner / rightCorner : commissures gauche/droite (sens "miroir" — donc
 * en realite leftCorner correspond a la droite de l'image brute).
 * topLip / bottomLip : centre des levres haute et basse.
 * center : moyen entre topLip et bottomLip (vec2).
 */
export interface MouthLandmarks {
  leftCorner: { x: number; y: number };
  rightCorner: { x: number; y: number };
  topLip: { x: number; y: number };
  bottomLip: { x: number; y: number };
  center: { x: number; y: number };
  /** Demi-largeur (commissures), normalisee. */
  halfWidth: number;
  /** Demi-hauteur (vertical lip gap), normalisee. */
  halfHeight: number;
  /** Yaw approximatif de la bouche (rotation de la ligne des commissures), rad. */
  angle: number;
}

// Indices MediaPipe Face Mesh (478 points) — bouche
const MOUTH_INDICES = {
  // Commissures externes
  CORNER_LEFT: 61,    // a gauche de l'image brute
  CORNER_RIGHT: 291,  // a droite de l'image brute
  // Centre haut et bas
  UPPER_LIP_TOP: 13,
  LOWER_LIP_BOTTOM: 14,
};

export class SmileDetector {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private lastTime = 0;
  private rawSmile = 0; // 0..1 brut (moyenne mouthSmileLeft/Right)
  private normalizedSmile = 0; // 0..1 après calibration
  private faceDetected = false;
  private calibration: CalibrationData = { neutralSmile: 0.05, maxSmile: 0.6 };
  private running = false;
  private rafId: number | null = null;
  /** Landmarks bouche du dernier frame detecte (null si pas de visage). */
  private mouthLandmarks: MouthLandmarks | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async initialize(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  }

  async requestWebcam(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /** Lance le RAF, mais ne fait l'inférence MediaPipe qu'à 15 fps. */
  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    if (now - this.lastTime >= MIN_FRAME_MS && this.landmarker && this.video.readyState >= 2) {
      this.lastTime = now;
      try {
        const result: FaceLandmarkerResult = this.landmarker.detectForVideo(this.video, now);
        this.processResult(result);
      } catch (e) {
        // Ne pas tuer la boucle sur une erreur ponctuelle (drop de frame possible).
        console.warn('[SmileDetector] detect error', e);
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private processResult(r: FaceLandmarkerResult): void {
    if (!r.faceBlendshapes || r.faceBlendshapes.length === 0) {
      this.faceDetected = false;
      this.mouthLandmarks = null;
      return;
    }
    this.faceDetected = true;
    const cats = r.faceBlendshapes[0].categories;
    let left = 0;
    let right = 0;
    for (const c of cats) {
      if (c.categoryName === 'mouthSmileLeft') left = c.score;
      else if (c.categoryName === 'mouthSmileRight') right = c.score;
    }
    this.rawSmile = (left + right) / 2;
    // Normalisation par la calibration
    const range = Math.max(0.05, this.calibration.maxSmile - this.calibration.neutralSmile);
    this.normalizedSmile = Math.max(0, Math.min(1, (this.rawSmile - this.calibration.neutralSmile) / range));

    // Extraction des landmarks de la bouche.
    // ATTENTION : on inverse X pour matcher un affichage miroir (selfie).
    if (r.faceLandmarks && r.faceLandmarks.length > 0) {
      const lm = r.faceLandmarks[0];
      const rawCornerL = lm[MOUTH_INDICES.CORNER_LEFT];
      const rawCornerR = lm[MOUTH_INDICES.CORNER_RIGHT];
      const rawTop = lm[MOUTH_INDICES.UPPER_LIP_TOP];
      const rawBot = lm[MOUTH_INDICES.LOWER_LIP_BOTTOM];
      if (rawCornerL && rawCornerR && rawTop && rawBot) {
        // Inverse X pour le mirror : la commissure "gauche" de l'image miroir
        // correspond a la commissure droite de l'image brute (et inversement).
        const leftCorner = { x: 1 - rawCornerR.x, y: rawCornerR.y };
        const rightCorner = { x: 1 - rawCornerL.x, y: rawCornerL.y };
        const topLip = { x: 1 - rawTop.x, y: rawTop.y };
        const bottomLip = { x: 1 - rawBot.x, y: rawBot.y };
        const cx = (leftCorner.x + rightCorner.x) * 0.5;
        const cy = (topLip.y + bottomLip.y) * 0.5;
        const dx = rightCorner.x - leftCorner.x;
        const dy = rightCorner.y - leftCorner.y;
        const halfWidth = Math.hypot(dx, dy) * 0.5;
        const halfHeight = Math.max(0.01, (bottomLip.y - topLip.y) * 0.5);
        const angle = Math.atan2(dy, dx);
        this.mouthLandmarks = {
          leftCorner,
          rightCorner,
          topLip,
          bottomLip,
          center: { x: cx, y: cy },
          halfWidth,
          halfHeight,
          angle,
        };
      } else {
        this.mouthLandmarks = null;
      }
    } else {
      this.mouthLandmarks = null;
    }
  }

  /** Renvoie les landmarks de la bouche du dernier frame, ou null si pas de visage. */
  getMouthLandmarks(): MouthLandmarks | null {
    return this.mouthLandmarks;
  }

  /** Renvoie la valeur instantanée du sourire brut (utile pendant la calibration). */
  getRawSmile(): number {
    return this.rawSmile;
  }

  /** Renvoie le sourire normalisé 0..1 par la calibration courante. */
  getSmile(): number {
    return this.faceDetected ? this.normalizedSmile : 0;
  }

  isFaceDetected(): boolean {
    return this.faceDetected;
  }

  setCalibration(c: CalibrationData): void {
    this.calibration = c;
  }

  getCalibration(): CalibrationData {
    return { ...this.calibration };
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  dispose(): void {
    this.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.landmarker?.close();
    this.landmarker = null;
  }
}
