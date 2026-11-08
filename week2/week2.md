# 2주차 과제 — 지구 · 달 · ISS 변환 설계

## 공통 기준과 조사 자료

거리 단위는 **지구 평균 반지름 = 1**로 정했다. km를 직접 사용하면 지구–달 거리와 ISS 크기의 자릿수 차이가 커지고, 모든 장면을 한 화면에 맞추기도 어렵다. 지구 반지름 단위로 바꾸면 지구 반지름은 1, 달까지 거리는 약 60.3, ISS 궤도 반지름은 약 1.063이 되어 비율을 쉽게 비교할 수 있다.

| 대상 | 사용한 값 | 계산 또는 설명 |
|---|---:|---|
| 지구 반지름 | 6,371 km = 1 | 주차 강의의 검산 표 값 |
| 달 반지름 | 1,737 km = 0.273 | 1,737 / 6,371 |
| 지구–달 평균 거리 | 384,400 km = 60.3 | 384,400 / 6,371 |
| ISS 고도 | 약 400 km | 원 궤도로 단순화 |
| ISS 궤도 반지름 | 약 6,771 km = 1.063 | (6,371 + 400) / 6,371 |
| ISS 궤도 경사 | 약 51.6° | 궤도면 기울기 |
| ISS 전체 길이 | 약 109 m | 모형의 최장 길이를 맞추는 데 사용 |
| 달 공전 주기 | 약 27.3일 | 회전 속도 계산 |
| ISS 공전 주기 | 약 90분 = 1.5시간 | 회전 속도 계산 |

