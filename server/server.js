require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const OpenAI = require("openai");

const app = express();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const PORT = process.env.PORT || 5000;

// Comma-separated list of frontend origins, e.g. "https://my-app.vercel.app"
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
];

// No fallback in production: a missing config value must stop the server,
// not silently point it at localhost or a publicly known secret.
if (IS_PRODUCTION) {
  for (const name of ["MONGO_URL", "JWT_SECRET"]) {
    if (!process.env[name]) {
      console.error(`FATAL: ${name} must be set when NODE_ENV=production.`);
      process.exit(1);
    }
  }
}

const MONGO_URL =
  process.env.MONGO_URL ||
  "mongodb://127.0.0.1:27017/kissanAdvisor";

// Outside production, a missing secret becomes a random per-process one
// (sessions reset on restart). It is never a known constant.
const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.randomBytes(48).toString("hex");

if (!process.env.JWT_SECRET) {
  console.warn(
    "WARNING: JWT_SECRET is not set. Using a temporary random secret; logins will not survive a restart."
  );
}

// Shared code that lets an agriculture officer self-register. Unset = registration disabled.
const OFFICER_INVITE_CODE = process.env.OFFICER_INVITE_CODE || "";

function safeEqual(a, b) {
  const hash = (value) =>
    crypto.createHash("sha256").update(String(value)).digest();

  return crypto.timingSafeEqual(hash(a), hash(b));
}

/* =====================================================
   OPENAI
===================================================== */

let openai = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY.trim(),
  });
}

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

/* =====================================================
   DATABASE
===================================================== */

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error(
      "MongoDB connection error:",
      error.message
    );

    // Serving requests without a database only produces 500s; let the host restart us.
    process.exit(1);
  });

/* =====================================================
   USER MODEL
===================================================== */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        "farmer",
        "officer",
        "admin",
      ],
      default: "farmer",
    },
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

/* =====================================================
   CASE MODEL
===================================================== */

const caseSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
    },

    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    farmerName: {
      type: String,
      required: true,
    },

    crop: {
      type: String,
      required: true,
    },

    disease: {
      type: String,
      required: true,
    },

    confidence: {
      type: Number,
      required: true,
    },

    image: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Verified",
      ],
      default: "Pending",
    },

    advice: {
      type: String,
      default: "",
    },

    officerName: {
      type: String,
      default: "",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  }
);

const DiseaseCase =
  mongoose.models.DiseaseCase ||
  mongoose.model(
    "DiseaseCase",
    caseSchema
  );

/* =====================================================
   JWT
===================================================== */

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

/* =====================================================
   AUTH MIDDLEWARE
===================================================== */

function authMiddleware(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    if (
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication format.",
      });
    }

    const token =
      authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is missing.",
      });
    }

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      success: false,
      message:
        "Session expired or invalid. Please login again.",
    });
  }
}

/* =====================================================
   OFFICER / ADMIN MIDDLEWARE
===================================================== */

function officerOnly(req, res, next) {
  if (
    req.user.role !== "officer" &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Officer access required.",
    });
  }

  next();
}

/* =====================================================
   ADMIN ONLY
===================================================== */

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message:
        "Admin access required.",
    });
  }

  next();
}

/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Kissan Advisor API is running 🌱",
  });
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/api/health", async (req, res) => {
  const mongoState =
    mongoose.connection.readyState;

  res.json({
    success: true,

    server: "running",

    mongodb:
      mongoState === 1
        ? "connected"
        : "disconnected",

    openai:
      Boolean(process.env.OPENAI_API_KEY),
  });
});

/* =====================================================
   OPENAI STATUS
===================================================== */

app.get(
  "/api/ai/status",
  (req, res) => {

    const configured =
      Boolean(
        process.env.OPENAI_API_KEY
      );

    res.json({
      configured,

      message:
        configured
          ? "OpenAI API is configured."
          : "OpenAI API key is not configured.",

      model:
        "gpt-4o-mini",
    });
  }
);

/* =====================================================
   OPENAI URDU AI Q&A
===================================================== */

