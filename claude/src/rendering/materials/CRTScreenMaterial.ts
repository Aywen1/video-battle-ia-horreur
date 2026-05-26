/**
 * Shader d'écran CRT : scanlines, courbure de tube, vignettage, distorsion
 * chromatique. Utilisé pour la caméra de plateau qui montre la webcam du
 * joueur en direct. Désaccoupé volontairement du pipeline standard.
 *
 * Mode "filtre Snapchat" optionnel (uMouthFilter > 0) :
 * - Déforme localement les UVs autour de la position de la bouche (etirement
 *   horizontal style "smile filter"), de sorte que les pixels webcam soient
 *   physiquement étirés (effet de morphing).
 * - Dessine par-dessus un sourire grotesque procédural (lèvres rouge sang,
 *   dents trop blanches) qui suit les landmarks de la bouche, avec orientation
 *   (angle) et taille mises à jour chaque frame.
 */
import { ShaderMaterial, Texture, Vector2 } from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uChromatic;
  uniform vec2 uResolution;
  uniform float uMirror;

  // ===== Filtre "Snapchat" — déformation locale + sourire greffé =====
  // Toutes les valeurs sont en espace UV (0..1) avec X mirroré comme l'affichage.
  uniform float uMouthFilter;    // 0..1 : intensité globale du filtre
  uniform vec2  uMouthCenter;    // centre de la bouche (uv space)
  uniform float uMouthHalfWidth; // demi-largeur des commissures
  uniform float uMouthHalfHeight;// demi-hauteur des lèvres
  uniform float uMouthAngle;     // rotation de la ligne des commissures (rad)
  uniform float uSmileStretch;   // 0..1 : agrandissement horizontal du sourire

  vec2 curve(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) / vec2(6.0, 4.5);
    uv = uv + uv * offset * offset;
    return uv * 0.5 + 0.5;
  }

  // Rotation autour d'un point
  vec2 rotateUV(vec2 uv, vec2 pivot, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    vec2 v = uv - pivot;
    return pivot + vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }

  void main() {
    vec2 uv = vUv;
    if (uMirror > 0.5) uv.x = 1.0 - uv.x;

    vec2 cuv = curve(uv);
    if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // ===== Filtre bouche : déforme les UVs autour du centre de la bouche =====
    // On va etirer horizontalement la zone autour de la bouche pour donner
    // un effet de "smile pulled wider".
    if (uMouthFilter > 0.01 && uMouthHalfWidth > 0.001) {
      // Travaille dans le repere aligne sur la bouche (rotation -angle).
      vec2 local = rotateUV(cuv, uMouthCenter, -uMouthAngle) - uMouthCenter;
      // Zone d'influence : ellipse autour de la bouche (1.6x la taille de la bouche)
      float rx = uMouthHalfWidth * 1.8;
      float ry = uMouthHalfHeight * 4.5;
      float dx = local.x / rx;
      float dy = local.y / ry;
      float r = sqrt(dx * dx + dy * dy);
      if (r < 1.0) {
        // Falloff doux (cos^2)
        float falloff = pow(cos(r * 1.5707963), 2.0);
        float strength = uMouthFilter * falloff;
        // Etirement horizontal : tire les pixels vers les commissures
        float stretch = 1.0 + uSmileStretch * 0.55 * strength;
        local.x = local.x / stretch;
        // Petit creusement vertical au niveau des dents (creuse la bouche vers le bas)
        float jawDrop = 0.005 * strength * (local.y / ry);
        local.y -= jawDrop;
        // Repasse dans l'espace ecran
        cuv = rotateUV(local + uMouthCenter, uMouthCenter, uMouthAngle);
      }
    }

    // Décalage chromatique
    float ca = uChromatic * (0.3 + uIntensity);
    float r = texture2D(uMap, cuv + vec2( ca, 0.0)).r;
    float g = texture2D(uMap, cuv).g;
    float b = texture2D(uMap, cuv + vec2(-ca, 0.0)).b;
    vec3 col = vec3(r, g, b);

    // ===== Sourire grotesque overlay (lèvres + dents) =====
    // On calcule la distance au centre de la bouche en repere rotated.
    if (uMouthFilter > 0.01 && uMouthHalfWidth > 0.001) {
      vec2 local = rotateUV(cuv, uMouthCenter, -uMouthAngle) - uMouthCenter;
      // Largeur du sourire greffe : suit la bouche mais agrandie selon stretch
      float mouthW = uMouthHalfWidth * (1.0 + uSmileStretch * 0.5);
      float mouthH = uMouthHalfHeight * (1.4 + uSmileStretch * 0.6);
      // Forme du sourire : arc de cercle. y = -sin(x*PI/(2*W)) * H * curve
      // Le sourire descend vers le bas aux extremes (sourire diabolique tire vers le bas)
      float xn = local.x / mouthW; // -1..1
      if (abs(xn) <= 1.05) {
        // Forme de la bouche : 2 arcs (haut + bas)
        // Courbe en cloche inversée : aux extremes, la bouche descend
        float curveOffset = pow(abs(xn), 2.0) * 0.55 - 0.20;
        float yCenterLocal = mouthH * curveOffset;
        // Largeur verticale dans la bouche
        float yTop = yCenterLocal - mouthH * 0.65;
        float yBot = yCenterLocal + mouthH * 0.85;
        if (local.y >= yTop && local.y <= yBot && abs(xn) <= 1.0) {
          // Couleur de base : rouge sang
          vec3 lipColor = vec3(0.36, 0.03, 0.07);
          // Dents : bande horizontale claire au centre de la bouche
          float dentY = local.y - yCenterLocal;
          float toothBand = 1.0 - smoothstep(mouthH * 0.05, mouthH * 0.55, abs(dentY));
          // Decoupe verticale des dents (separations sombres)
          float toothCount = 13.0;
          float toothPhase = fract(xn * toothCount * 0.5 + 0.5);
          float toothSlot = smoothstep(0.08, 0.16, toothPhase) * smoothstep(0.92, 0.84, toothPhase);
          // Petits ombrages aux racines
          float gumShadow = smoothstep(0.0, 0.15, mouthH * 0.05 - abs(dentY));
          vec3 toothColor = mix(vec3(0.95, 0.92, 0.84), vec3(0.55, 0.45, 0.40), 1.0 - toothSlot);
          toothColor = mix(toothColor, vec3(0.2, 0.05, 0.05), gumShadow * 0.4);
          // Inside bouche (zones non-dents) : noir profond / rouge tres sombre
          float insideBouche = smoothstep(mouthH * 0.55, mouthH * 0.85, abs(dentY));
          vec3 insideColor = vec3(0.06, 0.01, 0.02);
          // Combine : lèvres au bord, dents au centre haut, interieur en bas
          float edgeT = smoothstep(0.85, 1.0, abs(xn));
          float lipBandTop = smoothstep(mouthH * 0.85, mouthH * 0.55, abs(dentY));
          vec3 mixed = mix(toothColor, lipColor, edgeT);
          mixed = mix(mixed, insideColor, insideBouche);
          // Levres rouges autour du contour (epaisses)
          float lipThickness = smoothstep(mouthH * 0.95, mouthH * 0.75, abs(dentY));
          float lipBand = max(edgeT, lipThickness * 0.5);
          mixed = mix(mixed, lipColor * vec3(1.3, 1.0, 1.0), lipBand * 0.7);

          // Falloff aux bords de l'ovale pour blender avec le visage
          float xFalloff = pow(1.0 - abs(xn), 0.5);
          float blend = uMouthFilter * xFalloff;
          col = mix(col, mixed, blend);

          // Petites taches de sang aux commissures
          float cornerDist = 1.0 - abs(xn);
          if (cornerDist < 0.18 && abs(dentY) < mouthH * 0.4) {
            float bloodAlpha = (1.0 - cornerDist / 0.18) * uMouthFilter;
            col = mix(col, vec3(0.42, 0.02, 0.05), bloodAlpha * 0.55);
          }
        }
      }
    }

    // Scanlines
    float scan = sin(cuv.y * uResolution.y * 1.6) * 0.5 + 0.5;
    col *= mix(1.0, 0.78 + 0.22 * scan, uIntensity);

    // Phosphor mask (très subtil)
    float mask = sin(cuv.x * uResolution.x * 1.5) * 0.5 + 0.5;
    col *= mix(1.0, 0.92 + 0.08 * mask, uIntensity);

    // Vignette tube
    vec2 vig = cuv * (1.0 - cuv);
    float v = vig.x * vig.y * 14.0;
    v = pow(v, 0.4);
    col *= clamp(v, 0.0, 1.0);

    // Petit jitter horizontal (rolling) lié au temps
    float jitter = sin(uTime * 2.0 + cuv.y * 30.0) * 0.0015 * uIntensity;
    col += texture2D(uMap, cuv + vec2(jitter, 0.0)).rgb * 0.03 * uIntensity;

    // Légère teinte chaude
    col = mix(col, col * vec3(1.05, 1.0, 0.92), 0.4);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class CRTScreenMaterial extends ShaderMaterial {
  constructor(map: Texture, opts: { intensity?: number; chromatic?: number; mirror?: boolean } = {}) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMap: { value: map },
        uTime: { value: 0 },
        uIntensity: { value: opts.intensity ?? 1.0 },
        uChromatic: { value: opts.chromatic ?? 0.004 },
        uResolution: { value: new Vector2(512, 384) },
        uMirror: { value: opts.mirror ? 1 : 0 },
        // Filtre Snapchat : tout a 0 par defaut = comportement inchange
        uMouthFilter: { value: 0 },
        uMouthCenter: { value: new Vector2(0.5, 0.62) },
        uMouthHalfWidth: { value: 0.12 },
        uMouthHalfHeight: { value: 0.04 },
        uMouthAngle: { value: 0 },
        uSmileStretch: { value: 0 },
      },
    });
  }

  setMap(tex: Texture): void {
    this.uniforms.uMap.value = tex;
  }

  update(time: number, intensity?: number): void {
    this.uniforms.uTime.value = time;
    if (intensity !== undefined) this.uniforms.uIntensity.value = intensity;
  }

  /**
   * Met a jour les uniforms du filtre "smile" en temps reel.
   * - filterIntensity : 0..1 (0 = filtre desactive, 1 = filtre plein)
   * - centerUv : centre de la bouche en UV (0..1)
   * - halfWidth/halfHeight : demi-dimensions de la bouche en UV
   * - angle : rotation (rad)
   * - stretch : 0..1 = agrandissement horizontal supplementaire ("sourire elargi")
   */
  setMouthFilter(
    filterIntensity: number,
    centerUv: { x: number; y: number },
    halfWidth: number,
    halfHeight: number,
    angle: number,
    stretch: number,
  ): void {
    this.uniforms.uMouthFilter.value = filterIntensity;
    (this.uniforms.uMouthCenter.value as Vector2).set(centerUv.x, 1 - centerUv.y);
    this.uniforms.uMouthHalfWidth.value = halfWidth;
    this.uniforms.uMouthHalfHeight.value = halfHeight;
    this.uniforms.uMouthAngle.value = angle;
    this.uniforms.uSmileStretch.value = stretch;
  }
}
