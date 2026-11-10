# 3주차 과제 — 떠 있는 공과 절차적 행성

## 실행 파일

- [실습 1 — 떠 있는 공](task1.html)
- [실습 1 — 공전 비교 화면](task1.html?motion=orbit)
- [실습 1 — 법선 색상 셰이더 화면](task1.html?shader=normal)
- [실습 2 — 용암 균열 행성과 사막 행성](task2.html)
- [출발 코드](w3-start.html)

현재 파일은 로컬에서 검수한 버전이다. 3·4·5·6·7주차 작업을 마친 뒤 함께 배포할 예정이므로 GitHub Pages 주소는 아직 확인하지 않았다.

## 실습 1 — 바닥 위에서 도는 공

`task1.html`은 시작 코드의 삼각형을 바닥 상자와 구 메시로 바꾸고, WebGL2에서 버텍스·프래그먼트 셰이더를 컴파일해 그린다. `makeBox`와 `makeSphere`는 각각 위치·법선·색 버퍼와 인덱스 버퍼를 만든다. 버텍스 셰이더는 모델·카메라 행렬을 적용하고 회전한 법선을 전달하며, 프래그먼트 셰이더는 보간된 법선을 정규화해 방향광의 확산 반사 색을 계산한다. 깊이 테스트를 켜서 바닥과 공의 앞뒤가 올바르게 가려지도록 했다.

카메라 행렬은 이동·회전·원근 분할·축척을 순서대로 곱해 만든다. 공의 기본 변환은 다음과 같다.

```js
M4.multiply(M4.translate(1.9, 1.9, 0), M4.rotateY(time * 0.8))
```

오른쪽부터 적용되어 공이 먼저 자기 중심에서 회전한 뒤 `(1.9, 1.9, 0)` 위치로 이동하므로 바닥 위에서 제자리 자전한다. `?motion=orbit`은 순서를 바꾼 `Ry(time * 0.8) · T(1.9, 1.9, 0)`을 사용한다. y-up 좌표계에서 `Ry`는 y축을 중심으로 회전하므로, 수평 오프셋 x=1.9가 원을 그리며 공전하고 높이 y=1.9는 유지된다. 단순히 `T(0, 1.9, 0)`를 `Ry` 앞에 두면 이동이 회전축과 나란해 중심이 움직이지 않으므로, 비교가 실제로 보이도록 수평 오프셋을 추가했다.

`?shader=normal`은 프래그먼트 셰이더를 바꿔 정규화한 법선을 `N * 0.5 + 0.5`로 RGB에 표시한다. 음수 성분도 0–1 색 범위로 옮겨 법선 방향을 색으로 볼 수 있다.

**캡처 대기**

- [ ] `task1.html` 기본 화면을 `images/task1-spin.png`로 저장
- [ ] `task1.html?motion=orbit` 화면을 `images/task1-orbit.png`로 저장
- [ ] `task1.html?shader=normal` 화면을 `images/task1-normal.png`로 저장
- [ ] 캡처를 이 보고서에 삽입하고, 자전과 공전의 차이 및 법선 색상의 의미를 확인

## 실습 2 — 서로 다른 두 절차적 행성

### 의도

한 행성은 검은 암석을 가르는 빛나는 용암 균열로, 다른 행성은 바람에 밀리는 대각선 사구로 설계했다. 예시의 가스 행성 띠·대륙과 도시 불빛·위성 분화구와 다른 표면 구조를 만들고자 했다. 두 표면 모두 이미지 텍스처 없이 프래그먼트 셰이더의 계산만으로 만든다.

### 구현 방법

버텍스 셰이더는 회전된 법선 `vNormal`을 조명용으로, 회전 전 법선 `vSurf`를 행성 표면 무늬용으로 각각 전달한다. 구 표면에서 보간된 값을 프래그먼트 셰이더에서 정규화한 뒤, `uPlanetType`으로 두 행성의 절차를 선택한다. `uTime`은 행성의 자전과 표면 무늬의 흐름에 사용한다. `dot(N, L)`에 따른 확산광을 적용해 낮과 밤 경계가 드러난다.

