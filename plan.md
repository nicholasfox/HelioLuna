# 日月食教育演示项目 — 实施计划

## 技术栈
- **框架**: Vanilla JS + CesiumJS 1.119 (CDN) + astronomy-engine (npm)
- **开发服务器**: Vite
- **布局**: 1个大窗口（太阳系全景）+ 4个小窗口（不同视角）

## 8步实施计划

### 第一步：项目初始化
- `package.json`：依赖 `astronomy-engine` + `vite`
- `index.html`：Cesium CDN + 5个Viewer容器 + 布局CSS
- 目录结构：`src/` 下分模块

### 第二步：HTML 结构 + 5个 Viewer 初始化
- 大窗口（~70%宽）：太阳系全景，禁用Earth Globe
- 4个子窗口（2x2网格，~30%宽）：
  - 子窗1：地面→看太阳（保留Globe+卫星瓦片）
  - 子窗2：地面→看月亮（保留Globe+卫星瓦片）
  - 子窗3：太阳→看地球（禁用Globe）
  - 子窗4：地心锁定（禁用Globe）
- 初始化错开 300ms 避免 WebGL context 冲突
- 均使用 ICRF 惯性系模式（satorb loader.js 模式）

### 第三步：EntityManager + Config
- `EntityManager`：统一管理跨5个Viewer的实体添加/更新/删除
- 需要两组坐标体系：
  - 主窗口：日心坐标系（Heliocentric）
  - 子窗口：地心坐标系（Geocentric ICRF）

### 第四步：历元计算（ephemeris.js）
- 使用 Cesium 内置 `Simon1994PlanetaryPositions` 计算日、月在ICRF中的位置
- 提供两套接口：
  - `getHeliocentricPositions(time)` → 主窗口使用（太阳在原点）
  - `getGeocentricPositions(time)` → 子窗口使用（地球在原点）
- 后续扩展：使用 `astronomy-engine` 计算8大行星位置

### 第五步：太阳系实体（solarSystem.js）
- 创建太阳（黄色发光球体）、地球（蓝绿色球体）、月球（灰色球体）
- 半径乘以放大系数（如1000x）以保证在AU尺度下可见
- 绘制地球轨道（黄道面圆圈）和月球轨道
- 标记4个分至点位置（春分/秋分/夏至/冬至）
- 在 `scene.preUpdate` 中实时更新位置

### 第六步：地球特征（earthFeatures.js）
- 赤道（红色线）、南北回归线（橙色线）、自转轴（黄色线）
- 广州坐标标记（113.2644°E, 23.1291°N）
- 支持点击地球表面选择位置（ScreenSpaceEventHandler）
- *注意*：只在子窗1和子窗2添加（保留Globe的视图）

### 第七步：4个子窗口相机控制（cameraViews.js）
- **子窗1**：相机固定于地表坐标（如广州），`lookAt` 太阳，实时追踪
- **子窗2**：相机固定于地表坐标，`lookAt` 月亮，实时追踪
- **子窗3**：相机置于太阳附近（偏移避免遮挡），方向指向地心，观察四季变化
- **子窗4**：相机置于地心附近，构建正交基使太阳方向固定于屏幕，同时可见月球绕地

### 第八步：后续迭代（本次骨架完成后）
- 时间控制（Cesium Clock 共享）
- 教学比例/真实比例切换
- 坐标输入面板
- 8大行星完整支持
- 日月食阴影锥计算与可视化
- 界面汉化

## 关键设计决策

### 坐标系选择
- 所有Viewer使用 **ICRF（国际天球参考系）** 惯性系
- 主窗口：日心坐标系（太阳在原点）
- 子窗口：地心坐标系（地球在原点）
- 使用 satorb `loader.js` 的 ICRF 相机模式

### 尺度处理
- 轨道距离保持真实值（AU尺度）
- 行星半径放大（默认1000x）以保证可见
- 提供教学/真实比例切换

### 缩放策略（重要）
各个行星与太阳的实际半径对比和距离差异极大，教学演示建议：
- 行星大小：独立放大系数，至少保证在太阳系全景下看到行星
- 轨道距离：保持真实比例，让用户理解相对距离

## 参考项目
- `/home/nicholas/workspace/agents/satorb/html/loader.js` — ICRF相机模式核心代码
