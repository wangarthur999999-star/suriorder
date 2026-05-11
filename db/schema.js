const bcrypt = require("bcryptjs");

function initDb(db) {
  // Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      language TEXT DEFAULT 'nl',
      admin_pin TEXT NOT NULL,
      welcome_msg TEXT,
      whatsapp_number TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      name TEXT NOT NULL,
      name_zh TEXT, name_en TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      category_id INTEGER REFERENCES categories(id),
      name TEXT NOT NULL,
      name_zh TEXT, name_en TEXT,
      desc TEXT, desc_zh TEXT, desc_en TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      available INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      items_json TEXT NOT NULL,
      total REAL NOT NULL,
      note TEXT,
      pickup_time TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add new columns to existing tables (idempotent)
  const cols = (table) => db.prepare(`PRAGMA table_info(${table})`).all();
  const add = (table, col, type) => {
    if (!cols(table).find(c => c.name === col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  };
  add("categories", "name_srn", "TEXT");
  add("items", "name_srn", "TEXT");
  add("items", "desc_srn", "TEXT");
  add("shops", "admin_lang", "TEXT DEFAULT 'nl'");
  add("shops", "wizard_complete", "INTEGER DEFAULT 0");
  add("shops", "welcome_msg", "TEXT");
  add("orders", "payment_method", "TEXT DEFAULT 'cod'");
  add("orders", "payment_status", "TEXT DEFAULT 'unpaid'");
  add("orders", "payment_note", "TEXT");
  add("shops", "bank_name", "TEXT");
  add("shops", "bank_account", "TEXT");
  add("shops", "bank_account_name", "TEXT");

  // Auto-seed demo shop if not present
  const demoExists = db.prepare("SELECT 1 FROM shops WHERE id='demo'").get();
  if (!demoExists) {
    const demoHash = bcrypt.hashSync("1234", 10);
    db.prepare("INSERT INTO shops (id, name, phone, language, admin_pin, whatsapp_number) VALUES (?,?,?,?,?,?)").run("demo", "Wangs Eatery", "+5971234567", "nl", demoHash, "+5971234567");
    const cat1 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_srn, sort_order) VALUES (?,?,?,?,?,?)").run("demo", "Rijst gerechten", "饭类", "Rice dishes", "Aleisi nyanyan", 1).lastInsertRowid;
    const cat2 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_srn, sort_order) VALUES (?,?,?,?,?,?)").run("demo", "Noedels", "面类", "Noodles", "Noodles", 2).lastInsertRowid;
    const cat3 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_srn, sort_order) VALUES (?,?,?,?,?,?)").run("demo", "Drankjes", "饮品", "Drinks", "Dringi", 3).lastInsertRowid;
    const insertItem = db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, name_srn, desc, desc_zh, desc_en, desc_srn, price, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
    const demoItems = [
      [cat1, "Nasi Goreng", "印尼炒饭", "Fried Rice", "Nasi Goreng", "Met kip en groenten", "鸡肉蔬菜炒饭", "With chicken and veggies", "Nanga fowru nanga gruntu", 45],
      [cat1, "Moksi Meti", "混合米饭", "Mixed Rice", "Moksi Meti", "Surinaamse mix met vlees", "苏里南混合肉类米饭", "Surinamese mixed meat rice", "Sranan moksi meti nanga meti", 55],
      [cat1, "Roti Kip", "鸡肉飞饼", "Chicken Roti", "Roti Fowru", "Met aardappel en kousenband", "配土豆和豆角", "With potato and long beans", "Nanga patata nanga kousenband", 50],
      [cat2, "Bami Goreng", "炒面", "Fried Noodles", "Bami Goreng", "Met kip of garnalen", "鸡肉或虾仁", "With chicken or shrimp", "Nanga fowru noso garnalen", 40],
      [cat2, "Tjauw Min", "炒面（潮州）", "Chow Mein", "Tjauw Min", "Chinese stijl met groenten", "中式蔬菜炒面", "Chinese style with veggies", "Sneysi styl nanga gruntu", 42],
      [cat3, "Parbo Bier", "Parbo啤酒", "Parbo Beer", "Parbo Biri", "Lokaal gebrouwen", "本地酿造", "Locally brewed", "Meki na Sranan", 15],
      [cat3, "Verse Kokoswater", "新鲜椰子水", "Fresh Coconut Water", "Fersi Kokoswatra", "Uit eigen tuin", "自家种植", "From our garden", "Fu wi eigi dyari", 12],
    ];
    demoItems.forEach((item, idx) => {
      insertItem.run("demo", item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], idx);
    });
    console.log("Auto-seeded demo shop");
  }
}

module.exports = { initDb };
