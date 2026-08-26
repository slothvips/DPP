export const TEST_CASE_IMPORT_PROMPT = `我需要把自然语言描述导入 DPP 的测试用例库。

请进入“测试用例导入”流程：
1. 引导我描述测试目标、目标网页、前置条件、操作步骤和预期结果。
2. 每个测试用例必须明确一个或多个目标 URL。
3. 多个目标 URL 按顺序访问，并属于同一个测试流程，例如 A -> B -> C。
4. 为每个步骤明确它所属的目标网页。
5. 预期结果只按自然语言记录，不要生成 DOM 选择器或可执行断言。
6. 账号、密码、Token 等用户明确提供的测试数据可以保留在测试用例中，但不要在普通回复、日志或报告中重复输出。
7. 这次只负责整理和导入测试用例，不要打开网页，也不要执行测试任务。
8. 信息不足时先向我提问，不要自行猜测。
9. 信息完整后，直接将结构化测试用例保存到团队共享测试用例库，并告诉我保存了哪些用例。
10. 一次描述多个测试场景时，拆分成多条独立测试用例。

我接下来会描述需要导入的测试用例。`;

export function buildTestCaseExecutionPrompt(title: string, id: string): string {
  return `请执行测试用例：${title}
测试用例 ID：${id}

执行要求：
1. 先调用 test_case_get 读取该测试用例的完整结构和目标 URL 顺序。
2. 调用 test_run_start 创建一次新的测试执行记录，并保存返回的 run_id。
3. 严格按照步骤 order 串行执行；每次只处理一个步骤和一个网页子 Agent。
4. 每个 delegate_browser_agent 只处理当前步骤，必须提供对应目标网页 ID、test_target_id、initial_url=该目标 URL 和 open_new_tab=true，为每个目标网页使用独立任务标签页；共享账号、订单或其他外部状态时必须额外提供 resource_keys。
5. 开始每个步骤前调用 test_run_update_step 设置 current_step_id；一次只提交一个步骤。
6. 每个网页子 Agent 只执行一个测试步骤，返回 JSON：{"status":"passed | failed | blocked","actualResult":"实际观察结果","detail":"补充说明"}。
 7. 只有解析出合法 JSON 且 status、actualResult 合法时才能保存结果；解析失败必须保存 blocked，不能猜测为 passed。保存 blocked 时不要传 current_step_id。
8. 每个步骤完成后立即调用 test_run_update_step 保存结果，并把网页子 Agent 返回的原始 JSON 传给 agent_result 供 DPP 校验。
9. failed 步骤保存后继续执行未完成步骤；blocked 或 stopped 后停止相关执行，不得猜测为通过。
10. 全部步骤完成后调用 test_run_finish 保存 passed、failed、blocked 或 stopped 报告及原因；passed 只能用于所有步骤均通过的执行。
11. 测试运行工具保存失败时停止网页操作；系统会将当前执行记录结束为 stopped，不要继续假装执行成功。
12. 用户取消、停止会话、网页任务停止或侧栏关闭时，必须将执行记录结束为 stopped 或 blocked；不要留下 running 状态。
13. 不要截图，不要录像。不要在普通回复、日志或报告中重复密码、Token 或其他敏感测试数据。`;
}

export function buildPromptTestCasesSection(): string {
  return `## 测试用例导入与执行

当用户明确要求导入测试用例时，进入“测试用例导入”流程：
- 当前流程只负责解析和保存，不打开网页，不执行测试任务。
- 信息不足时必须先追问，不能猜测后保存。用户只说“登录页”“管理后台”等模糊目标时，必须追问明确 URL。
- 每个测试用例至少包含测试目标、一个目标 URL 和一个步骤；多个 URL 必须明确访问顺序。
- 目标 URL 必须是 http:// 或 https://，targets.order 必须连续且唯一。
- 每个步骤必须有唯一 ID、连续 order，并通过合法 target_id 关联目标网页。
- 预期结果只记录自然语言，不生成 DOM 选择器、CSS 选择器或可执行断言表达式。
- 用户明确提供的账号、密码、Token 等测试数据可以写入测试用例；必须标记 sensitive=true，不要在普通回复、日志或报告中重复这些值。
- 信息完整后必须调用 test_case_import 直接保存，不要只输出 Markdown 后声称已经保存。
- 只有 test_case_import 返回成功后，才能告诉用户保存成功；工具失败时必须明确报告失败。
- 一次描述多个测试场景时，拆分为多条独立测试用例后一次批量导入。
- 用户要求修改已有测试用例时，先调用 test_case_list 或 test_case_get 找到目标并读取当前版本，再调用 test_case_update 提交完整定义；不能静默新建一条替代旧用例。
- test_case_update 只在用户明确要求更新时调用，工具失败时不能声称更新成功。

当用户要求执行测试用例时，按步骤 order 串行执行，每次只委派一个网页步骤并单独保存结果。failed 结果允许继续后续步骤，blocked 或 stopped 后停止；delegate_browser_agent 的 success 不等于测试通过，必须根据受限 JSON 中的实际预期判断步骤状态。

查询已有测试用例时，先使用 test_case_list 按标题查找，再使用 test_case_get 读取完整定义。不要把测试数据明文放入无关工具调用。`;
}
