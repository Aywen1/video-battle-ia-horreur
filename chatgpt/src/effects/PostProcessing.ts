import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const horrorShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    battery: { value: 1 },
    nightmare: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float battery;
    uniform float nightmare;
    varying vec2 vUv;

    float random(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      float warp = sin((uv.y + time * 0.65) * 24.0) * 0.006 * nightmare;
      uv.x += warp;
      float aberration = mix(0.0035, 0.001, battery) + nightmare * 0.012;
      vec2 fromCenter = uv - 0.5;
      float edge = dot(fromCenter, fromCenter);
      vec2 shift = normalize(fromCenter + 0.0001) * aberration * edge;

      float r = texture2D(tDiffuse, uv + shift).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - shift).b;
      vec3 color = vec3(r, g, b);

      float vignette = smoothstep(1.08, 0.42, length(fromCenter));
      float grain = random(uv * vec2(1280.0, 720.0) + time * 17.0) - 0.5;
      color += grain * (0.026 + nightmare * 0.11);
      color.r += nightmare * 0.18;
      color.g *= 1.0 - nightmare * 0.18;
      color.b *= 1.0 - nightmare * 0.28;
      color *= mix(0.94, 1.0, vignette);
      color = pow(color + vec3(0.028), vec3(0.9, 0.94, 0.98));

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class PostProcessing {
  private readonly composer: EffectComposer;
  private readonly shaderPass: ShaderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.08, 0.32, 0.86);
    this.composer.addPass(bloom);

    this.shaderPass = new ShaderPass(horrorShader);
    this.composer.addPass(this.shaderPass);
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  setNightmareIntensity(value: number): void {
    this.shaderPass.uniforms.nightmare.value = THREE.MathUtils.clamp(value, 0, 1);
  }

  render(delta: number, battery: number): void {
    this.shaderPass.uniforms.time.value += delta;
    this.shaderPass.uniforms.battery.value = battery;
    this.composer.render();
  }
}
