import { DAY_ORDER } from './types.js';

function countBy(items, mapper) {
  const counts = new Map();
  for (const item of items) {
    const key = mapper(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export class AutoSchedulerEngine {
  constructor(timeSlots, assignments, constraints, options = {}) {
    this.timeSlots = [...timeSlots];
    this.assignments = [...assignments];
    this.teacherConstraints = new Map();
    for (const constraint of constraints) {
      this.teacherConstraints.set(constraint.teacherId, constraint);
    }
    this.options = {
      allowSameSubjectMultiplePerDay: options.allowSameSubjectMultiplePerDay ?? false,
      preferEarlierPeriods: options.preferEarlierPeriods ?? true,
      searchTimeLimitMs: options.searchTimeLimitMs ?? 0,
    };

    this.teacherOccupied = new Set();
    this.roomOccupied = new Set();
    this.groupOccupied = new Set();
    this.teacherDailyCount = new Map();
    this.groupSubjectDailyCount = new Map();
    this.bestPlaced = 0;
    this.bestSchedules = [];
    this.startedAt = Date.now();
  }

  run() {
    const startTime = Date.now();
    const tasks = this.expandAssignments();
    const sortedTasks = this.sortTasksByDifficulty(tasks);

    this.search({
      remaining: sortedTasks,
      placed: [],
    });

    const executionTimeMs = Date.now() - startTime;
    const placedCounts = countBy(this.bestSchedules, (entry) => `${entry.subjectId}__${entry.classGroup}`);

    const unplacedAssignments = this.assignments
      .map((assignment) => {
        const key = `${assignment.subjectId}__${assignment.classGroup}`;
        const placed = placedCounts.get(key) ?? 0;
        const remainingPeriods = Math.max(0, assignment.periodsPerWeek - placed);
        return remainingPeriods > 0
          ? {
              subjectName: assignment.subjectName,
              classGroup: assignment.classGroup,
              remainingPeriods,
              reason: 'Unable to place all periods without violating teacher, room, or class conflicts.',
            }
          : null;
      })
      .filter((item) => item !== null);

    return {
      success: this.bestPlaced === tasks.length,
      totalPlaced: this.bestPlaced,
      totalRequired: tasks.length,
      schedules: [...this.bestSchedules].sort((a, b) => {
        if (a.day !== b.day) {
          return DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
        }
        return a.period - b.period;
      }),
      unplacedAssignments,
      executionTimeMs,
    };
  }

  expandAssignments() {
    const tasks = [];
    for (const assignment of this.assignments) {
      for (let periodIndex = 0; periodIndex < assignment.periodsPerWeek; periodIndex += 1) {
        tasks.push({ assignment, periodIndex });
      }
    }
    return tasks;
  }

  sortTasksByDifficulty(tasks) {
    return [...tasks].sort((a, b) => {
      const teacherDelta = b.assignment.teacherIds.length - a.assignment.teacherIds.length;
      if (teacherDelta !== 0) {
        return teacherDelta;
      }
      const periodDelta = b.assignment.periodsPerWeek - a.assignment.periodsPerWeek;
      if (periodDelta !== 0) {
        return periodDelta;
      }
      return a.assignment.subjectName.localeCompare(b.assignment.subjectName);
    });
  }

  search(state) {
    if (this.options.searchTimeLimitMs > 0 && Date.now() - this.startedAt >= this.options.searchTimeLimitMs) {
      this.captureBest(state.placed);
      return;
    }

    if (state.remaining.length === 0) {
      this.captureBest(state.placed);
      return;
    }

    if (state.placed.length + state.remaining.length < this.bestPlaced) {
      return;
    }

    const taskIndex = this.pickNextTaskIndex(state.remaining);
    const task = state.remaining[taskIndex];
    const remaining = state.remaining.filter((_, index) => index !== taskIndex);
    const candidateSlots = this.getCandidateSlots(task.assignment);
    let placedAny = false;

    for (const slot of candidateSlots) {
      if (!this.canPlace(task.assignment, slot)) {
        continue;
      }

      placedAny = true;
      this.applyPlacement(task.assignment, slot, state.placed);
      this.search({
        remaining,
        placed: state.placed,
      });
      this.undoPlacement(task.assignment, slot, state.placed);
    }

    if (!placedAny) {
      this.search({
        remaining,
        placed: state.placed,
      });
    }
  }

  captureBest(placed) {
    if (placed.length > this.bestPlaced) {
      this.bestPlaced = placed.length;
      this.bestSchedules = placed.map((entry) => ({ ...entry, teacherIds: [...entry.teacherIds] }));
    }
  }

  pickNextTaskIndex(tasks) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index];
      const candidateCount = this.getCandidateSlots(task.assignment).filter((slot) => this.canPlace(task.assignment, slot)).length;
      if (candidateCount < bestScore) {
        bestScore = candidateCount;
        bestIndex = index;
        if (candidateCount <= 1) {
          break;
        }
      }
    }

    return bestIndex;
  }

  getCandidateSlots(assignment) {
    const slots = [...this.timeSlots];
    slots.sort((a, b) => {
      const groupA = this.getGroupDayCount(assignment.classGroup, a.day);
      const groupB = this.getGroupDayCount(assignment.classGroup, b.day);
      if (groupA !== groupB) {
        return groupA - groupB;
      }

      if (this.options.preferEarlierPeriods && a.period !== b.period) {
        return a.period - b.period;
      }

      return DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    });
    return slots;
  }

  getGroupDayCount(classGroup, day) {
    let count = 0;
    for (const slot of this.timeSlots) {
      if (slot.day === day && this.groupOccupied.has(`${classGroup}_${slot.key}`)) {
        count += 1;
      }
    }
    return count;
  }

  canPlace(assignment, slot) {
    const key = slot.key;

    if (this.roomOccupied.has(`${assignment.classroomId}_${key}`)) {
      return false;
    }

    if (this.groupOccupied.has(`${assignment.classGroup}_${key}`)) {
      return false;
    }

    for (const teacherId of assignment.teacherIds) {
      if (this.teacherOccupied.has(`${teacherId}_${key}`)) {
        return false;
      }

      const constraint = this.teacherConstraints.get(teacherId);
      if (constraint?.unavailableSlots.has(key)) {
        return false;
      }

      const dailyKey = `${teacherId}_${slot.day}`;
      const currentPeriods = this.teacherDailyCount.get(dailyKey) ?? 0;
      if (constraint?.maxPeriodsPerDay !== undefined && currentPeriods >= constraint.maxPeriodsPerDay) {
        return false;
      }
    }

    if (!this.options.allowSameSubjectMultiplePerDay) {
      const groupSubDailyKey = `${assignment.classGroup}_${assignment.subjectId}_${slot.day}`;
      const sameSubjectToday = this.groupSubjectDailyCount.get(groupSubDailyKey) ?? 0;
      if (sameSubjectToday >= 1) {
        return false;
      }
    }

    return true;
  }

  applyPlacement(assignment, slot, placed) {
    const key = slot.key;
    this.roomOccupied.add(`${assignment.classroomId}_${key}`);
    this.groupOccupied.add(`${assignment.classGroup}_${key}`);

    for (const teacherId of assignment.teacherIds) {
      this.teacherOccupied.add(`${teacherId}_${key}`);
      const dailyKey = `${teacherId}_${slot.day}`;
      this.teacherDailyCount.set(dailyKey, (this.teacherDailyCount.get(dailyKey) ?? 0) + 1);
    }

    const groupSubDailyKey = `${assignment.classGroup}_${assignment.subjectId}_${slot.day}`;
    this.groupSubjectDailyCount.set(groupSubDailyKey, (this.groupSubjectDailyCount.get(groupSubDailyKey) ?? 0) + 1);

    placed.push({
      subjectId: assignment.subjectId,
      classGroup: assignment.classGroup,
      classroomId: assignment.classroomId,
      teacherIds: [...assignment.teacherIds],
      timeSlotId: slot.id,
      day: slot.day,
      period: slot.period,
    });
  }

  undoPlacement(assignment, slot, placed) {
    const key = slot.key;
    this.roomOccupied.delete(`${assignment.classroomId}_${key}`);
    this.groupOccupied.delete(`${assignment.classGroup}_${key}`);

    for (const teacherId of assignment.teacherIds) {
      this.teacherOccupied.delete(`${teacherId}_${key}`);
      const dailyKey = `${teacherId}_${slot.day}`;
      const current = (this.teacherDailyCount.get(dailyKey) ?? 0) - 1;
      if (current > 0) {
        this.teacherDailyCount.set(dailyKey, current);
      } else {
        this.teacherDailyCount.delete(dailyKey);
      }
    }

    const groupSubDailyKey = `${assignment.classGroup}_${assignment.subjectId}_${slot.day}`;
    const current = (this.groupSubjectDailyCount.get(groupSubDailyKey) ?? 0) - 1;
    if (current > 0) {
      this.groupSubjectDailyCount.set(groupSubDailyKey, current);
    } else {
      this.groupSubjectDailyCount.delete(groupSubDailyKey);
    }

    placed.pop();
  }
}

export function createTimeSlots(days, periodsPerDay) {
  const slots = [];
  for (const day of days) {
    for (let period = 1; period <= periodsPerDay; period += 1) {
      slots.push({
        id: `${day}_${period}`,
        day,
        period,
        key: `${day}_${period}`,
      });
    }
  }
  return slots;
}
