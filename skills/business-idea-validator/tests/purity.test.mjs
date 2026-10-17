/* purity.test.mjs — the modules the worker bundles must not touch Node APIs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const f of ['i18n', 'verdict', 'render', 'schema']) {
  test(`scripts/${f}.mjs is free of Node-only APIs`, () => {
    const src = readFileSync(new URL(`../scripts/${f}.mjs`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /\bnode:|\bprocess\.|\brequire\(|from ['"]fs['"]|from ['"]path['"]/);
  });
}
