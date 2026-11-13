/* ===== cinematic world effects: wet street reflections (planar mirror) and street-lamp light cones ===== */
const WET = {
  enabled: false, scale: 0.5, mats: [], hide: [],
  rt: null, vcam: new THREE.PerspectiveCamera(), texM: new THREE.Matrix4(),
  uniforms: { tRefl: { value: null }, uTexM: { value: null }, uWet: { value: 0 } },
};
WET.uniforms.uTexM.value = WET.texM;

// patch a MeshStandardMaterial so it shows blurred reflections, stronger in procedural puddles
function makeWet(mat, mesh, strength) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tRefl = WET.uniforms.tRefl; sh.uniforms.uTexM = WET.uniforms.uTexM; sh.uniforms.uWet = WET.uniforms.uWet;
    sh.uniforms.uWetK = { value: strength };
    sh.vertexShader = 'uniform mat4 uTexM; varying vec4 vReflUv; varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n vec4 wpR = modelMatrix * vec4(transformed, 1.0); vWP = wpR.xyz; vReflUv = uTexM * wpR;');
    sh.fragmentShader = `uniform sampler2D tRefl; uniform float uWet, uWetK; varying vec4 vReflUv; varying vec3 vWP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      ` + sh.fragmentShader.replace('#include <opaque_fragment>', `
      if (uWet > 0.0) {
        float pud = smoothstep(0.48, 0.6, vn(vWP.xz * 0.16) * 0.7 + vn(vWP.xz * 0.9) * 0.3);
        float wet = uWet * uWetK * mix(0.3, 1.0, pud);
        vec3 V = normalize(cameraPosition - vWP); float fr = 0.05 + 0.95 * pow(1.0 - max(V.y, 0.0), 4.0);
        vec2 ruv = vReflUv.xy / vReflUv.w; float spread = mix(0.014, 0.003, pud);
        vec3 rc = texture2D(tRefl, ruv).rgb * 0.3;
        rc += (texture2D(tRefl, ruv + vec2(0.0, spread)).rgb + texture2D(tRefl, ruv - vec2(0.0, spread)).rgb) * 0.25;
        rc += (texture2D(tRefl, ruv + vec2(0.0, spread * 2.5)).rgb + texture2D(tRefl, ruv - vec2(0.0, spread * 2.5)).rgb) * 0.1;
        outgoingLight = outgoingLight * (1.0 - 0.4 * wet) + rc * wet * mix(0.3, 1.0, fr);
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'wet' + strength;
  WET.mats.push(mat); WET.hide.push(mesh);
}

function wetSetQuality(q, renderer) {
  WET.enabled = q !== 'low'; WET.scale = q === 'high' ? 0.5 : 0.33;
  WET.uniforms.uWet.value = WET.enabled ? 1 : 0;
  if (WET.enabled && !WET.rt) WET.rt = new THREE.WebGLRenderTarget(4, 4, { type: renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType });
  if (WET.rt) WET.uniforms.tRefl.value = WET.rt.texture;
}
function wetResize(w, h) { if (WET.rt) WET.rt.setSize(Math.max(2, Math.floor(w * WET.scale)), Math.max(2, Math.floor(h * WET.scale))); }

// render the scene from a camera mirrored below the street (same idea as a planar reflector)
const _wf = new THREE.Vector3(), _wu = new THREE.Vector3(), _wt = new THREE.Vector3();
function wetRender(r, scene, cam) {
  if (!WET.enabled) return;
  cam.updateMatrixWorld();
  const vc = WET.vcam;
  vc.position.set(cam.position.x, -cam.position.y, cam.position.z);
  _wf.set(0, 0, -1).applyQuaternion(cam.quaternion); _wt.copy(cam.position).add(_wf); _wt.y = -_wt.y;
  _wu.set(0, 1, 0).applyQuaternion(cam.quaternion); _wu.y = -_wu.y;
  vc.up.copy(_wu); vc.lookAt(_wt); vc.projectionMatrix.copy(cam.projectionMatrix); vc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
  vc.updateMatrixWorld(); vc.matrixWorldInverse.copy(vc.matrixWorld).invert();
  WET.texM.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
  for (const m of WET.hide) m.visible = false;
  const au = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
  r.setRenderTarget(WET.rt); r.clear(); r.render(scene, vc);
  r.shadowMap.autoUpdate = au;
  for (const m of WET.hide) m.visible = true;
}

// soft volumetric-looking cones under the street lamps
function buildLampCones(scene, heads) {
  const geo = new THREE.ConeGeometry(2.1, 4.9, 20, 1, true); geo.translate(0, -2.45, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uCol: { value: new THREE.Color(1.0, 0.7, 0.38) }, uK: { value: 0.11 } },
    vertexShader: `varying float vH; varying float vF; varying float vD;
      void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vH = -position.y / 4.9;
        vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal); vec3 v = normalize(cameraPosition - wp.xyz);
        vF = abs(dot(n, v)); vD = length(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uK; varying float vH; varying float vF; varying float vD;
      void main(){ float a = pow(vF, 2.0) * (1.0 - smoothstep(0.55, 1.0, vH)) * smoothstep(0.0, 0.06, vH) * (1.0 - vH * 0.5);
        a *= exp(-vD * 0.018) * smoothstep(0.8, 3.0, vD);
        gl_FragColor = vec4(uCol * a * uK, 1.0); }`,
  });
  const im = new THREE.InstancedMesh(geo, mat, heads.length);
  heads.forEach((p, i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y - 0.05, p.z)));
  im.frustumCulled = false; im.renderOrder = 5; scene.add(im);
  return im;
}
