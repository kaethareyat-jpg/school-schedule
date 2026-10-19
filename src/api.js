import { AutoSchedulerEngine, createTimeSlots } from './autoScheduler.js';
import { DayOfWeek } from './types.js';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function buildSamplePayload() {
  return {
    days: [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
    ],
    periodsPerDay: 6,
    assignments: [
      {
        subjectId: 'math-01',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        classGroup: 'M.2/1',
        periodsPerWeek: 5,
        teacherIds: ['t1'],
        classroomId: 'room-a',
      },
      {
        subjectId: 'thai-01',
        subjectCode: 'THAI',
        subjectName: 'Thai Language',
        classGroup: 'M.2/1',
        periodsPerWeek: 4,
        teacherIds: ['t2'],
        classroomId: 'room-a',
      },
      {
        subjectId: 'science-01',
        subjectCode: 'SCI',
        subjectName: 'Science',
        classGroup: 'M.2/1',
        periodsPerWeek: 3,
        teacherIds: ['t3'],
        classroomId: 'room-lab',
      },
      {
        subjectId: 'english-01',
        subjectCode: 'ENG',
        subjectName: 'English',
        classGroup: 'M.2/2',
        periodsPerWeek: 4,
        teacherIds: ['t4'],
        classroomId: 'room-b',
      },
      {
        subjectId: 'pe-01',
        subjectCode: 'PE',
        subjectName: 'Physical Education',
        classGroup: 'M.2/2',
        periodsPerWeek: 2,
        teacherIds: ['t5'],
        classroomId: 'gym',
      },
    ],
    constraints: [
      {
        teacherId: 't1',
        unavailableSlots: ['MONDAY_1', 'FRIDAY_6'],
        maxPeriodsPerDay: 3,
      },
      {
        teacherId: 't3',
        unavailableSlots: ['WEDNESDAY_2'],
        maxPeriodsPerDay: 2,
      },
    ],
    options: {
      preferEarlierPeriods: true,
      allowSameSubjectMultiplePerDay: false,
      searchTimeLimitMs: 250,
    },
  };
}

export function normalizePayload(input) {
  const payload = isObject(input) ? input : {};
  const sample = buildSamplePayload();

  const days = Array.isArray(payload.days) && payload.days.length > 0 ? payload.days : sample.days;
  const periodsPerDay = Number.isInteger(payload.periodsPerDay) && payload.periodsPerDay > 0 ? payload.periodsPerDay : sample.periodsPerDay;
  const assignments = Array.isArray(payload.assignments) ? payload.assignments : sample.assignments;

  const constraints = Array.isArray(payload.constraints)
    ? payload.constraints.map((constraint) => ({
        teacherId: String(constraint.teacherId),
        unavailableSlots: new Set(Array.isArray(constraint.unavailableSlots) ? constraint.unavailableSlots.map(String) : []),
        maxPeriodsPerDay:
          Number.isInteger(constraint.maxPeriodsPerDay) && constraint.maxPeriodsPerDay > 0
            ? constraint.maxPeriodsPerDay
            : undefined,
      }))
    : sample.constraints.map((constraint) => ({
        teacherId: constraint.teacherId,
        unavailableSlots: new Set(constraint.unavailableSlots),
        maxPeriodsPerDay: constraint.maxPeriodsPerDay,
      }));

  const options = isObject(payload.options) ? payload.options : sample.options;

  return {
    days,
    periodsPerDay,
    assignments,
    constraints,
    options: {
      preferEarlierPeriods: options.preferEarlierPeriods ?? sample.options.preferEarlierPeriods,
      allowSameSubjectMultiplePerDay: options.allowSameSubjectMultiplePerDay ?? sample.options.allowSameSubjectMultiplePerDay,
      searchTimeLimitMs: options.searchTimeLimitMs ?? sample.options.searchTimeLimitMs,
    },
  };
}

export function runSchedule(payload) {
  const normalized = normalizePayload(payload);
  const timeSlots = createTimeSlots(normalized.days, normalized.periodsPerDay);
  const engine = new AutoSchedulerEngine(timeSlots, normalized.assignments, normalized.constraints, normalized.options);
  const result = engine.run();
  return {
    input: {
      days: normalized.days,
      periodsPerDay: normalized.periodsPerDay,
      assignmentCount: normalized.assignments.length,
      constraintCount: normalized.constraints.length,
    },
    ...result,
  };
}
