export const verificarAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "SOLO_ADMIN"
    });
  }

  next();
};