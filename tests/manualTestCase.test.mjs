import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('manual test case creation starts with a project and persists the case in it', () => {
  const library = source('../src/features/aiAssistant/components/AIMaterialLibraryView.tsx');
  const projectLibrary = source(
    '../src/features/aiAssistant/components/TestProjectLibraryView.tsx'
  );
  const projects = source('../src/lib/db/testProjects.ts');

  assert.match(library, /createTestProject/);
  assert.match(library, /createTestCaseInProject/);
  assert.match(library, /const \[creatingProject, setCreatingProject\] = useState\(false\)/);
  assert.match(
    library,
    /const \[creatingProjectId, setCreatingProjectId\] = useState<string \| null>\(null\)/
  );
  assert.match(library, /onClick=\{handleCreate\}/);
  assert.match(library, /手动创建/);
  assert.match(library, /material\?: DecryptedTestCaseMaterial/);
  assert.match(library, /await createTestCaseInProject\(projectId, input\)/);
  assert.match(library, /测试用例已创建并归入项目/);
  assert.match(library, /onCreateTestCase=\{\(projectId\) =>/);
  assert.match(projectLibrary, /onCreateTestCase: \(projectId: string\) => void/);
  assert.match(projectLibrary, /onClick=\{\(\) => onCreateTestCase\(project\.id\)\}/);
  assert.doesNotMatch(projectLibrary, /选择测试用例/);
  assert.match(projects, /testCases: \[\]/);
  assert.match(projects, /db\.transaction\('rw', db\.materials, db\.testProjects/);
  assert.match(projects, /testCaseMaterialId: testCase\.id/);
});