app.post(
  "/api/ai/ask",
  authMiddleware,
  async (req, res) => {

    try {

      const question =
        typeof req.body.question === "string"
          ? req.body.question.trim()
          : "";

      const context =
        typeof req.body.context === "string"
          ? req.body.context.trim()
          : "";

      /* -----------------------------------------------
         VALIDATE QUESTION
      ------------------------------------------------ */

      if (!question) {
        return res.status(400).json({
          success: false,
          message:
            "Question is required.",
        });
      }

      if (question.length > 4000) {
        return res.status(400).json({
          success: false,
          message:
            "Question is too long. Please ask a shorter question.",
        });
      }

      /* -----------------------------------------------
         CHECK OPENAI
      ------------------------------------------------ */

      if (!process.env.OPENAI_API_KEY) {

        return res.status(503).json({
          success: false,
          message:
            "OpenAI API key is not configured.",
        });
      }

      if (!openai) {

        return res.status(503).json({
          success: false,
          message:
            "OpenAI service is not initialized.",
        });
      }

      /* -----------------------------------------------
         SYSTEM INSTRUCTIONS
      ------------------------------------------------ */

      const systemPrompt = `
You are Kissan Advisor, an AI agricultural assistant
designed for Pakistani farmers.

Your job is to answer farmers' agriculture questions
in very simple Urdu.

IMPORTANT RULES:

1. Answer in Urdu script by default.

2. Use very simple language that a farmer can understand.

3. Answer the farmer's exact question.

4. Give practical agricultural guidance.

5. Do not pretend to be an Agriculture Officer.

6. If the situation is severe, uncertain, or dangerous,
   recommend contacting a local Agriculture Officer.

7. Do not invent pesticide brands.

8. Do not provide unsafe pesticide mixing instructions.

9. For pesticide recommendations, advise the farmer to
   follow the product label and local Agriculture
   Department guidance.

10. Do not give a fake guaranteed diagnosis.

11. If the farmer asks about a disease, explain:
    - possible cause
    - what the farmer should do
    - prevention

12. Keep the answer concise and useful.

13. The farmer may ask questions about wheat,
    crops, diseases, irrigation, weather, fertilizers,
    pesticides, prevention, and general farming.

14. If the farmer's question is unclear, explain what
    additional crop information or photo would help.

Always prioritize farmer safety.
`;

      /* -----------------------------------------------
         USER MESSAGE
      ------------------------------------------------ */

      let userPrompt =
        `Farmer question:\n${question}`;

      if (context) {
        userPrompt +=
          `\n\nAdditional case context:\n${context}`;
      }

      /* -----------------------------------------------
         OPENAI REQUEST
      ------------------------------------------------ */

      const response =
        await openai.responses.create({

          model:
            "gpt-4o-mini",

          instructions:
            systemPrompt,

          input:
            userPrompt,

          temperature:
            0.3,

          max_output_tokens:
            600,
        });

      /* -----------------------------------------------
         GET ANSWER
      ------------------------------------------------ */

      let answer =
        response.output_text
          ? response.output_text.trim()
          : "";

      /* -----------------------------------------------
         FALLBACK EXTRACTION
      ------------------------------------------------ */

      if (!answer && response.output) {

        const textParts = [];

        for (
          const item of response.output
        ) {

          if (
            item.type ===
              "message" &&
            Array.isArray(
              item.content
            )
          ) {

            for (
              const content
              of item.content
            ) {

              if (
                content.type ===
                  "output_text" &&
                content.text
              ) {

                textParts.push(
                  content.text
                );
              }
            }
          }
        }

        answer =
          textParts
            .join("\n")
            .trim();
      }

      /* -----------------------------------------------
         EMPTY RESPONSE
      ------------------------------------------------ */

      if (!answer) {

        console.error(
          "OpenAI returned an empty response:",
          JSON.stringify(
            response,
            null,
            2
          )
        );

        return res.status(500).json({
          success: false,
          message:
            "AI did not return an answer.",
        });
      }

      /* -----------------------------------------------
         SUCCESS
      ------------------------------------------------ */

      return res.json({
        success: true,
        answer,
      });

    } catch (error) {

      /* -----------------------------------------------
         DETAILED ERROR LOG
      ------------------------------------------------ */

      console.error(
        "\n========== OPENAI ERROR =========="
      );

      console.error(
        "Message:",
        error?.message
      );

      console.error(
        "Status:",
        error?.status
      );

      console.error(
        "Code:",
        error?.code
      );

      console.error(
        "Type:",
        error?.type
      );

      console.error(
        "Name:",
        error?.name
      );

      console.error(
        "===================================\n"
      );

      /* -----------------------------------------------
         USER-FRIENDLY ERROR
      ------------------------------------------------ */

      let message =
        "Unable to get an AI answer right now.";

      if (
        error?.status === 401
      ) {

        message =
          "OpenAI API key is invalid or unauthorized.";

      } else if (
        error?.status === 429
      ) {

        message =
          "OpenAI API usage limit or quota has been reached.";

      } else if (
        error?.status === 404
      ) {

        message =
          "The requested OpenAI model or API endpoint is unavailable.";

      } else if (
        error?.status >= 500
      ) {

        message =
          "OpenAI service is temporarily unavailable. Please try again.";

      } else if (
        error?.message
      ) {

        message =
          error.message;
      }

      return res.status(
        error?.status >= 400 &&
        error?.status < 600
          ? error.status
          : 500
      ).json({

        success: false,

        message,

      });
    }
  }
);

