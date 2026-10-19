const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
const defaultState = {
  settings: { periodsPerDay: 6, schoolName: 'โรงเรียนของคุณ' },
  personnel: [
    { name: 'ครูสมใจ ใจดี', group: 'คณิตศาสตร์' },
    { name: 'ครูวิชัย พูนผล', group: 'วิทยาศาสตร์' },
    { name: 'ครูสุดา แสงทอง', group: 'ภาษาไทย' },
  ],
  blocks: [
    { id: 'b1', teacherName: 'ครูสมใจ ใจดี', lessonName: 'คณิตศาสตร์พื้นฐาน', classGroup: 'ม.2/1', room: '302', periods: 2 },
    { id: 'b2', teacherName: 'ครูวิชัย พูนผล', lessonName: 'วิทยาศาสตร์', classGroup: 'ม.2/1', room: 'Lab 1', periods: 2 },
    { id: 'b3', teacherName: 'ครูสุดา แสงทอง', lessonName: 'ภาษาไทย', classGroup: 'ม.1/2', room: '201', periods: 1 },
  ],
  placements: [
    { blockId: 'b1', day: 0, period: 0 },
    { blockId: 'b2', day: 1, period: 1 },
    { blockId: 'b3', day: 2, period: 2 },
  ],
  rooms: ['201', '302', 'Lab 1', 'ห้องดนตรี'],
};

const stored = localStorage.getItem('teachflow-state');
const state = stored ? JSON.parse(stored) : defaultState;
let selectedTeacher = 'all';
let currentView = 'dashboard';
let draggedBlockId = null;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const save = () => localStorage.setItem('teachflow-state', JSON.stringify(state));
const blockById = (id) => state.blocks.find((block) => block.id === id);
const placedBlockIds = () => new Set(state.placements.map((item) => item.blockId));

function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 3200);
}

function renderMetrics() {
  const placed = state.placements.length;
  const totalPeriods = state.blocks.reduce((sum, block) => sum + Number(block.periods || 1), 0);
  $('#metrics').innerHTML = [
    ['บุคลากรทั้งหมด', state.personnel.length, 'คน'],
    ['รายวิชาที่จัดการ', new Set(state.blocks.map((block) => block.lessonName)).size, 'รายวิชา'],
    ['คาบที่วางแล้ว', placed, `จาก ${totalPeriods} คาบ`],
    ['รายการรอดำเนินการ', Math.max(0, state.blocks.length - placed), 'บล็อก'],
  ].map(([label, value, suffix]) => `<article class="metric-card"><p>${label}</p><strong>${value}</strong><span>${suffix}</span></article>`).join('');
}

function renderDashboard() {
  renderMetrics();
  const todays = state.placements.filter((placement) => placement.day === 0).map((placement) => ({ ...placement, block: blockById(placement.blockId) }));
  $('#todaySchedule').innerHTML = todays.length ? todays.map(({ period, block }) => `<div class="today-item"><span class="period-badge">คาบ ${period + 1}</span><div><strong>${escapeHtml(block.lessonName)}</strong><p>${escapeHtml(block.teacherName)} · ${escapeHtml(block.classGroup)}</p></div><span>${escapeHtml(block.room || 'ไม่ระบุห้อง')}</span></div>`).join('') : '<div class="empty-state">วันนี้ยังไม่มีคาบสอนที่จัดไว้</div>';
  const pending = state.blocks.filter((block) => !placedBlockIds().has(block.id));
  $('#conflictList').innerHTML = pending.length ? pending.slice(0, 4).map((block) => `<div class="notice warning"><span>!</span><div><strong>ยังไม่ได้วางคาบเรียน</strong><p>${escapeHtml(block.lessonName)} · ${escapeHtml(block.teacherName)}</p></div></div>`).join('') : '<div class="notice success"><span>✓</span><div><strong>ตารางเรียบร้อยดี</strong><p>ไม่มีรายการที่รอการจัดการ</p></div></div>';
}

