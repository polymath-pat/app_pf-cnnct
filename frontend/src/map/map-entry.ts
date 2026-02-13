import './map.css';
import { Application } from 'pixi.js';
import { MapScene } from './scene/MapScene';
import { HealthPoller } from './data/health-poller';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0x0a0e17,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const container = document.getElementById('map-canvas');
  if (!container) return;
  container.appendChild(app.canvas);

  const scene = new MapScene(app);
  scene.build();

  const poller = new HealthPoller(
    (data) => scene.updateHealth(data),
    (data) => scene.updateWebhooks(data),
  );
  poller.start();

  window.addEventListener('resize', () => {
    scene.reposition();
  });
}

main();
