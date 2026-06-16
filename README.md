# phone-balance

最新项目文件位于 `phone-balance/` 目录。

## 目录结构

- `phone-balance/index.html`
- `phone-balance/css/style.css`
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
- `warningChannel = "browser"` 的账号不会走后台微信提醒
- 其余已启用提醒的账号会同时尝试 `WxPusher` 和 `Server酱 Turbo`
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
- 通知渠道

因此，不同手机号可以使用不同的触发条件，后台任务会分别判断。
