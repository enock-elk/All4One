import {
  CPI_FIRST_YEAR,
  CPI_LAST_ACTUAL_YEAR,
  DEFAULT_FUTURE_CPI,
  DEFAULT_PREMIUM,
  projectSalary,
} from './salary-cpi.js';

const FREQUENCIES = [
  { value: 'month', label: 'per month' },
  { value: 'week', label: 'per week' },
  { value: 'year', label: 'per year' },
  { value: 'fortnight', label: 'per fortnight' },
];

function money(value) {
  return new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fillYears(select, selected) {
  const last = new Date().getFullYear() + 15;
  select.innerHTML = '';
  for (let year = CPI_FIRST_YEAR; year <= last; year += 1) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    if (year === selected) option.selected = true;
    select.appendChild(option);
  }
}

function readPercent(input, fallbackPercent) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return fallbackPercent;
  return value;
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
  const resultAmount = document.getElementById('salary-result-amount');
  const resultFactor = document.getElementById('salary-result-factor');
  const resultNote = document.getElementById('salary-result-note');

  const thisYear = new Date().getFullYear();
  fillYears(fromInput, Math.min(CPI_LAST_ACTUAL_YEAR, thisYear));
  fillYears(toInput, thisYear);
  futureInput.value = '5';
  premiumInput.value = '1';

  const render = () => {
    const futurePercent = Math.round(readPercent(futureInput, (DEFAULT_FUTURE_CPI - 1) * 100) * 1000) / 1000;
    const premiumPercent = Math.round(readPercent(premiumInput, DEFAULT_PREMIUM * 100) * 1000) / 1000;
    const futureCpi = 1 + futurePercent / 100;
    const premium = premiumPercent / 100;
    const frequency = FREQUENCIES.find((item) => item.value === frequencyInput.value) || FREQUENCIES[0];
    const modelFactor = futureCpi + premium;
    modelLine.textContent = `Future CPI ${futurePercent}% (${futureCpi.toFixed(2)}) plus premium ${premiumPercent}% gives a salary-inflation factor of ${modelFactor.toFixed(2)} once a December index is not published.`;

    const rawAmount = String(amountInput.value).trim();
    if (!rawAmount) {
      resultAmount.textContent = 'Enter an amount';
      resultFactor.textContent = '';
      return;
    }
    const amount = Number(rawAmount.replace(/\s/g, '').replace(/,/g, ''));
    const projected = projectSalary({
      amount,
      fromYear: fromInput.value,
      toYear: toInput.value,
      futureCpi,
      premium,
    });

    if (projected.amount == null) {
      resultAmount.textContent = 'Enter an amount';
      resultFactor.textContent = '';
      return;
    }

    resultAmount.textContent = `R ${money(projected.amount)} ${frequency.label}`;
    resultFactor.textContent = `Factor ${projected.factor.toFixed(6)} from ${fromInput.value} to ${toInput.value}. The payment frequency is kept as entered.`;
    resultNote.textContent = `Stats SA CPI P0141, December index, plus the ${premiumPercent}% premium from the 10 March 2026 LOE model.`;
  };

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
});
