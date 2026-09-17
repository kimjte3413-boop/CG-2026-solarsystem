## 바꿔본 버텍스 셰이더 코드 (비스듬히 보기 & 자동 회전)
/* ══════════════════════════════════════════════════════════════════════════
   2. 버텍스 셰이더 — 정점 하나마다 한 번씩 실행됩니다
   ══════════════════════════════════════════════════════════════════════════ */
const VS_SOURCE = `#version 300 es
// 정점 하나마다 이 프로그램이 한 번씩 실행됩니다.

layout(location=0) in vec3 aPos;      // 정점 위치 버퍼
layout(location=1) in vec3 aNormal;   // 법선 버퍼
layout(location=3) in vec3 aColor;    // 정점 색 버퍼

uniform float uTime;                  // 초 단위 시간 (모든 정점이 같은 값)
uniform vec2  uFit;                   // 화면 비에 맞춰 찌그러지지 않게

out vec3 vColor;                      // 프래그먼트 셰이더로 넘길 값
out vec3 vNormal;

mat4 rotateY(float a) {              // y축 회전 — 2주차의 Ry
  float c = cos(a), s = sin(a);
  return mat4( c, 0.0,  -s, 0.0,     // GLSL 의 mat4 는 한 줄이 한 "열"
              0.0, 1.0, 0.0, 0.0,
                s, 0.0,   c, 0.0,
              0.0, 0.0, 0.0, 1.0);
}

mat4 rotateX(float a) {              // x축 회전 — 2주차의 Rx
  float c = cos(a), s = sin(a);
  return mat4(1.0, 0.0, 0.0, 0.0,
              0.0,   c,   s, 0.0,
              0.0,  -s,   c, 0.0,
              0.0, 0.0, 0.0, 1.0);
}

void main() {
  vColor  = aColor;
  vNormal = aNormal;

  vec4 p = vec4(aPos, 1.0);
  mat4 M = mat4(1.0);                  // 단위행렬에서 시작

  // 행렬 3개가 왼쪽부터 차례로 곱해집니다.
  // 정점에는 오른쪽 것부터 적용됩니다 — 2주차와 같은 규칙입니다.
  M = rotateY(uTime * 0.7) * M;        // ← 행렬 하나 추가
  M = rotateX(-0.62) * M;              // ← 행렬 하나 추가 (약 35도 내려보기)
  M = rotateY(0.55) * M;               //    비스듬히 옆에서

  p = M * p;                           // ← 여기서 한 번에 적용

  if (p.w != 0.0) p.xy /= p.w;         // 원근 나눗셈 (원근 효과를 켰을 때만 의미가 있습니다)
  p.w = 1.0;
  p.xy *= uFit;
  gl_Position = p;
}`
;
