你是一个 UI 设计 + 前端开发专家。你要为 SuriOrder 苏里南餐厅 SaaS 重新设计并构建餐厅老板管理后台页面。

## 项目概览

- **项目**: SuriOrder — 苏里南餐厅免费接单系统
- **页面**: `public/admin.html` — 餐厅老板登录后的管理后台 + 接单大屏
- **技术栈**: 纯 HTML/CSS/JS（无框架，无构建工具），一张 HTML 包含所有 CSS/JS
- **设备**: 桌面优先（厨师平板/电脑用），但也兼容手机
- **4 语言**: nl (Nederlands), en (English), zh (中文), es (Español)
- **后端**: Express + SQLite，API 全部已就绪，你只做前端
- **风格**: 不限制你发挥，但默认参考 "Warm Utility" — 奶油底 (#fef9ed)，绿品牌 (#16a34a)，橙点缀 (#f97316)，14-18px 圆角，柔和阴影

---

## 你需要构建的页面

### 概览视图

页面有两种状态：

**状态 A — 管理后台**（默认视图）
- 顶部 Header：店铺名 + Shop ID + 语言切换 + 退出按钮
- 统计卡片行：今日订单数/营收、7天营收、待处理数
- 7 天趋势柱状图
- Tab 栏：订单 | 菜单 | 分享 | 设置
- Tab 内容区
- 进入接单大屏的入口按钮

**状态 B — 接单大屏**（全屏覆盖，暗底）
- 全屏黑色/深灰背景
- 实时订单卡片网格
- 顶部 Exit 按钮
- 语音播报 + 确认按钮 + 打印

---

## API 接口（全已就绪）

### 认证
所有管理接口需要在 Header 带 JWT：
```
Authorization: Bearer <token>
```
Token 来自登录/注册返回，存 localStorage key `suriorder_token`。

### 接口清单

```
POST /api/login          { shop_id, admin_pin }  → { token, shop }
POST /api/shops           { name, admin_pin, language }  → { token, shop, id }
GET  /api/admin/dashboard  → { ordersToday:{count,total}, ordersWeek:{count,total}, pending:{count}, daily:[{day,cnt,total}], topItems:[{name,cnt}] }
GET  /api/admin/orders?limit=50  → [{ id, customer_name, customer_phone, items_json, total, status, payment_method, payment_status, dining_option, note, pickup_time, created_at, prev_orders }]
GET  /api/admin/items     → [{ id, name, name_zh, name_en, name_es, desc, desc_zh, desc_en, desc_es, price, category_id, category_name, image_url, available })
POST /api/admin/items     { name, name_zh, name_en, name_es, price, category_id }  → { ok }
PUT  /api/admin/items/:id  { name, price, available, category_id, image_url, ... }  → { ok }
DELETE /api/admin/items/:id  → { ok }
GET  /api/admin/categories  → [{ id, name, name_zh, name_en, name_es, sort_order }]
POST /api/admin/categories  { name, name_zh, name_en, name_es }  → { ok }
DELETE /api/admin/categories/:id  → { ok }
PUT  /api/admin/shop      { welcome_msg, whatsapp_number, language, bank_name, bank_account, bank_account_name }  → { ok }
PUT  /api/admin/orders/:id  { status }  // status: "confirmed" | "done" | "cancelled"
PUT  /api/admin/orders/:id  { payment_status }  // payment_status: "paid" | "refunded"
GET  /api/admin/events     // SSE (text/event-stream), event: "new-order"

// 公共接口（无需 auth）
GET  /api/shop/:id/menu-link  → { order_url }
```

### SSE (Server-Sent Events)

```
GET /api/admin/events
Authorization: Bearer <token>

// 事件格式:
event: new-order
data: {"id":"abc12345","customer_name":"张三","customer_phone":"+597...","items":[{...}],"total":105,"note":"","pickup_time":"18:30","status":"pending","payment_method":"cod","payment_status":"unpaid","dining_option":"takeaway","created_at":"..."}
```

连接断开时需指数退避重连（1s → 2s → 4s → max 30s）。连接成功时重置退避。

---

## 功能需求（完整清单）

### 1. 登录/注册
- Shop ID + PIN 输入
- 登录成功 → localStorage 存 token + shop，跳转 dashboard
- 注册：店名 + 电话 + PIN (最少4位) + 语言选择
- 注册成功 → 显示 Shop ID（必须醒目，告知老板保存好）
- 注册后自动进入新手向导
- 页面加载时检查 localStorage 有无 token，有则自动恢复 session

### 2. Dashboard
- 4 张统计卡片：今日订单数 / 今日营收 / 7天营收 / 待处理数
- 7 天趋势柱状图（从 daily 数据渲染）
- 热门菜品 Top 5 列表
- 进入接单大屏按钮（醒目绿底）

### 3. 订单管理 Tab
- 订单列表表格：订单号、客户名+电话（点击跳 WhatsApp）、菜品摘要、金额、时间、状态、操作
- 点击行展开显示菜品明细表（品名×数量×单价×小计）
- 状态下拉：确认 / 完成 / 取消
- 支付状态按钮：标记已付 / 标记退款
- 支付标签：现金（💵）/ 转账（🏦）
- 堂食（🍽）/ 外带（🛍）标签
- 回头客标记（🔄 熟客 xN）
- 备注显示

### 4. 菜单管理 Tab
- 菜品列表：名称、分类、价格、上下架开关
- 添加菜品表单：名称(NL/中文/EN/ES)、价格、分类下拉
- 点击菜品可编辑
- 删除确认
- 分类管理：添加/删除分类芯片

### 5. 分享 Tab
- 显示菜单链接 URL
- 一键复制按钮
- WhatsApp 分享提示
- 二维码图片

### 6. 设置 Tab
- WhatsApp 号码
- 欢迎消息
- 店铺语言
- 银行信息（名称/账号/户名）

### 7. 新手向导（5步）
- Step 1: 欢迎 + Shop ID 展示
- Step 2: 设置 WhatsApp 号码
- Step 3: 快速添加菜品
- Step 4: 分享菜单链接
- Step 5: 完成 → 进入 Dashboard

### 8. 接单大屏（核心功能）
- 点击 dashboard 按钮进入全屏暗底模式
- 实时订单卡片网格（auto-fill, min 360px）
- 卡片内容：订单号、客户名、电话、菜品明细（品名×数量×单价）、合计、堂食/外带标签、现金/转账标签、取餐时间、备注
- 新订单卡片弹入动画（scale + fade）
- **语音播报**：SpeechSynthesis API，按店铺语言朗读新订单内容，每 5 秒重复直到确认
- **确认按钮**：更新服务器状态 + `window.print()` 打印小票
- 确认后卡片变绿 → 3 秒淡出
- 退出按钮 → 回到管理后台
- **@media print**：只显示当前打印卡片，隐藏所有 UI，适合 58mm/80mm 热敏打印机

### 9. 其他
- Toast 通知（`/shared.js` 提供全局 Toast）
- SSE 新订单横幅提醒 + AudioContext 提示音
- 语言切换实时更新所有 UI 文字
- 登出按钮清 localStorage 刷新页面

---

## 设计方向建议

- **默认风格**: "Warm Utility" — 暖色调实用风，不要冷冰冰的 SaaS 模板
- 也可以自由发挥 —— 比如暗色模式管理后台 + 接单大屏全暗，视觉统一
- 卡片、按钮、表格要有呼吸感
- 状态标签用颜色区分（绿=已确认、黄=待处理、红=取消、蓝=堂食、紫=外带）
- 移动端（375-430px）下 Tab 和表格做响应式处理

---

## 技术约束

1. **纯 HTML/CSS/JS**，所有代码在一个文件，无外部依赖（除了 /shared.js）
2. **ES5 兼容**（不需要箭头函数，但用了也可以）
3. **XSS 防护**：用户输入用 `esc()` 函数转义：`function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }`
4. **i18n**：所有文字通过 `t(key)` 函数查 `L_admin[adminLang]` 对象获取
5. **Auth Header**：所有 fetch 带 `authHeaders()` 返回 `{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }`
6. **Token 存储**：`localStorage.getItem('suriorder_token')`
7. **语言存储**：`localStorage.getItem('suriorder_admin_lang')`，默认 `'nl'`
8. **SSE**：用 `EventSource` API，事件类型 `new-order`

---

## 完整 i18n Keys（必须全支持）

```js
var L_admin = {
  nl: {
    login_subtitle: "Beheer uw menu en bestellingen",
    shop_id_ph: "Shop ID", pin_ph: "PIN Code",
    login_btn: "Inloggen", no_account: "Nog geen account?", register_link: "Registreer",
    reg_title: "Nieuwe Shop", reg_subtitle: "Maak uw gratis account aan",
    name_ph: "Bedrijfsnaam", phone_ph: "Telefoonnummer",
    pin_new_ph: "Kies een PIN (min 4 cijfers)", reg_btn: "Account aanmaken",
    back_login: "← Terug naar login",
    menu_link_label: "Uw bestellink:",
    stats_today_orders: "Vandaag Orders", stats_today_revenue: "Vandaag Omzet",
    stats_week_revenue: "7 Dagen Omzet", stats_pending: "Openstaand",
    tab_orders: "Bestellingen", tab_menu: "Menu", tab_share: "Delen", tab_settings: "Instellingen",
    th_customer: "Klant", th_items: "Items", th_total: "Totaal", th_time: "Tijd", th_status: "Status", th_action: "Actie",
    th_name: "Gerecht", th_cat: "Cat", th_price: "Prijs",
    empty_orders: "Geen bestellingen",
    item_name_ph: "Naam (NL)", item_name_zh_ph: "名称 (中文)", item_name_en_ph: "Name (EN)", item_name_es_ph: "Nombre (ES)",
    item_price_ph: "Prijs (SRD)", add_btn: "+ Toevoegen", cat_opt: "Categorie",
    share_title: "Deel uw menu link", share_desc: "Klanten openen deze link op hun telefoon",
    share_wa: "WhatsApp: kopieer link en stuur naar klanten", share_tip: "Tip: zet deze link in uw WhatsApp profiel",
    copy_btn: "Kopiëren",
    actie: "Actie", bevestig: "Bevestig", klaar: "Klaar", annuleer: "Annuleer",
    alert_name_pin: "Vul bedrijfsnaam en PIN in", alert_pin_min: "PIN minimaal 4 tekens",
    alert_reg_error: "Fout bij registratie",
    alert_account_created: "Account aangemaakt! Shop ID: {id} — bewaar dit goed.",
    alert_invalid_login: "Ongeldige inloggegevens", alert_name_price: "Naam en prijs verplicht",
    alert_delete: "Item verwijderen?",
    wizard_step1_title: "Welkom bij SuriOrder!", wizard_step1_desc: "Uw Shop ID — bewaar goed:",
    wizard_step2_title: "WhatsApp Nummer", wizard_step2_desc: "Klanten bereiken u via WhatsApp", wizard_step2_ph: "WhatsApp (+597...)",
    wizard_step3_title: "Snelle Menu Setup", wizard_step3_desc: "Voeg snel gerechten toe", wizard_step3_name: "Naam", wizard_step3_price: "Prijs (SRD)", wizard_step3_cat: "Categorie",
    wizard_step4_title: "Deel Uw Link", wizard_step4_desc: "Klanten bestellen via:",
    wizard_step5_title: "Klaar!", wizard_step5_desc: "Uw shop is live. Deel uw link!",
    wizard_next: "Volgende", wizard_skip: "Overslaan", wizard_done: "Naar Dashboard", wizard_copy: "Kopiëren", wizard_add_item: "+ Nog een gerecht",
    notif_new_order: "Nieuwe bestelling!", notif_from: "van",
    settings_title: "Winkel Instellingen", settings_welcome: "Welkomstbericht", settings_wa: "WhatsApp nummer",
    settings_lang: "Taal", settings_bank_name: "Bank naam", settings_bank_account: "Rekeningnummer", settings_bank_holder: "Op naam van",
    settings_save: "Opslaan", settings_saved: "Opgeslagen!",
    pm_cod: "Contant", pm_bank: "Overschrijving",
    pay_unpaid: "Onbetaald", pay_paid: "Betaald", pay_refunded: "Terugbetaald",
    mark_paid: "✓ Betaald", mark_refunded: "↩ Terug",
    cancel: "Annuleer", delete_confirm: "Verwijder",
    toast_item_added: "Gerecht toegevoegd", toast_save_error: "Fout bij opslaan",
    wizard_copied: "Gekopieerd!",
    cat_label: "Categorieën", cat_new_ph: "Nieuwe categorie", cat_add_btn: "+ Toevoegen",
    cat_delete_confirm: "Categorie en items verwijderen?",
    th_avail: "Beschikbaar", sold_out: "Uitverkocht", return_badge: "Vaste klant",
    // 接单大屏
    os_title: "Bestellingen Scherm", os_exit: "Verlaten", os_enter: "🔔 Order Scherm",
    os_active: "Live", os_confirm: "✅ Bevestigen", os_confirmed: "Bevestigd",
    os_dine_in: "🍽 Dine-in", os_takeaway: "🛍 Afhalen",
    os_cod: "💵 Contant", os_bank: "🏦 Overboeking", os_pickup: "Ophalen",
    os_empty: "Wachten op bestellingen..."
  },
  en: {
    login_subtitle: "Manage your menu and orders",
    shop_id_ph: "Shop ID", pin_ph: "PIN Code",
    login_btn: "Login", no_account: "No account?", register_link: "Register",
    reg_title: "New Shop", reg_subtitle: "Create your free account",
    name_ph: "Business name", phone_ph: "Phone number",
    pin_new_ph: "Choose a PIN (min 4 digits)", reg_btn: "Create Account",
    back_login: "← Back to login",
    menu_link_label: "Your order link:",
    stats_today_orders: "Today Orders", stats_today_revenue: "Today Revenue",
    stats_week_revenue: "7 Day Revenue", stats_pending: "Pending",
    tab_orders: "Orders", tab_menu: "Menu", tab_share: "Share", tab_settings: "Settings",
    th_customer: "Customer", th_items: "Items", th_total: "Total", th_time: "Time", th_status: "Status", th_action: "Action",
    th_name: "Dish", th_cat: "Cat", th_price: "Price",
    empty_orders: "No orders yet",
    item_name_ph: "Name (NL)", item_name_zh_ph: "名称 (中文)", item_name_en_ph: "Name (EN)", item_name_es_ph: "Nombre (ES)",
    item_price_ph: "Price (SRD)", add_btn: "+ Add", cat_opt: "Category",
    share_title: "Share your menu link", share_desc: "Customers open this link on their phone",
    share_wa: "WhatsApp: copy link and send to customers", share_tip: "Tip: put this link in your WhatsApp profile",
    copy_btn: "Copy",
    actie: "Action", bevestig: "Confirm", klaar: "Done", annuleer: "Cancel",
    alert_name_pin: "Enter business name and PIN", alert_pin_min: "PIN must be at least 4 digits",
    alert_reg_error: "Registration error",
    alert_account_created: "Account created! Shop ID: {id} — save this.",
    alert_invalid_login: "Invalid credentials", alert_name_price: "Name and price required",
    alert_delete: "Delete this item?",
    wizard_step1_title: "Welcome to SuriOrder!", wizard_step1_desc: "Your Shop ID — keep it safe:",
    wizard_step2_title: "WhatsApp Number", wizard_step2_desc: "Customers can reach you via WhatsApp", wizard_step2_ph: "WhatsApp (+597...)",
    wizard_step3_title: "Quick Menu Setup", wizard_step3_desc: "Add a few dishes to start", wizard_step3_name: "Dish name", wizard_step3_price: "Price (SRD)", wizard_step3_cat: "Category",
    wizard_step4_title: "Share Your Link", wizard_step4_desc: "Customers order via:",
    wizard_step5_title: "Ready!", wizard_step5_desc: "Your shop is live. Share your link!",
    wizard_next: "Next", wizard_skip: "Skip", wizard_done: "Go to Dashboard", wizard_copy: "Copy", wizard_add_item: "+ Another dish",
    notif_new_order: "New order!", notif_from: "from",
    settings_title: "Shop Settings", settings_welcome: "Welcome message", settings_wa: "WhatsApp number",
    settings_lang: "Language", settings_bank_name: "Bank name", settings_bank_account: "Account number", settings_bank_holder: "Account holder",
    settings_save: "Save", settings_saved: "Saved!",
    pm_cod: "Cash", pm_bank: "Transfer",
    pay_unpaid: "Unpaid", pay_paid: "Paid", pay_refunded: "Refunded",
    mark_paid: "✓ Mark Paid", mark_refunded: "↩ Refund",
    cancel: "Cancel", delete_confirm: "Delete",
    toast_item_added: "Item added", toast_save_error: "Save error",
    wizard_copied: "Copied!",
    cat_label: "Categories", cat_new_ph: "New category", cat_add_btn: "+ Add",
    cat_delete_confirm: "Delete category and items?",
    th_avail: "Available", sold_out: "Sold out", return_badge: "Regular",
    os_title: "Order Screen", os_exit: "Exit", os_enter: "🔔 Order Screen",
    os_active: "Live", os_confirm: "✅ Confirm", os_confirmed: "Confirmed",
    os_dine_in: "🍽 Dine-in", os_takeaway: "🛍 Takeaway",
    os_cod: "💵 Cash", os_bank: "🏦 Transfer", os_pickup: "Pickup",
    os_empty: "Waiting for orders..."
  },
  zh: {
    login_subtitle: "管理菜单和订单",
    shop_id_ph: "店铺 ID", pin_ph: "PIN 码",
    login_btn: "登录", no_account: "没有账号？", register_link: "注册",
    reg_title: "新店铺", reg_subtitle: "创建免费账号",
    name_ph: "店铺名称", phone_ph: "电话号码",
    pin_new_ph: "设置 PIN 码（最少4位）", reg_btn: "创建账号",
    back_login: "← 返回登录",
    menu_link_label: "您的下单链接：",
    stats_today_orders: "今日订单", stats_today_revenue: "今日营收",
    stats_week_revenue: "7天营收", stats_pending: "待处理",
    tab_orders: "订单", tab_menu: "菜单", tab_share: "分享", tab_settings: "设置",
    th_customer: "客户", th_items: "菜品", th_total: "金额", th_time: "时间", th_status: "状态", th_action: "操作",
    th_name: "菜品", th_cat: "分类", th_price: "价格",
    empty_orders: "暂无订单",
    item_name_ph: "名称 (NL)", item_name_zh_ph: "名称 (中文)", item_name_en_ph: "Name (EN)", item_name_es_ph: "Nombre (ES)",
    item_price_ph: "价格 (SRD)", add_btn: "+ 添加", cat_opt: "分类",
    share_title: "分享菜单链接", share_desc: "客户用手机打开此链接下单",
    share_wa: "WhatsApp：复制链接发送给客户", share_tip: "提示：把链接放到 WhatsApp 简介",
    copy_btn: "复制",
    actie: "操作", bevestig: "确认", klaar: "完成", annuleer: "取消",
    alert_name_pin: "请输入店名和 PIN", alert_pin_min: "PIN 至少4位",
    alert_reg_error: "注册失败",
    alert_account_created: "注册成功！Shop ID: {id} — 请妥善保存。",
    alert_invalid_login: "登录信息错误", alert_name_price: "名称和价格必填",
    alert_delete: "确定删除此菜品？",
    wizard_step1_title: "欢迎使用 SuriOrder！", wizard_step1_desc: "您的 Shop ID — 请保存好：",
    wizard_step2_title: "WhatsApp 号码", wizard_step2_desc: "客户可通过 WhatsApp 联系您", wizard_step2_ph: "WhatsApp (+597...)",
    wizard_step3_title: "快速菜单设置", wizard_step3_desc: "先添加几个菜品", wizard_step3_name: "菜品名", wizard_step3_price: "价格 (SRD)", wizard_step3_cat: "分类",
    wizard_step4_title: "分享链接", wizard_step4_desc: "客户通过此链接下单：",
    wizard_step5_title: "准备就绪！", wizard_step5_desc: "您的店铺已上线，分享链接吧！",
    wizard_next: "下一步", wizard_skip: "跳过", wizard_done: "进入后台", wizard_copy: "复制", wizard_add_item: "+ 再加一个菜",
    notif_new_order: "新订单！", notif_from: "来自",
    settings_title: "店铺设置", settings_welcome: "欢迎消息", settings_wa: "WhatsApp 号码",
    settings_lang: "语言", settings_bank_name: "银行名称", settings_bank_account: "账号", settings_bank_holder: "户名",
    settings_save: "保存", settings_saved: "已保存！",
    pm_cod: "现金", pm_bank: "转账",
    pay_unpaid: "未付", pay_paid: "已付", pay_refunded: "已退款",
    mark_paid: "✓ 已付", mark_refunded: "↩ 退款",
    cancel: "取消", delete_confirm: "删除",
    toast_item_added: "菜品已添加", toast_save_error: "保存失败",
    wizard_copied: "已复制！",
    cat_label: "分类", cat_new_ph: "新分类名称", cat_add_btn: "+ 添加",
    cat_delete_confirm: "确定删除分类及其菜品？",
    th_avail: "状态", sold_out: "售罄", return_badge: "熟客",
    os_title: "接单大屏", os_exit: "退出", os_enter: "🔔 进入接单大屏",
    os_active: "实时", os_confirm: "✅ 确认接单", os_confirmed: "已确认",
    os_dine_in: "🍽 堂食", os_takeaway: "🛍 外带",
    os_cod: "💵 现金", os_bank: "🏦 转账", os_pickup: "取餐时间",
    os_empty: "等待订单中..."
  },
  es: {
    login_subtitle: "Gestiona tu menú y pedidos",
    shop_id_ph: "Shop ID", pin_ph: "Código PIN",
    login_btn: "Iniciar sesión", no_account: "¿Sin cuenta?", register_link: "Registrarse",
    reg_title: "Nueva Tienda", reg_subtitle: "Crea tu cuenta gratis",
    name_ph: "Nombre del negocio", phone_ph: "Teléfono",
    pin_new_ph: "Elige un PIN (mín 4 dígitos)", reg_btn: "Crear Cuenta",
    back_login: "← Volver al inicio",
    menu_link_label: "Tu enlace de pedido:",
    stats_today_orders: "Pedidos Hoy", stats_today_revenue: "Ingresos Hoy",
    stats_week_revenue: "7 Días", stats_pending: "Pendientes",
    tab_orders: "Pedidos", tab_menu: "Menú", tab_share: "Compartir", tab_settings: "Ajustes",
    th_customer: "Cliente", th_items: "Platos", th_total: "Total", th_time: "Hora", th_status: "Estado", th_action: "Acción",
    th_name: "Plato", th_cat: "Cat", th_price: "Precio",
    empty_orders: "Sin pedidos",
    item_name_ph: "Nombre (NL)", item_name_zh_ph: "名称 (中文)", item_name_en_ph: "Name (EN)", item_name_es_ph: "Nombre (ES)",
    item_price_ph: "Precio (SRD)", add_btn: "+ Agregar", cat_opt: "Categoría",
    share_title: "Comparte tu enlace", share_desc: "Los clientes abren este enlace en su teléfono",
    share_wa: "WhatsApp: copia el enlace y envíalo", share_tip: "Tip: pon este enlace en tu perfil de WhatsApp",
    copy_btn: "Copiar",
    actie: "Acción", bevestig: "Confirmar", klaar: "Listo", annuleer: "Cancelar",
    alert_name_pin: "Ingrese nombre y PIN", alert_pin_min: "PIN mínimo 4 dígitos",
    alert_reg_error: "Error de registro",
    alert_account_created: "¡Cuenta creada! Shop ID: {id} — guárdelo bien.",
    alert_invalid_login: "Credenciales inválidas", alert_name_price: "Nombre y precio requeridos",
    alert_delete: "¿Eliminar este plato?",
    wizard_step1_title: "¡Bienvenido a SuriOrder!", wizard_step1_desc: "Su Shop ID — guárdelo bien:",
    wizard_step2_title: "Número de WhatsApp", wizard_step2_desc: "Los clientes lo contactan por WhatsApp", wizard_step2_ph: "WhatsApp (+597...)",
    wizard_step3_title: "Menú Rápido", wizard_step3_desc: "Agregue algunos platos", wizard_step3_name: "Nombre del plato", wizard_step3_price: "Precio (SRD)", wizard_step3_cat: "Categoría",
    wizard_step4_title: "Comparta su enlace", wizard_step4_desc: "Los clientes piden por:",
    wizard_step5_title: "¡Listo!", wizard_step5_desc: "Su tienda está en vivo. ¡Comparta el enlace!",
    wizard_next: "Siguiente", wizard_skip: "Saltar", wizard_done: "Ir al Dashboard", wizard_copy: "Copiar", wizard_add_item: "+ Otro plato",
    notif_new_order: "¡Nuevo pedido!", notif_from: "de",
    settings_title: "Ajustes", settings_welcome: "Mensaje de bienvenida", settings_wa: "Número WhatsApp",
    settings_lang: "Idioma", settings_bank_name: "Banco", settings_bank_account: "Número de cuenta", settings_bank_holder: "Titular",
    settings_save: "Guardar", settings_saved: "¡Guardado!",
    pm_cod: "Efectivo", pm_bank: "Transferencia",
    pay_unpaid: "No pagado", pay_paid: "Pagado", pay_refunded: "Reembolsado",
    mark_paid: "✓ Pagado", mark_refunded: "↩ Reembolsar",
    cancel: "Cancelar", delete_confirm: "Eliminar",
    toast_item_added: "Plato agregado", toast_save_error: "Error al guardar",
    wizard_copied: "¡Copiado!",
    cat_label: "Categorías", cat_new_ph: "Nueva categoría", cat_add_btn: "+ Agregar",
    cat_delete_confirm: "¿Eliminar categoría y platos?",
    th_avail: "Disponible", sold_out: "Agotado", return_badge: "Cliente frecuente",
    os_title: "Pantalla de Pedidos", os_exit: "Salir", os_enter: "🔔 Pantalla de Pedidos",
    os_active: "En vivo", os_confirm: "✅ Confirmar", os_confirmed: "Confirmado",
    os_dine_in: "🍽 Para servir", os_takeaway: "🛍 Para llevar",
    os_cod: "💵 Efectivo", os_bank: "🏦 Transferencia", os_pickup: "Recoger",
    os_empty: "Esperando pedidos..."
  }
};
```

---

## 输出要求

1. **一个完整的 `admin.html` 文件**，包含所有 CSS + HTML + JS
2. 功能完整度优先于视觉炫酷——登录、CRUD、SSE、接单大屏、语音、打印全部要能用
3. 代码风格一致，引用 `/shared.js`（提供 `Toast` 全局对象）
4. 简短说明你的设计思路（3-4 句话）

## 参考

当前 admin.html 有完整的 JS 逻辑可以参考，但 UI 太丑。你需要重新设计 UI，但保留所有功能性代码的核心逻辑。接单大屏的 Speech API + 打印 + SSE hook 这些核心机制不要丢。