/* =====================================================
   REGISTER FARMER
===================================================== */

app.post(
  "/api/auth/register",
  async (req, res) => {

    try {

      const {
        name,
        email,
        password,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Name, email and password are required.",
        });
      }

      if (
        password.length < 6
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters.",
        });
      }

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const existingUser =
        await User.findOne({
          email:
            cleanEmail,
        });

      if (existingUser) {

        return res.status(400).json({
          success: false,
          message:
            "An account with this email already exists.",
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const user =
        await User.create({

          name:
            name.trim(),

          email:
            cleanEmail,

          password:
            hashedPassword,

          role:
            "farmer",
        });

      const token =
        createToken(user);

      return res.status(201).json({

        success: true,

        message:
          "Farmer account created successfully.",

        token,

        user: {
          id:
            user._id,
          name:
            user.name,
          email:
            user.email,
          role:
            user.role,
        },

      });

    } catch (error) {

      console.error(
        "Farmer registration error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Registration failed.",
      });
    }
  }
);

/* =====================================================
   REGISTER OFFICER
===================================================== */

app.post(
  "/api/auth/officer-register",
  async (req, res) => {

    try {

      if (!OFFICER_INVITE_CODE) {

        return res.status(403).json({
          success: false,
          message:
            "Officer registration is disabled.",
        });
      }

      const {
        name,
        email,
        password,
        inviteCode,
      } = req.body;

      if (
        typeof inviteCode !== "string" ||
        !safeEqual(
          inviteCode,
          OFFICER_INVITE_CODE
        )
      ) {

        return res.status(403).json({
          success: false,
          message:
            "Invalid invite code.",
        });
      }

      if (
        !name ||
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Name, email and password are required.",
        });
      }

      if (
        password.length < 6
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters.",
        });
      }

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const existingUser =
        await User.findOne({
          email:
            cleanEmail,
        });

      if (existingUser) {

        return res.status(400).json({
          success: false,
          message:
            "An account with this email already exists.",
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const officer =
        await User.create({

          name:
            name.trim(),

          email:
            cleanEmail,

          password:
            hashedPassword,

          role:
            "officer",
        });

      const token =
        createToken(officer);

      return res.status(201).json({

        success: true,

        message:
          "Officer account created successfully.",

        token,

        user: {
          id:
            officer._id,
          name:
            officer.name,
          email:
            officer.email,
          role:
            officer.role,
        },

      });

    } catch (error) {

      console.error(
        "Officer registration error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Officer registration failed.",
      });
    }
  }
);

/* =====================================================
   FARMER LOGIN
===================================================== */

