# phone-balance

最新项目文件位于 `phone-balance/` 目录。

## 目录结构

- `phone-balance/index.html`
- `phone-balance/css/style.css`
- `phone-balance/js/billing-core.js`
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
- 只要至少一个通道发送成功，就会回写 `warningLastNotifiedAt`
- 如果两个通道都失败，工作流会失败并保留当前账号的待提醒状态

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
