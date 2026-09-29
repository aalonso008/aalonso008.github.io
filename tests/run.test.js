const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/model.js');
require('../js/body-calc.js');
require('../js/progression-calc.js');
const { runChecks } = require('./checks.js');

test('modelo, cuerpo y progresión', () => {
  runChecks(assert);
});
