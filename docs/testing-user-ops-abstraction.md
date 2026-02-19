# 用户操作抽象化 - 测试文档

本文档描述了用户操作抽象化功能的自动化测试方案。

## 测试环境准备

### 1. 启动开发服务器

用户已经帮你启动
你直接在浏览器打开'chrome-extension://ojabcppnngnamjmnojnodjmabipbnpgi/sidepanel.html'就可以开始测试

### 2. 使用 Chrome DevTools MCP 连接浏览器

确保 Chrome DevTools MCP 已正确配置，能够自动化控制浏览器。

---

## 测试用例设计

### 1. Links 模块测试

| 测试用例                 | 描述               | 验证点           |
| ------------------------ | ------------------ | ---------------- |
| `test_links_add`         | 通过AI工具添加链接 | 链接存在于列表中 |
| `test_links_togglePin`   | 切换链接置顶状态   | 置顶状态正确切换 |
| `test_links_recordVisit` | 记录链接访问       | usageCount 递增  |
| `test_links_bulkAdd`     | 批量添加链接       | 所有链接成功创建 |
| `test_links_delete`      | 删除链接           | 链接被软删除     |

#### 测试脚本示例：links_togglePin

```javascript
// 测试 links_togglePin
await click('[data-testid="tab-links"]');
await wait_for('not([data-testid="loading"])');

// 获取第一个链接的ID并切换置顶
const linkElement = await wait_for('[data-testid^="link-"]');
const linkId = linkElement.getAttribute('data-testid').replace('link-', '');

// 切换置顶
await evaluate_script(`window.__AI_TOOLS__.links_togglePin({ id: '${linkId}' })`);

// 验证置顶状态
const isPinned = await evaluate_script(`
  window.__DB__.linkStats.get('${linkId}').then(s => !!s?.pinnedAt)
`);
assert(isPinned === true, 'Link should be pinned');
```

---

### 2. Recorder 模块测试

| 测试用例                    | 描述         | 验证点             |
| --------------------------- | ------------ | ------------------ |
| `test_recorder_list`        | 列出所有录制 | 返回正确的录制列表 |
| `test_recorder_delete`      | 删除指定录制 | 录制被删除         |
| `test_recorder_clear`       | 清空所有录制 | 录制列表为空       |
| `test_recorder_updateTitle` | 更新录制标题 | 标题正确更新       |
| `test_recorder_import`      | 导入录制JSON | 录制成功导入       |
| `test_recorder_export`      | 导出录制JSON | 返回正确的JSON数据 |

---

### 3. Blackboard 模块测试

| 测试用例                    | 描述             | 验证点           |
| --------------------------- | ---------------- | ---------------- |
| `test_blackboard_togglePin` | 切换便签置顶状态 | 置顶状态正确切换 |

---

### 4. Tags 模块测试

| 测试用例                   | 描述                  | 验证点            |
| -------------------------- | --------------------- | ----------------- |
| `test_tags_add_no_color`   | 不带color参数添加标签 | 自动生成随机颜色  |
| `test_tags_add_with_color` | 带color参数添加标签   | 使用指定颜色      |
| `test_tags_toggle`         | 切换标签关联          | 关联正确添加/移除 |

---

### 5. Jenkins 模块测试
！暂时不用测试

| 测试用例                 | 描述            | 验证点           |
| ------------------------ | --------------- | ---------------- |
| `test_jenkins_sync`      | 同步Jenkins数据 | 任务列表更新     |
| `test_jenkins_switchEnv` | 切换Jenkins环境 | 当前环境正确切换 |

---

## 一致性验证测试

验证通过UI和AI工具执行相同操作产生一致的结果：

```javascript
// 1. 通过UI添加链接
await click('[data-testid="tab-links"]');
await click('[data-testid="add-link-button"]');
await fill('[data-testid="link-name-input"]', 'Test Link');
await fill('[data-testid="link-url-input"]', 'https://example.com');
await click('[data-testid="save-link-button"]');

// 2. 通过AI工具添加相同链接
await evaluate_script(`
  window.__AI_TOOLS__.links_add({
    name: 'Test Link',
    url: 'https://example.com'
  })
`);

// 3. 验证结果一致
const links = await evaluate_script('window.__DB__.links.toArray()');
assert(links.length === 1, 'Should have exactly one link');
```

---

## 测试数据清理

每个测试前后进行数据清理：

```javascript
async function cleanup() {
  await evaluate_script('window.__DB__.links.clear()');
  await evaluate_script('window.__DB__.tags.clear()');
  await evaluate_script('window.__DB__.recordings.clear()');
  await evaluate_script('window.__DB__.blackboard.clear()');
}
```

---

## 执行测试命令

```bash
# 启动开发服务器
pnpm dev

# 在另一个终端或使用 MCP 执行自动化测试脚本
npx chrome-devtools-mcp run-tests --suite user-ops-abstraction
```

---

## 测试覆盖率目标

| 模块       | 覆盖率              |
| ---------- | ------------------- |
| Links      | 100% (5/5 测试用例) |
| Recorder   | 100% (6/6 测试用例) |
| Blackboard | 100% (1/1 测试用例) |
| Tags       | 100% (3/3 测试用例) |
| Jenkins    | 100% (2/2 测试用例) |

**总计**: 17所有新增和修改的功能

---

## 个测试用例，覆盖 关键验证点

### 1. 功能一致性

- UI 操作和 AI 工具操作应产生相同的结果
- 数据库状态应保持一致

### 2. 错误处理

- 无效输入应返回有意义的错误信息
- 边界情况应有适当处理

### 3. 性能

- 批量操作应使用事务确保原子性
- 大量数据操作不应阻塞 UI

---

## 测试报告

测试完成后，生成以下报告：

- **通过率**: X/Y 测试用例通过
- **失败用例**: 列出失败的测试及原因
- **执行时间**: 总执行时间
- **建议**: 如有失败，提供修复建议
