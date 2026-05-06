import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  console.log("ENTRÓ AL REGISTER");
  try {
    const db = await req.app.locals.getDB();

    const { email, password } = req.body;

    // 1. validar datos
    if (!email || !password) {
      return res.status(400).json({ error: "DATOS_INCOMPLETOS" });
    }

    // 2. verificar si existe
    const userExists = await db.collection("users").findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: "USUARIO_EXISTE" });
    }

    // 3. encriptar password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. crear usuario
    const newUser = {
      email,
      password: hashedPassword,
      role: "user", // por defecto
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(newUser);

    res.json({ ok: true, message: "Usuario creado" });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};
//===LOGIN===//
export const login = async (req, res) => {
  console.log("entro al login");
  try {
    const db = await req.app.locals.getDB();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "DATOS_INCOMPLETOS" });
    }
    // BUSCA EL USUARIO
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "CREDENCIALES_INVALIDAS" });
    }
    const passwordValido = await bcrypt.compare(password, user.password);
    if (!passwordValido) {
      return res.status(401).json({ error: "CREDENCIALES_INVALIDAS" });
    }
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({
      ok:true,
      token,
      user: {
        email: user.email,
        name: user.name || "",
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};
