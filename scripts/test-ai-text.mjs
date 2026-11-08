import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({ entryPoints: ['src/lib/ai.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { extractAiText } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

assert.equal(extractAiText({ response: '  Halo dunia  ' }), 'Halo dunia');
assert.equal(extractAiText({ choices: [{ message: { content: ' Ringkasan ' } }] }), 'Ringkasan');
assert.equal(extractAiText('  teks langsung '), 'teks langsung');
// Reasoning model dapat mengembalikan content null; harus jadi string kosong, bukan error.
assert.equal(extractAiText({ choices: [{ message: { content: null, reasoning_content: 'x' } }] }), '');
assert.equal(extractAiText({ response: 42 }), '');
assert.equal(extractAiText({}), '');
assert.equal(extractAiText(null), '');
assert.equal(extractAiText(undefined), '');
console.log('AI text extraction: response, choices, plain string, null content and empty results passed.');
