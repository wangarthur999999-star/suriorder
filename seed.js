// Seed demo shop for Suriname restaurant
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const db = new Database(path.join(__dirname, "data", "suriorder.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, language TEXT DEFAULT 'nl',
    admin_pin TEXT NOT NULL, welcome_msg TEXT, whatsapp_number TEXT,
    created_at TEXT DEFAULT (datetime('now')), active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id TEXT NOT NULL REFERENCES shops(id),
    name TEXT NOT NULL, name_zh TEXT, name_en TEXT, sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id TEXT NOT NULL REFERENCES shops(id),
    category_id INTEGER REFERENCES categories(id), name TEXT NOT NULL, name_zh TEXT, name_en TEXT,
    desc TEXT, desc_zh TEXT, desc_en TEXT, price REAL NOT NULL,
    image_url TEXT, available INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id),
    customer_name TEXT NOT NULL, customer_phone TEXT,
    items_json TEXT NOT NULL, total REAL NOT NULL,
    note TEXT, pickup_time TEXT, status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const shopId = "demo";
const pin = "1234";

// Upsert demo shop
db.prepare("INSERT OR REPLACE INTO shops (id, name, phone, language, admin_pin, whatsapp_number) VALUES (?,?,?,?,?,?)").run(shopId, "Wangs Eatery", "+5971234567", "nl", pin, "+5971234567");

// Delete old demo data
db.prepare("DELETE FROM items WHERE shop_id=?").run(shopId);
db.prepare("DELETE FROM categories WHERE shop_id=?").run(shopId);

// Categories
const cat1 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, sort_order) VALUES (?,?,?,?,?)").run(shopId, "Rijst gerechten", "饭类", "Rice dishes", 1).lastInsertRowid;
const cat2 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, sort_order) VALUES (?,?,?,?,?)").run(shopId, "Noedels", "面类", "Noodles", 2).lastInsertRowid;
const cat3 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, sort_order) VALUES (?,?,?,?,?)").run(shopId, "Drankjes", "饮品", "Drinks", 3).lastInsertRowid;

// Items
const items = [
  { cat: cat1, name: "Nasi Goreng", name_zh: "印尼炒饭", name_en: "Fried Rice", desc: "Met kip en groenten", desc_zh: "鸡肉蔬菜炒饭", desc_en: "With chicken and veggies", price: 45 },
  { cat: cat1, name: "Moksi Meti", name_zh: "混合米饭", name_en: "Mixed Rice", desc: "Surinaamse mix met vlees", desc_zh: "苏里南混合肉类米饭", desc_en: "Surinamese mixed meat rice", price: 55 },
  { cat: cat1, name: "Roti Kip", name_zh: "鸡肉飞饼", name_en: "Chicken Roti", desc: "Met aardappel en kousenband", desc_zh: "配土豆和豆角", desc_en: "With potato and long beans", price: 50 },
  { cat: cat2, name: "Bami Goreng", name_zh: "炒面", name_en: "Fried Noodles", desc: "Met kip of garnalen", desc_zh: "鸡肉或虾仁", desc_en: "With chicken or shrimp", price: 40 },
  { cat: cat2, name: "Tjauw Min", name_zh: "炒面（潮州）", name_en: "Chow Mein", desc: "Chinese stijl met groenten", desc_zh: "中式蔬菜炒面", desc_en: "Chinese style with veggies", price: 42 },
  { cat: cat3, name: "Parbo Bier", name_zh: "Parbo啤酒", name_en: "Parbo Beer", desc: "Lokaal gebrouwen", desc_zh: "本地酿造", desc_en: "Locally brewed", price: 15 },
  { cat: cat3, name: "Verse Kokoswater", name_zh: "新鲜椰子水", name_en: "Fresh Coconut Water", desc: "Uit eigen tuin", desc_zh: "自家种植", desc_en: "From our garden", price: 12 },
];

const insertItem = db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, desc, desc_zh, desc_en, price, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)");
items.forEach((i, idx) => {
  insertItem.run(shopId, i.cat, i.name, i.name_zh, i.name_en, i.desc, i.desc_zh, i.desc_en, i.price, idx);
});

console.log("Demo shop seeded!");
console.log("Shop ID: demo, PIN: 1234");
console.log("Order page: http://localhost:3456/order/demo");
console.log("Admin page: http://localhost:3456/admin/demo");
