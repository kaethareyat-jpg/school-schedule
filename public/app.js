const payloadEditor = document.getElementById('payloadEditor');
const runBtn = document.getElementById('runBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const clearBtn = document.getElementById('clearBtn');
const scheduleView = document.getElementById('scheduleView');
const unplacedView = document.getElementById('unplacedView');
const successStat = document.getElementById('successStat');
const placedStat = document.getElementById('placedStat');
const timeStat = document.getElementById('timeStat');
const resultSummary = document.getElementById('resultSummary');
const statusLabel = document.getElementById('statusLabel');
const serverLabel = document.getElementById('serverLabel');

function setStatus(text, tone = 'good') {
  statusLabel.textContent = text;
  statusLabel.dataset.tone = tone;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function groupByDay(entries) {
  return entries.reduce((map, entry) => {
    const items = map.get(entry.day) ?? [];
    items.push(entry);
    map.set(entry.day, items);
    return map;
  }, new Map());
}

function renderSchedule(entries) {
  if (!entries || entries.length === 0) {
    scheduleView.className = 'schedule-view empty';
    scheduleView.textContent = 'ยังไม่มีข้อมูล';
    return;
  }

  const byDay = groupByDay(entries);
  const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  scheduleView.className = 'schedule-view';
  scheduleView.innerHTML = dayOrder
    .filter((day) => byDay.has(day))
    .map((day) => {
      const items = byDay.get(day).slice().sort((a, b) => a.period - b.period);
      return `
        <section class="day-card">
          <h4>${day}</h4>
          ${items
            .map(
              (entry) => `
                <div class="entry">
                  <div class="entry-top">
                    <span>${entry.subjectId}</span>
                    <span class="pill good">คาบ ${entry.period}</span>
                  </div>
                  <div class="entry-meta">
                    ห้อง ${entry.classroomId} · ห้องเรียน ${entry.classGroup} · ครู ${entry.teacherIds.join(', ')}
                  </div>
                </div>
              `
            )
            .join('')}
        </section>
      `;
    })
    .join('');
}

function renderUnplaced(items) {
  if (!items || items.length === 0) {
    unplacedView.className = 'unplaced-view empty';
    unplacedView.textContent = 'ยังไม่มีข้อมูล';
    return;
  }

  unplacedView.className = 'unplaced-view';
  unplacedView.innerHTML = items
    .map(
      (item) => `
        <div class="unplaced-item">
          <strong>${item.subjectName}</strong> · ${item.classGroup}
          <div>เหลืออีก ${item.remainingPeriods} คาบ</div>
          <div>${item.reason}</div>
        </div>
      `
    )
    .join('');
}

async function loadSample() {
  setStatus('กำลังโหลดตัวอย่าง', 'warn');
  const response = await fetch('/sample-data');
  const payload = await response.json();
  payloadEditor.value = prettyJson(payload);
  setStatus('พร้อมใช้งาน', 'good');
}

async function runScheduler() {
  try {
    const payload = JSON.parse(payloadEditor.value);
    setStatus('กำลังสร้างตาราง', 'warn');
    const response = await fetch('/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error ?? 'เกิดข้อผิดพลาด');
    }

    successStat.textContent = result.success ? 'สำเร็จ' : 'ไม่ครบ';
    placedStat.textContent = `${result.totalPlaced} / ${result.totalRequired}`;
    timeStat.textContent = `${result.executionTimeMs} ms`;
    resultSummary.textContent = result.success
      ? 'สร้างตารางได้ครบ'
      : `สร้างได้ ${result.totalPlaced} จาก ${result.totalRequired}`;
    renderSchedule(result.schedules);
    renderUnplaced(result.unplacedAssignments);
    setStatus('สร้างตารางเรียบร้อย', result.success ? 'good' : 'warn');
  } catch (error) {
    setStatus('ข้อมูลไม่ถูกต้อง', 'bad');
    resultSummary.textContent = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
    scheduleView.className = 'schedule-view empty';
    scheduleView.textContent = 'ไม่สามารถแสดงผลได้';
    unplacedView.className = 'unplaced-view empty';
    unplacedView.textContent = 'ไม่สามารถแสดงผลได้';
  }
}

function clearOutput() {
  successStat.textContent = '-';
  placedStat.textContent = '-';
  timeStat.textContent = '-';
  resultSummary.textContent = 'ยังไม่มีการสร้างตาราง';
  scheduleView.className = 'schedule-view empty';
  scheduleView.textContent = 'ยังไม่มีข้อมูล';
  unplacedView.className = 'unplaced-view empty';
  unplacedView.textContent = 'ยังไม่มีข้อมูล';
  setStatus('พร้อมใช้งาน', 'good');
}

async function init() {
  try {
    const health = await fetch('/health');
    const json = await health.json();
    serverLabel.textContent = json.ok ? 'ออนไลน์' : 'ไม่พร้อมใช้งาน';
  } catch {
    serverLabel.textContent = 'เชื่อมต่อไม่ได้';
  }

  await loadSample();
  await runScheduler();
}

loadSampleBtn.addEventListener('click', loadSample);
runBtn.addEventListener('click', runScheduler);
clearBtn.addEventListener('click', clearOutput);

init();
