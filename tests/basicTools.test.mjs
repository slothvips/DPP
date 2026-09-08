import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let calculator;
let dateTime;
let developerUtilities;
let jsonUtilities;
let runtimeContext;
let toolRegistry;
let toolCallUtils;
let testCases;
let toolConfirmation;
let unitConversion;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': path.join(root, 'src') } },
  });
  [
    calculator,
    dateTime,
    developerUtilities,
    jsonUtilities,
    runtimeContext,
    toolRegistry,
    toolCallUtils,
    testCases,
    toolConfirmation,
    unitConversion,
  ] = await Promise.all([
    server.ssrLoadModule('/src/lib/ai/tools/calculator.ts'),
    server.ssrLoadModule('/src/lib/ai/tools/dateTime.ts'),
    server.ssrLoadModule('/src/lib/ai/tools/developerUtilities.ts'),
    server.ssrLoadModule('/src/features/toolbox/components/JsonTool/jsonUtils.ts'),
    server.ssrLoadModule('/src/lib/ai/runtimeContext.ts'),
    server.ssrLoadModule('/src/lib/ai/toolRegistry.ts'),
    server.ssrLoadModule('/src/features/aiAssistant/lib/toolCallUtils.ts'),
    server.ssrLoadModule('/src/lib/ai/tools/testCases.ts'),
    server.ssrLoadModule('/src/features/aiAssistant/components/toolConfirmationShared.ts'),
    server.ssrLoadModule('/src/lib/ai/tools/unitConversion.ts'),
  ]);
});

after(async () => {
  await server?.close();
});

test('runtime context reports a fixed local date, weekday, and timezone', () => {
  const context = runtimeContext.buildRuntimeContext(
    new Date('2026-09-05T00:00:00.000Z'),
    'zh-CN',
    'Asia/Shanghai'
  );
  assert.match(context, /当前日期：2026-09-05/);
  assert.match(context, /当前时间：08:00:00/);
  assert.match(context, /星期：星期六/);
  assert.match(context, /Asia\/Shanghai（GMT\+08:00）/);
});

test('date tool handles calendar dates, leap years, differences, and timezone conversion', async () => {
  assert.deepEqual(
    await dateTime.runDateTime({
      operation: 'inspect',
      date_time: '2026-09-05',
      locale: 'en-US',
    }),
    { input_kind: 'calendar_date', date: '2026-09-05', weekday: 'Saturday' }
  );
  assert.equal(
    (
      await dateTime.runDateTime({
        operation: 'add',
        date_time: '2024-02-28',
        amount: 1,
        unit: 'day',
      })
    ).date,
    '2024-02-29'
  );
  assert.equal(
    (
      await dateTime.runDateTime({
        operation: 'difference',
        date_time: '2024-02-28',
        end_date_time: '2024-03-01',
        unit: 'day',
      })
    ).value,
    2
  );
  assert.equal(
    (
      await dateTime.runDateTime({
        operation: 'difference',
        date_time: '2024-01-31',
        end_date_time: '2024-02-29',
        unit: 'month',
      })
    ).value,
    1
  );
  const converted = await dateTime.runDateTime({
    operation: 'convert_timezone',
    date_time: '2026-09-05T00:00:00.000Z',
    time_zone: 'America/New_York',
    locale: 'en-US',
  });
  assert.equal(converted.date, '2026-09-04');
  assert.equal(converted.weekday, 'Friday');
});

test('date tool rejects ambiguous semantics instead of returning environment-dependent results', async () => {
  await assert.rejects(
    dateTime.runDateTime({ operation: 'inspect', date_time: '09/05/2026' }),
    /必须是 YYYY-MM-DD/
  );
  await assert.rejects(
    dateTime.runDateTime({ operation: 'inspect', date_time: '2024-02-30' }),
    /不是有效日期/
  );
  await assert.rejects(
    dateTime.runDateTime({ operation: 'inspect', date_time: '2024-01-01T00:00:00-00:00' }),
    /表示未知偏移/
  );
  await assert.rejects(
    dateTime.runDateTime({
      operation: 'add',
      date_time: '2024-03-10',
      amount: 1,
      unit: 'hour',
    }),
    /纯日期只能按/
  );
  await assert.rejects(
    dateTime.runDateTime({
      operation: 'add',
      date_time: '9999-12-31',
      amount: 1,
      unit: 'day',
    }),
    /超出 0000-9999 年范围/
  );
  const elapsed = await dateTime.runDateTime({
    operation: 'add',
    date_time: '2024-03-10T06:30:00Z',
    amount: 1,
    unit: 'day',
    time_zone: 'America/New_York',
    locale: 'en-US',
  });
  assert.equal(elapsed.arithmetic, 'elapsed_time');
  assert.equal(elapsed.date, '2024-03-11');
  assert.equal(elapsed.time, '02:30:00');
  assert.equal(
    (
      await dateTime.runDateTime({
        operation: 'inspect',
        date_time: 'milliseconds:-1',
        time_zone: 'UTC',
      })
    ).timestamp_ms,
    -1
  );
});

