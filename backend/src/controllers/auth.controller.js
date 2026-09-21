const authService = require("../services/auth.service");

function validateEmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6;
}

function validateName(name) {
  return typeof name === "string" && name.trim().length >= 1;
}

async function register(req, res, next) {
  try {
    const name = req.body.name ? req.body.name.trim() : "";
    const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password || "";
    const confirmPassword = req.body.confirmPassword || "";

    if (!validateName(name)) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email is required",
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    if (await authService.emailExists(email)) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await authService.createUser(name, email, password);

    res.status(201).json({
      success: true,
      data: { user },
      message: "Registration successful",
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password || "";

    if (!validateEmail(email) || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordValid = await authService.verifyPassword(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = authService.createToken(user.id);

    const cookieSecure = process.env.COOKIE_SECURE === "true";
    const cookieSameSite = process.env.COOKIE_SAME_SITE || "lax";

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      message: "Login successful",
    });
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  const cookieSecure = process.env.COOKIE_SECURE === "true";
  const cookieSameSite = process.env.COOKIE_SAME_SITE || "lax";

  res.clearCookie("access_token", {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
}

async function getMe(req, res, next) {
  try {
    const user = await authService.findUserById(req.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, logout, getMe };