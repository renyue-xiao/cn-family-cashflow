# 上游与原创边界

固定上游：[Wealthfolio](https://github.com/wealthfolio/wealthfolio)，提交 `75da569bb5366f6efd31dc954f6136cbd9e2f4a3`，Addon SDK 3.9.0。

本项目使用该提交的 SDK 类型契约。`vendor/wealthfolio-addon-sdk/` 中 `types.ts`、`host-api.ts`、`data-types.ts`、`permissions.ts`、`manifest.ts`、`icons.ts` 为原样保留的 MIT SDK 源文件；同目录 LICENSE 保留其版权声明。应用只做 type import，不打包 SDK 模块实现。不需要上游目录或本机绝对路径。

生命周期与构建方法参考上游 `packages/addon-dev-tools/templates/addon.tsx.template`、`vite.config.ts.template`、`manifest.json.template`：ES module default enable(ctx)、声明式 route、React 由宿主提供、不在 addon 内创建 React root。CSS 单独打包到 dist，由宿主 sandbox 安装。

Wealthfolio 主应用采用 AGPL-3.0；SDK 包有独立 MIT 许可。本项目未复制宿主应用业务实现。原创领域模型、计算、界面、适配器、样例和测试采用本项目 MIT LICENSE。将来若复制或修改宿主 AGPL 代码，应另行遵守其许可，不能以 SDK MIT 代替。

原创增量：家庭/企业归属、整数分、逐日现金账、收入/借款/本金/利息分离、目标付款日、工资中断、还款表及来源化解释材料。账户/估值读取、scoped storage、路由和文件保存是宿主现成功能。

真实调用：`accounts.getAll`、`portfolio.getLatestValuations`、`alternativeAssets.getAll`、`storage.get/set`、`files.openSaveDialog`。输入文件用 DOM File API；不依赖 Web 实现返回 null 的 `files.openCsvDialog`。未请求宿主网络权限或模型接口。

验证边界：类型编译、纯计算、原适配器函数配 API 返回桩、两个构建与 ZIP 结构。真实 Wealthfolio 安装、权限提示、文件保存对话框、热加载及数据库持久化未实际运行，不能声称宿主集成验收通过。