자료: [2주차 강의 — 축척 검산 표](https://cg.catholic.ac.kr/~mgchoi/CG/weeks/week02/), [NASA Moon Facts](https://science.nasa.gov/moon/facts/) (달 반지름·평균 거리·동주기 자전), [NASA ISS Station Facts](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/) (약 90분 공전·109 m 길이), [satellitemap.space](https://satellitemap.space/) (궤도 경사 확인). 강의의 수치와 NASA의 근삿값은 반올림 차이가 있으므로 이 보고서는 강의 검산 표의 지구·달 기준값을 사용한다.

실행 파일에서 `t`는 **시뮬레이션 시간(시간)** 이다. Task 1·2는 `T_SPEED = 0.5`이므로 실제 1초마다 시뮬레이션 시간이 0.5시간 흐른다. Task 3은 확대된 ISS를 관찰하기 쉽게 `T_SPEED = 0.05`로 낮췄다. 달과 ISS의 각속도는 각각 `360 / (27.3 × 24)`도/시간과 `360 / 1.5`도/시간으로 계산했다. 원 궤도·고정 고도·고정 경사로 단순화했으며, 실제 TLE 궤도 계산은 하지 않는다.

## Task 1 — 실제 비율로 만들기

**축 범위:** x, y, z 모두 ±70 지구 반지름. 달의 중심이 원점에서 60.3이고 반지름이 0.273이므로 바깥 가장자리는 60.573이다. 70은 여기에 약 15% 여유를 둔다.

**설정 JSON**

```json
{
  "range": { "x": "70", "y": "70", "z": "70" },
  "objects": [
    {
      "id": "earth", "name": "지구", "color": [0.35, 0.6, 0.95],
      "steps": [{ "type": "Su", "args": ["1"] }]
    },
    {
      "id": "moon", "name": "달", "color": [0.78, 0.78, 0.82],
      "steps": [
        { "type": "Rz", "args": ["360/(27.3*24)*t"] },
        { "type": "T", "args": ["60.3", "0", "0"] },
        { "type": "Rz", "args": ["180"] },
        { "type": "Su", "args": ["0.273"] }
      ]
    },
    {
      "id": "sat", "name": "인공위성", "color": [0.95, 0.72, 0.35],
      "steps": [
        { "type": "Rx", "args": ["51.6"] },
        { "type": "Rz", "args": ["360/1.5*t"] },
        { "type": "T", "args": ["1.063", "0", "0"] },
        { "type": "Rz", "args": ["180"] },
        { "type": "Su", "args": ["0.00000534"] }
      ]
    }
  ]
}
```

지구 반지름은 1, 달 중심까지 거리는 60.3, ISS 궤도 반지름은 1.063으로 두었다. ISS 모형의 로컬 최장 길이는 3.2이고, 전체 길이 109 m는 지구 반지름의 약 `0.0000171`이므로 균등 크기는 `0.0000171 / 3.2 ≈ 0.00000534`다. `Rz(180)`은 각 물체의 로컬 +X를 지구 쪽으로 향하게 한다. 달에는 공전과 같은 각도의 자전을 적용해 동주기 자전을 표현한다. ISS의 `Rx(51.6)`은 궤도면을 기울인다.

- [Task 1 변환 설정 열기](https://cg.catholic.ac.kr/~mgchoi/CG/demos/d02-transform-lab.html?d=eyJyYW5nZSI6eyJ4IjoiNzAiLCJ5IjoiNzAiLCJ6IjoiNzAifSwib2JqZWN0cyI6W3siaWQiOiJlYXJ0aCIsIm5hbWUiOiLsp4DqtawiLCJjb2xvciI6WzAuMzUsMC42LDAuOTVdLCJzdGVwcyI6W3sidHlwZSI6IlN1IiwiYXJncyI6WyIxIl19XX0seyJpZCI6Im1vb24iLCJuYW1lIjoi64usIiwiY29sb3IiOlswLjc4LDAuNzgsMC44Ml0sInN0ZXBzIjpbeyJ0eXBlIjoiUnoiLCJhcmdzIjpbIjM2MC8oMjcuMyoyNCkqdCJdfSx7InR5cGUiOiJUIiwiYXJncyI6WyI2MC4zIiwiMCIsIjAiXX0seyJ0eXBlIjoiUnoiLCJhcmdzIjpbIjE4MCJdfSx7InR5cGUiOiJTdSIsImFyZ3MiOlsiMC4yNzMiXX1dfSx7ImlkIjoic2F0IiwibmFtZSI6IuyduOqzteychOyEsSIsImNvbG9yIjpbMC45NSwwLjcyLDAuMzVdLCJzdGVwcyI6W3sidHlwZSI6IlJ4IiwiYXJncyI6WyI1MS42Il19LHsidHlwZSI6IlJ6IiwiYXJncyI6WyIzNjAvMS41KnQiXX0seyJ0eXBlIjoiVCIsImFyZ3MiOlsiMS4wNjMiLCIwIiwiMCJdfSx7InR5cGUiOiJSeiIsImFyZ3MiOlsiMTgwIl19LHsidHlwZSI6IlN1IiwiYXJncyI6WyIwLjAwMDAwNTM0Il19XX1dfQ%3D%3D)

**순서 바꾸기 질문**

1. 달의 핵심 사슬 `Rz(θ) · T(60.3) · S(0.273)`에서 `T`를 `Rz` 앞으로 옮겨 `T · Rz · S`로 만들면 달 중심은 원점 기준으로 돌지 않고 반지름 60.3 위치에 고정된다. 회전은 이동 뒤의 로컬 모양에만 적용되어 제자리 자전처럼 보인다.
2. `S`를 맨 앞으로 옮기면 `S · Rz · T`가 되어 이동도 0.273배 된다. 달 중심의 궤도 반지름이 60.3에서 약 16.46으로 줄어든다.
3. 세 행렬의 여섯 순열 중 실제 반지름과 크기를 모두 유지하며 공전시키는 것은 **`Rz · T · S` 한 가지**다. 회전은 이동의 왼쪽에 있어 이동된 중심을 원점 둘레로 돌리고, 크기는 이동의 오른쪽에 있어 물체 자체에만 적용된다.

**Task 1 질문**

- **단위와 이유:** 지구 반지름을 1로 했다. 천체 간 실제 비율을 유지하면서 수치 규모를 다루기 쉽고, 지구·달·ISS 위치를 한 기준에서 비교할 수 있다.
- **숫자가 커서 생긴 문제:** 원점에서 달까지 60.3인 반면 ISS의 실제 크기는 약 `0.0000171` 지구 반지름뿐이다. 같은 축척에서 ISS는 사실상 픽셀보다 작아 보이지 않는다. 축을 ±70으로 맞추면 달은 들어오지만 지구와 ISS는 매우 작게 보이는 것이 실제 비율의 결과다.
- **지구를 향하게 한 단계:** 궤도 회전과 이동 뒤의 `Rz(180)`이 로컬 +X를 반대 방향으로 돌린다. 달은 공전 회전도 자전 회전에 함께 쓰므로 같은 면이 지구를 향한다.

**캡처 대기:** 직접 실행한 뒤 `images/task1.png`로 저장하고 아래에 추가한다.

## Task 2 — NDC 범위에 맞추기

축 범위는 x, y, z 모두 ±1이다. 가장 먼 점인 달 바깥쪽까지는 `60.3 + 0.273 = 60.573`이므로 공통 배율은 `s = 1 / 60.573 ≈ 0.01651`이다. 여유를 두어 `0.0165`를 선택했다. 이 스케일을 모든 물체의 사슬에서 **맨 왼쪽**에 놓았다. 그래야 물체 크기뿐 아니라 지구에서 떨어진 거리까지 함께 줄어든다.

**설정 JSON**

```json
{
  "range": { "x": "1", "y": "1", "z": "1" },
  "objects": [
    {
      "id": "earth", "name": "지구", "color": [0.35, 0.6, 0.95],
      "steps": [
        { "type": "Su", "args": ["0.0165"] },
        { "type": "Su", "args": ["1"] }
      ]
    },
    {
      "id": "moon", "name": "달", "color": [0.78, 0.78, 0.82],
      "steps": [
        { "type": "Su", "args": ["0.0165"] },
        { "type": "Rz", "args": ["360/(27.3*24)*t"] },
        { "type": "T", "args": ["60.3", "0", "0"] },
        { "type": "Rz", "args": ["180"] },
        { "type": "Su", "args": ["0.273"] }
      ]
    },
    {
      "id": "sat", "name": "인공위성", "color": [0.95, 0.72, 0.35],
      "steps": [
        { "type": "Su", "args": ["0.0165"] },
        { "type": "Rx", "args": ["51.6"] },
        { "type": "Rz", "args": ["360/1.5*t"] },
        { "type": "T", "args": ["1.063", "0", "0"] },
        { "type": "Rz", "args": ["180"] },
        { "type": "Su", "args": ["0.00000534"] }
      ]
    }
  ]
}
```

- [Task 2 변환 설정 열기](https://cg.catholic.ac.kr/~mgchoi/CG/demos/d02-transform-lab.html?d=eyJyYW5nZSI6eyJ4IjoiMSIsInkiOiIxIiwieiI6IjEifSwib2JqZWN0cyI6W3siaWQiOiJlYXJ0aCIsIm5hbWUiOiLsp4DqtawiLCJjb2xvciI6WzAuMzUsMC42LDAuOTVdLCJzdGVwcyI6W3sidHlwZSI6IlN1IiwiYXJncyI6WyIwLjAxNjUiXX0seyJ0eXBlIjoiU3UiLCJhcmdzIjpbIjEiXX1dfSx7ImlkIjoibW9vbiIsIm5hbWUiOiLri6wiLCJjb2xvciI6WzAuNzgsMC43OCwwLjgyXSwic3RlcHMiOlt7InR5cGUiOiJTdSIsImFyZ3MiOlsiMC4wMTY1Il19LHsidHlwZSI6IlJ6IiwiYXJncyI6WyIzNjAvKDI3LjMqMjQpKnQiXX0seyJ0eXBlIjoiVCIsImFyZ3MiOlsiNjAuMyIsIjAiLCIwIl19LHsidHlwZSI6IlJ6IiwiYXJncyI6WyIxODAiXX0seyJ0eXBlIjoiU3UiLCJhcmdzIjpbIjAuMjczIl19XX0seyJpZCI6InNhdCIsIm5hbWUiOiLsnbjqs7XsnITshLEiLCJjb2xvciI6WzAuOTUsMC43MiwwLjM1XSwic3RlcHMiOlt7InR5cGUiOiJTdSIsImFyZ3MiOlsiMC4wMTY1Il19LHsidHlwZSI6IlJ4IiwiYXJncyI6WyI1MS42Il19LHsidHlwZSI6IlJ6IiwiYXJncyI6WyIzNjAvMS41KnQiXX0seyJ0eXBlIjoiVCIsImFyZ3MiOlsiMS4wNjMiLCIwIiwiMCJdfSx7InR5cGUiOiJSeiIsImFyZ3MiOlsiMTgwIl19LHsidHlwZSI6IlN1IiwiYXJncyI6WyIwLjAwMDAwNTM0Il19XX1dfQ%3D%3D)

- **배율을 맨 앞에 둔 이유:** `S · R · T · …`는 오른쪽부터 계산하므로 마지막에 장면 전체를 축소한다. 맨 뒤에 두면 위치는 줄지 않고 물체 크기만 작아져 달이 계속 화면 밖에 남는다.
- **공통 배율을 쓴 이유:** 물체마다 다른 전역 배율을 쓰면 거리와 크기의 상대 비율이 달라진다. 같은 배율로 장면 전체를 줄여야 실제 비율이 유지된다.
- **화면에서 보이는 모습:** 달은 NDC 안에 들어온다. 지구는 작고, 달도 작게 보이며, ISS는 실제 크기 비율 때문에 거의 보이지 않는다. 이것이 수치를 틀리게 입력한 것이 아니라 실제 비율을 그대로 그린 결과다.

**캡처 대기:** 직접 실행한 뒤 `images/task2.png`로 저장하고 아래에 추가한다.

## Task 3 — 보는 사람을 위한 표현

실제 축척은 과학적 비교에는 적합하지만, 한 화면에서 지구와 ISS의 형태를 알아보기에는 부적합하다. 그래서 공통 장면 배율은 Task 2와 같게 유지하고, 달 크기를 과장하는 한편 ISS는 보이도록 **크기와 궤도 반지름 모두 과장**했다. 달 반지름은 지구 반지름 단위의 0.273에서 0.82로 키웠다(3배). ISS 궤도 반지름은 실제 1.063 대신 3을, 모형 크기는 실제 비율의 `0.00000534` 대신 `0.75`를 사용했다. 페이지 왼쪽 위에 이 과장을 표시한다.

**설정 JSON**

```json
{
  "range": { "x": "1", "y": "1", "z": "1" },
  "objects": [
    {
      "id": "earth", "name": "지구", "color": [0.35, 0.6, 0.95],
      "steps": [
        { "type": "Su", "args": ["0.0165"] },
        { "type": "Su", "args": ["1"] }
      ]
    },
    {
      "id": "moon", "name": "달", "color": [0.78, 0.78, 0.82],
      "steps": [
        { "type": "Su", "args": ["0.0165"] },
        { "type": "Rz", "args": ["360/(27.3*24)*t"] },
        { "type": "T", "args": ["60.3", "0", "0"] },
        { "type": "Rz", "args": ["180"] },
        { "type": "Su", "args": ["0.82"] }
      ]
    },
    {
      "id": "sat", "name": "인공위성", "color": [0.95, 0.72, 0.35],
      "steps": [
        { "type": "Su", "args": ["0.0165"] },
        { "type": "Rx", "args": ["51.6"] },
        { "type": "Rz", "args": ["360/1.5*t"] },
        { "type": "T", "args": ["3", "0", "0"] },
        { "type": "Rz", "args": ["180"] },
        { "type": "Su", "args": ["0.75"] }
      ]
    }
  ]
}
```

- [Task 3 변환 설정 열기](https://cg.catholic.ac.kr/~mgchoi/CG/demos/d02-transform-lab.html?d=eyJyYW5nZSI6eyJ4IjoiMSIsInkiOiIxIiwieiI6IjEifSwib2JqZWN0cyI6W3siaWQiOiJlYXJ0aCIsIm5hbWUiOiLsp4DqtawiLCJjb2xvciI6WzAuMzUsMC42LDAuOTVdLCJzdGVwcyI6W3sidHlwZSI6IlN1IiwiYXJncyI6WyIwLjAxNjUiXX0seyJ0eXBlIjoiU3UiLCJhcmdzIjpbIjEiXX1dfSx7ImlkIjoibW9vbiIsIm5hbWUiOiLri6wiLCJjb2xvciI6WzAuNzgsMC43OCwwLjgyXSwic3RlcHMiOlt7InR5cGUiOiJTdSIsImFyZ3MiOlsiMC4wMTY1Il19LHsidHlwZSI6IlJ6IiwiYXJncyI6WyIzNjAvKDI3LjMqMjQpKnQiXX0seyJ0eXBlIjoiVCIsImFyZ3MiOlsiNjAuMyIsIjAiLCIwIl19LHsidHlwZSI6IlJ6IiwiYXJncyI6WyIxODAiXX0seyJ0eXBlIjoiU3UiLCJhcmdzIjpbIjAuODIiXX1dfSx7ImlkIjoic2F0IiwibmFtZSI6IuyduOqzteychOyEsSIsImNvbG9yIjpbMC45NSwwLjcyLDAuMzVdLCJzdGVwcyI6W3sidHlwZSI6IlN1IiwiYXJncyI6WyIwLjAxNjUiXX0seyJ0eXBlIjoiUngiLCJhcmdzIjpbIjUxLjYiXX0seyJ0eXBlIjoiUnoiLCJhcmdzIjpbIjM2MC8xLjUqdCJdfSx7InR5cGUiOiJUIiwiYXJncyI6WyIzIiwiMCIsIjAiXX0seyJ0eXBlIjoiUnoiLCJhcmdzIjpbIjE4MCJdfSx7InR5cGUiOiJTdSIsImFyZ3MiOlsiMC43NSJdfV19XX0%3D)

- **장점:** 달과 ISS의 형태 및 공전 움직임을 한 화면에서 알아보기 쉽다.
- **잃는 것:** 달과 ISS의 크기, ISS의 궤도 반지름이 실제 비율과 다르다. 천체 크기나 ISS의 지구 표면 위 고도를 비교하는 용도로는 쓸 수 없다.

**캡처 대기:** 직접 실행한 뒤 `images/task3.png`로 저장하고 아래에 추가한다.

## 실행 파일과 최종 점검

- [Task 1 실행하기](https://kimjte3413-boop.github.io/CG-2026-solarsystem/week2/task1.html)
- [Task 2 실행하기](https://kimjte3413-boop.github.io/CG-2026-solarsystem/week2/task2.html)
- [Task 3 실행하기](https://kimjte3413-boop.github.io/CG-2026-solarsystem/week2/task3.html)

이 파일들은 주차 실습 도구가 내보내는 단독 WebGL 템플릿을 바탕으로 변환 설정과 카메라 범위를 맞춘 실행 페이지다. Task 3은 Task 2의 실행 템플릿에 크기 과장 안내를 추가했다. 배포 후 위 GitHub Pages 주소에서 세 파일이 실제로 열리는지 확인한다.

아래 작업은 브라우저에서 직접 실행·검수한 뒤 완료한다.

- [ ] 각 Task 페이지에서 지구·달·ISS가 의도한 범위에 있는지, 애니메이션이 동작하는지 확인
- [ ] 실습 도구에서 로컬 +X 화살표를 켜고 달과 ISS가 지구를 향하는지 확인
- [ ] 각 실행 화면을 캡처해 `images/task1.png`, `images/task2.png`, `images/task3.png`로 저장하고 이 문서에 `![Task 1](images/task1.png)` 형식으로 추가
- [ ] GitHub에 올린 뒤 Pages의 HTML·이미지·문서 링크를 열어 확인하고 저장소 주소를 사이버캠퍼스에 제출
