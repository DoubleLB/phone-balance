# 跨设备同步配置

当前页面已启用 Supabase 免费项目同步。打开网站会直接进入中国广电余额页面，不需要登录，也不需要输入同步码。

## 当前配置

- GitHub Pages: https://doublelb.github.io/phone-balance/
- Supabase Project URL: https://rhkzsyhxezlppfxqzalm.supabase.co
- Supabase Project ref: `rhkzsyhxezlppfxqzalm`
- Table: `public.balance_state`
- Row ID: `china_broadcasting`
- Frontend key type: publishable public key

## 数据表

```sql
create table if not exists public.balance_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.balance_state enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.balance_state to anon, authenticated;

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

## 同步规则

- 页面启动时先读取本地 `localStorage`，再拉取云端数据。
- 云端数据更新时间更新时，会覆盖本地数据。
- 用户保存设置、充值或刷新结算后，会自动把最新状态写入云端。
- 如果网络不可用，页面仍可本地使用，恢复网络后再次保存会继续同步。

## 重要说明

无登录、无同步码的同步方式，本质上是让这个页面读写同一条云端记录。它适合个人私用网址；只要别人知道网址，也可能修改这份余额数据。

不要把 Supabase service role key、数据库密码或 GitHub token 写入前端页面。