첫 번째 행성은 `fbm`으로 만든 잡음 지형값이 특정 높이 근처일 때 밝은 용암색을 드러낸다. `abs(terrain - 0.48)`은 기준 높이에서의 거리를 만들고, `smoothstep`은 균열의 폭과 가장자리를 부드럽게 조절한다. 시간값은 잡음 좌표를 이동시켜 균열 무늬가 흐르는 느낌을 준다.

두 번째 행성은 위도, 경도, 잡음 변형을 더한 사인파로 사구의 대각선 능선을 만든다. 시간에 따라 위상을 움직여 능선이 천천히 흐르고, 더 높은 주파수의 `fbm` 값을 모래의 잔결로 더한다. 이 방식은 가스 행성처럼 위도만으로 수평 띠를 그리는 대신 경도 방향 성분도 섞어 사구를 기울인다.

### 프래그먼트 셰이더 전체 코드

```glsl
#version 300 es
precision highp float;

in vec3 vColor;
in vec3 vNormal;
in vec3 vSurf;

uniform float uTime;
uniform int uPlanetType;

out vec4 fragColor;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

  float z0 = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);
  float z1 = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);
  return mix(z0, z1, f.z);
}

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

void main() {
  vec3 S = normalize(vSurf);
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(0.45, 0.8, 0.35));
  float diff = dot(N, L);
  float day = smoothstep(-0.16, 0.28, diff);

  vec3 color;
  if (uPlanetType == 0) {
    vec3 flow = S * 5.0 + vec3(0.0, uTime * 0.10, uTime * 0.04);
    float terrain = fbm(flow);
    float cracks = abs(terrain - 0.48);
    float molten = 1.0 - smoothstep(0.025, 0.085, cracks);
    vec3 rock = mix(vec3(0.035, 0.045, 0.075), vec3(0.22, 0.055, 0.035), terrain);
    vec3 lava = mix(vec3(1.0, 0.12, 0.015), vec3(1.0, 0.72, 0.08), terrain);
    color = mix(rock, lava, molten);
  } else if (uPlanetType == 1) {
    float longitude = atan(S.z, S.x);
    float warp = fbm(S * 3.1 + vec3(0.0, uTime * 0.015, 0.0)) - 0.5;
    float dunePhase = S.y * 18.0 + longitude * 8.0 + warp * 5.0 + uTime * 0.11;
    float dune = 0.5 + 0.5 * sin(dunePhase);
    float ridge = smoothstep(0.22, 0.78, dune);
    float grain = fbm(S * 17.0 + vec3(0.0, uTime * 0.015, 0.0));
    vec3 shadowSand = vec3(0.30, 0.12, 0.035);
    vec3 sunlitSand = vec3(0.95, 0.62, 0.24);
    color = mix(shadowSand, sunlitSand, ridge);
    color += (grain - 0.5) * 0.16;
    color = clamp(color, 0.0, 1.0);
  } else {
    color = vColor;
  }

  float nightGlow = 0.12 + 0.88 * day;
  fragColor = vec4(color * nightGlow, 1.0);
}
```

**캡처 대기**

- [ ] 용암 행성을 `images/task2-lava.png`로 저장
- [ ] 사막 행성을 `images/task2-dunes.png`로 저장
- [ ] 화면 캡처를 이 보고서에 삽입하고, 두 표면의 무늬와 애니메이션을 확인

## 제출 전 확인

- [x] `task1.html`과 `task2.html` 실행 파일 존재
- [x] 실습 1의 깊이 테스트, 바닥, 떠 있는 공, 자전과 조명 구현
- [x] 실습 2에서 이미지 텍스처 없이 두 행성의 표면을 계산
- [x] `uTime` 애니메이션, 물체 기준 표면 좌표, 낮·밤 조명 구현
- [x] 실습 1의 곱셈 순서 및 셰이더 변형을 재현하는 URL 제공
- [ ] 실습 화면을 직접 캡처해 이미지 폴더에 추가
- [ ] 나중에 배포한 GitHub Pages 페이지와 보고서 주소 확인
