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
  add("categories", "name_es", "TEXT");
  add("items", "name_es", "TEXT");
  add("items", "desc_es", "TEXT");
  add("shops", "admin_lang", "TEXT DEFAULT 'nl'");
  add("shops", "wizard_complete", "INTEGER DEFAULT 0");
  add("shops", "welcome_msg", "TEXT");
  add("orders", "payment_method", "TEXT DEFAULT 'cod'");
  add("orders", "payment_status", "TEXT DEFAULT 'unpaid'");
  add("orders", "payment_note", "TEXT");
  add("shops", "bank_name", "TEXT");
  add("shops", "bank_account", "TEXT");
  add("shops", "bank_account_name", "TEXT");

  // Auto-seed demo shop if not present (only when SEED_DEMO=true or not in production)
  const shouldSeed = process.env.SEED_DEMO === "true" || process.env.NODE_ENV !== "production";
  const demoExists = db.prepare("SELECT 1 FROM shops WHERE id='demo'").get();
  if (shouldSeed && !demoExists) {
    const demoHash = bcrypt.hashSync("1234", 10);
    db.prepare("INSERT INTO shops (id, name, phone, language, admin_pin, whatsapp_number) VALUES (?,?,?,?,?,?)").run("demo", "Wangs Eatery", "+5971234567", "nl", demoHash, "+5971234567");

    const cat1 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_es, sort_order) VALUES (?,?,?,?,?,?)").run("demo", "Rijst gerechten", "饭类", "Rice dishes", "Arroces", 1).lastInsertRowid;
    const cat2 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_es, sort_order) VALUES (?,?,?,?,?,?)").run("demo", "Noedels", "面类", "Noodles", "Fideos", 2).lastInsertRowid;
    const cat3 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_es, sort_order) VALUES (?,?,?,?,?,?)").run("demo", "Soepen", "汤类", "Soups", "Sopas", 3).lastInsertRowid;
    const cat4 = db.prepare("INSERT INTO categories (shop_id, name, name_zh, name_en, name_es, sort_order) VALUES (?,?,?,?,?,?)").run("demo", "Drankjes", "饮品", "Drinks", "Bebidas", 4).lastInsertRowid;

    const insertItem = db.prepare("INSERT INTO items (shop_id, category_id, name, name_zh, name_en, name_es, desc, desc_zh, desc_en, desc_es, price, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
    const demoItems = [
      [cat1, "Nasi Goreng", "印尼炒饭", "Fried Rice", "Arroz Frito", "Met kip en groenten", "鸡肉蔬菜炒饭", "With chicken and veggies", "Con pollo y vegetales", 45],
      [cat1, "Moksi Meti", "混合米饭", "Mixed Rice", "Arroz Mixto", "Surinaamse mix met vlees", "苏里南混合肉米饭", "Surinamese mixed meat rice", "Arroz mixto surinames con carne", 55],
      [cat1, "Roti Kip", "鸡肉飞饼", "Chicken Roti", "Roti de Pollo", "Met aardappel en kousenband", "配土豆和长豆角", "With potato and long beans", "Con papa y frijoles largos", 50],
      [cat1, "Tjap Tjoi", "杂菜", "Mixed Vegetables", "Verduras Mixtas", "Chinese gemengde groenten met vlees", "什锦杂菜炒肉", "Chinese mixed vegetables with meat", "Verduras chinas salteadas con carne", 42],
      [cat2, "Tjauw Min", "潮州炒面", "Chow Mein", "Chow Mein", "Chinese stijl met groenten en kip", "中式鸡肉蔬菜炒面", "Chinese style with veggies and chicken", "Fideos chinos salteados con pollo", 42],
      [cat2, "Bami Goreng", "炒面", "Fried Noodles", "Fideos Fritos", "Met kip of garnalen", "鸡肉或虾仁炒面", "With chicken or shrimp", "Con pollo o camarones", 40],
      [cat3, "Saotosoep", "苏里南鸡汤", "Chicken Soup", "Sopa de Pollo", "Surinaamse kippensoep met taugé", "苏里南风味鸡肉豆芽汤", "Surinamese chicken soup with bean sprouts", "Sopa surinamesa de pollo con brotes", 30],
      [cat3, "Wontonsoep", "云吞汤", "Wonton Soup", "Sopa Wantán", "Huisgemaakte wontons in bouillon", "自制云吞配鲜汤", "Homemade wontons in broth", "Wantanes caseros en caldo", 35],
      [cat4, "Parbo Bier", "Parbo啤酒", "Parbo Beer", "Cerveza Parbo", "Lokaal gebrouwen", "本地酿造", "Locally brewed", "Cerveza artesanal local", 15],
      [cat4, "Verse Kokoswater", "新鲜椰子水", "Fresh Coconut Water", "Agua de Coco", "Uit eigen tuin", "自家种植椰子", "From our garden", "De nuestro jardín", 12],
    ];
    demoItems.forEach((item, idx) => {
      insertItem.run("demo", item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], idx);
    });
  }

  // Performance: composite index for order listing queries
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC)");
}

module.exports = { initDb };
