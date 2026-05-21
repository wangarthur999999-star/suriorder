你是一个 UI 设计师，为 SuriOrder（苏里南餐厅 WhatsApp 点餐 SaaS）重新设计顾客点餐页面。

## 项目背景

- 苏里南（南美）餐厅用的免费点餐平台，手机优先
- 这页是顾客扫码后看到的菜单+下单页（C 端核心页面）
- 产品气质：**「古董纸质菜单」**——像法国小镇 Bistro 的厚纸食单，手感温润，不像冷冰冰的 App
- 品牌色：**#16a34a** 绿色（主操作）。点缀色：**#f97316** 橙色（仅用于强调价格/徽章）。WhatsApp 绿：**#25D366**
- **底色从浅灰改为暖米白**：#faf6eb（暖调宣纸白），不是冷灰
- 卡片：**#fff**（纯白）

## 参考设计方向

参考两个设计语言，融合其精华：

**方向A（Stitch — 现代暖工具感）：**
- Header 翡翠绿渐变 + 径向高光叠加（circle at 80% 20%）
- 分类导航毛玻璃 sticky（backdrop-filter: blur(14px)）
- 菜品卡片多层微阴影 + inset 白色高光（厚纸卡片感）
- 加减按钮绿色实心圆 + 发光阴影
- 购物车固定底部毛玻璃 + 顶部柔阴影
- 弹窗底部弹出式 bottom sheet

**方向B（Remix — 古董纸质菜单感）：**
- 暖米白底色 #faf6eb + 点阵纹理
- Header 深绿 emerald 渐变（#059669 → #064e3b）+ 底部 24px 圆角
- 分类标签做成**档案夹标签**式——白色凸起卡片，选中态向上平移 + 更有层次的阴影
- 菜品卡片做成**复古餐券**式——两侧微锯齿穿孔边（用伪元素小半圆模拟）
- emoji 区做成**邮票式**——16px 圆角底色方块 + 虚线外轮廓（outline: 1px dashed）
- 手写备注用**黄底便利贴**样式——#fefcbd 底色 + 左侧琥珀色竖线 + 微微旋转
- 购物车顶部做成**锯齿撕裂纸边**（用小三角伪元素）
- 价格用等宽字体 + SRD 前缀小字
- 选中菜品的卡片叠加淡红色**朱砂印章**水印（"王记特选"）

**融合策略：方向B的暖调底色 + 纸质纹理为主，方向A的现代交互（毛玻璃、阴影层次）为辅。**

## 输出要求

1. **纯 HTML+CSS**，不要 Tailwind，不要 React，不要任何 JS 框架。CSS 写在 `<style>` 标签里
2. CSS 使用 `var(--xxx)` 变量（见下方令牌），不要硬编码颜色值
3. 手机优先：`body { max-width: 480px; margin: 0 auto; }`
4. 只输出 **375-430px 宽度**范围的样式，不需要桌面端
5. 输出完整的独立 HTML 文件（从 `<!DOCTYPE html>` 到 `</html>`）

---

## 设计令牌（CSS 变量，直接用 var() 引用）

```css
/* 品牌色 */
--pri:       #16a34a;
--pri-dark:  #15803d;
--pri-light: #dcfce7;
--pri-bg:    #f0fdf4;

/* 中性色 — 暖调纸系 */
--bg:        #faf6eb;   /* 暖米白底色，不是冷灰 */
--card:      #fff;
--border:    #e5e7eb;
--text:      #1a1a1a;
--text-sec:  #4b5563;
--muted:     #6b7280;

/* 点缀色 */
--accent:    #f97316;   /* 橙色，仅用于价格强调和徽章 */
--accent-light: #fff7ed;

/* WhatsApp */
--wa:        #25D366;
--wa-hover:  #1fa954;

/* 圆角层级 */
--r-sm: 8px;  --r: 10px;  --r-lg: 14px;
--r-xl: 18px;  --r-2xl: 24px;

/* 触控 */
--touch: 44px;  --touch-sm: 36px;

/* 安全区 */
--safe-bot: env(safe-area-inset-bottom, 0px);
--safe-top: env(safe-area-inset-top, 0px);
```

