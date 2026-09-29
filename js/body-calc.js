/* Cálculos de composición corporal. Funciones puras, sin DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ACTIVITY_LEVELS = [
    { id: 'sedentary', label: 'Sedentario', factor: 1.2 },
    { id: 'light', label: 'Ligero (1–3 días/sem)', factor: 1.375 },
    { id: 'moderate', label: 'Moderado (3–5 días/sem)', factor: 1.55 },
    { id: 'active', label: 'Activo (6–7 días/sem)', factor: 1.725 },
    { id: 'very_active', label: 'Muy activo (2 veces/día o trabajo físico)', factor: 1.9 },
  ];

  function activityFactor(level) {
    const found = ACTIVITY_LEVELS.find((item) => item.id === level);
    return found ? found.factor : 1.55;
  }

  function ageFromBirth(birthDate, now) {
    if (!birthDate) return null;
    const birth = new Date(birthDate + 'T00:00:00');
    if (Number.isNaN(birth.getTime())) return null;
    const today = now || new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
  }

  function bmi(weightKg, heightCm) {
    const h = heightCm / 100;
    if (!weightKg || !h) return null;
    return weightKg / (h * h);
  }

  function bmiCategory(value) {
    if (value == null || Number.isNaN(value)) return '';
    if (value < 18.5) return 'bajo peso';
    if (value < 25) return 'normal';
    if (value < 30) return 'sobrepeso';
    return 'obesidad';
  }

  function healthyWeightRange(heightCm) {
    const h = heightCm / 100;
    if (!h) return null;
    return { min: 18.5 * h * h, max: 24.9 * h * h };
  }

  function heightInches(heightCm) {
    return heightCm / 2.54;
  }

  function idealWeights(heightCm, sex) {
    const x = heightInches(heightCm) - 60;
    const male = sex !== 'F';
    const devine = male ? 50 + 2.3 * x : 45.5 + 2.3 * x;
    const robinson = male ? 52 + 1.9 * x : 49 + 1.7 * x;
    const miller = male ? 56.2 + 1.41 * x : 53.1 + 1.36 * x;
    const average = (devine + robinson + miller) / 3;
    return { devine, robinson, miller, average };
  }

  function navyBodyFat(measures) {
    const height = measures.heightCm;
    const waist = measures.waistCm;
    const neck = measures.neckCm;
    const hip = measures.hipCm;
    if (measures.bodyFatManual != null && measures.bodyFatManual !== '') return Number(measures.bodyFatManual);
    if (!height || !waist || !neck) return null;
    if (measures.sex === 'F') {
      if (!hip) return null;
      const inner = waist + hip - neck;
      if (inner <= 0) return null;
      return 495 / (1.29579 - 0.35004 * Math.log10(inner) + 0.221 * Math.log10(height)) - 450;
    }
    const inner = waist - neck;
    if (inner <= 0) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(inner) + 0.15456 * Math.log10(height)) - 450;
  }

  function fatMass(weightKg, bodyFatPct) {
    if (weightKg == null || bodyFatPct == null) return null;
    return (weightKg * bodyFatPct) / 100;
  }

  function leanMass(weightKg, bodyFatPct) {
    const fat = fatMass(weightKg, bodyFatPct);
    if (fat == null) return null;
    return weightKg - fat;
  }

  function ffmi(leanKg, heightCm) {
    const h = heightCm / 100;
    if (!leanKg || !h) return null;
    return leanKg / (h * h);
  }

  function ffmiNormalized(leanKg, heightCm) {
    const value = ffmi(leanKg, heightCm);
    const h = heightCm / 100;
    if (value == null || !h) return null;
    return value + 6.1 * (1.8 - h);
  }

  function ffmiCategory(value) {
    if (value == null) return '';
    if (value < 18) return 'bajo';
    if (value < 20) return 'promedio';
    if (value < 22) return 'bueno';
    if (value < 23) return 'muy bueno';
    if (value <= 25) return 'excelente';
    return 'por encima del techo natural aprox.';
  }

  function goalWeight(leanKg, targetBodyFat) {
    if (!leanKg || targetBodyFat == null || targetBodyFat >= 100) return null;
    return leanKg / (1 - targetBodyFat / 100);
  }

  function mifflin(weightKg, heightCm, age, sex) {
    if (!weightKg || !heightCm || age == null) return null;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === 'F' ? base - 161 : base + 5;
  }

  function tdee(bmr, level) {
    if (bmr == null) return null;
    return bmr * activityFactor(level);
  }

  function calorieTargets(maintenance) {
    if (maintenance == null) return null;
    return {
      cut: Math.round(maintenance - 400),
      maintain: Math.round(maintenance),
      bulk: Math.round(maintenance + 250),
    };
  }

  function proteinRange(weightKg) {
    if (!weightKg) return null;
    return { min: 1.8 * weightKg, max: 2.2 * weightKg };
  }

  function movingAverage(points, windowSize) {
    const size = windowSize || 7;
    const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((point) => {
      const end = new Date(point.date + 'T00:00:00');
      const start = new Date(end);
      start.setDate(start.getDate() - (size - 1));
      const startIso = start.toISOString().slice(0, 10);
      const window = sorted.filter((item) => item.date >= startIso && item.date <= point.date);
      const avg = window.reduce((sum, item) => sum + item.value, 0) / window.length;
      return { date: point.date, value: avg };
    });
  }

  function trendPerWeek(points) {
    if (!points || points.length < 2) return null;
    const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date));
    const first = new Date(sorted[0].date + 'T00:00:00').getTime();
    const xs = sorted.map((point) => (new Date(point.date + 'T00:00:00').getTime() - first) / 86400000);
    const ys = sorted.map((point) => point.value);
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxy = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
    const sx2 = xs.reduce((sum, x) => sum + x * x, 0);
    const denom = n * sx2 - sx * sx;
    if (!denom) return null;
    const slopePerDay = (n * sxy - sx * sy) / denom;
    return slopePerDay * 7;
  }

  function projectDate(currentWeight, goal, kgPerWeek, now) {
    if (goal == null || currentWeight == null || !kgPerWeek) return null;
    const delta = goal - currentWeight;
    if (Math.abs(delta) < 0.2) return null;
    if (Math.sign(delta) !== Math.sign(kgPerWeek)) return null;
    if (Math.abs(kgPerWeek) < 0.05) return null;
    const days = Math.round((delta / kgPerWeek) * 7);
    if (days < 0 || days > 3650) return null;
    const date = new Date(now || new Date());
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function round1(n) {
    if (n == null || Number.isNaN(n)) return null;
    return Math.round(n * 10) / 10;
  }

  return {
    ACTIVITY_LEVELS,
    activityFactor,
    ageFromBirth,
    bmi,
    bmiCategory,
    healthyWeightRange,
    idealWeights,
    navyBodyFat,
    fatMass,
    leanMass,
    ffmi,
    ffmiNormalized,
    ffmiCategory,
    goalWeight,
    mifflin,
    tdee,
    calorieTargets,
    proteinRange,
    movingAverage,
    trendPerWeek,
    projectDate,
    round1,
  };
});
