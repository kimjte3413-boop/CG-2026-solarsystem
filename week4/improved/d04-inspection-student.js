/* Guided inspection interface for P1-P6 and orthographic comparisons O1/O2. */
(() => {
  'use strict';

  const viewer = window.InspectionViewer;
  const root = document.querySelector('#student-ui');
  const taskList = document.querySelector('#tasks');
  const canvas = viewer.canvas;
  const model = viewer.model;
  const completed = new Set();
  let selected = null;
  let mode = 'free';
  let hideOccluders = true;
  let mapVisible = true;
  let comparisonAnswers = {};

  const style = document.createElement('style');
  style.textContent = `
    .guided { border-top:1px solid var(--d-line); padding-top:10px; }
    .guided h2 { margin:4px 0 7px; font-size:12px; color:var(--d-ink); }
    .guided .guided-status { margin:7px 0; padding:7px; background:var(--d-bg-soft); border-radius:5px; }
    .guided .guided-controls { display:flex; gap:6px; margin:6px 0; }
    .guided .guided-controls .btn { margin:0; }
    .guided .guided-task { margin:5px 0; }
    .guided .guided-task .inspection-target-button {
      display:block; width:100%; min-height:38px; margin:0; padding:7px 10px;
      border:1px solid var(--d-line-strong); border-left:3px solid var(--d-accent);
      border-radius:6px; background:var(--d-bg); color:var(--d-ink);
      box-shadow:0 1px 2px rgb(20 35 55 / 10%); cursor:pointer;
      font-size:11.5px; line-height:1.45; font-weight:600; font-family:inherit;
      text-align:left;
    }
    .guided .guided-task .inspection-target-button::after { content:"›"; float:right; color:var(--d-accent); font-size:17px; line-height:1; }
    .guided .guided-task .inspection-target-button:hover { border-color:var(--d-accent); background:var(--d-accent-soft); }
    .guided .guided-task .inspection-target-button:focus-visible { outline:2px solid var(--d-accent); outline-offset:2px; }
    .guided .guided-task .inspection-target-button[aria-current="true"] { border-color:var(--d-accent); background:var(--d-accent-soft); box-shadow:0 0 0 2px color-mix(in srgb,var(--d-accent) 18%,transparent); }
    .guided .guided-task .btn .task-check { display:inline-block; width:1.3em; font-weight:700; }
    .guided .guided-note { color:var(--d-muted); font-size:10.5px; line-height:1.5; margin:5px 0; }
    .guided label { display:block; margin:6px 0; font-size:11px; }
    .guided select { width:100%; padding:5px; border:1px solid var(--d-line-strong); border-radius:5px; background:var(--d-bg); color:var(--d-ink); font:inherit; }
    .context-badge { position:absolute; z-index:2; top:10px; right:10px; padding:5px 8px; border:1px solid var(--d-line-strong); border-radius:5px; background:color-mix(in srgb,var(--d-bg) 90%,transparent); color:var(--d-ink); font:11px/1.4 sans-serif; pointer-events:none; }
    .context-marker { position:absolute; width:12px; height:12px; margin:-6px; border:2px solid #fff; border-radius:50%; background:#e04438; box-shadow:0 0 0 2px #17212d; transform:translate(-50%,-50%); pointer-events:none; }
    .context-badge[hidden], .context-marker[hidden] { display:none; }
    @media(max-width:620px) { .guided .guided-task .inspection-target-button { min-height:36px; font-size:10.5px; padding:5px 8px; } }
  `;
  document.head.append(style);

  const contextBadge = document.createElement('div');
  contextBadge.className = 'context-badge';
  contextBadge.textContent = '전체 위치도 · 빨간 점은 선택 지점';
  const contextMarker = document.createElement('div');
  contextMarker.className = 'context-marker';
  const viewport = canvas.closest('.viewport');
  viewport.append(contextBadge, contextMarker);

  function makeButton(label, onClick, className = 'btn') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    button.addEventListener('click', () => { viewer.controls.state.actions++; });
    return button;
  }

  const panel = document.createElement('section');
  panel.className = 'guided';
  panel.setAttribute('aria-label', '관찰 안내');
  const heading = document.createElement('h2');
  heading.textContent = '관찰 안내';
  panel.append(heading);

  const progress = document.createElement('p');
  progress.className = 'guided-status';
  progress.setAttribute('aria-live', 'polite');
  panel.append(progress);

  const selection = document.createElement('p');
  selection.className = 'guided-note';
  selection.setAttribute('aria-live', 'polite');
  panel.append(selection);

  const taskButtons = new Map();
  const list = document.createElement('div');
  for (const task of model.tasks) {
    const row = document.createElement('div');
    row.className = 'guided-task';
    const button = makeButton('', () => selectTask(task.id), 'btn inspection-target-button');
    button.dataset.taskId = task.id;
    row.append(button);
    list.append(row);
    taskButtons.set(task.id, button);
  }
  panel.append(list);

  const navigation = document.createElement('div');
  navigation.className = 'guided-controls';
  navigation.append(
    makeButton('이전', () => moveSelection(-1)),
    makeButton('다음', () => moveSelection(1))
  );
  panel.append(navigation);

  const mapButton = makeButton('위치도 숨기기', () => {
    mapVisible = !mapVisible;
    updateMapVisibility();
  });
  mapButton.setAttribute('aria-pressed', 'true');
  panel.append(mapButton);

  const completeButton = makeButton('이 관찰 완료로 표시', markCompleted);
  panel.append(completeButton);

  const hideButton = makeButton('가림 구조물 숨기기');
  hideButton.setAttribute('aria-pressed', 'true');
  hideButton.addEventListener('click', () => {
    hideOccluders = !hideOccluders;
    updateHiddenParts();
    updateStatus();
  });
  panel.append(hideButton);

  const hiddenNotice = document.createElement('p');
  hiddenNotice.className = 'guided-note';
  hiddenNotice.setAttribute('aria-live', 'polite');
  panel.append(hiddenNotice);

  panel.append(makeButton('자유 회전으로 둘러보기', enterFreeExplore));
  root.append(panel);

  taskList.replaceChildren();
  taskList.setAttribute('aria-label', 'P1-P6 표지와 O1-O2 비교 관찰 과제');

  function clearHidden() {
    viewer.hidden.clear();
  }

  function updateMapVisibility() {
    contextBadge.hidden = !mapVisible;
    contextMarker.hidden = !mapVisible || !selected;
    mapButton.textContent = mapVisible ? '위치도 숨기기' : '위치도 보기';
    mapButton.setAttribute('aria-pressed', String(mapVisible));
  }

  function updateHiddenParts() {
    clearHidden();
    if (!hideOccluders || !selected) return;
    if (selected === 'P2') {
      for (const part of model.boxes) {
        if (part.id.startsWith('rail-0-') || part.id === 'rail-top-0') {
          viewer.hidden.add(part.id);
        }
      }
    } else if (selected === 'P5') {
      viewer.hidden.add('back-1');
    }
  }

  function selectedTask() {
    return model.tasks.find(task => task.id === selected) || null;
  }

  function selectTask(id) {
    selected = id;
    mode = id[0] === 'O' ? 'comparison' : 'focus';
    hideOccluders = true;
    updateHiddenParts();
    updateStatus();
  }

  function moveSelection(delta) {
    const current = model.tasks.findIndex(task => task.id === selected);
    const next = current < 0 ? 0 : (current + delta + model.tasks.length) % model.tasks.length;
    selectTask(model.tasks[next].id);
  }

  function enterFreeExplore() {
    mode = 'free';
    selected = null;
    hideOccluders = true;
    clearHidden();
    viewer.controls.home();
    updateStatus();
  }

  function markCompleted() {
    if (!selected) return;
    if (selected === 'O1'
      && (!comparisonAnswers.O1?.height || !comparisonAnswers.O1?.width)) {
      selection.textContent = '상단 높이와 폭을 각각 비교해 선택하세요.';
      return;
    }
    if (selected === 'O2' && !comparisonAnswers.O2) {
      selection.textContent = '두 장치의 돌출을 비교해 선택하세요.';
      return;
    }
    completed.add(selected);
    updateStatus();
  }

  function updateStatus() {
    const task = selectedTask();
    const count = completed.size;
    progress.textContent = `관찰 진행 ${count}/8 · ${count === 8 ? '모든 항목을 확인했습니다.' : '각 지점을 본 뒤 직접 완료 처리하세요.'}`;
    for (const [id, button] of taskButtons) {
      const item = model.tasks.find(entry => entry.id === id);
      button.replaceChildren();
      const check = document.createElement('span');
      check.className = 'task-check';
      check.textContent = completed.has(id) ? '✓' : '○';
      button.append(check, document.createTextNode(`${item.id} ${item.name}`));
      if (id === selected) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    }

    if (!task) {
      selection.textContent = '전체 위치를 보며 항목을 선택하거나 트랙볼로 자유롭게 둘러보세요.';
      completeButton.disabled = true;
      hideButton.disabled = true;
      hideButton.textContent = '선택 지점의 가림 구조물 숨기기';
      hiddenNotice.textContent = '숨긴 구조물 없음';
      updateMapVisibility();
      return;
    }

    completeButton.disabled = completed.has(task.id);
    completeButton.textContent = completed.has(task.id) ? '관찰 완료됨' : '이 관찰 완료로 표시';
    const canHideOccluders = ['P2', 'P5'].includes(task.id);
    hideButton.disabled = !canHideOccluders;
    hideButton.textContent = canHideOccluders
      ? hideOccluders ? '숨긴 구조물 복원' : '가림 구조물 숨기기'
      : '이 지점은 구조물 숨김 없음';
    hideButton.setAttribute('aria-pressed', String(canHideOccluders && hideOccluders));
    hiddenNotice.textContent = task.id[0] === 'O'
      ? '직교 비교 대상과 주변 구조를 모두 표시합니다.'
      : viewer.hidden.size === 0
        ? '숨긴 구조물 없음'
        : `현재 숨김: ${task.id === 'P2' ? '1층 전면 난간' : '본관 뒤쪽 벽'} · 복원 버튼으로 되돌릴 수 있습니다.`;
    selection.textContent = `${task.id} · ${task.name} — 화면 중앙의 큰 보기가 상세 관찰, 오른쪽 위 작은 보기가 전체 위치입니다.`;
    updateMapVisibility();
    placeContextMarker(task.position);
    renderQuestion(task);
  }

  function renderQuestion(task) {
    const oldQuestion = panel.querySelector('.comparison-question');
    if (oldQuestion) oldQuestion.remove();
    if (task.id[0] !== 'O') return;

    const question = document.createElement('label');
    question.className = 'comparison-question';
    question.append(document.createTextNode(task.task));
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '직접 관찰 후 비교 결과 선택';
    select.append(placeholder);

    if (task.id === 'O1') {
      question.append(document.createElement('br'));
      for (const [key, text] of [['height', '패널 상단 높이'], ['width', '패널 폭']]) {
        const criterion = document.createElement('label');
        criterion.textContent = `${text}: `;
        const answer = document.createElement('select');
        answer.setAttribute('aria-label', text);
        for (const [value, label] of [['', '관찰 후 선택'], ['same', '같다'], ['different', '다르다']]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          answer.append(option);
        }
        answer.value = comparisonAnswers.O1?.[key] || '';
        answer.addEventListener('change', () => {
          viewer.controls.state.actions++;
          if (answer.value) {
            comparisonAnswers.O1 = { ...comparisonAnswers.O1, [key]: answer.value };
          } else if (comparisonAnswers.O1) {
            delete comparisonAnswers.O1[key];
          }
        });
        criterion.append(answer);
        question.append(criterion);
      }
    } else {
      for (const [value, label] of [
        ['', '관찰 후 어느 쪽인지 선택'],
        ['A', '파랑 A 장치가 더 돌출된다'],
        ['B', '주황 B 장치가 더 돌출된다'],
      ]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = comparisonAnswers.O2 || '';
      select.addEventListener('change', () => {
        viewer.controls.state.actions++;
        if (select.value) comparisonAnswers.O2 = select.value;
        else delete comparisonAnswers.O2;
      });
      question.append(select);
    }
    panel.insertBefore(question, completeButton);
  }

  function placeContextMarker(position) {
    const mapHalfHeight = 11.2;
    const rect = canvas.getBoundingClientRect();
    const mapWidth = rect.width * 0.30;
    const mapHeight = rect.height * 0.30;
    const halfWidth = mapHalfHeight * mapWidth / mapHeight;
    const x = (position[0] - (3.25 - halfWidth)) / (2 * halfWidth);
    const y = (position[2] + mapHalfHeight) / (2 * mapHalfHeight);
    const pad = Math.max(6, canvas.width * 0.012);
    const xInMap = Math.max(0, Math.min(1, x));
    const yInMap = Math.max(0, Math.min(1, y));
    contextMarker.style.left = `calc(${100 - 30 - pad / rect.width * 100}% + ${xInMap * 30}%)`;
    contextMarker.style.top = `calc(${pad / rect.height * 100}% + ${yInMap * 30}%)`;
  }

  function focusCamera(task) {
    const poi = model.poi.find(item => item.id === task.id);
    if (!poi) return null;
    const normal = [Math.sin(poi.yaw), 0, Math.cos(poi.yaw)];
    const fov = 36;
    const rect = canvas.getBoundingClientRect();
    const aspect = Math.max(0.5, rect.width / Math.max(rect.height, 1));
    const verticalDistance = poi.size[1] / (2 * Math.tan(fov * Math.PI / 360) * 0.72);
    const horizontalDistance = poi.size[0] / (2 * Math.tan(fov * Math.PI / 360) * aspect * 0.72);
    const distance = Math.max(0.72, verticalDistance, horizontalDistance);
    return {
      eye: poi.position.map((value, index) => value + normal[index] * distance),
      target: [...poi.position],
      up: [0, 1, 0],
      fov,
      near: 0.02,
      far: 120,
    };
  }

  function comparisonCamera(task) {
    const comparison = model.comparisons.find(item => item.id === task.id);
    const horizontalAxis = task.id === 'O1' ? 0 : 2;
    const bounds = comparison.members.map(id => model.boxes.find(part => part.id === id));
    const span = axis => {
      let min = Infinity;
      let max = -Infinity;
      for (const part of bounds) {
        const half = part.size[axis] / 2;
        min = Math.min(min, part.position[axis] - half);
        max = Math.max(max, part.position[axis] + half);
      }
      return max - min;
    };
    const rect = canvas.getBoundingClientRect();
    const aspect = Math.max(0.5, rect.width / Math.max(rect.height, 1));
    const halfHeight = Math.max(span(1) / 2, span(horizontalAxis) / (2 * aspect)) * 1.15;
    const distance = 22;
    const eye = comparison.position.map(
      (value, index) => value - comparison.viewDirection[index] * distance
    );
    return {
      eye,
      target: [...comparison.position],
      up: [0, 1, 0],
      orthographic: true,
      halfHeight,
      near: 0.02,
      far: 180,
    };
  }

  function drawContextMap() {
    if (!mapVisible) return;
    const w = Math.max(1, Math.round(canvas.width * 0.30));
    const h = Math.max(1, Math.round(canvas.height * 0.30));
    const pad = Math.max(6, Math.round(canvas.width * 0.012));
    const x = canvas.width - w - pad;
    const y = canvas.height - h - pad;
    viewer.drawView({
      eye: [3.25, 40, 0],
      target: [3.25, 4, 0],
      up: [0, 0, -1],
      orthographic: true,
      halfHeight: 11.2,
      near: 0.02,
      far: 180,
    }, [x, y, w, h]);
  }

  viewer.render = () => {
    const task = selectedTask();
    if (mode === 'focus' && task) {
      viewer.drawView(focusCamera(task));
    } else if (mode === 'comparison' && task) {
      viewer.drawView(comparisonCamera(task));
    } else {
      viewer.drawView(viewer.controls.camera());
    }
    drawContextMap();
  };

  for (const task of model.tasks) {
    taskButtons.get(task.id).addEventListener('dblclick', () => selectTask(task.id));
  }
  document.querySelector('#home').addEventListener('click', enterFreeExplore);
  canvas.addEventListener('dblclick', () => {
    viewer.controls.state.actions++;
    enterFreeExplore();
  });

  updateStatus();
})();
