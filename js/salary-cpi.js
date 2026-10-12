// December Stats SA CPI (P0141), column N of the 10 March 2026 LOE workbook.
// A year with both this December and the previous December uses that ratio.
// 1980 has no earlier December, so its CPI factor is 1. Later years with no
// published December index use the model's future CPI (1.05 unless edited).

export const CPI_FIRST_YEAR = 1980;
export const CPI_LAST_ACTUAL_YEAR = 2025;
export const DEFAULT_FUTURE_CPI = 1.05;
export const DEFAULT_PREMIUM = 0.01;

export const DECEMBER_CPI = {
  1980: 3.2,
  1981: 3.7,
  1982: 4.1,
  1983: 4.7,
  1984: 5.3,
  1985: 6.2,
  1986: 7.3,
  1987: 8.4,
  1988: 9.5,
  1989: 10.9,
  1990: 12.5,
  1991: 14.5,
  1992: 15.9,
  1993: 17.4,
  1994: 19.0,
  1995: 20.4,
  1996: 22.4,
  1997: 23.7,
  1998: 25.8,
  1999: 26.4,
  2000: 28.3,
  2001: 29.5,
  2002: 33.2,
  2003: 33.3,
  2004: 34.5,
  2005: 35.7,
  2006: 37.8,
  2007: 41.2,
  2008: 45.1,
  2009: 48.0,
  2010: 49.6,
  2011: 52.6,
  2012: 55.6,
  2013: 58.7,
  2014: 61.8,
  2015: 64.9,
  2016: 69.3,
  2017: 72.6,
  2018: 75.9,
  2019: 78.9,
  2020: 81.3,
  2021: 86.1,
  2022: 92.3,
  2023: 97.1,
  2024: 100.0,
  2025: 103.6,
};

export function cpiFactor(year, futureCpi = DEFAULT_FUTURE_CPI) {
  const current = DECEMBER_CPI[year];
  const prior = DECEMBER_CPI[year - 1];
  if (current != null && prior != null && prior !== 0) return current / prior;
  if (year <= CPI_FIRST_YEAR) return 1;
  return futureCpi;
}

export function salaryFactor(year, futureCpi = DEFAULT_FUTURE_CPI, premium = DEFAULT_PREMIUM) {
  return cpiFactor(year, futureCpi) + premium;
}

export function projectSalary({ amount, fromYear, toYear, futureCpi = DEFAULT_FUTURE_CPI, premium = DEFAULT_PREMIUM }) {
  const value = Number(amount);
  const from = Number(fromYear);
  const to = Number(toYear);
  const future = Number(futureCpi);
  const prem = Number(premium);
  if (!Number.isFinite(value) || !Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(future) || !Number.isFinite(prem)) {
    return { factor: null, amount: null };
  }
  if (from === to) return { factor: 1, amount: value };

  let factor = 1;
  if (to > from) {
    for (let year = from; year < to; year += 1) factor *= salaryFactor(year, future, prem);
  } else {
    for (let year = to; year < from; year += 1) factor *= salaryFactor(year, future, prem);
    factor = 1 / factor;
  }
  return { factor, amount: value * factor };
}

export function explainSalary({ fromYear, toYear, futureCpi = DEFAULT_FUTURE_CPI, premium = DEFAULT_PREMIUM }) {
  const from = Number(fromYear);
  const to = Number(toYear);
  const future = Number(futureCpi);
  const prem = Number(premium);
  if (![from, to, future, prem].every(Number.isFinite)) return null;
  if (from === to) return { direction: 'same', steps: [], factor: 1, premium: prem };

  const forward = to > from;
  const start = forward ? from : to;
  const end = forward ? to : from;
  const steps = [];
  for (let year = start; year < end; year += 1) {
    const current = DECEMBER_CPI[year];
    const prior = DECEMBER_CPI[year - 1];
    if (current != null && prior != null && prior !== 0) {
      steps.push({
        year,
        kind: 'ratio',
        numerator: current,
        denominator: prior,
        cpi: current / prior,
        salary: current / prior + prem,
      });
    } else if (year <= CPI_FIRST_YEAR) {
      steps.push({ year, kind: 'base', cpi: 1, salary: 1 + prem });
    } else {
      steps.push({ year, kind: 'future', cpi: future, salary: future + prem });
    }
  }

  let factor = steps.reduce((product, step) => product * step.salary, 1);
  if (!forward) factor = 1 / factor;
  return { direction: forward ? 'forward' : 'back', steps, factor, premium: prem };
}