---

## HTML 结构（必须严格保留！所有 id、class、data- 属性不能改名或删除，JS 依赖它们）

### 1. Header 区

```html
<header>
  <div class="lang-switch" id="lang-switch" role="group" aria-label="Select language">
    <button class="active" data-lang="nl" id="btn-nl">NL</button>
    <button data-lang="zh" id="btn-zh">中文</button>
    <button data-lang="en" id="btn-en">EN</button>
    <button data-lang="es" id="btn-es">ES</button>
  </div>
  <h1 id="shop-name">王记餐厅</h1>
  <p id="shop-desc">在线点餐</p>
  <a class="wa-contact" id="wa-contact" href="#" target="_blank" rel="noopener">💬 WhatsApp</a>
</header>
```

**设计方向：**
- 翡翠深绿渐变 `linear-gradient(to bottom, #059669, #064e3b)`，白色文字
- `::before` 伪元素叠加径向高光（`circle at 80% 20%`，白色到透明）制造光泽
- 底部 24px 圆角（`border-radius: 0 0 24px 24px`）
- 内部淡色横线纹理（`background-size: 100% 4px`，微弱的水平线）
- **语言切换**做成分段控件胶囊：半透明黑底容器 `background: rgba(0,0,0,.12)` + 毛玻璃，内部 4 个圆角按钮。active 态 = 白底绿字 + 微阴影，非 active = 白色半透明文字。按钮 `font-size: .7rem`，紧凑排列，圆角 7-8px
- WhatsApp 按钮：用 `var(--wa)` 绿色，绝对定位在 header 左上角，全圆角药丸（`border-radius: var(--r-2xl)`），发光阴影

### 2. 分类导航

```html
<nav class="cat-nav" id="cat-nav"></nav>
```

JS 动态渲染内部 button。每个 button 格式：`<button data-cat-id="0">全部</button>`，第一个有 `class="active"`。

**设计方向：档案夹标签式**
- `position: sticky; top: 0;` 吸顶
- 毛玻璃背景 `backdrop-filter: blur(14px)` + 暖白底色
- 底部 1px 极淡分割线
- button 横向滚动（`overflow-x: auto; flex: 0 0 auto; white-space: nowrap`）
- **非选中态**：透明背景，灰色文字，底部有淡分割线暗示
- **选中态**：白色背景卡片（像档案夹标签被提起），文字变绿色加粗，`translateY(2px)` 向上微移，顶部和两侧有圆角 + 微阴影 `0 -3px 8px rgba(0,0,0,.02)`。形成"当前标签被翻开"的立体感
- 选中态 button 上加一个橙色小圆点徽章（如果有菜品已加入购物车），用 `::after` 伪元素

### 3. 菜品列表

```html
<main class="menu" id="menu">
  <div class="cat-title">主食</div>
  <div class="item" data-cat="1">
    <div class="item-img">🍚</div>
    <div class="item-info">
      <h3>印尼炒饭</h3>
      <p>传统印尼炒饭配鸡肉</p>
    </div>
    <div class="item-action">
      <div class="item-price">SRD 45.00</div>
      <div class="qty-ctrl">
        <button data-item-id="1" data-delta="-1">−</button>
        <span>0</span>
        <button data-item-id="2" data-delta="1">+</button>
      </div>
    </div>
  </div>
</main>
```

JS 动态渲染多个 `.item`。每个 item 有 `data-cat="分类ID"`。item-img 里有 emoji（无图片时）或 `<img>` 标签（有图片时 `object-fit: cover`）。**item 元素全部由 JS 动态生成，以下 CSS 必须匹配 JS 输出的结构。**

**设计方向：复古餐券卡片**

