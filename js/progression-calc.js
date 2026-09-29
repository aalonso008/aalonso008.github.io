/* Métricas de entrenamiento y sugerencia de doble progresión. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function epley(weight, reps) {
    const w = Number(weight);
    const r = Number(reps);
    if (!w || !r) return 0;
    if (r <= 1) return w;
    return w * (1 + r / 30);
  }

  function epleyReliable(reps) {
    return Number(reps) > 0 && Number(reps) <= 10;
  }

  function groupSessions(sets) {
    const map = new Map();
    (sets || []).forEach((set) => {
      const key = set.sessionId || set.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(set);
    });
    return [...map.values()]
      .map((rows) => rows.slice().sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0)))
      .sort((a, b) => (a[0].ts || 0) - (b[0].ts || 0));
  }

  function sessionVolume(sets) {
    return (sets || []).reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
  }

  function sessionBestEpley(sets) {
    let best = 0;
    let reliable = false;
    (sets || []).forEach((set) => {
      const value = epley(set.weight, set.reps);
      if (value > best) {
        best = value;
        reliable = epleyReliable(set.reps);
      }
    });
    return { value: best, reliable };
  }

  function suggestProgression(input) {
    const prescription = input.prescription || { count: 3, repMin: 8, repMax: 12 };
    const last = input.lastSession || [];
    const prev = input.prevSession || null;
    const increment = input.increment || 2.5;
    if (input.deload) {
      return {
        kind: 'deload',
        text: 'Semana de descarga: hacé unas 40% menos de series, o bajá 10–20% el peso.',
      };
    }
    if (!last.length) return null;
    const weight = Math.max(...last.map((set) => Number(set.weight) || 0));
    const enoughSets = last.length >= (prescription.count || 1);
    const allHitMax = enoughSets && last.every((set) => (Number(set.reps) || 0) >= prescription.repMax);
    const step = increment >= 1 ? increment : 0.5;
    const roundToStep = (value) => Math.round(value / step) * step;
    const shown = (value) => {
      const n = Math.round(value * 10) / 10;
      return Number.isInteger(n) ? String(n) : String(n);
    };
    if (allHitMax) {
      const next = roundToStep(weight + increment);
      return { kind: 'up', text: `Subí a ${shown(next)} kg y volvé a ${prescription.repMin} reps` };
    }
    const belowMin = (session) => (session || []).some((set) => (Number(set.reps) || 0) < prescription.repMin);
    if (belowMin(last) && prev && belowMin(prev)) {
      const down = Math.round(weight * 0.9 * 2) / 2;
      return { kind: 'down', text: `Bajá a ${shown(down)} kg o revisá el descanso` };
    }
    return { kind: 'hold', text: `Mantené ${shown(weight)} kg y buscá +1 rep` };
  }

  function cycleInfo(startIso, now) {
    if (!startIso) return null;
    const start = new Date(startIso + 'T00:00:00');
    const today = new Date(now || new Date());
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(start.getTime()) || today < start) return null;
    const days = Math.floor((today.getTime() - start.getTime()) / 86400000);
    const week = (Math.floor(days / 7) % 8) + 1;
    let phase = 'Base';
    if (week >= 7) phase = 'Deload';
    else if (week >= 5) phase = 'Peso';
    else if (week >= 3) phase = 'Reps';
    return { week, phase, deload: phase === 'Deload' };
  }

  function weekBounds(now) {
    const date = new Date(now || new Date());
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const iso = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    return { start: iso(start), end: iso(end) };
  }

  function setsInRange(sets, start, end) {
    return (sets || []).filter((set) => set.date >= start && set.date <= end);
  }

  function previousWeekBounds(now) {
    const date = new Date(now || new Date());
    date.setDate(date.getDate() - 7);
    return weekBounds(date);
  }

  return {
    epley,
    epleyReliable,
    groupSessions,
    sessionVolume,
    sessionBestEpley,
    suggestProgression,
    cycleInfo,
    weekBounds,
    previousWeekBounds,
    setsInRange,
  };
});
