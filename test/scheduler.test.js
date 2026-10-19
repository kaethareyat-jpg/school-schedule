import assert from 'node:assert/strict';
import { AutoSchedulerEngine, createTimeSlots } from '../src/autoScheduler.js';
import { DayOfWeek } from '../src/types.js';

function buildEngine({ assignments, constraints = [], days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY], periodsPerDay = 4, options = {} }) {
  const timeSlots = createTimeSlots(days, periodsPerDay);
  return new AutoSchedulerEngine(timeSlots, assignments, constraints, {
    searchTimeLimitMs: 250,
    preferEarlierPeriods: true,
    allowSameSubjectMultiplePerDay: false,
    ...options,
  });
}

function groupCount(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function assertNoDuplicateSlots(result) {
  const roomSlots = new Set();
  const classSlots = new Set();
  const teacherSlots = new Set();

  for (const entry of result.schedules) {
    const roomKey = `${entry.classroomId}_${entry.day}_${entry.period}`;
    const classKey = `${entry.classGroup}_${entry.day}_${entry.period}`;
    assert.ok(!roomSlots.has(roomKey), `duplicate room slot: ${roomKey}`);
    assert.ok(!classSlots.has(classKey), `duplicate class slot: ${classKey}`);
    roomSlots.add(roomKey);
    classSlots.add(classKey);

    for (const teacherId of entry.teacherIds) {
      const teacherKey = `${teacherId}_${entry.day}_${entry.period}`;
      assert.ok(!teacherSlots.has(teacherKey), `duplicate teacher slot: ${teacherKey}`);
      teacherSlots.add(teacherKey);
    }
  }
}

function testSchedulesAllPeriodsWhenFeasible() {
  const engine = buildEngine({
    assignments: [
      {
        subjectId: 'math',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        classGroup: 'M.1/1',
        periodsPerWeek: 3,
        teacherIds: ['t1'],
        classroomId: 'room-a',
      },
      {
        subjectId: 'thai',
        subjectCode: 'THAI',
        subjectName: 'Thai',
        classGroup: 'M.1/2',
        periodsPerWeek: 2,
        teacherIds: ['t2'],
        classroomId: 'room-b',
      },
    ],
  });

  const result = engine.run();
  assert.equal(result.success, true);
  assert.equal(result.totalPlaced, result.totalRequired);
  assert.equal(result.unplacedAssignments.length, 0);
  assertNoDuplicateSlots(result);
}

function testTeacherUnavailableSlotsAreRespected() {
  const engine = buildEngine({
    assignments: [
      {
        subjectId: 'science',
        subjectCode: 'SCI',
        subjectName: 'Science',
        classGroup: 'M.2/1',
        periodsPerWeek: 2,
        teacherIds: ['t1'],
        classroomId: 'lab',
      },
    ],
    constraints: [
      {
        teacherId: 't1',
        unavailableSlots: new Set(['MONDAY_1']),
      },
    ],
  });

  const result = engine.run();
  assert.equal(result.success, true);
  assert.ok(result.schedules.every((entry) => !(entry.teacherIds.includes('t1') && entry.day === DayOfWeek.MONDAY && entry.period === 1)));
}

function testTeacherMaxPeriodsPerDayIsRespected() {
  const engine = buildEngine({
    assignments: [
      {
        subjectId: 'english',
        subjectCode: 'ENG',
        subjectName: 'English',
        classGroup: 'M.3/1',
        periodsPerWeek: 3,
        teacherIds: ['t1'],
        classroomId: 'room-c',
      },
    ],
    constraints: [
      {
        teacherId: 't1',
        unavailableSlots: new Set(),
        maxPeriodsPerDay: 1,
      },
    ],
  });

  const result = engine.run();
  assert.equal(result.success, true);

  const perTeacherDay = groupCount(result.schedules, (entry) => `${entry.teacherIds[0]}_${entry.day}`);
  for (const count of perTeacherDay.values()) {
    assert.ok(count <= 1, 'teacher exceeded max periods per day');
  }
}

function testSameSubjectIsNotScheduledTwicePerDayByDefault() {
  const engine = buildEngine({
    assignments: [
      {
        subjectId: 'history',
        subjectCode: 'HIS',
        subjectName: 'History',
        classGroup: 'M.4/1',
        periodsPerWeek: 4,
        teacherIds: ['t1'],
        classroomId: 'room-d',
      },
    ],
  });

  const result = engine.run();
  assert.equal(result.success, true);

  const perDay = groupCount(result.schedules, (entry) => `${entry.subjectId}_${entry.classGroup}_${entry.day}`);
  for (const count of perDay.values()) {
    assert.ok(count <= 1, 'same subject was placed more than once in a day');
  }
}

function testRoomAndClassConflictsNeverOverlap() {
  const engine = buildEngine({
    assignments: [
      {
        subjectId: 'art-a',
        subjectCode: 'ART',
        subjectName: 'Art A',
        classGroup: 'M.5/1',
        periodsPerWeek: 2,
        teacherIds: ['t1'],
        classroomId: 'shared-room',
      },
      {
        subjectId: 'art-b',
        subjectCode: 'ART',
        subjectName: 'Art B',
        classGroup: 'M.5/2',
        periodsPerWeek: 2,
        teacherIds: ['t2'],
        classroomId: 'shared-room',
      },
    ],
  });

  const result = engine.run();
  assert.equal(result.success, true);
  assertNoDuplicateSlots(result);
}

const tests = [
  testSchedulesAllPeriodsWhenFeasible,
  testTeacherUnavailableSlotsAreRespected,
  testTeacherMaxPeriodsPerDayIsRespected,
  testSameSubjectIsNotScheduledTwicePerDayByDefault,
  testRoomAndClassConflictsNeverOverlap,
];

let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
  console.log(`ok ${test.name}`);
}

console.log(`\n${passed}/${tests.length} tests passed`);