卡片整体：
- 纯白底，18-20px 大圆角
- **厚纸微阴影**：`box-shadow: 0 1px 2px rgba(0,0,0,.015), 0 3px 14px rgba(27,27,24,.02), inset 0 1px 0 rgba(255,255,255,.7)`
- 1px 极淡边框 `border: 1px solid rgba(0,0,0,.03)`
- **两侧穿孔边**：用 `::before` 和 `::after` 伪元素做成左右两侧的小半圆缺口，模拟撕纸餐券的穿孔线。半圆颜色与页面底色一致（`var(--bg)`），`border-radius: 50%`。或者简化为两侧有小弧形内凹
- 选中（购物车有数量 > 0）时叠加**淡红朱砂印章**水印：`::after` 伪元素在卡片中央，浅红圆框 + "王记特选" 文字，`opacity: .25`，`transform: rotate(12deg)`（注意：如果 JS 不加 class，这个效果用 `.item:has(.qty-ctrl span:not(:empty))` 或交给 JS 处理。**这里你可以用纯 CSS 实现：当 card 内 qty-ctrl 的 span 内容非"0"时用 :has() 选择器**）

左图右文布局：
- **item-img**：72×72px，16px 圆角。**做成邮票式容器**：内阴影 `inset 0 2px 4px rgba(0,0,0,.04)`，外侧加虚线轮廓 `outline: 1px dashed rgba(0,0,0,.08); outline-offset: 2px`。emoji 居中，`font-size: 2rem`
- item-img 背景色按 `data-cat` 分类——**暖调色盘**（比之前的更柔和）：
  - `data-cat="1"`：#fef3c7（暖黄，主食）
  - `data-cat="2"`：#fed7aa（暖杏，面类）
  - `data-cat="3"`：#fecaca（淡玫红，热菜）
  - `data-cat="4"`：#d1fae5（薄荷绿，饮品）
  - `data-cat="5"`：#fce7f3（淡粉，烧烤）

中间文字区（`.item-info`）：
- h3 菜名：`font-size: .95rem; font-weight: 800; color: var(--text)`，单行省略
- **手写备注标签**（如果有）：黄底便利贴式 `background: #fefcbd; border-left: 2px solid #f59e0b`，font-family 用 cursive 风格，小字（.78rem），微旋转 `rotate(-0.5deg)`，颜色 #92400e
- p 描述：`font-size: .78rem; color: var(--text-sec)`，最多 2 行省略
- 分类标签：小号 mono 字体 uppercase，灰色，在菜名上方

右侧价格+按钮区（`.item-action`）：
- **价格**：等宽字体风格 `font-weight: 800; font-size: 1rem`，绿色 `var(--pri)`。"SRD" 前缀用更小字号 + 绿色
- 价格背景：极淡的 `var(--pri-bg)` 底色，小圆角，内阴影，模拟纸质价格标签

加减按钮（`.qty-ctrl button`）：
- 增量按钮（`+`）：28×28px 小圆角方块 `border-radius: 8px`，绿色填充 `var(--pri)`，白色 + 图标，微阴影
- 减量按钮（`−`）：同样 28×28px，但浅灰底 + 边框（`border: 1px solid var(--border)`），深灰 − 图标
- 数量显示：居中，mono 字体加粗，白字黑底小圆角色块
- 按钮 active 缩放 `.9`

分类标题（`.cat-title`）：
- 小号大写字母，`font-size: .75rem`，灰色 `var(--muted)`，`letter-spacing: 1px`，上方留白 generous

### 4. 底部购物车

```html
<div class="cart-bar" id="cart-bar">
  <div class="cart-info">
    <span class="label" id="cart-count">0 items</span>
    <span class="cart-total" id="cart-total">SRD 0</span>
  </div>
  <button class="order-btn" id="cart-btn" disabled>下单</button>
</div>
```

