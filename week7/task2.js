/* Compare local rasterization, direct ray tracing, and path tracing. */
(() => {
  'use strict';
  const W = Week7, canvas = document.querySelector('#canvas');
  const gl = W.context(canvas), status = document.querySelector('#status');
  const profileLabel = document.querySelector('#profile');
  if (!gl) {
    status.textContent = 'WebGL2를 사용할 수 없습니다.';
    return;
  }
  const vertexSource = `#version 300 es
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;
  const raySource = `#version 300 es
  precision highp float;
  precision highp int;
  uniform vec2 uResolution;
  uniform int uMode, uSamples, uBounces, uAdvanced;
  uniform vec3 uEye, uLightPositions[3], uLightColors[3];
  out vec4 outColor;
  const float EPS = 0.002;
  const float PI = 3.14159265;
  vec3 centerOf(int id) {
    if (id == 0) return vec3(-1.45, -0.22, -3.2);
    if (id == 1) return vec3(0.0, -0.32, -3.7);
    if (id == 2) return vec3(1.35, -0.2, -3.15);
    return vec3(-0.25, 0.52, -2.45);
  }
  float radiusOf(int id) { return id == 0 ? 0.78 : id == 1 ? 0.67 : id == 2 ? 0.8 : 0.48; }
  vec3 colorOf(int id) {
    if (id == 0) return vec3(0.78, 0.16, 0.1);
    if (id == 1) return vec3(0.12, 0.38, 0.78);
    if (id == 2) return vec3(0.8, 0.56, 0.18);
    return vec3(0.42, 0.82, 0.9);
  }
  float sphereHit(vec3 ro, vec3 rd, vec3 center, float radius) {
    vec3 oc = ro - center;
    float halfB = dot(oc, rd);
    float disc = halfB * halfB - dot(oc, oc) + radius * radius;
    if (disc < 0.0) return -1.0;
    float root = sqrt(disc), t = -halfB - root;
    if (t > EPS) return t;
    t = -halfB + root;
    return t > EPS ? t : -1.0;
  }
  float sceneHit(vec3 ro, vec3 rd, out int id, out vec3 normal) {
    float closest = 1e20;
    id = -1;
    normal = vec3(0.0, 1.0, 0.0);
    for (int i = 0; i < 4; i++) {
      float t = sphereHit(ro, rd, centerOf(i), radiusOf(i));
      if (t > EPS && t < closest) {
        closest = t;
        id = i;
        normal = normalize(ro + t * rd - centerOf(i));
      }
    }
    if (abs(rd.y) > 1e-5) {
      float t = (-1.05 - ro.y) / rd.y;
      if (t > EPS && t < closest) { closest = t; id = 4; normal = vec3(0.0, 1.0, 0.0); }
    }
    if (abs(rd.z) > 1e-5) {
      float t = (-6.2 - ro.z) / rd.z;
      if (t > EPS && t < closest) { closest = t; id = 5; normal = vec3(0.0, 0.0, 1.0); }
    }
    return id < 0 ? -1.0 : closest;
  }
  vec3 albedoAt(int id, vec3 p) {
    if (id < 4) return colorOf(id);
    float grid = min(min(fract(p.x * 1.4), 1.0 - fract(p.x * 1.4)),
                     min(fract(p.z * 1.4), 1.0 - fract(p.z * 1.4)));
    if (id == 5) grid = min(min(fract(p.x * 1.4), 1.0 - fract(p.x * 1.4)),
                            min(fract(p.y * 1.4), 1.0 - fract(p.y * 1.4)));
    vec3 base = id == 5 ? vec3(0.35, 0.075, 0.045) : vec3(0.32, 0.35, 0.39);
    return grid < 0.022 ? base * 0.38 : base;
  }
  bool shadowed(vec3 p, vec3 n, vec3 lightPosition, float distanceToLight) {
    int blocker;
    vec3 blockerNormal;
    float t = sceneHit(p + n * 0.006, normalize(lightPosition - p), blocker, blockerNormal);
    return blocker >= 0 && t > 0.0 && t < distanceToLight - 0.012;
  }
  vec3 directLight(vec3 p, vec3 n, vec3 viewDir, int id) {
    vec3 base = albedoAt(id, p), result = base * 0.035;
    if (id == 5) result += vec3(0.025, 0.004, 0.002);
    for (int i = 0; i < 3; i++) {
      vec3 delta = uLightPositions[i] - p;
      float distanceToLight = length(delta);
      vec3 l = delta / distanceToLight;
      float diffuse = max(dot(n, l), 0.0);
      if (diffuse <= 0.0 || shadowed(p, n, uLightPositions[i], distanceToLight)) continue;
      vec3 h = normalize(l + viewDir);
      float specular = pow(max(dot(n, h), 0.0), id == 2 ? 80.0 : 28.0);
      result += (base * diffuse + vec3(0.23) * specular) *
                uLightColors[i] * (1.6 / (1.0 + 0.12 * distanceToLight * distanceToLight));
    }
    return result;
  }
  float randomValue(vec2 pixel, float seed) {
    return fract(sin(dot(pixel + seed, vec2(12.9898, 78.233))) * 43758.5453);
  }
  vec3 randomHemisphere(vec3 n, vec2 pixel, float seed) {
    float r1 = randomValue(pixel, seed), r2 = randomValue(pixel, seed + 17.31);
    float phi = 2.0 * PI * r1, z = sqrt(1.0 - r2), radius = sqrt(r2);
    vec3 helper = abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(helper, n)), bitangent = cross(n, tangent);
    return normalize(tangent * cos(phi) * radius + bitangent * sin(phi) * radius + n * z);
  }
  vec3 environment(vec3 rd) {
    return mix(vec3(0.035, 0.045, 0.065), vec3(0.2, 0.31, 0.47), max(rd.y, 0.0) * 0.8);
  }
  vec3 traceRay(vec3 ro, vec3 rd, vec2 pixel, float seed) {
    vec3 result = vec3(0.0), throughput = vec3(1.0);
    int id;
    vec3 n;
    for (int bounce = 0; bounce < 5; bounce++) {
      if (bounce >= uBounces) break;
      float t = sceneHit(ro, rd, id, n);
      if (t < 0.0) { result += throughput * environment(rd); break; }
      vec3 p = ro + t * rd;
      if (id == 2 && uAdvanced == 1) {
        result += throughput * vec3(0.9, 0.72, 0.42) * 0.08;
        throughput *= vec3(0.84, 0.76, 0.55);
        rd = reflect(rd, n);
        ro = p + n * 0.008;
        continue;
      }
      if (id == 3 && uAdvanced == 1) {
        float entering = dot(rd, n) < 0.0 ? 1.0 : -1.0;
        vec3 orientedN = n * entering;
        float eta = entering > 0.0 ? 1.0 / 1.48 : 1.48;
        vec3 refracted = refract(rd, orientedN, eta);
        float fresnel = 0.12 + 0.72 * pow(1.0 - max(dot(-rd, orientedN), 0.0), 5.0);
        if (dot(refracted, refracted) < 1e-5 || randomValue(pixel, seed + float(bounce)) < fresnel) {
          rd = reflect(rd, orientedN);
          ro = p + orientedN * 0.008;
        } else {
          rd = normalize(refracted);
          ro = p - orientedN * 0.008;
          throughput *= vec3(0.78, 0.94, 0.98);
        }
        continue;
      }
      result += throughput * directLight(p, n, -rd, id);
      if (uMode == 1) break;
      throughput *= albedoAt(id, p) * 0.62;
      if (bounce > 1 && randomValue(pixel, seed + float(bounce) * 9.0) > 0.78) break;
      rd = randomHemisphere(n, pixel, seed + float(bounce) * 37.0);
      ro = p + n * 0.008;
    }
    return result;
  }
  void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;
    vec3 eye = uEye;
    vec3 forward = normalize(vec3(0.0, -0.11, -1.0));
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rd = normalize(forward * 1.65 + uv.x * right + uv.y * up);
    vec3 color = vec3(0.0);
    int samples = uMode == 1 ? 1 : uSamples;
    for (int sampleIndex = 0; sampleIndex < 32; sampleIndex++) {
      if (sampleIndex >= samples) break;
      color += traceRay(eye, rd, gl_FragCoord.xy, float(sampleIndex) * 13.7);
    }
    color /= float(samples);
    color = color / (1.0 + color);
    outColor = vec4(pow(max(color, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
  }`;
  const localVertex = `#version 300 es
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  uniform mat4 uMVP, uModel;
  out vec3 vPosition, vNormal;
  void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vPosition = world.xyz;
    vNormal = mat3(uModel) * aNormal;
    gl_Position = uMVP * vec4(aPosition, 1.0);
  }`;
  const localFragment = `#version 300 es
  precision highp float;
  in vec3 vPosition, vNormal;
  uniform vec3 uColor, uEye, uLightPositions[3], uLightColors[3];
  out vec4 outColor;
  void main() {
    vec3 n = normalize(vNormal), v = normalize(uEye - vPosition);
    vec3 color = uColor * 0.07;
    for (int i = 0; i < 3; i++) {
      vec3 delta = uLightPositions[i] - vPosition;
      float distanceToLight = length(delta);
      vec3 l = delta / distanceToLight, h = normalize(l + v);
      float diffuse = max(dot(n, l), 0.0);
      float specular = pow(max(dot(n, h), 0.0), 28.0);
      color += (uColor * diffuse + vec3(0.15) * specular) * uLightColors[i] /
               (1.0 + 0.12 * distanceToLight * distanceToLight);
    }
    color = color / (1.0 + color);
    outColor = vec4(pow(max(color, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
  }`;

  let rayProgram, localProgram;
  try {
    rayProgram = W.program(gl, vertexSource, raySource);
    localProgram = W.program(gl, localVertex, localFragment);
  } catch (error) {
    status.textContent = `셰이더 오류: ${error.message}`;
    return;
  }
  const R = W.uniforms(gl, rayProgram, [
    'uResolution', 'uMode', 'uSamples', 'uBounces', 'uAdvanced', 'uEye',
    'uLightPositions[0]', 'uLightPositions[1]', 'uLightPositions[2]',
    'uLightColors[0]', 'uLightColors[1]', 'uLightColors[2]'
  ]);
  const L = W.uniforms(gl, localProgram, [
    'uMVP', 'uModel', 'uColor', 'uEye',
    'uLightPositions[0]', 'uLightPositions[1]', 'uLightPositions[2]',
    'uLightColors[0]', 'uLightColors[1]', 'uLightColors[2]'
  ]);
  const sphere = W.mesh(gl, W.sphere(24));
  const floor = W.mesh(gl, {
    positions: new Float32Array([-8, -1.05, 2, 8, -1.05, 2, 8, -1.05, -8, -8, -1.05, -8]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2])
  });
  const bodies = [
    { position: [-1.45, -0.22, -3.2], radius: 0.78, color: [0.78, 0.16, 0.1] },
    { position: [0, -0.32, -3.7], radius: 0.67, color: [0.12, 0.38, 0.78] },
    { position: [1.35, -0.2, -3.15], radius: 0.8, color: [0.8, 0.56, 0.18] },
    { position: [-0.25, 0.52, -2.45], radius: 0.48, color: [0.42, 0.82, 0.9] }
  ];
  const eye = [0, 1.35, 7.5];
  const lightPositions = [[-3.2, 4.2, 1.0], [3.8, 2.3, -2.0], [0.2, 4.0, -6.0]];
  const lightColors = [[1.0, 0.83, 0.68], [0.55, 0.72, 1.0], [1.0, 0.38, 0.23]];
  const byId = id => document.querySelector(`#${id}`);
  const renderer = byId('renderer'), resolution = byId('resolution');
  const samples = byId('samples'), bounces = byId('bounces'), advanced = byId('advanced');
  const timerExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const timerAvailable = !!timerExtension;
  let width = 320, height = 180, initialized = false, measuring = false;
  const profilePrefix = 'week7-render-profile-v1';
  function deviceKey() {
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const cores = Math.max(1, navigator.hardwareConcurrency || 2);
    const memory = navigator.deviceMemory || 0;
    const tier = mobile ? 'mobile' : cores >= 12 ? 'desktop-high' : cores >= 6 ? 'desktop-mid' : 'desktop-low';
    return `${profilePrefix}:${tier}:${Math.round(memory) || 'unknown'}:${cores}`;
  }
  function parseResolution(value) {
    const [w, h] = value.split('x').map(Number);
    return [w, h];
  }
  function readSettings() {
    return {
      renderer: renderer.value,
      resolution: resolution.value,
      samples: Number(samples.value),
      bounces: Number(bounces.value),
      advanced: advanced.value
    };
  }
  function applySettings(settings) {
    renderer.value = settings.renderer;
    resolution.value = settings.resolution;
    samples.value = String(settings.samples);
    bounces.value = String(settings.bounces);
    advanced.value = settings.advanced;
    byId('samples-value').textContent = samples.value;
    byId('bounces-value').textContent = `${bounces.value}회`;
    [width, height] = parseResolution(resolution.value);
  }
  function chooseInitialProfile(pathMilliseconds) {
    const estimated = multiplier => pathMilliseconds * multiplier;
    let profile;
    if (estimated(192) < 120) profile = { renderer: 'path', resolution: '1280x720', samples: 16, bounces: 3, advanced: '1' };
    else if (estimated(36) < 120) profile = { renderer: 'path', resolution: '960x540', samples: 8, bounces: 2, advanced: '1' };
    else if (estimated(8) < 120) profile = { renderer: 'ray', resolution: '640x360', samples: 4, bounces: 2, advanced: '1' };
    else profile = { renderer: 'ray', resolution: '320x180', samples: 4, bounces: 1, advanced: '0' };
    return profile;
  }
  function persistSettings() {
    try { localStorage.setItem(deviceKey(), JSON.stringify(readSettings())); }
    catch (error) { status.textContent = `기기 설정 저장 실패: ${error.message}`; }
  }
  function setupCanvas() {
    canvas.width = width;
    canvas.height = height;
    canvas.style.aspectRatio = `${width} / ${height}`;
    gl.viewport(0, 0, width, height);
  }
  function setUniforms(program, uniforms, mode) {
    gl.useProgram(program);
    if (mode !== 'local') {
      gl.uniform2f(R.uResolution, width, height);
      gl.uniform1i(R.uMode, mode === 'ray' ? 1 : 2);
      gl.uniform1i(R.uSamples, Number(samples.value));
      gl.uniform1i(R.uBounces, Number(bounces.value));
      gl.uniform1i(R.uAdvanced, Number(advanced.value));
      gl.uniform3fv(R['uLightPositions[0]'], lightPositions[0]);
      gl.uniform3fv(R['uLightPositions[1]'], lightPositions[1]);
      gl.uniform3fv(R['uLightPositions[2]'], lightPositions[2]);
      gl.uniform3fv(R['uLightColors[0]'], lightColors[0]);
      gl.uniform3fv(R['uLightColors[1]'], lightColors[1]);
      gl.uniform3fv(R['uLightColors[2]'], lightColors[2]);
      gl.uniform3fv(R.uEye, eye);
      return;
    }
    const view = W.M4.lookAt(eye, [0, 0, -2.6], [0, 1, 0]);
    const projection = W.M4.perspective(Math.PI / 3, width / height, 0.1, 100);
    const vp = W.M4.multiply(projection, view);
    gl.uniform3fv(L.uEye, eye);
    gl.uniform3fv(L['uLightPositions[0]'], lightPositions[0]);
    gl.uniform3fv(L['uLightPositions[1]'], lightPositions[1]);
    gl.uniform3fv(L['uLightPositions[2]'], lightPositions[2]);
    gl.uniform3fv(L['uLightColors[0]'], lightColors[0]);
    gl.uniform3fv(L['uLightColors[1]'], lightColors[1]);
    gl.uniform3fv(L['uLightColors[2]'], lightColors[2]);
    gl.uniformMatrix4fv(L.uMVP, false, vp);
    gl.bindVertexArray(floor.vao);
    gl.uniformMatrix4fv(L.uModel, false, W.M4.identity());
    gl.uniform3f(L.uColor, 0.3, 0.33, 0.38);
    gl.drawElements(gl.TRIANGLES, floor.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(sphere.vao);
    for (const body of bodies) {
      const model = W.M4.model(body.position, [body.radius, body.radius, body.radius]);
      gl.uniformMatrix4fv(L.uModel, false, model);
      gl.uniformMatrix4fv(L.uMVP, false, W.M4.multiply(vp, model));
      gl.uniform3fv(L.uColor, body.color);
      gl.drawElements(gl.TRIANGLES, sphere.count, gl.UNSIGNED_SHORT, 0);
    }
  }
  function render(mode) {
    setupCanvas();
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.025, 0.035, 0.06, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (mode === 'local') {
      setUniforms(localProgram, L, mode);
    } else {
      setUniforms(rayProgram, R, mode);
      gl.bindVertexArray(null);
      W.fullscreen(gl, rayProgram);
    }
  }
  function draw() {
    if (!measuring && initialized) render(renderer.value);
    requestAnimationFrame(draw);
  }
  async function measureOnce(mode) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    let query = null;
    if (timerAvailable) {
      query = gl.createQuery();
      gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, query);
    }
    const start = performance.now();
    render(mode);
    if (query) gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
    gl.finish();
    const wall = performance.now() - start;
    let gpu = null;
    if (query) {
      let available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      for (let frame = 0; !available && frame < 60; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      }
      const disjoint = gl.getParameter(timerExtension.GPU_DISJOINT_EXT);
      if (!disjoint && available) {
        gpu = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      }
      gl.deleteQuery(query);
    }
    return { wall, gpu };
  }
  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  async function measureAll(repeats = 3, startup = false) {
    if (measuring) return null;
    measuring = true;
    const saved = readSettings();
    const savedWidth = width, savedHeight = height;
    const result = {};
    try {
      [width, height] = startup ? [320, 180] : parseResolution(resolution.value);
      if (startup) {
        for (const mode of ['local', 'ray', 'path']) {
          renderer.value = mode;
          samples.value = '4'; bounces.value = '1'; advanced.value = '0';
          width = 320; height = 180;
          render(mode);
          gl.finish();
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }
      for (const mode of ['local', 'ray', 'path']) {
        const samplesTaken = [];
        for (let i = 0; i < repeats; i++) {
          if (startup) {
            renderer.value = 'path'; samples.value = '4'; bounces.value = '1'; advanced.value = '0';
            width = 320; height = 180;
          }
          samplesTaken.push(await measureOnce(mode));
          if (!startup) status.textContent = `측정 중… ${mode} ${i + 1}/${repeats}`;
        }
        result[mode] = {
          wall: median(samplesTaken.map(item => item.wall)),
          gpu: samplesTaken.every(item => item.gpu !== null) ? median(samplesTaken.map(item => item.gpu)) : null
        };
        if (!startup) {
          byId(`${mode}-wall`).textContent = `${result[mode].wall.toFixed(1)}`;
          byId(`${mode}-gpu`).textContent = result[mode].gpu === null ? '—' : result[mode].gpu.toFixed(1);
        }
      }
      return result;
    } finally {
      applySettings(saved);
      width = savedWidth;
      height = savedHeight;
      setupCanvas();
      measuring = false;
    }
  }
  renderer.addEventListener('change', persistSettings);
  resolution.addEventListener('change', () => { [width, height] = parseResolution(resolution.value); persistSettings(); });
  for (const control of [samples, bounces, advanced]) {
    control.addEventListener('input', () => {
      byId('samples-value').textContent = samples.value;
      byId('bounces-value').textContent = `${bounces.value}회`;
      persistSettings();
    });
    control.addEventListener('change', persistSettings);
  }
  byId('measure').addEventListener('click', async () => {
    byId('measure').disabled = true;
    try {
      const result = await measureAll(3);
      if (result) {
        const gpuAvailable = Object.values(result).every(item => item.gpu !== null);
        status.textContent = `측정 완료 · ${width}×${height} / ${samples.value}표본 / ${bounces.value}회 · ${gpuAvailable ? 'GPU 시간과 동기화 시간 표시' : 'GPU 시간 미지원, 동기화 시간 표시'}`;
      }
    } catch (error) {
      status.textContent = `측정 실패: ${error.message}`;
    } finally {
      byId('measure').disabled = false;
    }
  });
  byId('save-profile').addEventListener('click', () => {
    persistSettings();
    profileLabel.textContent = `이 기기에 현재 설정을 저장했습니다 (${deviceKey().split(':').slice(1).join(' · ')}). 다음 접속부터 자동 적용됩니다.`;
  });
  async function initialize() {
    setupCanvas();
    render('local');
    status.textContent = `WebGL2 · ${gl.getParameter(gl.RENDERER)} · GPU 타이머 ${timerAvailable ? '지원' : '미지원'}`;
    try {
      const saved = localStorage.getItem(deviceKey());
      if (saved) {
        const profile = JSON.parse(saved);
        if (profile && ['local', 'ray', 'path'].includes(profile.renderer)) {
          applySettings(profile);
          profileLabel.textContent = `저장된 기기 프로필을 자동 적용했습니다 (${deviceKey().split(':').slice(1).join(' · ')}).`;
          initialized = true;
          return;
        }
      }
    } catch (error) {
      profileLabel.textContent = `저장 프로필을 읽지 못했습니다: ${error.message}`;
    }
    profileLabel.textContent = '이 기기의 짧은 path tracing 시작 측정으로 초기 화질을 고릅니다…';
    const result = await measureAll(1, true);
    const profile = chooseInitialProfile(result.path.wall);
    applySettings(profile);
    persistSettings();
    profileLabel.textContent = `시작 측정 ${result.path.wall.toFixed(1)} ms → ${profile.resolution} · ${profile.samples}표본 · ${profile.bounces}회 · ${profile.renderer}. 설정을 바꾸면 이 기기에 저장됩니다.`;
    initialized = true;
  }
  initialize().catch(error => {
    status.textContent = `초기 프로필 측정 실패: ${error.message}`;
    initialized = true;
  });
  requestAnimationFrame(draw);
})();