function renderTeacherOptions() {
  const names = [...new Set([...state.personnel.map((person) => person.name), ...state.blocks.map((block) => block.teacherName)])];
  $('#teacherOptions').innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
  $('#teacherFilter').innerHTML = `<option value="all">ครูทุกคน</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
  $('#teacherFilter').value = selectedTeacher;
}

function blockCard(block, compact = false) {
  const placed = placedBlockIds().has(block.id);
  return `<article class="lesson-card ${placed ? 'placed' : ''}" draggable="${compact ? 'false' : 'true'}" data-block-id="${block.id}"><div class="lesson-card-top"><span class="subject-dot"></span><strong>${escapeHtml(block.lessonName)}</strong>${!compact ? `<button class="delete-block" data-delete-block="${block.id}" aria-label="ลบบล็อก">×</button>` : ''}</div><p>${escapeHtml(block.teacherName)}</p><small>${escapeHtml(block.classGroup)}${block.room ? ` · ห้อง ${escapeHtml(block.room)}` : ''} · ${block.periods} คาบ</small>${placed && !compact ? '<span class="placed-label">วางแล้ว</span>' : ''}</article>`;
}

function conflictAt(block, day, period) {
  const occupying = state.placements.map((placement) => ({ placement, block: blockById(placement.blockId) })).filter((item) => item.placement.day === day && item.placement.period === period && item.block);
  const sameTeacher = occupying.find((item) => item.block.teacherName === block.teacherName);
  if (sameTeacher) return `ครู ${block.teacherName} มีสอนอยู่แล้วในคาบนี้`;
  const sameClass = occupying.find((item) => item.block.classGroup === block.classGroup);
  if (sameClass) return `ชั้น ${block.classGroup} มีเรียนอยู่แล้วในคาบนี้`;
  const sameRoom = block.room && occupying.find((item) => item.block.room && item.block.room === block.room);
  if (sameRoom) return `ห้อง ${block.room} ถูกใช้งานอยู่แล้วในคาบนี้`;
  return null;
}

function renderSchedule() {
  renderTeacherOptions();
  const visibleBlocks = state.blocks.filter((block) => selectedTeacher === 'all' || block.teacherName === selectedTeacher);
  const unplaced = visibleBlocks.filter((block) => !placedBlockIds().has(block.id));
  $('#lessonPool').innerHTML = unplaced.length ? unplaced.map((block) => blockCard(block)).join('') : '<div class="empty-state small">วางบล็อกครบแล้ว<br />เพิ่มบล็อกใหม่ได้จากปุ่มด้านบน</div>';
  $('#poolCount').textContent = `${unplaced.length} บล็อกที่ยังไม่วาง`;
  const periods = Number(state.settings.periodsPerDay);
  const mode = $('#viewMode').value;
  const dayIndexes = mode === 'day' ? [0] : days.map((_, index) => index);
  const header = dayIndexes.map((day) => `<th>${days[day]}</th>`).join('');
  const body = Array.from({ length: periods }, (_, period) => {
    const cells = dayIndexes.map((day) => {
      const placement = state.placements.find((item) => item.day === day && item.period === period);
      const block = placement && blockById(placement.blockId);
      const hiddenByFilter = block && selectedTeacher !== 'all' && block.teacherName !== selectedTeacher;
      const content = block && !hiddenByFilter ? blockCard(block, true) : '';
      return `<td class="drop-cell ${block && !hiddenByFilter ? 'occupied' : ''}" data-day="${day}" data-period="${period}">${content}</td>`;
    }).join('');
    return `<tr><th class="period-cell">คาบ ${period + 1}<small>${period === 0 ? '08:30' : ''}</small></th>${cells}</tr>`;
  }).join('');
  $('#timetable').innerHTML = `<div class="table-scroll"><table class="timetable"><thead><tr><th>เวลา</th>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
  wireDragAndDrop();
}

