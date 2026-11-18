# phone-balance

最新项目文件位于 `phone-balance/` 目录。

## 目录结构

- `phone-balance/index.html`
- `phone-balance/css/style.css`
- `phone-balance/js/billing-core.js`
- `phone-balance/js/accounts-core.js`
- `phone-balance/js/sync-core.js`
- `phone-balance/js/app.js`
- `phone-balance/svg/`
- `scripts/wxpusher-notify.mjs`
- `.github/workflows/wxpusher-notify.yml`

## 本地使用

直接打开 `phone-balance/index.html` 即可。

## GitHub Pages

仓库根目录的 `index.html` 会自动跳转到 `phone-balance/index.html`，用于兼容当前发布入口。

## 云端同步

页面已接入 Supabase，用于保存账号配置、余额、预警规则和同步状态。不同设备访问同一个发布地址时，会读取并写入同一份远程数据。

页面启动时会先完成云端水合，再执行自动结算和自动上传。清理浏览器缓存后，如果云端已有数据，设备会直接使用云端数据，不会先把内置默认值结算后上传覆盖云端。

同步时按账号记录手动修改时间与结算时间：不同账号的修改各自保留；同一账号优先使用较新的手动配置，再比较自动结算时间，防止旧设备的自动扣费撤销停用状态。删除标记对同一账号编号始终生效。保存远程数据时使用 `updated_at` 条件更新并在并发冲突时自动重读合并。

每个账号的“充值余额”面板会保存充值时间、充值金额和充值后余额。修改充值金额会按差额修正当前余额及后续记录，删除记录会扣回对应充值金额；充值流水随账号数据同步到其他设备，不单独保存操作备份。

同步回归测试：`node scripts/sync-regression.mjs`

## 账号管理

首页展开“账号管理”，可以新增号码、修改号码/运营商/账号类型、选择计费方式、设置余额、停用、注销、隐藏或删除。详情页顶部“编辑账号”可进入同一编辑表单。

- 使用中：按所选计费方式自动扣费，并执行预警规则。
- 已停用 / 已注销：停止自动扣费及两种后台提醒，余额和充值记录保留。恢复使用时从恢复当天继续计费，不补扣停用期间费用。
- 在首页隐藏：不显示在首页账号列表、余额合计及月费合计中；在账号管理中仍可查看、编辑和重新显示。隐藏本身不停止使用中账号的扣费或提醒。
- 删除：从界面移除账号及其充值记录，停止计费和提醒；同步中保留删除标记，防止旧设备恢复已删除账号。再次添加同一号码会生成新的账号编号。

联通宽带暂停使用时，在“账号管理”中编辑对应账号，状态选择“已停用”，勾选“在首页隐藏”，然后保存。需要保留首页标识时可以不隐藏。

新增账号支持月费按自然天分摊、固定日费、月末一次扣费，原有账号不受新增功能影响。首次升级不会自动改变任何已有账号状态或余额；请按实际情况设置停用状态及当前余额。后台写回前会重新读取最新账号及状态，通过版本条件更新，避免旧任务覆盖刚保存的配置。

账号与计费回归测试：`node scripts/accounts-regression.mjs`。浏览器集成测试：`node scripts/accounts-browser-check.cjs`，需要可用的 Playwright；可通过 `PLAYWRIGHT_MODULE` 和 `BROWSER_PATH` 指定本地工具路径。浏览器测试拦截全部网络请求、使用模拟 Supabase，不会操作真实账号数据。

后台写回与双通道模拟测试：`node scripts/notify-state-regression.mjs`，不发送真实消息。

参数设置中的未保存修改不会被每 30 秒的自动同步覆盖；未修改的字段仍跟随云端更新。保存只提交实际编辑的字段，避免关闭通知时顺带覆盖其他设备刚更新的余额。提示“设置已保存并同步到云端”才表示云端确认；若显示“仅保存到本机”，后台仍可能使用旧规则，请重试同步。

## 后台通知

项目当前使用 `GitHub Actions + WxPusher + Server酱 Turbo` 做后台提醒。页面关闭后，定时任务仍会按同一套预警规则检查远程数据并发送微信提醒。

工作流文件：

- `.github/workflows/wxpusher-notify.yml`

通知脚本：

- `scripts/wxpusher-notify.mjs`

默认逻辑：

- 每 30 分钟执行一次
- 先按现有计费规则自动结算到昨天
- 再逐个账号检查是否触发预警
- 已启用提醒的账号会同时尝试 `WxPusher` 和 `Server酱 Turbo`
- 每个通道提交前单独重读云端；已停用、已注销、已删除或关闭提醒的账号会跳过，并在任务日志注明原因。若在第一个通道发送期间关闭提醒，第二个通道会重新检查；已经提交给平台的消息无法撤回。
- 只要至少一个通道发送成功，就会回写 `warningLastNotifiedAt`
- 如果两个通道都失败，工作流会失败并保留当前账号的待提醒状态

`DRY_RUN=1` 仅预览判断，不发送消息、不写入余额或通知冷却记录。

## 需要配置的 GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions` 中配置：

- `WXPUSHER_APP_TOKEN`
- `WXPUSHER_UIDS`
- `SERVERCHAN_SENDKEY`

说明：

- `WXPUSHER_APP_TOKEN`：WxPusher 应用的 AppToken
- `WXPUSHER_UIDS`：接收人的 UID，多个 UID 用英文逗号分隔
- `SERVERCHAN_SENDKEY`：Server酱 Turbo 的 SendKey

## 触发规则来源

每个账号的提醒规则由页面里的“参数修改 / 预警设置”决定，当前支持：

- 是否启用提醒
- 触发模式：按余额 / 按预计可用天数
- 触发阈值
- 冷却时间（小时）
因此，不同手机号可以使用不同的触发条件，后台任务会分别判断；触发后两个通知通道会同时尝试发送。

## 登录说明

当前版本仍保持“打开网站直接进入”的方式。若后续需要真正区分用户登录，需要加入 Supabase Auth 或独立后端，并配合 Row Level Security、用户表和每用户数据隔离；这不是小改动，会明显影响现有同步结构和配置流程。

## 计费核心

前端页面和后台通知共用 `phone-balance/js/billing-core.js` 中的计费、结算、预警判断逻辑。后续修改广电、联通、移动、电信的扣费规则时，优先修改这一份核心文件，避免页面显示和后台提醒不一致。

## 缓存版本

页面会在加载时自动给 CSS 和 JS 追加版本参数，发布后手机浏览器会优先读取最新文件，不需要每次手动修改 `?v=` 后缀。
