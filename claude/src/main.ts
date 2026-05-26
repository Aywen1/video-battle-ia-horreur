/**
 * Point d'entrée. Affiche le splash webcam, demande la permission, calibre le
 * sourire + le micro, puis crée et démarre Game.
 */
import { WebcamSplash } from './ui/WebcamSplash';
import { MicrophoneInput } from './audio/MicrophoneInput';
import { Game } from './game/Game';

async function bootstrap(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app introuvable');
  const webcamVideo = document.getElementById('webcam-video') as HTMLVideoElement | null;
  if (!webcamVideo) throw new Error('#webcam-video introuvable');

  const microphone = new MicrophoneInput();
  const splash = new WebcamSplash(document.body, webcamVideo, microphone);
  const { detector } = await splash.showAndWait();

  const game = new Game(app, detector, webcamVideo, microphone);
  await game.start();

  // Nettoyage du splash après que le jeu a démarré (mais on garde le DOM le
  // temps de la transition de fade)
  setTimeout(() => splash.dispose(), 1500);

  // Sauvegarde sur l'objet window pour debug en dev
  (window as unknown as { __game: Game }).__game = game;
}

bootstrap().catch((e) => {
  console.error(e);
  const errBox = document.createElement('div');
  errBox.style.cssText = `
    position: fixed; inset: 0; background: #1c1b1a; color: #f4e9d8;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Courier New', monospace; padding: 40px; text-align: center;
    z-index: 99;
  `;
  errBox.innerHTML = `
    <div>
      <h2 style="color:#c8102e;">Erreur au démarrage</h2>
      <pre style="text-align:left; max-width:600px; opacity:0.8;">${String(e)}</pre>
    </div>
  `;
  document.body.appendChild(errBox);
});
