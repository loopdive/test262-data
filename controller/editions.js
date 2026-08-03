// Cumulative ES edition pass rates.
//
// meta.json carries per-edition results: for each ECMAScript edition, how many
// test262 tests belong to it and how many each engine passes. Read on its own,
// a per-edition number answers "how good is this engine at ES2020 features?" —
// useful, but not what you want when picking an engine, because an engine that
// aces ES2020 while failing ES5 is not usable for ES2020 code.
//
// The cumulative rate answers the other question: "if I write code targeting
// edition N, what fraction of the language up to and including N works?" It is
// a running total over editions in order — the same shape js2 publishes for
// itself (website/components/t262-charts.js, `cumulativeScopes`).
//
// Editions with no edition number (proposals, and anything test262 tags with a
// feature that has not landed in a spec) are excluded: they belong to no
// edition, so they cannot be part of a running total through one.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const editionLabel = edition => (Number(edition) === 5 ? 'ES5' : `ES${2009 + Number(edition)}`);

/**
 * @param meta parsed meta.json
 * @returns [{ edition, label, total, engines: { <engine>: { pass, rate } } }]
 *          in edition order, each entry cumulative through that edition
 */
export const cumulativeEditions = meta => {
  const editions = Object.keys(meta.editions ?? {})
    .filter(x => x !== 'undefined' && Number.isFinite(Number(x)))
    .sort((a, b) => Number(a) - Number(b));

  const engines = Object.keys(meta.engines ?? {});
  const running = { total: 0, engines: Object.fromEntries(engines.map(e => [e, 0])) };
  const out = [];

  for (const edition of editions) {
    const entry = meta.editions[edition];
    running.total += entry.total ?? 0;
    for (const engine of engines) running.engines[engine] += entry.engines?.[engine] ?? 0;

    out.push({
      edition: Number(edition),
      label: editionLabel(edition),
      total: running.total,
      engines: Object.fromEntries(engines.map(e => [e, {
        pass: running.engines[e],
        rate: running.total ? running.engines[e] / running.total : null
      }]))
    });
  }

  return out;
};

export default cumulativeEditions;

// CLI: print the table for every engine. Reads deploy/meta.json when it exists
// (i.e. straight after a local run), otherwise the deployed one.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const local = join(process.env.FYI_WORKDIR ?? join(import.meta.dirname, '..', '.test262-fyi'), 'deploy', 'meta.json');

  const meta = existsSync(local)
    ? JSON.parse(readFileSync(local, 'utf8'))
    : await (await fetch(process.env.FYI_META_URL || 'https://data.test262.fyi/meta.json')).json();

  const rows = cumulativeEditions(meta);
  const engines = Object.keys(meta.engines).sort();

  const pad = (s, n) => String(s).padStart(n);
  console.log(pad('cumulative', 10) + pad('tests', 8) + engines.map(e => pad(e, 9)).join(''));
  for (const row of rows) {
    console.log(
      pad(row.label, 10) + pad(row.total, 8) +
      engines.map(e => pad(`${(row.engines[e].rate * 100).toFixed(1)}%`, 9)).join('')
    );
  }
}
