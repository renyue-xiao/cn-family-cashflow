# 开发与代码审查

使用 Node 24 LTS 和 Python 3.12。先运行 `npm ci`，不使用未锁版本的运行时或开发依赖。新增依赖需说明用途，并提交 `package.json` 与 `package-lock.json`。

## 提交前检查

```sh
npm run format
npm run format:check
npm run lint
npm test
npm run build
npm run verify:addon
git diff --check
```

`build` 首先运行 TypeScript 检查，然后分别构建独立站点与插件并打包。`verify:addon` 导入真实构建模块，用最小上下文桩检查入口、路由和清理注册，不等价于真实 Wealthfolio 安装。实际宿主测试结果应单独说明。

Prettier 统一 TypeScript、React、CSS、JSON、Markdown 与工作流格式；ESLint 检查 TypeScript 推荐规则及 React Hooks 规则。保持警告为零，不为通过检查加入全局禁用。`vendor/` 为上游原样 SDK，格式化和 lint 排除该目录；构建产物也排除，修改源文件后重新生成。

## 修改业务逻辑

现金金额始终为整数分。家庭/企业、估值/可用现金、收入/借款、本金/利息、付款日顺序是业务契约，改动需保留相应不变量测试。界面编辑先经过 `validatePlan`，失败保持原有效状态。宿主输入可能违反声明类型，运行时校验不能省略；仅在故意构造非法输入的测试边界使用明确的 `unknown` 转换。

先做与改动相称的测试，再运行检查链。纯格式整理不新增复述实现的测试。涉及界面时检查编辑、恢复、导入导出与窄屏，涉及异步适配器时检查失败、取消和状态恢复。上游 SDK 文件若必须升级，应独立提交并更新来源提交与许可证说明。

## 分支与 Pull Request

从 `main` 创建主题分支，小范围提交；以 SSH 远端推送并发起 GitHub PR。描述具体问题、行为变化、验证结果和未验证边界，避免把 API 桩验证写成宿主集成通过。检查最终 diff、CI 与 GitHub 代码审查意见后再合并。不能把尚未发生的审查或本地检查称作 GitHub CI 通过。

CI 在 PR 及 `main` 推送运行安装、格式、lint、测试、类型/双构建与插件入口验证；Actions 使用固定 SHA，仓库权限只读。工作流不携带模型密钥，也不自动发布或交易。