app.post(
  "/api/auth/login",
  async (req, res) => {

    try {

      const {
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Email and password are required.",
        });
      }

      const user =
        await User.findOne({
          email:
            email
              .trim()
              .toLowerCase(),
        });

      if (!user) {

        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password.",
        });
      }

      const passwordMatch =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!passwordMatch) {

        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password.",
        });
      }

      const token =
        createToken(user);

      return res.json({

        success: true,

        message:
          "Login successful.",

        token,

        user: {
          id:
            user._id,
          name:
            user.name,
          email:
            user.email,
          role:
            user.role,
        },

      });

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Login failed.",
      });
    }
  }
);

/* =====================================================
   OFFICER LOGIN
===================================================== */

app.post(
  "/api/auth/officer-login",
  async (req, res) => {

    try {

      const {
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Email and password are required.",
        });
      }

      const officer =
        await User.findOne({
          email:
            email
              .trim()
              .toLowerCase(),
        });

      if (!officer) {

        return res.status(401).json({
          success: false,
          message:
            "Officer account not found.",
        });
      }

      if (
        officer.role !==
        "officer"
      ) {

        return res.status(403).json({
          success: false,
          message:
            "This account is not an officer account.",
        });
      }

      const valid =
        await bcrypt.compare(
          password,
          officer.password
        );

      if (!valid) {

        return res.status(401).json({
          success: false,
          message:
            "Invalid officer credentials.",
        });
      }

      const token =
        createToken(officer);

      return res.json({

        success: true,

        message:
          "Officer login successful.",

        token,

        user: {
          id:
            officer._id,
          name:
            officer.name,
          email:
            officer.email,
          role:
            officer.role,
        },

      });

    } catch (error) {

      console.error(
        "Officer login error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Officer login failed.",
      });
    }
  }
);

/* =====================================================
   ADMIN LOGIN
===================================================== */

app.post(
  "/api/auth/admin-login",
  async (req, res) => {

    try {

      const {
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Email and password are required.",
        });
      }

      const admin =
        await User.findOne({
          email:
            email
              .trim()
              .toLowerCase(),
        });

      if (!admin) {

        return res.status(401).json({
          success: false,
          message:
            "Admin account not found.",
        });
      }

      if (
        admin.role !==
        "admin"
      ) {

        return res.status(403).json({
          success: false,
          message:
            "This account is not an admin account.",
        });
      }

      const valid =
        await bcrypt.compare(
          password,
          admin.password
        );

      if (!valid) {

        return res.status(401).json({
          success: false,
          message:
            "Invalid admin credentials.",
        });
      }

      const token =
        createToken(admin);

      return res.json({

        success: true,

        message:
          "Admin login successful.",

        token,

        user: {
          id:
            admin._id,
          name:
            admin.name,
          email:
            admin.email,
          role:
            admin.role,
        },

      });

    } catch (error) {

      console.error(
        "Admin login error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Admin login failed.",
      });
    }
  }
);

/* =====================================================
   GET FARMER CASES
===================================================== */

app.get(
  "/api/cases/my",
  authMiddleware,
  async (req, res) => {

    try {

      const cases =
        await DiseaseCase.find({
          farmerId:
            req.user.id,
        }).sort({
          createdAt: -1,
        });

      return res.json(cases);

    } catch (error) {

      console.error(
        "Get farmer cases error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load cases.",
      });
    }
  }
);

/* =====================================================
   GET ALL CASES
===================================================== */

app.get(
  "/api/cases",
  authMiddleware,
  officerOnly,
  async (req, res) => {

    try {

      const cases =
        await DiseaseCase.find()
          .sort({
            createdAt: -1,
          });

      return res.json(cases);

    } catch (error) {

      console.error(
        "Get all cases error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load cases.",
      });
    }
  }
);

/* =====================================================
   CREATE CASE
===================================================== */

