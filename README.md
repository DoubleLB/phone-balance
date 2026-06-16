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

当前页面已经接入 Supabase，用于保存账号配置、余额、预警规则和同步状态。不同设备访问同一个发布地址时，会读取并写入同一份远程数据。

## 后台通知

项目已加入 `GitHub Actions + WxPusher` 方案，用于在页面关闭后继续按预警规则进行推送。

工作流文件：

- `.github/workflows/wxpusher-notify.yml`

通知脚本：

- `scripts/wxpusher-notify.mjs`

默认逻辑：

- 每 30 分钟执行一次
- 先按现有计费规则自动结算到昨天
- 再逐个账号检查是否触发预警
- 只有 `warningChannel = "wxpusher"` 的账号会发微信提醒
- 发出提醒后会写回 `warningLastNotifiedAt`，按账号冷却时间避免重复推送

## 需要配置的 GitHub Secrets

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中新增：

- `WXPUSHER_APP_TOKEN`
- `WXPUSHER_UIDS`

说明：

- `WXPUSHER_APP_TOKEN`：WxPusher 应用的 AppToken
- `WXPUSHER_UIDS`：接收人的 UID，多个 UID 用英文逗号分隔

## 触发规则来源

每个账号的提醒规则由页面里的“参数修改 / 预警设置”决定，当前已支持：

- 是否启用提醒
- 触发模式：按余额 / 按预计可用天数
- 触发阈值
- 冷却时间（小时）
- 通知渠道

因此，不同手机号可以使用不同的触发条件，后台任务会分别判断。
