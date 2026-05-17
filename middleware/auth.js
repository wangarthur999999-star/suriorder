const jwt = require("jsonwebtoken");

function authMiddleware(JWT_SECRET) {
  return function auth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : (req.query.token || "");
    if (!token) return res.status(401).json({ error: "unauthorized" });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.shopId = payload.shopId;
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  };
}

module.exports = { authMiddleware };
