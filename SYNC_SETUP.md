# 跨设备同步配置

当前页面已经内置云同步代码，但没有写入任何云端密钥。未配置时仍然使用本地 `localStorage`。

## 推荐方案：Supabase 免费项目

1. 注册并创建 Supabase 项目。
2. 打开 SQL Editor，执行：

```sql
create table if not exists public.balance_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.balance_state enable row level security;

create policy "public read balance state"
on public.balance_state
for select
using (id = 'china_broadcasting');

create policy "public insert balance state"
on public.balance_state
for insert
with check (id = 'china_broadcasting');

create policy "public update balance state"
on public.balance_state
for update
using (id = 'china_broadcasting')
with check (id = 'china_broadcasting');
```

3. 在 Supabase Project Settings -> API 里复制：
   - Project URL
   - anon public key
4. 修改 `index.html` 里的配置：

```js
var CLOUD_SYNC = {
  enabled: true,
  supabaseUrl: "你的 Project URL",
  anonKey: "你的 anon public key",
  table: "balance_state",
  rowId: "china_broadcasting"
};
```

5. 重新提交并部署到 GitHub Pages。

## 重要说明

无登录、无同步码的同步方式，本质上是让这个页面读写同一条云端记录。只适合个人私用网址。只要别人知道你的网址，也可能修改这份余额数据。
