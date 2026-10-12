import {
  DEFAULT_FUTURE_CPI,
  DEFAULT_PREMIUM,
  explainSalary,
  projectSalary,
} from './salary-cpi.js';

const FREQUENCIES = [
  { value: 'month', label: 'per month' },
  { value: 'week', label: 'per week' },
  { value: 'year', label: 'per year' },
  { value: 'fortnight', label: 'per fortnight' },
];
const FREQUENCY_KEY = 'all4one_salary_frequency';

function money(value) {
  return new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function readPercent(input, fallbackPercent) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return fallbackPercent;
  return Math.round(value * 1000) / 1000;
}

function plainIndex(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(number);
}

function percentLabel(premium) {
  const percent = Math.round(premium * 10000) / 100;
  return `${String(percent).replace(/\.0$/, '')}%`;
}

function fraction(numerator, denominator) {
  const node = document.createElement('span');
  node.className = 'math-frac';
  const top = document.createElement('span');
  top.className = 'math-num';
  top.textContent = plainIndex(numerator);
  const bar = document.createElement('span');
  bar.className = 'math-bar';
  const bottom = document.createElement('span');
  bottom.className = 'math-den';
  bottom.textContent = plainIndex(denominator);
  node.append(top, bar, bottom);
  return node;
}

function termNode(step, count, premiumText) {
  const term = document.createElement('span');
  term.className = 'math-term';
  term.append(document.createTextNode('('));
  if (step.kind === 'ratio') {
    term.append(fraction(step.numerator, step.denominator));
    term.append(document.createTextNode(` + ${premiumText}`));
  } else if (step.kind === 'base') {
    term.append(document.createTextNode(`1 + ${premiumText}`));
  } else {
    term.append(document.createTextNode(`${plainIndex(step.cpi)} + ${premiumText}`));
  }
  term.append(document.createTextNode(')'));
  if (count > 1) {
    const power = document.createElement('sup');
    power.textContent = String(count);
    term.append(power);
  }
  return term;
}

function groupSteps(steps) {
  const groups = [];
  steps.forEach((step) => {
    const key = step.kind === 'ratio'
      ? `ratio:${step.numerator}:${step.denominator}`
      : `${step.kind}:${step.cpi}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.count += 1;
    else groups.push({ step, key, count: 1 });
  });
  return groups;
}

function appendProduct(parent, steps, premiumText) {
  groupSteps(steps).forEach((group, index) => {
    if (index) {
      const times = document.createElement('span');
      times.className = 'math-op';
      times.textContent = '×';
      parent.append(times);
    }
    parent.append(termNode(group.step, group.count, premiumText));
  });
}

function renderFormula(host, explanation, premiumText) {
  host.replaceChildren();
  if (!explanation || explanation.direction === 'same') return;

  const math = document.createElement('div');
  math.className = 'salary-math';
  const equals = document.createElement('span');
  equals.className = 'math-eq';
  equals.textContent = `= ${explanation.factor.toFixed(6)}`;

  if (explanation.direction === 'back') {
    const frac = document.createElement('span');
    frac.className = 'math-frac math-frac-lg';
    const top = document.createElement('span');
    top.className = 'math-num';
    top.textContent = '1';
    const bar = document.createElement('span');
    bar.className = 'math-bar';
    const bottom = document.createElement('span');
    bottom.className = 'math-den';
    appendProduct(bottom, explanation.steps, premiumText);
    frac.append(top, bar, bottom);
    math.append(frac, equals);
  } else {
    appendProduct(math, explanation.steps, premiumText);
    math.append(equals);
  }
  host.append(math);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('salary-form');
  if (!form) return;

  const amountInput = document.getElementById('salary-amount');
  const frequencyInput = document.getElementById('salary-frequency');
  const fromInput = document.getElementById('salary-from-year');
  const toInput = document.getElementById('salary-to-year');
  const futureInput = document.getElementById('salary-future-cpi');
  const premiumInput = document.getElementById('salary-premium');
  const modelLine = document.getElementById('salary-model-factor');
  const factorLine = document.getElementById('salary-factor-line');
  const resultAmount = document.getElementById('salary-result-amount');
  const formula = document.getElementById('salary-formula');
  const resultNote = document.getElementById('salary-result-note');
  const copyButton = document.getElementById('salary-copy');

  const thisYear = new Date().getFullYear();
  fromInput.value = '2025';
  toInput.value = String(thisYear);
  futureInput.value = '5';
  premiumInput.value = '1';
  const savedFrequency = localStorage.getItem(FREQUENCY_KEY);
  if (FREQUENCIES.some((item) => item.value === savedFrequency)) frequencyInput.value = savedFrequency;

  let copyValue = '';

  const render = () => {
    const futurePercent = readPercent(futureInput, (DEFAULT_FUTURE_CPI - 1) * 100);
    const premiumPercent = readPercent(premiumInput, DEFAULT_PREMIUM * 100);
    const futureCpi = 1 + futurePercent / 100;
    const premium = premiumPercent / 100;
    const frequency = FREQUENCIES.find((item) => item.value === frequencyInput.value) || FREQUENCIES[0];
    const premiumText = percentLabel(premium);
    modelLine.textContent = `Each step is that December over the previous December, plus the ${premiumText} premium. The same step, repeated, is a power. Going backwards uses 1 over that product. Years up to 1980 use 1 plus the ${premiumText} premium. A later year with no December index uses ${futurePercent}% plus the ${premiumText} premium.`;
    resultNote.textContent = `Stats SA CPI P0141, December index, plus the ${premiumText} premium.`;

    const rawAmount = String(amountInput.value).trim();
    const fromYear = Number(fromInput.value);
    const toYear = Number(toInput.value);
    if (!rawAmount || !Number.isFinite(fromYear) || !Number.isFinite(toYear)) {
      resultAmount.textContent = 'Enter an amount and both years';
      factorLine.textContent = '';
      formula.replaceChildren();
      copyValue = '';
      copyButton.disabled = true;
      return;
    }

    const amount = Number(rawAmount.replace(/\s/g, '').replace(/,/g, ''));
    const projected = projectSalary({ amount, fromYear, toYear, futureCpi, premium });
    const explanation = explainSalary({ fromYear, toYear, futureCpi, premium });
    if (projected.amount == null) {
      resultAmount.textContent = 'Enter an amount and both years';
      factorLine.textContent = '';
      formula.replaceChildren();
      copyValue = '';
      copyButton.disabled = true;
      return;
    }

    resultAmount.textContent = `R ${money(projected.amount)} ${frequency.label}`;
    const sameYear = explanation && explanation.direction === 'same' ? ' Same year, so the factor is 1.' : '';
    factorLine.textContent = `Factor ${explanation.factor.toFixed(6)} from ${fromYear} to ${toYear}.${sameYear} The payment frequency is kept as entered.`;
    renderFormula(formula, explanation, premiumText);
    copyValue = projected.amount.toFixed(2);
    copyButton.disabled = false;
    copyButton.textContent = 'Copy';
  };

  frequencyInput.addEventListener('change', () => {
    localStorage.setItem(FREQUENCY_KEY, frequencyInput.value);
  });
  copyButton.addEventListener('click', async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
    } catch {
      const area = document.createElement('textarea');
      area.value = copyValue;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    copyButton.textContent = 'Copied';
    window.setTimeout(() => {
      if (!copyButton.disabled) copyButton.textContent = 'Copy';
    }, 1400);
  });

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
});