function wireDragAndDrop() {
  document.querySelectorAll('[data-block-id][draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', () => { draggedBlockId = card.dataset.blockId; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { draggedBlockId = null; card.classList.remove('dragging'); });
  });
  document.querySelectorAll('.drop-cell').forEach((cell) => {
    cell.addEventListener('dragover', (event) => { event.preventDefault(); if (!cell.classList.contains('occupied')) cell.classList.add('drag-over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', (event) => {
      event.preventDefault(); cell.classList.remove('drag-over');
      if (!draggedBlockId || cell.classList.contains('occupied')) return;
      const block = blockById(draggedBlockId); const day = Number(cell.dataset.day); const period = Number(cell.dataset.period);
      const reason = conflictAt(block, day, period);
      if (reason) { $('#scheduleConflict').textContent = `วางไม่ได้: ${reason}`; $('#scheduleConflict').classList.remove('hidden'); cell.classList.add('invalid'); setTimeout(() => cell.classList.remove('invalid'), 700); return; }
      state.placements.push({ blockId: block.id, day, period }); save(); $('#scheduleConflict').classList.add('hidden'); renderSchedule(); renderDashboard(); showToast(`วาง ${block.lessonName} ในวัน${days[day]} คาบ ${period + 1} แล้ว`);
    });
  });
}

function renderPersonnel() {
  const query = $('#personSearch').value.toLowerCase();
  const people = state.personnel.filter((person) => `${person.name} ${person.group}`.toLowerCase().includes(query));
  $('#personnelTotal').textContent = `${people.length} คน`;
  $('#personnelTable').innerHTML = people.map((person) => { const count = state.placements.filter((placement) => blockById(placement.blockId)?.teacherName === person.name).length; return `<tr><td><strong>${escapeHtml(person.name)}</strong></td><td>${escapeHtml(person.group)}</td><td>${count} คาบ</td><td><span class="status ready">พร้อมใช้งาน</span></td><td class="table-actions"><button class="text-button view-teacher" data-teacher="${escapeHtml(person.name)}">ดูตาราง</button><button class="text-button" data-edit-person="${escapeHtml(person.name)}">แก้ไข</button><button class="text-button danger-text" data-delete-person="${escapeHtml(person.name)}">ลบ</button></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty-cell">ไม่พบข้อมูลบุคลากร</td></tr>';
}

function renderSubjects() {
  $('#subjectTable').innerHTML = state.blocks.map((block, index) => `<tr><td>ท${String(index + 1).padStart(3, '0')}</td><td><strong>${escapeHtml(block.lessonName)}</strong></td><td>${escapeHtml(block.classGroup)}</td><td>${block.periods} คาบ</td><td>${escapeHtml(block.teacherName)}</td><td class="table-actions"><button class="text-button" data-edit-block="${block.id}">แก้ไข</button><button class="text-button danger-text" data-delete-block="${block.id}">ลบ</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">ยังไม่มีรายวิชา</td></tr>';
}

function renderRooms() {
  const rooms = [...new Set([...state.rooms, ...state.blocks.map((block) => block.room).filter(Boolean)])];
  $('#roomCards').innerHTML = rooms.map((room) => { const uses = state.placements.filter((placement) => blockById(placement.blockId)?.room === room).length; return `<article class="room-card"><span class="room-icon">⌂</span><h3>ห้อง ${escapeHtml(room)}</h3><p>${uses ? `มีใช้งาน ${uses} คาบในตาราง` : 'ยังไม่มีคาบที่จองไว้'}</p><div class="card-actions"><span class="status ${uses ? 'busy' : 'ready'}">${uses ? 'มีการใช้งาน' : 'ว่าง'}</span><span><button class="text-button" data-edit-room="${escapeHtml(room)}">แก้ไข</button><button class="text-button danger-text" data-delete-room="${escapeHtml(room)}">ลบ</button></span></div></article>`; }).join('');
}

function renderReports() {
  $('#reportCards').innerHTML = state.personnel.map((person) => `<article class="report-card"><div class="report-avatar">${escapeHtml(person.name.charAt(3) || person.name.charAt(0))}</div><div><h3>${escapeHtml(person.name)}</h3><p>${escapeHtml(person.group)} · ${state.placements.filter((p) => blockById(p.blockId)?.teacherName === person.name).length} คาบ</p></div><button class="text-button view-teacher" data-teacher="${escapeHtml(person.name)}">เปิดตาราง</button></article>`).join('');
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((element) => element.classList.toggle('active', element.id === `${view}View`));
  document.querySelectorAll('.nav-item[data-view]').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
  const titles = { dashboard: 'ภาพรวมตารางสอน', schedule: 'ตารางสอนบุคลากร', personnel: 'จัดการบุคลากร', subjects: 'จัดการรายวิชา', rooms: 'จัดการห้องเรียน', auto: 'จัดตารางอัตโนมัติ', reports: 'รายงาน', settings: 'ตั้งค่า' };
  $('#pageTitle').textContent = titles[view];
  $('#sidebar').classList.remove('open');
  if (view === 'schedule') renderSchedule();
}

function openModal() { $('#modalBackdrop').classList.remove('hidden'); $('#lessonForm [name="teacherName"]').focus(); }
function closeModal() { $('#modalBackdrop').classList.add('hidden'); $('#lessonForm').reset(); delete $('#lessonForm').dataset.editBlock; }

function openBlockEditor(block) {
  $('#modalTitle').textContent = 'แก้ไขคาบสอน';
  const form = $('#lessonForm');
  form.dataset.editBlock = block.id;
  form.teacherName.value = block.teacherName;
  form.lessonName.value = block.lessonName;
  form.classGroup.value = block.classGroup;
  form.room.value = block.room || '';
  form.periods.value = block.periods;
  $('#modalBackdrop').classList.remove('hidden');
  form.lessonName.focus();
}

async function runAutoSchedule() {
  const button = $('#autoScheduleBtn'); button.disabled = true; button.textContent = 'กำลังจัดตาราง...';
  const engineDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  const assignments = state.blocks.map((block) => ({ subjectId: block.id, subjectName: block.lessonName, classGroup: block.classGroup, classroomId: block.room || `room-${block.id}`, teacherIds: [block.teacherName], periodsPerWeek: Number(block.periods) }));
  try {
    const response = await fetch('/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignments, days, periodsPerDay: Number(state.settings.periodsPerDay) }) });
    if (!response.ok) throw new Error('ไม่สามารถจัดตารางได้');
    const result = await response.json();
    if (Array.isArray(result.schedules)) {
      state.placements = result.schedules.map((item) => ({ blockId: item.subjectId, day: engineDays.indexOf(item.day), period: Number(item.period) - 1 })).filter((item) => item.blockId && item.day >= 0 && item.period >= 0);
      save(); renderSchedule(); renderDashboard();
    }
    $('#autoResult').className = 'auto-result'; $('#autoResult').innerHTML = `<strong>จัดตารางเสร็จแล้ว</strong><p>ระบบวางตารางได้ ${state.placements.length} คาบ โปรดตรวจสอบผลลัพธ์ก่อนนำไปใช้งานจริง</p>`;
    showToast('ระบบจัดตารางอัตโนมัติเรียบร้อยแล้ว');
  } catch (error) {
    $('#autoResult').className = 'auto-result error'; $('#autoResult').textContent = 'ยังจัดตารางอัตโนมัติไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง';
  } finally { button.disabled = false; button.textContent = 'เริ่มจัดตารางอัตโนมัติ'; }
}

function openPersonModal(person = null) {
  const form = $('#personForm');
  $('#personModalTitle').textContent = person ? 'แก้ไขบุคลากร' : 'เพิ่มบุคลากร';
  form.reset();
  if (person) { form.dataset.originalName = person.name; form.name.value = person.name; form.group.value = person.group; } else delete form.dataset.originalName;
  $('#personModalBackdrop').classList.remove('hidden');
  form.name.focus();
}
function closePersonModal() { $('#personModalBackdrop').classList.add('hidden'); $('#personForm').reset(); delete $('#personForm').dataset.originalName; }
function addPersonnel() { openPersonModal(); }
function addRoom() { const room = prompt('ชื่อหรือหมายเลขห้อง'); if (!room?.trim()) return; state.rooms.push(room.trim()); save(); renderRooms(); showToast('เพิ่มห้องเรียนแล้ว'); }
function editPersonnel(oldName) { const person = state.personnel.find((item) => item.name === oldName); if (person) openPersonModal(person); }
function deletePersonnel(name) { const inUse = state.blocks.some((block) => block.teacherName === name); const message = inUse ? `ครู ${name} มีคาบสอนที่เกี่ยวข้องอยู่ ต้องการลบเฉพาะรายชื่อครูหรือไม่? คาบสอนจะยังคงอยู่` : `ต้องการลบ ${name} หรือไม่?`; if (!confirm(message)) return; state.personnel = state.personnel.filter((person) => person.name !== name); if (selectedTeacher === name) selectedTeacher = 'all'; save(); renderAll(); showToast('ลบรายชื่อบุคลากรแล้ว'); }
function editRoom(oldRoom) { const room = prompt('ชื่อหรือหมายเลขห้อง', oldRoom); if (!room?.trim()) return; const newRoom = room.trim(); state.rooms = state.rooms.map((item) => item === oldRoom ? newRoom : item); state.blocks.forEach((block) => { if (block.room === oldRoom) block.room = newRoom; }); save(); renderAll(); showToast('แก้ไขห้องเรียนแล้ว'); }
function deleteRoom(room) { const inUse = state.blocks.some((block) => block.room === room); const message = inUse ? `ห้อง ${room} ถูกใช้งานในคาบสอน ต้องการลบออกจากรายการห้องหรือไม่? คาบสอนเดิมจะยังแสดงชื่อห้องนี้` : `ต้องการลบห้อง ${room} หรือไม่?`; if (!confirm(message)) return; state.rooms = state.rooms.filter((item) => item !== room); save(); renderRooms(); showToast('ลบห้องเรียนแล้ว'); }
function renderAll() { renderDashboard(); renderSchedule(); renderPersonnel(); renderSubjects(); renderRooms(); renderReports(); }

document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-view]'); if (nav) switchView(nav.dataset.view);
  const go = event.target.closest('[data-go]'); if (go) switchView(go.dataset.go);
  if (event.target.closest('#addBlockBtn') || event.target.closest('#subjectQuickAdd')) { $('#modalTitle').textContent = 'เพิ่มคาบสอน'; delete $('#lessonForm').dataset.editBlock; openModal(); }
  if (event.target.closest('#modalClose') || event.target.closest('#modalCancel')) closeModal();
  if (event.target.closest('#personModalClose') || event.target.closest('#personModalCancel')) closePersonModal();
  if (event.target === $('#modalBackdrop')) closeModal();
  if (event.target === $('#personModalBackdrop')) closePersonModal();
  const deleteButton = event.target.closest('[data-delete-block]'); if (deleteButton) { const id = deleteButton.dataset.deleteBlock; const block = blockById(id); if (!confirm(`ต้องการลบ ${block?.lessonName || 'บล็อกคาบสอน'} หรือไม่?`)) return; state.blocks = state.blocks.filter((block) => block.id !== id); state.placements = state.placements.filter((placement) => placement.blockId !== id); save(); renderAll(); showToast('ลบบล็อกคาบสอนแล้ว'); }
  const editBlock = event.target.closest('[data-edit-block]'); if (editBlock) openBlockEditor(blockById(editBlock.dataset.editBlock));
  const editPerson = event.target.closest('[data-edit-person]'); if (editPerson) editPersonnel(editPerson.dataset.editPerson);
  const deletePerson = event.target.closest('[data-delete-person]'); if (deletePerson) deletePersonnel(deletePerson.dataset.deletePerson);
  const editRoomButton = event.target.closest('[data-edit-room]'); if (editRoomButton) editRoom(editRoomButton.dataset.editRoom);
  const deleteRoomButton = event.target.closest('[data-delete-room]'); if (deleteRoomButton) deleteRoom(deleteRoomButton.dataset.deleteRoom);
  const teacher = event.target.closest('.view-teacher'); if (teacher) { selectedTeacher = teacher.dataset.teacher; switchView('schedule'); }
  if (event.target.closest('#addPersonBtn')) addPersonnel(); if (event.target.closest('#addRoomBtn')) addRoom();
  if (event.target.closest('#autoScheduleBtn')) runAutoSchedule();
  if (event.target.closest('#printBtn')) window.print();
  if (event.target.closest('#menuToggle')) $('#sidebar').classList.toggle('open');
  if (event.target.closest('#shareBtn')) { const url = location.href; try { await navigator.clipboard.writeText(url); showToast('คัดลอกลิงก์แล้ว'); } catch { showToast(`ลิงก์สำหรับเปิด: ${url}`, 'info'); } }
});

$('#lessonForm').addEventListener('submit', (event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const teacherName = form.get('teacherName').trim(); const values = { teacherName, lessonName: form.get('lessonName').trim(), classGroup: form.get('classGroup').trim(), room: form.get('room').trim(), periods: Number(form.get('periods')) }; const existing = formElement.dataset.editBlock && blockById(formElement.dataset.editBlock); if (existing) Object.assign(existing, values); else state.blocks.push({ id: `b${Date.now()}`, ...values }); if (!state.personnel.some((person) => person.name === teacherName)) state.personnel.push({ name: teacherName, group: 'ยังไม่ระบุกลุ่มสาระ' }); if (values.room && !state.rooms.includes(values.room)) state.rooms.push(values.room); save(); closeModal(); delete formElement.dataset.editBlock; renderAll(); showToast(existing ? 'แก้ไขคาบสอนแล้ว' : 'สร้างบล็อกคาบสอนแล้ว ลากไปวางในตารางได้เลย'); });
$('#personForm').addEventListener('submit', (event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const name = form.get('name').trim(); const group = form.get('group').trim() || 'ทั่วไป'; const oldName = formElement.dataset.originalName; const existing = oldName && state.personnel.find((person) => person.name === oldName); if (existing) { existing.name = name; existing.group = group; state.blocks.forEach((block) => { if (block.teacherName === oldName) block.teacherName = name; }); if (selectedTeacher === oldName) selectedTeacher = name; } else if (!state.personnel.some((person) => person.name === name)) { state.personnel.push({ name, group }); } else { showToast('มีรายชื่อบุคลากรนี้อยู่แล้ว', 'info'); return; } save(); closePersonModal(); renderAll(); showToast(existing ? 'แก้ไขข้อมูลบุคลากรแล้ว' : 'เพิ่มบุคลากรแล้ว'); });
$('#teacherFilter').addEventListener('change', (event) => { selectedTeacher = event.target.value; renderSchedule(); });
$('#viewMode').addEventListener('change', renderSchedule);
$('#personSearch').addEventListener('input', renderPersonnel);
$('#saveSettings').addEventListener('click', () => { state.settings.periodsPerDay = Number($('#periodsPerDayInput').value); state.settings.schoolName = $('#schoolNameInput').value.trim() || 'โรงเรียนของคุณ'; $('#pageEyebrow').textContent = state.settings.schoolName; save(); renderSchedule(); showToast('บันทึกการตั้งค่าแล้ว'); });

$('#periodsPerDayInput').value = state.settings.periodsPerDay;
$('#schoolNameInput').value = state.settings.schoolName;
$('#pageEyebrow').textContent = state.settings.schoolName;
renderDashboard(); renderSchedule(); renderPersonnel(); renderSubjects(); renderRooms(); renderReports();
