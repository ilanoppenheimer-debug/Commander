export function roundToIncrement(value, increment = 2.5) {
  return Math.round(value / increment) * increment;
}

export function kgToLb(kg) {
  return kg * 2.20462;
}

export function lbToKg(lb) {
  return lb / 2.20462;
}

// ESTAS SON LAS 3 QUE NECESITA LA APP:
export const toKg = (val, unit) => (unit === 'kg' ? val : val * 0.453592);
export const toLb = (val, unit) => (unit === 'lb' ? val : val * 2.20462);
export const formatNum = (num) => {
  const n = parseFloat(num);
  if (isNaN(n)) return 0;
  return parseFloat(n.toFixed(2));
};
