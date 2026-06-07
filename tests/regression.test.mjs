import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const updateVrInput = main.match(/function updateVRInput\(delta\) \{([\s\S]*?)\n\}/);
assert.ok(updateVrInput, 'main.js should define updateVRInput');

const nonVrBranch = updateVrInput[1].match(/if \(!renderer\.xr\.isPresenting\) \{([\s\S]*?)return;\n  \}/);

assert.ok(nonVrBranch, 'main.js should keep a non-VR branch in updateVRInput');
assert.ok(
  !nonVrBranch[1].includes("keys.delete('KeyE')"),
  'desktop non-VR frames must not clear KeyE before puzzle repair runs'
);
assert.ok(
  main.includes('const INTERACT_KEY =') &&
    main.includes('event.code === INTERACT_KEY') &&
    main.includes("event.key?.toLowerCase() === 'e'"),
  'interact input should accept both event.code and lowercase event.key'
);
assert.ok(
  !index.includes('rosebud-exported-splash') && !index.includes('Rosebud.AI'),
  'index.html should not render the Rosebud startup splash'
);