test('calculator preserves decimal precision and marks rounded division results', async () => {
  assert.equal(
    (await calculator.runCalculation({ operation: 'add', values: ['0.1', '0.2'] })).result,
    '0.3'
  );
  assert.equal(
    (
      await calculator.runCalculation({
        operation: 'add',
        values: ['9007199254740993', '1'],
      })
    ).result,
    '9007199254740994'
  );
  assert.equal(
    (await calculator.runCalculation({ operation: 'add', values: ['1e-30', '2e-30'] })).result,
    '0.000000000000000000000000000003'
  );
  assert.equal(
    (await calculator.runCalculation({ operation: 'round', values: ['-1.005'], precision: 2 }))
      .result,
    '-1.01'
  );
  const division = await calculator.runCalculation({ operation: 'divide', values: ['1', '3'] });
  assert.equal(division.result, '0.33333333333333333333');
  assert.equal(division.exact, false);
  assert.equal(division.rounding_mode, 'half_up');
  await assert.rejects(
    calculator.runCalculation({ operation: 'divide', values: ['1', '0'] }),
    /不能除以零/
  );
  await assert.rejects(
    calculator.runCalculation({ operation: 'divide', values: ['1e-30', '1'] }),
    /小于默认 20 位小数精度/
  );
  calculator.registerCalculatorTools();
  await assert.rejects(
    toolRegistry.toolRegistry.execute('calculate', { operation: 'add', values: [0.1, 0.2] }),
    /must be a string/
  );
});

test('unit conversion distinguishes temperatures and decimal versus binary data units', async () => {
  assert.equal(
    (
      await unitConversion.runUnitConversion({
        value: '32',
        from_unit: 'fahrenheit',
        to_unit: 'celsius',
        precision: 2,
      })
    ).output.value,
    '0'
  );
  assert.equal(
    (
      await unitConversion.runUnitConversion({
        value: '1',
        from_unit: 'mebibyte',
        to_unit: 'megabyte',
      })
    ).output.value,
    '1.048576'
  );
  const recurring = await unitConversion.runUnitConversion({
    value: '1',
    from_unit: 'meter',
    to_unit: 'foot',
  });
  assert.equal(recurring.exact, undefined);
  assert.equal(recurring.precision, 20);
  assert.equal(
    (
      await unitConversion.runUnitConversion({
        value: '1e-30',
        from_unit: 'meter',
        to_unit: 'meter',
      })
    ).output.value,
    '0.000000000000000000000000000001'
  );
  await assert.rejects(
    unitConversion.runUnitConversion({
      value: '1e-30',
      from_unit: 'meter',
      to_unit: 'foot',
    }),
    /小于默认 20 位小数精度/
  );
  await assert.rejects(
    unitConversion.runUnitConversion({
      value: '1',
      from_unit: 'meter',
      to_unit: 'kilogram',
    }),
    /必须属于同一类别/
  );
  await assert.rejects(
    unitConversion.runUnitConversion({
      value: '-459.6700000000000000001',
      from_unit: 'fahrenheit',
      to_unit: 'kelvin',
      precision: 0,
    }),
    /不能低于绝对零度/
  );
});

