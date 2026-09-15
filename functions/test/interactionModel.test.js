const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modelPath = path.resolve(
  __dirname,
  '../../alexa-skill/interactionModels/custom/en-AU.json',
);
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

test('Australian interaction model has the BabySteps invocation', () => {
  assert.equal(
    model.interactionModel.languageModel.invocationName,
    'baby steps',
  );
});

test('every slot referenced by a sample is declared on its intent', () => {
  for (const intent of model.interactionModel.languageModel.intents) {
    const slots = new Set((intent.slots || []).map(slot => slot.name));
    for (const sample of intent.samples || []) {
      for (const match of sample.matchAll(/\{([^}]+)\}/g)) {
        assert.equal(
          slots.has(match[1]),
          true,
          `${intent.name} sample references undeclared slot ${match[1]}`,
        );
      }
    }
  }
});