**设计方向：锯齿收银纸卷**
- `position: fixed; bottom: 0;` 固定底部，暖白底色
- **顶部锯齿撕裂边**：用 `::before` 伪元素，多个小三角形排成一行，模拟收银纸卷的锯齿撕口（可以用 repeating `conic-gradient` 或多个旋转 45deg 的小方块实现）
- 左右两侧小圆点（模拟点阵打印机输纸孔）
- 毛玻璃 `backdrop-filter: blur(20px)`
- 顶部柔阴影 `0 -4px 16px rgba(0,0,0,.04)`
- 左侧：件数标签（小号 mono uppercase，`var(--accent)` 橙色）+ 总价（大字 mono 加粗，`var(--pri)` 绿色）
- 右侧下单按钮：绿色填充 `var(--pri)`，14-18px 圆角，白色加粗文字，发光阴影 `0 4px 14px rgba(22,163,74,.25)`
- disabled 态：透明度 .35，阴影消失
- **空购物车时**显示一条轻提示："添加美味菜品吧 ✨"（灰色斜体小字）
- padding-bottom 留安全区 `var(--safe-bot)`

### 5. 结账弹窗

```html
<div class="modal-overlay hidden" id="checkout-modal">
  <div class="modal">
    <h2 id="checkout-title">确认订单</h2>
    <div class="order-summary" id="order-summary"></div>
    <div class="pay-methods" id="pay-methods" role="group" aria-label="Select payment method">
      <button class="active" data-pay="cod" id="pay-cod">💵 现金</button>
      <button data-pay="bank_transfer" id="pay-bank_transfer">🏦 银行转账</button>
    </div>
    <div class="bank-instructions hidden" id="bank-info">
      <strong id="bank-title">银行转账信息</strong>
      <p id="bank-details"></p>
    </div>
    <input type="text" id="cust-name" placeholder="姓名">
    <input type="tel" id="cust-phone" placeholder="电话">
    <div class="pickup-time" id="pickup-times">
      <button data-time="Nu" class="active">现在</button>
      <button data-time="12:00">12:00</button>
      <button data-time="12:30">12:30</button>
      <button data-time="13:00">13:00</button>
    </div>
    <textarea id="cust-note" placeholder="备注"></textarea>
    <label class="consent-label" id="consent-label">
      <input type="checkbox" id="consent-check">
      <span id="consent-text">我同意服务条款和隐私政策</span>
    </label>
    <button class="submit-btn" id="submit-btn" disabled>提交订单</button>
    <button class="cancel-btn" id="cancel-btn">取消</button>
  </div>
</div>
```

**设计方向：底部抽屉式 + 弹簧动画**
- `.modal-overlay`：半透明黑遮罩 + 毛玻璃 `backdrop-filter: blur(4px)`
- `.modal`：白色，顶部 28px 大圆角，底部直角。阴影 `0 -8px 40px rgba(0,0,0,.12)`。内边距 generous（28px 20px）
- 顶部小横条（抓手指示器）：`width: 40px; height: 4px; background: #e5e7eb; border-radius: 2px; margin: 0 auto 16px`
- `max-height: 85vh; overflow-y: auto`
- **slideUp 动画用 spring 缓动**：`animation: slideUp .4s cubic-bezier(.16,1,.3,1)`（模拟弹簧感）

弹窗内部组件：
- **支付方式按钮**：flex 两列，大圆角，选中态绿色边框 + 浅绿底 + 内阴影
- **取餐时间按钮**：flex 横向排列，选中态绿色填充 + 白色文字
- **备注 textarea**：黄底便利贴风格！`background: #fefce8; border: 1px solid #fde68a; border-radius: var(--r-lg);` 浅黄底，模拟便签纸。focus 变亮黄
- **订单摘要**：浅灰底卡片，item 列表，底部虚线分隔 + 总计行（绿色加粗）
- **银行转账信息**：浅绿底 `var(--pri-bg)`，左边框绿色竖线
- **提交按钮**：全宽，绿色 + 发光阴影，disabled 时 .35 透明度
- **取消按钮**：浅灰底，无边框

### 6. 成功页

