import assert from 'node:assert/strict';
import test from 'node:test';
import { redactSensitiveFields } from '../src/utils/sensitive.ts';

test('redacts test data values marked sensitive', () => {
  assert.deepEqual(
    redactSensitiveFields({
      testData: [
        { name: 'username', value: 'tester', sensitive: false },
        { name: 'password', value: 'secret-value', sensitive: true },
      ],
    }),
    {
      testData: [
        { name: 'username', value: 'tester', sensitive: false },
        { name: 'password', value: '[redacted]', sensitive: true },
      ],
    }
  );
});