app.post(
  "/api/cases",
  authMiddleware,
  async (req, res) => {

    try {

      const {
        crop,
        disease,
        confidence,
        image,
      } = req.body;

      if (
        !crop ||
        !disease ||
        confidence ===
          undefined ||
        confidence ===
          null
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Crop, disease and confidence are required.",
        });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {

        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      const count =
        await DiseaseCase.countDocuments();

      const caseId =
        `KA-${String(
          count + 1
        ).padStart(3, "0")}`;

      const newCase =
        await DiseaseCase.create({

          caseId,

          farmerId:
            req.user.id,

          farmerName:
            user.name,

          crop:
            String(crop).trim(),

          disease:
            String(disease).trim(),

          confidence:
            Number(confidence),

          image:
            image || "",

          status:
            "Pending",
        });

      return res.status(201).json({
        success: true,
        case:
          newCase,
      });

    } catch (error) {

      console.error(
        "Create case error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to create case.",
      });
    }
  }
);

/* =====================================================
   VERIFY CASE
===================================================== */

app.put(
  "/api/cases/:id/verify",
  authMiddleware,
  officerOnly,
  async (req, res) => {

    try {

      const officer =
        await User.findById(
          req.user.id
        );

      const updatedCase =
        await DiseaseCase.findByIdAndUpdate(

          req.params.id,

          {
            status:
              "Verified",

            officerName:
              officer?.name ||
              "Agriculture Officer",

            verifiedAt:
              new Date(),
          },

          {
            new: true,
          }
        );

      if (!updatedCase) {

        return res.status(404).json({
          success: false,
          message:
            "Case not found.",
        });
      }

      return res.json({
        success: true,
        case:
          updatedCase,
      });

    } catch (error) {

      console.error(
        "Verify case error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to verify case.",
      });
    }
  }
);

/* =====================================================
   SEND OFFICER ADVICE
===================================================== */

app.put(
  "/api/cases/:id/advice",
  authMiddleware,
  officerOnly,
  async (req, res) => {

    try {

      const {
        advice,
      } = req.body;

      if (
        !advice ||
        !String(advice).trim()
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Advice cannot be empty.",
        });
      }

      const officer =
        await User.findById(
          req.user.id
        );

      const updatedCase =
        await DiseaseCase.findByIdAndUpdate(

          req.params.id,

          {
            advice:
              String(advice).trim(),

            officerName:
              officer?.name ||
              "Agriculture Officer",
          },

          {
            new: true,
          }
        );

      if (!updatedCase) {

        return res.status(404).json({
          success: false,
          message:
            "Case not found.",
        });
      }

      return res.json({
        success: true,
        case:
          updatedCase,
      });

    } catch (error) {

      console.error(
        "Send advice error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to send advice.",
      });
    }
  }
);

/* =====================================================
   ADMIN SEED
===================================================== */

// Admin accounts cannot be created through the API. Set ADMIN_EMAIL and
// ADMIN_PASSWORD to create the first admin at startup (existing accounts are left untouched).
async function seedAdmin() {

  const email =
    (process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

  const password =
    process.env.ADMIN_PASSWORD || "";

  if (!email && !password) {
    return;
  }

  try {

    if (!email || password.length < 8) {

      console.error(
        "Admin seed skipped: ADMIN_EMAIL is required and ADMIN_PASSWORD must be at least 8 characters."
      );

      return;
    }

    const existingUser =
      await User.findOne({ email });

    if (existingUser) {

      console.log(
        existingUser.role === "admin"
          ? "Admin account already exists."
          : "Admin seed skipped: ADMIN_EMAIL belongs to a non-admin account."
      );

      return;
    }

    await User.create({

      name:
        "Administrator",

      email,

      password:
        await bcrypt.hash(
          password,
          10
        ),

      role:
        "admin",
    });

    console.log(
      "Admin account created successfully."
    );

  } catch (error) {

    console.error(
      "Admin seed error:",
      error.message
    );
  }
}

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
  (error, req, res, next) => {

    console.error(
      "Global server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message:
        "Internal server error.",
    });
  }
);

/* =====================================================
   SERVER
===================================================== */

app.listen(
  PORT,
  async () => {

    console.log(
      `Kissan Advisor server running at http://localhost:${PORT}`
    );

    if (
      process.env.OPENAI_API_KEY
    ) {

      console.log(
        "OpenAI API key loaded successfully."
      );

    } else {

      console.log(
        "WARNING: OpenAI API key not found in .env"
      );
    }

    await seedAdmin();
  }
);