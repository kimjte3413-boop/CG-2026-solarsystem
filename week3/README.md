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

## task2 — 절차적 셰이더로 행성 표면 만들기

`task2.html`은 이미지 텍스처를 불러오지 않고 프래그먼트 셰이더에서 각 픽셀의 색을 계산해 두 행성의 표면 무늬를 만듭니다. 구 메시와 카메라는 공유하고, 셰이더 uniform `uPlanetType`으로 행성별 무늬를 선택합니다.

### 물체 기준 좌표와 조명 좌표

버텍스 셰이더는 `vSurf = aNormal`로 회전 전 구 표면의 법선을 전달합니다. 단위 구에서는 법선 방향이 곧 표면상의 방향 좌표이므로, 이 값을 프래그먼트 셰이더에서 무늬 계산에 쓸 수 있습니다. 따라서 무늬는 화면에 고정되지 않고 구 표면에 붙어 함께 회전합니다.

조명에는 별도의 `vNormal = mat3(uModel) * aNormal`을 사용합니다. 이것은 모델 회전을 반영한 법선이어서 빛 방향과 비교할 수 있습니다. 물체 기준 좌표 `S`는 표면 패턴, 세계 기준 법선 `N`은 조명 계산에 쓰는 역할 분리입니다.

### 잡음 함수: hash31 → noise3 → fbm

프래그먼트 셰이더의 `hash31(p)`는 3차원 격자 좌표를 그 점에 고정된 의사 난수값으로 바꿉니다. GPU 셰이더에서 무작위 값을 매번 새로 뽑는 대신 같은 위치에 항상 같은 값이 나오게 해, 패턴이 프레임마다 깜빡이지 않도록 합니다.

`noise3(p)`는 `floor(p)`로 현재 격자 셀을 찾고, 셀 꼭짓점 8곳의 `hash31` 값을 구합니다. `fract(p)`가 알려 주는 셀 안 위치를 보간 비율로 삼아 `mix`를 차례로 적용해 부드러운 3D 값 잡음을 만듭니다. 보간 전에 `f = f * f * (3.0 - 2.0 * f)`를 적용하는 것은 셀의 경계에서 기울기가 부드럽게 이어지도록 하기 위해서입니다.

`fbm(p)`는 `noise3`를 네 옥타브 합산합니다. 반복마다 입력 좌표를 약 2배 확대하고 진폭을 절반으로 줄여, 큰 얼룩과 잔무늬가 겹친 자연스러운 패턴을 얻습니다.

```glsl
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise3(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}
```

### 용암 행성

첫 번째 행성(`uPlanetType == 0`)은 `fbm(flow)`를 지형값으로 사용합니다. `flow` 좌표의 일부에 `uTime`을 더해 무늬가 천천히 흐르게 합니다.

```glsl
float terrain = fbm(flow);
float cracks = abs(terrain - 0.48);
float molten = 1.0 - smoothstep(0.025, 0.085, cracks);
color = mix(rock, lava, molten);
```

`terrain`이 기준값 `0.48`에 가까운 곳에서 `cracks`가 작습니다. 역방향 `smoothstep`으로 그 주변만 밝은 용암 영역으로 만들고, `mix`로 어두운 암석과 주황·노란 용암색을 섞습니다.

### 얼음 행성

두 번째 행성(`uPlanetType == 1`)은 `S.y`를 위도 성분으로 보고 `sin(S.y * 24.0 + ...)`로 가로 띠를 만듭니다. `fbm(S * 3.5)`를 띠의 위상에 더해 직선처럼 고른 줄무늬를 불규칙하게 만들고, 경도 `atan(S.z, S.x)`와 `uTime`을 이용해 띠가 천천히 흔들립니다. `smoothstep`으로 청록색 두 가지를 섞고, `smoothstep(..., abs(S.y))`로 남북극에 밝은 얼음 덮개를 추가합니다.

### 낮과 밤

두 행성의 색을 정한 뒤, `N`과 광원 방향 `L`의 내적을 계산합니다. 내적이 클수록 표면이 광원을 향하므로 밝고, 음수면 광원이 반대편에 있습니다. `smoothstep(-0.16, 0.28, diff)`로 경계를 부드럽게 한 뒤 밤면에도 약한 빛을 남깁니다.

```glsl
float diff = dot(N, L);
float day = smoothstep(-0.16, 0.28, diff);
float nightGlow = 0.12 + 0.88 * day;
fragColor = vec4(color * nightGlow, 1.0);
```

무늬 애니메이션에는 셰이더 uniform `uTime`을, 구 전체의 자전에는 JavaScript의 `M4.rotateY(...)` 모델 행렬을 사용합니다. 둘은 각각 표면 패턴의 흐름과 물체의 회전을 담당합니다.
