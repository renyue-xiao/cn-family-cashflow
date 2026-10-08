# 本轮代码质量检查

范围：`feat/initial-release`，相对加固前 `1645f9e` 的 changed-only 检查。日期：2026-10-08。结论：**PASS（本地检查）**；GitHub CI 与代码审查仍需推送后执行。

| 阶段       | 实际结果                                                                            |
| ---------- | ----------------------------------------------------------------------------------- |
| 既有测试   | 12/12通过，无新增复述格式的测试                                                     |
| 导入完整性 | 独立入口构建通过；addon 构建模块真实 import，通过上下文桩注册路由与清理             |
| 静态检查   | ESLint 10 / TypeScript recommended / React Hooks recommended；0错误、0警告          |
| 类型检查   | `tsc --noEmit` 通过；编辑器显式any移除，非法测试输入限制在unknown边界               |
| 业务验证   | 既有工资中断、现金/估值、借款/收入、本金/利息、日期顺序、导入恢复和宿主缺值用例通过 |
| 前端验证   | 独立与addon构建通过；本轮未重新执行浏览器交互或真实宿主安装                         |
| 文件一致性 | format check、git diff check通过；vendor SDK无修改，生成物不纳入格式/lint           |
| 文档       | 新增CONTRIBUTING，说明锁定依赖、提交检查链、PR与验证边界                            |

运行环境：本地 Node 26.3.1。已从 lockfile 执行 npm ci；CI配置 Node 24、Python 3.12，Actions固定SHA，权限仅contents:read。当前本地结果不能替代GitHub运行结果。

既有测试的原生Node覆盖率：实际加载的 adapters/domain/import/samples 四个模块合计行95.26%、分支80.98%、函数96.72%；**这不是整个应用覆盖率**，不含React界面、解释材料与真实宿主。领域模块行99.54%、分支85.25%。

除统一格式、类型收窄外，实际变化：输入草稿按已确认值key重置；存储恢复effect依赖adapter，addon在enable时创建稳定adapter；CSV包装异常保留cause。金额、日期和预测口径保持既有测试结果。

复现：`npm ci && npm run format:check && npm run lint && npm test && npm run build && npm run verify:addon`。覆盖率另运行 `node --test --experimental-test-coverage tests/*.test.ts`。
