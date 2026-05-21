你是一个前端开发专家。你要为一个苏里南餐厅外卖 SaaS 重建客户下单页面。

## 项目背景

- 项目名：SuriOrder
- 技术栈：纯 HTML/CSS/JS（无框架），手机优先 (375-430px)
- 后端：Express + SQLite，API 已就绪
- 4 种语言：nl（荷兰语）、en（英语）、zh（中文）、es（西班牙语）
- 风格：Warm Utility — 奶油色底，绿色品牌色 (#16a34a)，橙色点缀 (#f97316)

## 你的任务

重写 `public/order.html`，保持现有核心逻辑，增加 5 个优化。

## 当前 order.html 已有功能（必须保留）

1. **类目导航** — 水平滚动按钮，按 category 筛选菜品
2. **菜品卡片** — 图片、名称、描述（多语言）、价格、数量增减按钮
3. **浮动购物车栏** — 底部固定，显示总价，点击展开结账
4. **结账底部弹窗** — 客户名、电话、支付方式切换（现金/转账）、取餐时间、备注、同意勾选框
5. **下单提交流程** — POST /api/order，成功动画，错误处理
6. **4 语言 i18n** — L 对象 (nl/en/zh/es)，`t(key)` 翻译函数
7. **语言切换按钮** — 顶部国旗图标
8. **共享 JS** — 引用 `/shared.js`（含 Toast 通知）

## API 契约

```js
POST /api/order
Content-Type: application/json

{
  shop_id: "demo",           // 从 URL 参数 ?shop=xxx 获取
  customer_name: "张三",
  customer_phone: "+5971234567",  // 格式: +597 + 6-7位数字
  items: [
    { id: 1, qty: 2 },
    { id: 3, qty: 1 }
  ],
  payment_method: "cod",     // "cod" = 现金, "bank_transfer" = 转账
  dining_option: "dine_in",  // 新增: "dine_in" = 堂食, "takeaway" = 外带
  pickup_time: "18:30",      // 外带时需要
  note: "少辣不用洋葱"        // 可选
}

// 成功响应
{ order_id: "abc12345", total: 105.00, items: [...], payment_method: "cod" }

// 错误响应
{ error: "invalid phone" }
```

## 需要新增的 5 个功能

### 1. 堂食/外带 Toggle（结账弹窗内）

两个并排按钮：
- 🍽 堂食 (dine_in)
- 🛍 外带 (takeaway，默认选中)

点"堂食"时隐藏取餐时间输入框，点"外带"时显示。样式复用支付方式切换的按钮组。

### 2. 购物车按钮优化

当前按钮显示 `🛒 下单`，改为显示总价 + 数量：
```
🛒 SRD 105 · 3件  → 下单
```
价格和数量随购物车实时更新。

### 3. 售罄状态

当 `item.available === 0` 时：
- 卡片灰色半透明 (opacity: 0.5, grayscale)
- 不可点击（pointer-events: none）
- 叠加"售罄/Uitverkocht/Sold Out/Agotado"标签
- 数量按钮隐藏

### 4. 下单成功倒计时

成功后显示确认页，5 秒倒计时自动返回菜单：
```
✅ 下单成功！ #abc12345
3 秒后返回菜单...
```
用 setInterval 倒计时 → 0 时重置页面状态。

### 5. 表单验证增强

必填字段为空时：
- 边框变红 + CSS shake 动画 (0.4s)
- 不需要弹 toast，红框抖动就够了
- 字段：customer_name, customer_phone, 至少 1 个 item

## 不要改的

- `shared.js` 不要动（公共文件）
- Toast 组件保持现有调用方式
- 购物车数据结构 `cart = { [itemId]: { id, name, price, qty } }` 保持不变
- 语言切换逻辑 `setLang()` 保持不变
- 整体 HTML 结构保持（shop header → category nav → items grid → cart bar → checkout sheet）

## 多语言参考

已有的 L 对象结构（补充 dining_option 相关 key）：

```js
var L = {
  nl: {
    dine_in: "🍽 Dine-in",
    takeaway: "🛍 Afhalen",
    sold_out: "Uitverkocht",
    cart_btn: "🛒 Bestellen",
    success_title: "Bestelling geplaatst!",
    success_countdown: "Terug in {n} seconden...",
    validation_name: "Vul naam in",
    validation_phone: "Vul geldig telefoonnummer in",
    // ... 其他已有的 key 保留
  },
  en: {
    dine_in: "🍽 Dine-in",
    takeaway: "🛍 Takeaway",
    sold_out: "Sold out",
    cart_btn: "🛒 Order",
    success_title: "Order placed!",
    success_countdown: "Back in {n} seconds...",
    validation_name: "Enter name",
    validation_phone: "Enter valid phone",
  },
  zh: {
    dine_in: "🍽 堂食",
    takeaway: "🛍 外带",
    sold_out: "售罄",
    cart_btn: "🛒 下单",
    success_title: "下单成功！",
    success_countdown: "{n} 秒后返回菜单...",
    validation_name: "请输入姓名",
    validation_phone: "请输入有效电话号码",
  },
  es: {
    dine_in: "🍽 Para servir",
    takeaway: "🛍 Para llevar",
    sold_out: "Agotado",
    cart_btn: "🛒 Pedir",
    success_title: "¡Pedido realizado!",
    success_countdown: "Volviendo en {n} segundos...",
    validation_name: "Ingrese nombre",
    validation_phone: "Ingrese teléfono válido",
  }
};
```

## 输出

1. 完整的 `order.html` 文件（CSS + HTML + JS 全部在一个文件）
2. 简要说明每项改动的实现方式（2-3 句话即可）

保持代码风格一致：vanilla JS、ES5 兼容（不需要箭头函数和模板字符串也没关系）、`esc()` 防 XSS、`t()` 翻译。
