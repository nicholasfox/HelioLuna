# HelioLuna / 日月 — 三体天文模拟器

基于 Three.js + [Astronomy Engine](https://github.com/cosinekitty/astronomy) 的交互式 3D 天文可视化。

## 功能

- 五种视角：日心、地心、月心、地表、月表
- 真实时间轴，以春分点为起始，支持任意年份
- 日月位置实时计算（Astronomy Engine，精度 ±1′）
- 地表/月表模式：鼠标拖拽旋转、滚轮缩放
- 自动跟踪：太阳跟踪 / 对侧天体跟踪
- 预设城市/月面坐标快速定位
- 昼夜明暗平滑过渡、星光白天渐隐（仅地球）
- 月球潮汐锁定、自转轴正确显示

## 使用

直接打开 `index.html` 即可运行：

```bash
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

或使用 VSCode Live Server 等任意静态服务器。

**操作说明：**

1. 切换到「地表」或「月表」模式
2. 点击天体表面选点，或从下拉菜单选择预设
3. 点击「确认选点」进入地面视角
4. 鼠标拖拽旋转，滚轮缩放
5. 时间轴可拖拽、播放、跳转日期、选择年份

## 技术栈

- [Three.js](https://threejs.org/) — 本地库，无 CDN 依赖
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — 高精度星历计算（VSOP87 + NOVAS）
- 纯前端，无后端依赖

## 许可

MIT
