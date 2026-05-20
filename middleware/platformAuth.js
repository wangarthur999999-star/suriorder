const jwt = require("jsonwebtoken");

function platformAuthMiddleware(JWT_SECRET) {
  return function platformAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorized" });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role !== "platform_owner" || payload.type !== "platform") {
        return res.status(401).json({ error: "unauthorized" });
      }
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  };
}

module.exports = { platformAuthMiddleware };
