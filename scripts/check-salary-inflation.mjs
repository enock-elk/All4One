import assert from 'node:assert/strict';
import { explainSalary, projectSalary } from '../js/salary-cpi.js';

const f2023 = 97.1 / 92.3 + 0.01;
const f2024 = 100 / 97.1 + 0.01;
const f2025 = 103.6 / 100 + 0.01;

const forward = projectSalary({
  amount: 10000,
  fromYear: 2023,
  toYear: 2026,
  futureCpi: 1.05,
  premium: 0.01,
});
assert.ok(Math.abs(forward.factor - (f2023 * f2024 * f2025)) < 1e-9);
assert.ok(Math.abs(forward.amount - 10000 * f2023 * f2024 * f2025) < 1e-6);

const backward = projectSalary({
  amount: 10000,
  fromYear: 2026,
  toYear: 2024,
  futureCpi: 1.05,
  premium: 0.01,
});
assert.ok(Math.abs(backward.factor - (1 / (f2024 * f2025))) < 1e-9);

const futureOnly = projectSalary({
  amount: 1000,
  fromYear: 2026,
  toYear: 2028,
  futureCpi: 1.05,
  premium: 0.01,
});
assert.ok(Math.abs(futureOnly.factor - (1.06 * 1.06)) < 1e-9);

const sameYear = projectSalary({
  amount: 50,
  fromYear: 2020,
  toYear: 2020,
  futureCpi: 1.05,
  premium: 0.01,
});
assert.equal(sameYear.factor, 1);
assert.equal(sameYear.amount, 50);

const from1980 = projectSalary({
  amount: 100,
  fromYear: 1980,
  toYear: 1981,
  futureCpi: 1.05,
  premium: 0.01,
});
assert.ok(Math.abs(from1980.factor - 1.01) < 1e-12);

[ [2023, 2026], [2034, 2026], [1970, 1985], [2026, 2026], [1980, 1981] ].forEach(([fromYear, toYear]) => {
  const projected = projectSalary({ amount: 1, fromYear, toYear, futureCpi: 1.05, premium: 0.01 });
  const explained = explainSalary({ fromYear, toYear, futureCpi: 1.05, premium: 0.01 });
  assert.ok(Math.abs(projected.factor - explained.factor) < 1e-9, `${fromYear} to ${toYear}`);
});

const backFuture = explainSalary({ fromYear: 2034, toYear: 2026, futureCpi: 1.05, premium: 0.01 });
assert.equal(backFuture.direction, 'back');
assert.equal(backFuture.steps.length, 8);
assert.ok(backFuture.steps.every((step) => step.kind === 'future'));

console.log('salary inflation checks passed');
