/* Pixel ray tracing for a solar/lunar eclipse demonstration. */
(() => {
  'use strict';
  const W = Week7, canvas = document.querySelector('#canvas');
  const gl = W.context(canvas), status = document.querySelector('#status');
  if (!gl) {
    status.textContent = 'WebGL2를 사용할 수 없습니다.';
    return;
  }
  const vertexSource = `#version 300 es
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;
  const fragmentSource = `#version 300 es
  precision highp float;
  uniform vec2 uResolution;
  uniform vec3 uEye;
  uniform float uYaw, uPitch, uOrbit;
  uniform int uShadows;
  out vec4 outColor;
  const float EPS = 0.003;
  const vec3 STAR = vec3(-3.0, 1.8, 2.2);
  const vec3 PLANET = vec3(0.0, 0.0, 0.0);
  const float PLANET_R = 1.0;
  float sphereHit(vec3 ro, vec3 rd, vec3 center, float radius) {
    vec3 oc = ro - center;
    float halfB = dot(oc, rd);
    float disc = halfB * halfB - dot(oc, oc) + radius * radius;
    if (disc < 0.0) return -1.0;
    float root = sqrt(disc);
    float t = -halfB - root;
    if (t > EPS) return t;
    t = -halfB + root;
    return t > EPS ? t : -1.0;
  }
  vec3 moonPosition() {
    vec3 axis = normalize(STAR - PLANET);
    vec3 tangent = normalize(cross(axis, vec3(0.0, 1.0, 0.0)));
    return PLANET + 1.35 * (axis * cos(uOrbit) + tangent * sin(uOrbit));
  }
  float traceBodies(vec3 ro, vec3 rd, out int id) {
    vec3 moon = moonPosition();
    float closest = 1e20;
    id = -1;
    float t = sphereHit(ro, rd, STAR, 0.38);
    if (t > 0.0 && t < closest) { closest = t; id = 0; }
    t = sphereHit(ro, rd, PLANET, PLANET_R);
    if (t > 0.0 && t < closest) { closest = t; id = 1; }
    t = sphereHit(ro, rd, moon, 0.29);
    if (t > 0.0 && t < closest) { closest = t; id = 2; }
    return id < 0 ? -1.0 : closest;
  }
  float traceRoom(vec3 ro, vec3 rd, out int id) {
    float closest = traceBodies(ro, rd, id);
    float t;
    if (abs(rd.y) > 1e-5) {
      t = (-1.35 - ro.y) / rd.y;
      if (t > EPS && t < closest) { closest = t; id = 3; }
    }
    if (abs(rd.z) > 1e-5) {
      t = (-4.2 - ro.z) / rd.z;
      if (t > EPS && t < closest) { closest = t; id = 4; }
    }
    return id < 0 ? -1.0 : closest;
  }
  bool blockedToStar(vec3 p, vec3 n) {
    vec3 toStar = STAR - p;
    float distanceToStar = length(toStar);
    vec3 direction = toStar / distanceToStar;
    int blocker;
    float t = traceBodies(p + n * 0.008, direction, blocker);
    return blocker > 0 && t > 0.0 && t < distanceToStar - 0.012;
  }
  vec3 shade(vec3 ro, vec3 rd, float t, int id) {
    vec3 p = ro + t * rd;
    if (id == 0) {
      float stripes = 0.92 + 0.08 * sin(p.y * 22.0 + p.x * 7.0);
      return vec3(1.0, 0.61, 0.19) * stripes;
    }
    vec3 n;
    vec3 albedo;
    if (id == 1) {
      n = normalize(p - PLANET);
      float bands = 0.5 + 0.5 * sin((p.y / PLANET_R) * 28.0 + 0.35 * sin(p.x * 13.0));
      albedo = mix(vec3(0.09, 0.29, 0.49), vec3(0.26, 0.66, 0.78), smoothstep(0.54, 0.7, bands));
    } else if (id == 2) {
      n = normalize(p - moonPosition());
      float marks = step(0.68, fract(sin(dot(floor(p * 22.0), vec3(12.1, 78.2, 31.7))) * 43758.5));
      albedo = mix(vec3(0.34), vec3(0.2), marks * 0.45);
    } else if (id == 3) {
      n = vec3(0.0, 1.0, 0.0);
      float grid = min(min(fract(p.x * 1.5), 1.0 - fract(p.x * 1.5)),
                       min(fract(p.z * 1.5), 1.0 - fract(p.z * 1.5)));
      albedo = grid < 0.025 ? vec3(0.16, 0.25, 0.32) : vec3(0.055, 0.075, 0.1);
    } else {
      n = vec3(0.0, 0.0, 1.0);
      float grid = min(min(fract(p.x * 1.5), 1.0 - fract(p.x * 1.5)),
                       min(fract(p.y * 1.5), 1.0 - fract(p.y * 1.5)));
      albedo = grid < 0.025 ? vec3(0.13, 0.2, 0.27) : vec3(0.035, 0.05, 0.075);
    }
    float direct = max(dot(n, normalize(STAR - p)), 0.0);
    bool shadowed = uShadows == 1 && blockedToStar(p, n);
    float ambient = id == 2 ? 0.17 : 0.055;
    return albedo * (ambient + (shadowed ? 0.0 : direct) * 1.75);
  }
  void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;
    vec3 forward = normalize(vec3(0.0, -0.02, -1.0));
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(forward, worldUp));
    vec3 up = cross(right, forward);
    vec3 yawRight = right * cos(uYaw) + forward * sin(uYaw);
    vec3 yawForward = forward * cos(uYaw) - right * sin(uYaw);
    vec3 direction = normalize(1.72 * yawForward + uv.x * yawRight + uv.y * up * cos(uPitch) + yawForward * sin(uPitch) * uv.y);
    int id;
    float t = traceRoom(uEye, direction, id);
    vec3 color = t > 0.0 ? shade(uEye, direction, t, id) : vec3(0.008, 0.014, 0.028);
    color = color / (1.0 + color);
    color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
    outColor = vec4(color, 1.0);
  }`;
  let program;
  try {
    program = W.program(gl, vertexSource, fragmentSource);
  } catch (error) {
    status.textContent = `셰이더 오류: ${error.message}`;
    return;
  }
  const U = W.uniforms(gl, program, ['uResolution', 'uEye', 'uYaw', 'uPitch', 'uOrbit', 'uShadows']);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const eye = [0.2, 1.3, 7.4];
  let yaw = 0, pitch = -0.08, playing = false, previous = 0;
  const orbit = document.querySelector('#orbit');
  const orbitValue = document.querySelector('#orbit-value');
  const setOrbit = degrees => {
    const angle = ((degrees % 360) + 360) % 360;
    orbit.value = String(Math.round(angle));
    orbitValue.textContent = `${Math.round(angle)}°`;
  };
  orbit.addEventListener('input', () => {
    orbitValue.textContent = `${orbit.value}°`;
  });
  document.querySelector('#solar').addEventListener('click', () => { setOrbit(0); yaw = 0; pitch = -0.08; });
  document.querySelector('#lunar').addEventListener('click', () => { setOrbit(180); yaw = 0.19; pitch = -0.08; });
  document.querySelector('#play').addEventListener('click', event => {
    playing = !playing;
    event.currentTarget.textContent = playing ? '공전 멈춤' : '공전 재생';
    event.currentTarget.setAttribute('aria-pressed', String(playing));
  });
  document.querySelector('#reset').addEventListener('click', () => {
    eye.splice(0, 3, 0.2, 1.3, 7.4);
    yaw = 0; pitch = -0.08;
  });
  let drag = null;
  canvas.addEventListener('pointerdown', event => { drag = [event.clientX, event.clientY]; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    yaw += (event.clientX - drag[0]) * 0.006;
    pitch = Math.max(-1.0, Math.min(1.0, pitch + (event.clientY - drag[1]) * 0.005));
    drag = [event.clientX, event.clientY];
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  function draw(time) {
    const width = Math.max(1, Math.floor(canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.5)));
    const height = Math.max(1, Math.floor(canvas.clientHeight * Math.min(devicePixelRatio || 1, 1.5)));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(U.uResolution, width, height);
    gl.uniform3fv(U.uEye, eye);
    gl.uniform1f(U.uYaw, yaw);
    gl.uniform1f(U.uPitch, pitch);
    gl.uniform1f(U.uOrbit, Number(orbit.value) * Math.PI / 180);
    gl.uniform1i(U.uShadows, Number(document.querySelector('#shadow').value));
    if (playing && previous) setOrbit(Number(orbit.value) + Math.min(time - previous, 40) * 0.035);
    previous = time;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(draw);
  }
  status.textContent = `WebGL2 준비 완료 · ${gl.getParameter(gl.RENDERER)}`;
  requestAnimationFrame(draw);
})();