test('developer utilities handle Unicode, JSON, hashes, UUIDs, and bounded random integers', async () => {
  const encoded = await developerUtilities.runDeveloperUtility({
    operation: 'base64_encode',
    input: '你好 DPP',
  });
  const decoded = await developerUtilities.runDeveloperUtility({
    operation: 'base64_decode',
    input: encoded.output,
  });
  assert.equal(decoded.output, '你好 DPP');

  const hash = await developerUtilities.runDeveloperUtility({ operation: 'sha256', input: 'abc' });
  assert.equal(hash.hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    (await developerUtilities.runDeveloperUtility({ operation: 'json_validate', input: '{]' }))
      .valid,
    false
  );
  const json = '{ "id": 9007199254740993, "text": "a b", "empty": { } }';
  const formatted = await developerUtilities.runDeveloperUtility({
    operation: 'json_format',
    input: json,
  });
  assert.match(formatted.output, /9007199254740993/);
  assert.equal(
    (await developerUtilities.runDeveloperUtility({ operation: 'json_minify', input: json }))
      .output,
    '{"id":9007199254740993,"text":"a b","empty":{}}'
  );
  const stats = await developerUtilities.runDeveloperUtility({
    operation: 'text_stats',
    input: 'A😀\n中文',
    locale: 'zh-CN',
  });
  assert.equal(stats.graphemes, 5);
  assert.equal(stats.locale, 'zh-CN');
  assert.match(stats.word_definition, /Intl\.Segmenter/);
  await assert.rejects(
    developerUtilities.runDeveloperUtility({ operation: 'sha256', input: '\ud800' }),
    /未配对的 Unicode 代理项/
  );

  const uuids = await developerUtilities.runDeveloperUtility({ operation: 'uuid', count: 2 });
  assert.equal(uuids.values.length, 2);
  assert.ok(uuids.values.every((value) => /^[0-9a-f-]{36}$/.test(value)));
  const random = await developerUtilities.runDeveloperUtility({
    operation: 'random_integer',
    min: 10,
    max: 12,
    count: 20,
  });
  assert.ok(random.values.every((value) => Number.isInteger(value) && value >= 10 && value <= 12));
});

test('conservative JSON repair preserves number lexemes and commas inside strings', () => {
  const original = jsonUtilities.parseConservativeJson('{"id":9007199254740993,"text":"a,}",}');
  const repaired = jsonUtilities.parseConservativeJson('{"id":9007199254740993,"text":"a,}"}');
  const corrupted = jsonUtilities.parseConservativeJson('{"id":9007199254740992,"text":"a}"}');
  assert.equal(jsonUtilities.areJsonValuesEqual(original, repaired), true);
  assert.equal(jsonUtilities.areJsonValuesEqual(original, corrupted), false);
});

test('conservative JSON comparison ignores object order and equivalent number formatting', () => {
  const original = jsonUtilities.parseConservativeJson('{"a":1,"b":2}');
  const reordered = jsonUtilities.parseConservativeJson('{"b":2,"a":1.0}');
  assert.equal(jsonUtilities.areJsonValuesEqual(original, reordered), true);
});

test('test case delete tool is registered as a destructive confirmed operation', () => {
  testCases.registerTestCaseTools();
  const tool = toolRegistry.toolRegistry.get('test_case_delete');
  assert.ok(tool);
  assert.equal(tool.requiresConfirmation, true);
  assert.deepEqual(tool.parameters.required, ['id']);
});

test('test case import confirmation exposes only the case count', () => {
  testCases.registerTestCaseTools();
  const tool = toolRegistry.toolRegistry.get('test_case_import');
  assert.ok(tool);
  assert.equal(tool.requiresConfirmation, true);

  const content = toolConfirmation.getToolConfirmationContent('test_case_import', {
    project_name: 'Project token=PROJECT_SECRET',
    test_cases: [
      {
        title: 'Login SECRET_VALUE',
        source_text: 'password=SOURCE_SECRET',
        definition: {
          test_data: [{ name: 'password', value: 'SECRET_VALUE', sensitive: true }],
        },
      },
    ],
  });
  assert.equal(content.impact, '将导入 1 条测试用例');
  assert.doesNotMatch(JSON.stringify(content), /PROJECT_SECRET|SOURCE_SECRET|SECRET_VALUE/);

  const classified = toolCallUtils.normalizeAndClassifyToolCalls(
    [
      {
        id: 'import-1',
        type: 'function',
        function: { name: 'test_case_import', arguments: '{"test_cases":[]}' },
      },
    ],
    true
  );
  assert.equal(classified.toolCallsToConfirm.length, 1);
  assert.equal(classified.toolCallsToExecute.length, 0);
});
