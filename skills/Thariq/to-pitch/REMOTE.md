# Remote 分享（Tailscale）

用户提到 remote、手机、Tailscale 时走这条路径：把 pitch 做成一份手机经 Tailscale 直接访问的单页 HTML，现场起服务，终端交付二维码。

## 流程

1. **产出页面**：把 pitch 内容做成**单文件 HTML**，写入系统临时目录（目录名按主题自取）。手机能看靠两个硬条件：全部资源内联、viewport 自适应。主文件的两条阅读路径（explainer / pitch）落成页面顶部的一对切换按钮。demo 用 CSS/JS 动画代替 GIF——动画是可选加分项，静态截图兜底。
   完成标准：页面文件已在临时目录就位，所有引用均为内联资源。

2. **取 IP**：`tailscale ip -4` 查本机 IP，`tailscale status` 确认目标手机在线。IP 与主机名一律运行时查询，用时注入命令，写进任何文件的都是占位符。
   完成标准：目标手机在 `tailscale status` 输出中处于在线状态（不带 offline 标记）。

3. **起服务**：在页面目录后台运行 `python3 -m http.server <port> --bind 0.0.0.0`（`nohup … &`，日志落 /tmp）。端口选非常用高位（8765 这个量级）；被占用就换一个再起。
   完成标准：`curl` 对 `127.0.0.1:<port>` 和 Tailscale IP 各返回 200。

4. **交付**：终端双通道给出地址——`qrencode -t ANSIUTF8 "http://<tailscale-ip>:<port>/"` 渲染二维码，旁附明文 URL。同时告知：服务在后台运行、如何停（按端口找到进程 kill）。
   完成标准：二维码与明文 URL 都已在终端展示，停止方法已告知用户。

## Fallback

`tailscale` 未安装、未登录，或手机不在线：报告具体原因，回退主路径（粘贴即发）。用户可以去修 Tailscale 后重跑这条路径，或接受普通交付。