```html
<div class="hidden" id="success-view"></div>
```

JS 动态渲染内容。设计方向：
- 居中排版，大 emoji（5rem）
- **订单跟踪进度条**：3 阶段进度条（🧑‍🍳 制作中 → 📦 备餐中 → 🍽️ 请享用），绿色渐变进度条 + 圆点指示器
- WhatsApp 分享按钮：`var(--wa)` 绿色圆角药丸 + 发光阴影
- "再来一单" 按钮：绿色描边

### 7. 页脚

```html
<div class="order-footer">
  <a href="/privacy" target="_blank" id="footer-privacy">隐私</a>
  <span>·</span>
  <a href="/tos" target="_blank" id="footer-tos">条款</a>
  <span>·</span>
  <span id="footer-brand">SuriOrder</span>
</div>
```

### 8. 骨架屏（pre-JS 加载状态）

JS 动态渲染在 `<main class="menu" id="menu">` 内。骨架卡片形状与 item 一致（18-20px 圆角，相同厚纸阴影）。shimmer 动画。

---

## 视觉风格总结

| 元素 | 规范 |
|------|------|
| **底色** | `#faf6eb` 暖米白 + `radial-gradient(#ebdcb9 1.2px, transparent 1.2px)` 点阵纹理 |
| **卡片** | `#fff` 纯白，18-20px 圆角 |
| **卡片阴影** | 多层微阴影 + inset 白色高光，不要硬黑边框 |
| **Header** | 翡翠深绿渐变 + 径向高光 + 底部 24px 圆角 |
| **分类导航** | 档案夹标签式（选中态白色凸起卡片） |
| **菜品卡片** | 复古餐券式（穿孔边 + 邮票 emoji + 黄底手写标签 + 朱砂印章水印） |
| **加减按钮** | + 绿色实心小方块，− 浅灰描边小方块，数量黑底白字 |
| **购物车** | 锯齿收银纸卷式，毛玻璃，空态提示 |
| **弹窗** | 底部抽屉，弹簧动画，黄底备注便签，进度条 |
| **品牌绿** | `#16a34a` —— 按钮、价格、active 态 |
| **点缀橙** | `#f97316` —— 购物车计数徽章、价格高亮，不要大面积用 |
| **WhatsApp 绿** | `#25D366` —— 仅联系按钮和分享按钮 |
| **微交互** | 按钮 active 缩放、hover 阴影增强、弹窗弹簧缓出、购物车弹跳 |

## 需要包含的 CSS 动画

```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes successBounce {
  0%   { transform: scale(0); }
  60%  { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes cartBounce {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50%      { transform: translateX(-50%) scale(1.03); }
}
```

## 硬约束（红线，违反即废稿）

1. **不改 HTML 元素的 id、class、data- 属性名**——JS 完全依赖这些 selector
2. **不引入任何 JS**，纯 HTML+CSS
3. **不使用 Tailwind 或任何 CSS 框架**，纯手写 CSS
4. **使用 `var(--xxx)` 引用 CSS 变量**，不要硬编码颜色值到 CSS 规则里
5. **浅色模式 only**，苏里南户外强光
6. **无食物照片时用 emoji 占位**（JS 有图时会动态插入 `<img>` 替换 emoji）
7. **4 语言按钮**文字长度不同（NL 2字 / 中文 2字 / EN 2字 / ES 2字），flex 布局不写死宽度
8. **手机优先**：`body { max-width: 480px; margin: 0 auto; }`，375-430px 为主力视口
9. 所有颜色值通过 `var()` 引用令牌，如果你需要额外颜色（如深绿 `#059669`、便利贴黄 `#fefcbd`），在注释中标明建议新增的 CSS 变量

## 输出

完整独立 HTML 文件（`<!DOCTYPE html>` 到 `</html>`）。`<style>` 标签内包含所有 CSS。`<body>` 内包含上述完整 HTML 结构（header + nav + menu + cart + modal + success + footer + skeleton）。
