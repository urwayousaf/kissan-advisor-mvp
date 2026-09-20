import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";
const AI_URL = "http://127.0.0.1:8000";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("ur-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDiseaseName(name) {
  if (!name) return "Unknown";

  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");
}

function getCropNameUrdu(name) {
  const cropMap = {
    Wheat: "گندم",
    wheat: "گندم",
    Tomato: "ٹماٹر",
    tomato: "ٹماٹر",
    Maize: "مکئی",
    maize: "مکئی",
    Rice: "چاول",
    rice: "چاول",
    Potato: "آلو",
    potato: "آلو",
  };

  return cropMap[name] || name || "گندم";
}

function getDiseaseNameUrdu(name) {
  const diseaseMap = {
    BrownRust: "براؤن رسٹ",
    YellowRust: "یلو رسٹ",
    Septoria: "سیپٹوریا",
    Mildew: "ملڈیو",
    Healthy: "صحت مند",
    Brown_Rust: "براؤن رسٹ",
    Yellow_Rust: "یلو رسٹ",
  };

  return diseaseMap[name] || formatDiseaseName(name);
}

function getStatusUrdu(status) {
  if (status === "Pending") return "زیرِ التوا";
  if (status === "Verified") return "تصدیق شدہ";

  return status || "نامعلوم";
}

/* =========================================================
   ADVICE VOICE DATA HELPERS
========================================================= */

function createAdvicePayload(text, voiceNote = "") {
  return JSON.stringify({
    type: "KISSAN_ADVISOR_ADVICE",
    text: text || "",
    voiceNote: voiceNote || "",
  });
}

function parseAdvice(advice) {
  if (!advice) {
    return {
      text: "",
      voiceNote: "",
    };
  }

  if (typeof advice === "object") {
    return {
      text: advice.text || "",
      voiceNote: advice.voiceNote || "",
    };
  }

  try {
    const parsed = JSON.parse(advice);

    if (
      parsed &&
      parsed.type === "KISSAN_ADVISOR_ADVICE"
    ) {
      return {
        text: parsed.text || "",
        voiceNote: parsed.voiceNote || "",
      };
    }
  } catch {
    // Old normal text advice
  }

  return {
    text: advice,
    voiceNote: "",
  };
}

/* =========================================================
   WEATHER
========================================================= */

function getWeatherDescription(code) {
  const weatherMap = {
    0: "صاف آسمان",
    1: "زیادہ تر صاف",
    2: "جزوی طور پر ابر آلود",
    3: "مکمل ابر آلود",
    45: "دھند",
    48: "جمی ہوئی دھند",
    51: "ہلکی بوندا باندی",
    53: "درمیانی بوندا باندی",
    55: "تیز بوندا باندی",
    61: "ہلکی بارش",
    63: "درمیانی بارش",
    65: "تیز بارش",
    71: "ہلکی برف باری",
    73: "درمیانی برف باری",
    75: "تیز برف باری",
    80: "ہلکی بارش کی بوچھاڑ",
    81: "درمیانی بارش کی بوچھاڑ",
    82: "تیز بارش کی بوچھاڑ",
    95: "گرج چمک",
    96: "گرج چمک کے ساتھ اولے",
    99: "تیز اولوں کے ساتھ گرج چمک",
  };

  return weatherMap[code] || "موسم کی معلومات دستیاب نہیں";
}

function getSprayAlert(weather) {
  if (!weather) {
    return {
      type: "info",
      title: "موسم کی معلومات دستیاب نہیں",
      message:
        "اسپرے کرنے سے پہلے اپنی لوکیشن استعمال کرکے موجودہ موسم چیک کریں۔",
    };
  }

  const rain = Number(weather.precipitation || 0);
  const rainProbability = Number(
    weather.precipitationProbability || 0
  );
  const wind = Number(weather.windSpeed || 0);

  if (rain > 0.1 || rainProbability >= 60) {
    return {
      type: "danger",
      title: "ابھی اسپرے نہ کریں",
      message:
        "بارش کا امکان ہے یا بارش ہو رہی ہے۔ بارش زرعی اسپرے کے اثر کو کم کر سکتی ہے۔ موسم بہتر ہونے پر دوبارہ چیک کریں۔",
    };
  }

  if (wind >= 25) {
    return {
      type: "warning",
      title: "تیز ہوا چل رہی ہے",
      message:
        "تیز ہوا اسپرے کو دوسری جگہ منتقل کر سکتی ہے۔ پرسکون موسم کا انتظار کریں اور دوا کے لیبل پر دی گئی ہدایات پر عمل کریں۔",
    };
  }

  return {
    type: "success",
    title: "موسم اسپرے کے لیے مناسب ہے",
    message:
      "موجودہ موسم میں بارش یا تیز ہوا کا بڑا خطرہ نظر نہیں آ رہا۔ پھر بھی دوا کے لیبل اور زرعی افسر کی ہدایات پر عمل کریں۔",
  };
}

/* =========================================================
   WHEAT DISEASE ADVISORY
========================================================= */

function getDiseaseAdvice(disease) {
  switch (disease) {
    case "BrownRust":
      return {
        symptoms:
          "گندم کے پتوں پر بھورے یا نارنجی بھورے زنگ جیسے دھبے یا دانے ظاہر ہو سکتے ہیں۔",
        treatment:
          "فصل کو باقاعدگی سے چیک کریں اور مناسب مقامی علاج کے لیے زرعی افسر سے مشورہ کریں۔",
        pesticide:
          "صرف وہی مقامی طور پر رجسٹرڈ فنگس کش دوا استعمال کریں جو گندم کے لیے منظور شدہ ہو اور زرعی افسر یا دوا کے لیبل کے مطابق ہو۔",
        prevention:
          "جہاں دستیاب ہوں وہاں بیماری کے خلاف مزاحمت رکھنے والی اقسام استعمال کریں، فصل کو باقاعدگی سے دیکھیں اور اچھی زرعی دیکھ بھال کریں۔",
        weather:
          "بارش یا تیز ہوا میں اسپرے نہ کریں۔ زرعی دوا استعمال کرنے سے پہلے مقامی موسم چیک کریں۔",
      };

    case "YellowRust":
      return {
        symptoms:
          "گندم کے پتوں پر پیلے یا زرد نارنجی رنگ کے زنگ نما دانے لکیروں کی شکل میں ظاہر ہو سکتے ہیں۔",
        treatment:
          "فصل کو باقاعدگی سے چیک کریں اور بروقت انتظام کے لیے زرعی افسر سے مشورہ کریں۔",
        pesticide:
          "صرف گندم کے لیے مقامی طور پر رجسٹرڈ فنگس کش دوا استعمال کریں اور دوا کے لیبل اور ماہر کی ہدایت پر عمل کریں۔",
        prevention:
          "جہاں دستیاب ہوں وہاں مزاحم اقسام استعمال کریں، فصل کو شروع سے چیک کریں اور تجویز کردہ زرعی طریقوں پر عمل کریں۔",
        weather:
          "بارش یا تیز ہوا میں اسپرے نہ کریں۔ دوا استعمال کرنے سے پہلے موسم چیک کریں۔",
      };

    case "Septoria":
      return {
        symptoms:
          "سیپٹوریا کی وجہ سے گندم کے پتوں پر دھبے، زخم اور آہستہ آہستہ پیلا پن یا خشکی پیدا ہو سکتی ہے۔",
        treatment:
          "بیماری کی صورتحال دیکھتے رہیں اور فصل کے مرحلے اور مقامی حالات کے مطابق زرعی افسر سے مناسب علاج کے لیے مشورہ کریں۔",
        pesticide:
          "صرف مقامی طور پر رجسٹرڈ گندم کی فنگس کش دوا استعمال کریں، وہ بھی زرعی ماہر کی سفارش اور دوا کے لیبل کے مطابق۔",
        prevention:
          "کھیت کی صفائی برقرار رکھیں، نچلے پتوں کو چیک کریں اور گندم کی تجویز کردہ دیکھ بھال پر عمل کریں۔",
        weather:
          "زیادہ نمی والی صورتحال فنگس کی بیماری کو بڑھا سکتی ہے۔ اسپرے سے پہلے موسم چیک کریں۔",
      };

    case "Mildew":
      return {
        symptoms:
          "متاثرہ گندم کے پتوں پر سفید یا سرمئی پاؤڈر جیسی تہہ ظاہر ہو سکتی ہے۔",
        treatment:
          "فصل کی نگرانی بہتر کریں اور مناسب علاج کے لیے زرعی افسر سے مشورہ کریں۔",
        pesticide:
          "صرف گندم کے ملڈیو کے لیے مقامی طور پر رجسٹرڈ دوا استعمال کریں اور دوا کے لیبل پر عمل کریں۔",
        prevention:
          "جہاں ممکن ہو فصل کی غیر ضروری کثافت سے بچیں، کھیت کی اچھی دیکھ بھال کریں اور مزاحم اقسام استعمال کریں۔",
        weather:
          "بارش یا تیز ہوا میں اسپرے نہ کریں اور پہلے مقامی موسم چیک کریں۔",
      };

    case "Healthy":
      return {
        symptoms:
          "AI ماڈل نے اپ لوڈ کی گئی تصویر میں اپنی تربیت کے مطابق گندم کی کوئی مخصوص بیماری نہیں پائی۔",
        treatment:
          "اس AI نتیجے کی بنیاد پر کسی مخصوص بیماری کا علاج ضروری نہیں۔ فصل کی باقاعدگی سے نگرانی جاری رکھیں۔",
        pesticide:
          "غیر ضروری طور پر کیڑے مار یا فنگس کش دوا استعمال نہ کریں۔ دوا صرف تصدیق شدہ ضرورت اور ماہر کی سفارش پر استعمال کریں۔",
        prevention:
          "فصل کا باقاعدگی سے معائنہ کریں اور گندم کی تجویز کردہ زرعی دیکھ بھال جاری رکھیں۔",
        weather:
          "زرعی اسپرے سے پہلے مقامی موسم کی صورتحال چیک کرتے رہیں۔",
      };

    default:
      return {
        symptoms:
          "AI نتیجے کو کسی مخصوص بیماری کی رہنمائی سے نہیں ملایا جا سکا۔",
        treatment:
          "براہِ کرم تصدیق کے لیے زرعی افسر سے مشورہ کریں۔",
        pesticide:
          "صرف غیر یقینی AI نتیجے کی بنیاد پر کوئی دوا استعمال نہ کریں۔",
        prevention:
          "فصل کی نگرانی جاری رکھیں اور ماہر سے رہنمائی حاصل کریں۔",
        weather:
          "زرعی اسپرے سے پہلے مقامی موسم چیک کریں۔",
      };
  }
}

/* =========================================================
   FARMER AUTH
========================================================= */

function Auth({
  farmerMode,
  setFarmerMode,
  formData,
  setFormData,
  handleAuth,
  loading,
  error,
  setError,
  setPage,
}) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🌱</div>

        <div className="auth-title">
          <span className="small-label">KISSAN ADVISOR</span>

          <h2>
            {farmerMode === "login"
              ? "خوش آمدید"
              : "کسان اکاؤنٹ بنائیں"}
          </h2>

          <p>
            {farmerMode === "login"
              ? "اپنے کسان ڈیش بورڈ پر جانے کے لیے لاگ اِن کریں۔"
              : "اپنا اکاؤنٹ بنائیں اور اپنی فصلوں کی جانچ شروع کریں۔"}
          </p>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleAuth} autoComplete="on">
          {farmerMode === "register" && (
            <div className="form-group">
              <label htmlFor="name">پورا نام</label>

              <input
                id="name"
                name="name"
                type="text"
                placeholder="مثلاً محمد علی"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">ای میل ایڈریس</label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="مثلاً farmer@gmail.com"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">پاس ورڈ</label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="اپنا پاس ورڈ درج کریں"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              autoComplete={
                farmerMode === "register"
                  ? "new-password"
                  : "current-password"
              }
              minLength="6"
              required
            />

            <small className="input-help">
              کم از کم 6 حروف
            </small>
          </div>

          <button
            type="submit"
            className="primary-btn full-width"
            disabled={loading}
          >
            {loading
              ? "⏳ براہِ کرم انتظار کریں..."
              : farmerMode === "login"
              ? "🔐 اکاؤنٹ میں لاگ اِن کریں"
              : "🌱 اکاؤنٹ بنائیں"}
          </button>
        </form>

        <div className="auth-switch">
          {farmerMode === "login" ? (
            <>
              <span>کیا آپ کا اکاؤنٹ نہیں ہے؟</span>

              <button
                type="button"
                onClick={() => {
                  setFarmerMode("register");
                  setError("");

                  setFormData({
                    name: "",
                    email: formData.email,
                    password: "",
                  });
                }}
              >
                رجسٹر کریں
              </button>
            </>
          ) : (
            <>
              <span>کیا آپ کا پہلے سے اکاؤنٹ ہے؟</span>

              <button
                type="button"
                onClick={() => {
                  setFarmerMode("login");
                  setError("");

                  setFormData({
                    name: "",
                    email: formData.email,
                    password: "",
                  });
                }}
              >
                لاگ اِن
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="back-btn"
          onClick={() => {
            setError("");
            setPage("home");
          }}
        >
          ← ہوم پر واپس جائیں
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   STAFF LOGIN
========================================================= */

function StaffLogin({
  staffRole,
  setPage,
  onLogin,
}) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = staffRole === "admin";

  const roleName = isAdmin
    ? "ایڈمن"
    : "زرعی افسر";

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2) {
          throw new Error("براہِ کرم اپنا پورا نام درج کریں۔");
        }

        if (password.length < 6) {
          throw new Error(
            "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔"
          );
        }

        if (password !== confirmPassword) {
          throw new Error("دونوں پاس ورڈ ایک جیسے نہیں ہیں۔");
        }

        const endpoint = isAdmin
          ? "/auth/admin-register"
          : "/auth/officer-register";

        const response = await fetch(
          `${API_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: cleanName,
              email: cleanEmail,
              password,
            }),
          }
        );

        let data = {};

        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          throw new Error(
            data.message || "رجسٹریشن مکمل نہیں ہو سکی۔"
          );
        }

        if (!data.token || !data.user) {
          throw new Error(
            "اکاؤنٹ بن گیا لیکن لاگ اِن سیشن نہیں بن سکا۔"
          );
        }

        onLogin(data.token, data.user);
        return;
      }

      const endpoint = isAdmin
        ? "/auth/admin-login"
        : "/auth/officer-login";

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message || "لاگ اِن نہیں ہو سکا۔"
        );
      }

      if (
        isAdmin &&
        data.user?.role !== "admin"
      ) {
        throw new Error(
          "اس اکاؤنٹ کو ایڈمن رسائی حاصل نہیں ہے۔"
        );
      }

      if (
        !isAdmin &&
        data.user?.role !== "officer"
      ) {
        throw new Error(
          "اس اکاؤنٹ کو افسر کی رسائی حاصل نہیں ہے۔"
        );
      }

      if (!data.token || !data.user) {
        throw new Error(
          "لاگ اِن کا جواب نامکمل ہے۔"
        );
      }

      onLogin(data.token, data.user);
    } catch (err) {
      setError(
        err.message ||
        "درخواست مکمل نہیں ہو سکی۔"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          {isAdmin ? "⚙️" : "👨‍🌾"}
        </div>

        <div className="auth-title">
          <span className="small-label">
            KISSAN ADVISOR
          </span>

          <h2>
            {mode === "login"
              ? `${roleName} لاگ اِن`
              : `${roleName} اکاؤنٹ بنائیں`}
          </h2>

          <p>
            {mode === "login"
              ? isAdmin
                ? "مکمل نظام کی نگرانی اور انتظام کے لیے لاگ اِن کریں۔"
                : "کسانوں کے فصلوں کے کیسز کا جائزہ لینے کے لیے لاگ اِن کریں۔"
              : isAdmin
              ? "نظام کے انتظام کے لیے ایڈمن اکاؤنٹ بنائیں۔"
              : "کسانوں کے کیسز کا جائزہ لینے کے لیے زرعی افسر اکاؤنٹ بنائیں۔"}
          </p>
        </div>

        <div className="auth-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            🔐 لاگ اِن
          </button>

          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            📝 رجسٹر کریں
          </button>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="on">
          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="staff-name">
                پورا نام
              </label>

              <input
                id="staff-name"
                name="name"
                type="text"
                placeholder={
                  isAdmin
                    ? "مثلاً سسٹم ایڈمنسٹریٹر"
                    : "مثلاً محمد علی"
                }
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="staff-email">
              ای میل ایڈریس
            </label>

            <input
              id="staff-email"
              name="email"
              type="email"
              placeholder={
                isAdmin
                  ? "admin@gmail.com"
                  : "officer@gmail.com"
              }
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="staff-password">
              پاس ورڈ
            </label>

            <input
              id="staff-password"
              name="password"
              type="password"
              placeholder="اپنا پاس ورڈ درج کریں"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete={
                mode === "register"
                  ? "new-password"
                  : "current-password"
              }
              minLength="6"
              required
            />

            <small className="input-help">
              کم از کم 6 حروف
            </small>
          </div>

          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="staff-confirm-password">
                پاس ورڈ دوبارہ درج کریں
              </label>

              <input
                id="staff-confirm-password"
                name="confirmPassword"
                type="password"
                placeholder="اپنا پاس ورڈ دوبارہ درج کریں"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                autoComplete="new-password"
                minLength="6"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="primary-btn full-width"
            disabled={loading}
          >
            {loading
              ? "⏳ براہِ کرم انتظار کریں..."
              : mode === "login"
              ? isAdmin
                ? "⚙️ ایڈمن کے طور پر لاگ اِن کریں"
                : "👨‍🌾 افسر کے طور پر لاگ اِن کریں"
              : isAdmin
              ? "⚙️ ایڈمن اکاؤنٹ بنائیں"
              : "👨‍🌾 افسر اکاؤنٹ بنائیں"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              <span>
                کیا آپ کا اکاؤنٹ نہیں ہے؟
              </span>

              <button
                type="button"
                onClick={() =>
                  switchMode("register")
                }
              >
                رجسٹر کریں
              </button>
            </>
          ) : (
            <>
              <span>
                کیا آپ کا پہلے سے اکاؤنٹ ہے؟
              </span>

              <button
                type="button"
                onClick={() =>
                  switchMode("login")
                }
              >
                لاگ اِن
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="back-btn"
          onClick={() => {
            setError("");
            setMode("login");
            setPage("home");
          }}
        >
          ← ہوم پر واپس جائیں
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   HOME
========================================================= */

function Home({
  setPage,
  setFarmerMode,
}) {
  const openFarmerLogin = () => {
    setFarmerMode("login");
    setPage("auth");
  };

  const openRegister = () => {
    setFarmerMode("register");
    setPage("auth");
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div
          className="logo"
          onClick={() => setPage("home")}
        >
          <span className="logo-icon">🌱</span>
          Kissan Advisor
        </div>

        <div className="nav-links">
          <button
            type="button"
            className="nav-btn active"
            onClick={() => setPage("home")}
          >
            ہوم
          </button>

          <button
            type="button"
            className="nav-btn"
            onClick={openFarmerLogin}
          >
            کسان لاگ اِن
          </button>

          <button
            type="button"
            className="register-nav"
            onClick={openRegister}
          >
            رجسٹر کریں
          </button>

          <button
            type="button"
            className="officer-nav"
            onClick={() =>
              setPage("officer-login")
            }
          >
            افسر پینل
          </button>

          <button
            type="button"
            className="nav-btn"
            onClick={() =>
              setPage("admin-login")
            }
          >
            ایڈمن
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            🇵🇰 پاکستان کا اسمارٹ فارمنگ اسسٹنٹ
          </div>

          <h1>
            فصل کی اسمارٹ بیماری
            <br />
            <span>تشخیص اور رہنمائی</span>
          </h1>

          <p>
            فصل کے پتے کی تصویر اپ لوڈ کریں اور AI کی مدد سے
            بیماری کی تشخیص اور زرعی ماہر کی رہنمائی حاصل کریں۔
          </p>

          <div className="hero-buttons">
            <button
              type="button"
              className="primary-btn"
              onClick={openFarmerLogin}
            >
              کسان کے طور پر شروع کریں
              <span>→</span>
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                setPage("officer-login")
              }
            >
              زرعی افسر
            </button>
          </div>

          <div className="trust-row">
            <span>✓ AI بیماری کی تشخیص</span>
            <span>✓ ماہر کی تصدیق</span>
            <span>✓ اردو وائس</span>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card-top">
            <span className="live-dot"></span>
            اسمارٹ فصل تجزیہ
          </div>

          <div className="hero-card-icon">
            🌿
          </div>

          <h3>
            صحت مند کاشتکاری یہاں سے شروع کریں
          </h3>

          <p>
            فصل کی بیماری کو جلد شناخت کریں اور قابلِ اعتماد
            زرعی رہنمائی حاصل کریں۔
          </p>

          <div className="mini-stats">
            <div>
              <strong>AI</strong>
              <span>تشخیص</span>
            </div>

            <div>
              <strong>اردو</strong>
              <span>وائس</span>
            </div>

            <div>
              <strong>24/7</strong>
              <span>رسائی</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-heading">
          <span>یہ کیسے کام کرتا ہے</span>

          <h2>
            کسان کے لیے ضروری سہولیات
          </h2>

          <p>
            حقیقی کسانوں کے لیے آسان اور سادہ ٹیکنالوجی۔
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📷</div>

            <h3>فصل کی تصویر اپ لوڈ کریں</h3>

            <p>
              متاثرہ فصل کے پتے کی صاف تصویر لیں اور اسے اپ لوڈ کریں۔
            </p>

            <div className="feature-number">
              01
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤖</div>

            <h3>AI بیماری کی تشخیص</h3>

            <p>
              AI تصویر کا تجزیہ کرکے ممکنہ گندم کی بیماری کی شناخت کرتا ہے۔
            </p>

            <div className="feature-number">
              02
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">👨‍🌾</div>

            <h3>ماہر کی تصدیق</h3>

            <p>
              زرعی افسر نتیجے کا جائزہ لے کر ماہرانہ رہنمائی فراہم کرتا ہے۔
            </p>

            <div className="feature-number">
              03
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔊</div>

            <h3>اردو وائس رہنمائی</h3>

            <p>
              بیماری اور علاج کی معلومات اردو آواز میں سنیں۔
            </p>

            <div className="feature-number">
              04
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-logo">
          🌱 Kissan Advisor
        </div>

        <p>
          پاکستان کے لیے اسمارٹ فارمنگ ٹیکنالوجی
        </p>

        <span>
          © 2026 Kissan Advisor
        </span>
      </footer>
    </div>
  );
}

/* =========================================================
   WEATHER SECTION
========================================================= */

function WeatherSection({
  weather,
  locationName,
  weatherLoading,
  locationLoading,
  weatherError,
  getLocationWeather,
}) {
  const sprayAlert = getSprayAlert(weather);

  return (
    <section className="weather-section">
      <div className="section-header">
        <div>
          <p className="small-label">
            اسمارٹ موسم
          </p>

          <h2>
            🌦️ موسم اور اسپرے الرٹ
          </h2>

          <p>
            زرعی اسپرے کرنے سے پہلے اپنے علاقے کا موسم چیک کریں۔
          </p>
        </div>

        <button
          type="button"
          className="secondary-btn"
          onClick={getLocationWeather}
          disabled={weatherLoading || locationLoading}
        >
          {locationLoading || weatherLoading
            ? "📍 لوکیشن معلوم ہو رہی ہے..."
            : "📍 میری لوکیشن استعمال کریں"}
        </button>
      </div>

      {weatherError && (
        <div className="error-message">
          ⚠️ {weatherError}
        </div>
      )}

      {weather ? (
        <div className="weather-dashboard">
          <div className="weather-main-card">
            <div className="weather-location">
              📍 {locationName || "آپ کی لوکیشن"}
            </div>

            <div className="weather-temperature">
              {Math.round(weather.temperature)}°C
            </div>

            <h3>
              {getWeatherDescription(weather.weatherCode)}
            </h3>

            <p>
              موجودہ مقامی موسم کی صورتحال
            </p>
          </div>

          <div className="weather-stats">
            <div className="weather-stat-card">
              <span>💧</span>
              <small>نمی</small>
              <strong>
                {weather.humidity}%
              </strong>
            </div>

            <div className="weather-stat-card">
              <span>💨</span>
              <small>ہوا</small>
              <strong>
                {weather.windSpeed} کلومیٹر فی گھنٹہ
              </strong>
            </div>

            <div className="weather-stat-card">
              <span>🌧️</span>
              <small>بارش کا امکان</small>
              <strong>
                {weather.precipitationProbability}%
              </strong>
            </div>

            <div className="weather-stat-card">
              <span>☔</span>
              <small>بارش</small>
              <strong>
                {weather.precipitation} ملی میٹر
              </strong>
            </div>
          </div>

          <div
            className={`spray-alert ${sprayAlert.type}`}
          >
            <div className="spray-alert-icon">
              {sprayAlert.type === "success"
                ? "✅"
                : sprayAlert.type === "warning"
                ? "⚠️"
                : sprayAlert.type === "danger"
                ? "🚫"
                : "ℹ️"}
            </div>

            <div>
              <small>
                اسپرے الرٹ
              </small>

              <h3>
                {sprayAlert.title}
              </h3>

              <p>
                {sprayAlert.message}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div>📍</div>

          <h3>
            لوکیشن کا موسم لوڈ نہیں ہوا
          </h3>

          <p>
            مقامی موسم اور اسپرے کی صورتحال دیکھنے کے لیے
            "میری لوکیشن استعمال کریں" پر کلک کریں۔
          </p>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   FARMER DASHBOARD
========================================================= */

function Dashboard({
  farmer,
  cases,
  selectedFile,
  selectedImage,
  isAnalyzing,
  showResult,
  analysisResult,
  error,
  fileInputRef,
  handleImageChange,
  handleAnalyze,
  loadFarmerCases,
  speakAdvice,
  logout,
  shareCase,
  weather,
  locationName,
  weatherLoading,
  locationLoading,
  weatherError,
  getLocationWeather,
}) {
  const [selectedHistoryCase, setSelectedHistoryCase] =
    useState(null);

  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const handleTextChat = (e) => {
    e.preventDefault();

    const message = chatMessage.trim();
    if (!message) return;

    let reply =
      "براہِ کرم پہلے اپنی فصل کی تصویر اپ لوڈ کرکے AI تجزیہ مکمل کریں، پھر میں اسی نتیجے کی بنیاد پر رہنمائی دوں گا۔";

    if (currentResult) {
      const text = message.toLowerCase();

      if (
        text.includes("بیماری") ||
        text.includes("مسئلہ") ||
        text.includes("disease")
      ) {
        reply = `اس تصویر کے AI تجزیے کے مطابق ممکنہ بیماری ${getDiseaseNameUrdu(currentResult.disease)} ہے اور اعتماد کی شرح ${currentResult.confidence}% ہے۔`;
      } else if (
        text.includes("علاج") ||
        text.includes("treatment")
      ) {
        reply = advisory.treatment;
      } else if (
        text.includes("دوا") ||
        text.includes("سپرے") ||
        text.includes("pesticide")
      ) {
        reply = advisory.pesticide;
      } else if (
        text.includes("بچاؤ") ||
        text.includes("احتیاط") ||
        text.includes("prevention")
      ) {
        reply = advisory.prevention;
      } else {
        reply =
          "آپ کے سوال کو موجودہ AI نتیجے کے ساتھ دیکھا گیا ہے۔ مزید مخصوص رہنمائی کے لیے زرعی افسر سے تصدیق حاصل کریں۔";
      }
    }

    setChatMessages((previous) => [
      ...previous,
      { type: "user", text: message },
      { type: "assistant", text: reply },
    ]);
    setChatMessage("");
  };

  const pendingCases = cases.filter(
    (item) => item.status === "Pending"
  ).length;

  const verifiedCases = cases.filter(
    (item) => item.status === "Verified"
  ).length;

  const latestCase =
    cases.length > 0 ? cases[0] : null;

  const currentResult =
    analysisResult ||
    (showResult && latestCase
      ? {
          crop: latestCase.crop,
          disease: latestCase.disease,
          confidence: latestCase.confidence,
          status: "success",
        }
      : null);

  const diseaseName =
    getDiseaseNameUrdu(currentResult?.disease);

  const advisory =
    getDiseaseAdvice(currentResult?.disease);

  const latestAdvice =
    parseAdvice(latestCase?.advice);


  return (
    <div className="dashboard-page">
      <nav className="dashboard-nav">
        <div className="logo">
          <span className="logo-icon">🌱</span>
          Kissan Advisor
        </div>

        <div className="user-area">
          <span>
            خوش آمدید، <strong>{farmer?.name}</strong>
          </span>

          <button
            type="button"
            onClick={logout}
          >
            لاگ آؤٹ
          </button>
        </div>
      </nav>

      <main className="dashboard-container">
        <div className="dashboard-heading">
          <div>
            <p className="small-label">
              کسان ڈیش بورڈ
            </p>

            <h1>
              السلام علیکم، {farmer?.name} 👋
            </h1>

            <p>
              اپنی گندم کی فصل کی تصویر اپ لوڈ کریں تاکہ ممکنہ بیماری
              کی تشخیص اور زرعی رہنمائی حاصل کی جا سکے۔
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>📋</span>

            <div>
              <small>کل کیسز</small>
              <h3>{cases.length}</h3>
            </div>
          </div>

          <div className="stat-card">
            <span>⏳</span>

            <div>
              <small>زیرِ التوا</small>
              <h3>{pendingCases}</h3>
            </div>
          </div>

          <div className="stat-card">
            <span>✅</span>

            <div>
              <small>تصدیق شدہ</small>
              <h3>{verifiedCases}</h3>
            </div>
          </div>
        </div>

        <div className="quick-feature-grid">
          <div className="info-feature-card">
            <div className="info-feature-icon">
              🌦️
            </div>

            <div>
              <h3>موسم اور اسپرے الرٹ</h3>

              <p>
                مقامی موسم اور اسپرے سے متعلق رہنمائی۔
              </p>
            </div>
          </div>

          <div className="info-feature-card">
            <div className="info-feature-icon">
              📍
            </div>

            <div>
              <h3>لوکیشن رہنمائی</h3>

              <p>
                اپنے علاقے کے موسم کی معلومات حاصل کریں۔
              </p>
            </div>
          </div>

        </div>

        <WeatherSection
          weather={weather}
          locationName={locationName}
          weatherLoading={weatherLoading}
          locationLoading={locationLoading}
          weatherError={weatherError}
          getLocationWeather={getLocationWeather}
        />

        <section className="upload-section">
          <div className="section-header">
            <div>
              <p className="small-label">
                AI تجزیہ
              </p>

              <h2>
                🌾 اپنی گندم کی فصل چیک کریں
              </h2>

              <p>
                متاثرہ گندم کے پتے کی صاف تصویر اپ لوڈ کریں۔
              </p>
            </div>
          </div>

          <div className="upload-box">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt="منتخب فصل کی تصویر"
                className="preview-image"
              />
            ) : (
              <div className="upload-icon">
                📷
              </div>
            )}

            <h3>
              {selectedFile
                ? selectedFile.name
                : "گندم کی فصل کی تصویر اپ لوڈ کریں"}
            </h3>

            <p>
              JPG، PNG یا JPEG تصویر
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleImageChange}
              hidden
            />

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              📁 تصویر منتخب کریں
            </button>

            {selectedFile && (
              <button
                type="button"
                className="primary-btn analyze-btn"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing
                  ? "🤖 AI تجزیہ کر رہا ہے..."
                  : "🤖 گندم کا تجزیہ کریں"}
              </button>
            )}
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {showResult && currentResult && (
            <div className="result-card">
              <div className="result-header">
                <div>
                  <span className="success-badge">
                    ✓ AI تجزیہ مکمل
                  </span>

                  <h2>
                    🌾 {getCropNameUrdu(currentResult.crop)}
                  </h2>
                </div>

                <div className="confidence">
                  <strong>
                    {currentResult.confidence}%
                  </strong>

                  <span>
                    اعتماد کی شرح
                  </span>
                </div>
              </div>

              <div className="disease-result">
                <small>
                  شناخت شدہ بیماری
                </small>

                <h3>
                  {diseaseName}
                </h3>

                <p>
                  {advisory.symptoms}
                </p>
              </div>

              <div className="advisory-grid">
                <div className="advisory-card">
                  <div className="advisory-icon">
                    💊
                  </div>

                  <div>
                    <small>علاج</small>

                    <h3>
                      تجویز کردہ علاج
                    </h3>

                    <p>
                      {advisory.treatment}
                    </p>
                  </div>
                </div>

                <div className="advisory-card">
                  <div className="advisory-icon">
                    🧪
                  </div>

                  <div>
                    <small>کیڑے مار / فنگس کش دوا</small>

                    <h3>
                      دوا سے متعلق رہنمائی
                    </h3>

                    <p>
                      {advisory.pesticide}
                    </p>
                  </div>
                </div>

                <div className="advisory-card">
                  <div className="advisory-icon">
                    🛡️
                  </div>

                  <div>
                    <small>بچاؤ</small>

                    <h3>
                      حفاظتی اقدامات
                    </h3>

                    <p>
                      {advisory.prevention}
                    </p>
                  </div>
                </div>

                <div className="advisory-card">
                  <div className="advisory-icon">
                    🌦️
                  </div>

                  <div>
                    <small>موسمی الرٹ</small>

                    <h3>
                      اسپرے کی صورتحال
                    </h3>

                    <p>
                      {weather
                        ? getSprayAlert(weather).message
                        : advisory.weather}
                    </p>
                  </div>
                </div>
              </div>

              <div className="location-box">
                <div>
                  <small>📍 لوکیشن</small>

                  <strong>
                    {locationName ||
                      "مقامی زرعی رہنمائی"}
                  </strong>

                  <p>
                    {weather
                      ? "مقامی اسپرے کی صورتحال کے لیے موسم کی معلومات استعمال کی جا رہی ہیں۔"
                      : "مقامی موسم اور اسپرے کی صورتحال دیکھنے کے لیے اپنی لوکیشن استعمال کریں۔"}
                  </p>
                </div>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={getLocationWeather}
                  disabled={locationLoading}
                >
                  {locationLoading
                    ? "📍 لوکیشن معلوم ہو رہی ہے..."
                    : "📍 میری لوکیشن استعمال کریں"}
                </button>
              </div>


              {latestCase && (
                <div className="share-case-box">
                  <div>
                    <small>
                      زرعی افسر
                    </small>

                    <h3>
                      کیا آپ ماہر سے تصدیق چاہتے ہیں؟
                    </h3>

                    <p>
                      اس AI کیس کو زرعی افسر کے ساتھ شیئر کریں
                      تاکہ وہ پیشہ ورانہ جائزہ لے سکے۔
                    </p>
                  </div>

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() =>
                      shareCase(latestCase._id)
                    }
                  >
                    👨‍🌾 افسر کے ساتھ شیئر کریں
                  </button>
                </div>
              )}
            </div>
          )}
        </section>


        <section className="voice-assistant-section">
          <style>{`
            .ka-ai-chat-card { margin-top: 18px; border: 1px solid rgba(15, 118, 110, 0.14); border-radius: 22px; padding: 22px; background: linear-gradient(135deg, #ffffff 0%, #f6fbf8 100%); box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08); }
            .ka-ai-chat-head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
            .ka-ai-chat-icon { width: 48px; height: 48px; border-radius: 15px; display: grid; place-items: center; background: #0f8a45; color: #fff; font-size: 24px; flex: 0 0 48px; }
            .ka-ai-chat-head h3 { margin: 0; font-size: 1.15rem; }
            .ka-ai-chat-head p { margin: 4px 0 0; color: #64748b; font-size: 0.92rem; line-height: 1.7; }
            .ka-chat-input-row { display: flex; gap: 10px; align-items: stretch; }
            .ka-chat-input-row textarea { flex: 1; min-height: 88px; resize: vertical; border: 1px solid #d7e2dc; border-radius: 14px; padding: 13px 14px; font: inherit; outline: none; background: #fff; direction: rtl; text-align: right; }
            .ka-chat-input-row textarea:focus { border-color: #0f8a45; box-shadow: 0 0 0 3px rgba(15, 138, 69, 0.10); }
            .ka-chat-actions { display: flex; flex-direction: column; gap: 10px; min-width: 150px; }
            .ka-chat-send-btn { min-height: 44px; border-radius: 12px; border: 1px solid #0f8a45; background: #0f8a45; color: #fff; cursor: pointer; padding: 10px 13px; font-weight: 700; }
            .ka-chat-send-btn:disabled { opacity: 0.55; cursor: not-allowed; }
            .ka-quick-questions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
            .ka-quick-questions button { border: 1px solid #d9e8df; background: #f8fcfa; color: #245c40; border-radius: 999px; padding: 8px 11px; cursor: pointer; font-size: 0.84rem; direction: rtl; }
            .ka-chat-message { margin-top: 14px; border-radius: 15px; padding: 14px; direction: rtl; text-align: right; }
            .ka-chat-user { background: #eef7f1; border: 1px solid #dbeee1; }
            .ka-chat-ai { background: #fff; border: 1px solid #e3e9e5; }
            .ka-chat-message small { display: block; font-weight: 700; color: #64748b; margin-bottom: 5px; }
            .ka-chat-message p { margin: 0; line-height: 1.9; }
            @media (max-width: 700px) { .ka-ai-chat-card { padding: 16px; border-radius: 18px; } .ka-chat-input-row { flex-direction: column; } .ka-chat-actions { min-width: 0; } .ka-quick-questions button { width: 100%; text-align: right; } }
          `}</style>

          <div className="section-header">
            <div>
              <p className="small-label">اردو ٹیکسٹ اسسٹنٹ</p>
              <h2>💬 کسان ایڈوائزر سے سوال کریں</h2>
              <p>بیماری، علامات، علاج، دوا، بچاؤ، موسم یا زرعی افسر کی رہنمائی کے بارے میں ٹیکسٹ میں سوال پوچھیں۔</p>
            </div>
          </div>

          <div className="ka-ai-chat-card">
            <div className="ka-ai-chat-head">
              <div className="ka-ai-chat-icon">🤖</div>
              <div>
                <h3>اردو زرعی سوال و جواب</h3>
                <p>اپنا سوال نیچے لکھیں اور کسان ایڈوائزر سے ٹیکسٹ میں جواب حاصل کریں۔</p>
              </div>
            </div>

            <div className="ka-chat-input-row">
              <textarea value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="مثلاً: میری گندم کی فصل میں کون سی بیماری ہے؟" rows="3" dir="rtl" />
              <div className="ka-chat-actions">
                <button type="button" className="ka-chat-send-btn" onClick={handleTextChat} disabled={!chatMessage.trim()}>💬 جواب حاصل کریں</button>
              </div>
            </div>

            <div className="ka-quick-questions">
              {[
                "میری فصل میں کون سی بیماری ہے؟",
                "اس بیماری کا علاج کیا ہے؟",
                "کون سی دوا یا اسپرے استعمال کرنا چاہیے؟",
                "اس بیماری سے فصل کو کیسے بچاؤں؟",
                "کیا آج اسپرے کرنا مناسب ہے؟",
                "زرعی افسر نے کیا رہنمائی دی ہے؟",
              ].map((question) => (
                <button key={question} type="button" onClick={() => setChatMessage(question)}>{question}</button>
              ))}
            </div>

            {chatMessages.map((message, index) => (
              <div key={`${message.type}-${index}`} className={`ka-chat-message ${message.type === "user" ? "ka-chat-user" : "ka-chat-ai"}`}>
                <small>{message.type === "user" ? "آپ کا سوال" : "کسان ایڈوائزر کا جواب"}</small>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
        </section>

        {latestCase?.advice && (
          <section className="officer-response-section">
            <div className="section-header">
              <div>
                <p className="small-label">
                  ماہر کا جواب
                </p>

                <h2>
                  👨‍🌾 زرعی افسر کی رہنمائی
                </h2>

                <p>
                  آپ کے کیس کے لیے پیشہ ورانہ رہنمائی موصول ہوئی ہے۔
                </p>
              </div>
            </div>

            <div className="officer-response-card">
              <div className="response-icon">
                ✅
              </div>

              <div>
                <h3>
                  تصدیق شدہ زرعی رہنمائی
                </h3>

                {latestAdvice.text && (
                  <p>
                    {latestAdvice.text}
                  </p>
                )}

                {latestAdvice.voiceNote && (
                  <div className="voice-message-box">
                    <small>
                      🎙️ افسر کی وائس رہنمائی
                    </small>

                    <audio
                      controls
                      src={latestAdvice.voiceNote}
                      style={{
                        width: "100%",
                        marginTop: "10px",
                      }}
                    >
                      آپ کا براؤزر آڈیو چلانے کو سپورٹ نہیں کرتا۔
                    </audio>
                  </div>
                )}

                {latestAdvice.text && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      speakAdvice(latestAdvice.text)
                    }
                  >
                    🔊 افسر کی رہنمائی سنیں
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="cases-section">
          <div className="section-header">
            <div>
              <p className="small-label">
                سابقہ ریکارڈ
              </p>

              <h2>
                📋 میرے کیسز
              </h2>

              <p>
                آپ کے پچھلے فصلوں کے بیماری کے کیسز۔
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={loadFarmerCases}
            >
              🔄 تازہ کریں
            </button>
          </div>

          {cases.length === 0 ? (
            <div className="empty-state">
              <div>🌱</div>

              <h3>
                ابھی کوئی کیس موجود نہیں
              </h3>

              <p>
                بیماری کا کیس بنانے کے لیے اپنی گندم کی پہلی تصویر اپ لوڈ کریں۔
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>کیس آئی ڈی</th>
                    <th>فصل</th>
                    <th>بیماری</th>
                    <th>اعتماد</th>
                    <th>حیثیت</th>
                    <th>تاریخ</th>
                    <th>عمل</th>
                  </tr>
                </thead>

                <tbody>
                  {cases.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <strong>
                          {item.caseId}
                        </strong>
                      </td>

                      <td>
                        {getCropNameUrdu(item.crop)}
                      </td>

                      <td>
                        {getDiseaseNameUrdu(item.disease)}
                      </td>

                      <td>
                        {item.confidence}%
                      </td>

                      <td>
                        <span
                          className={`status ${
                            item.status === "Verified"
                              ? "verified"
                              : "pending"
                          }`}
                        >
                          {getStatusUrdu(item.status)}
                        </span>
                      </td>

                      <td>
                        {formatDate(item.createdAt)}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() =>
                            setSelectedHistoryCase(item)
                          }
                        >
                          دیکھیں
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedHistoryCase && (
          <section className="case-detail-card">
            <div className="section-header">
              <div>
                <p className="small-label">
                  کیس کی تفصیلات
                </p>

                <h2>
                  📄 {selectedHistoryCase.caseId}
                </h2>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setSelectedHistoryCase(null)
                }
              >
                ✕ بند کریں
              </button>
            </div>

            {selectedHistoryCase.image && (
              <img
                src={selectedHistoryCase.image}
                alt="کیس کی فصل"
                className="case-detail-image"
              />
            )}

            <div className="detail-grid">
              <div>
                <small>فصل</small>

                <strong>
                  {getCropNameUrdu(
                    selectedHistoryCase.crop
                  )}
                </strong>
              </div>

              <div>
                <small>بیماری</small>

                <strong>
                  {getDiseaseNameUrdu(
                    selectedHistoryCase.disease
                  )}
                </strong>
              </div>

              <div>
                <small>اعتماد</small>

                <strong>
                  {selectedHistoryCase.confidence}%
                </strong>
              </div>

              <div>
                <small>حیثیت</small>

                <strong>
                  {getStatusUrdu(
                    selectedHistoryCase.status
                  )}
                </strong>
              </div>
            </div>

            {selectedHistoryCase.advice && (
              <div className="advice-box">
                <strong>
                  👨‍🌾 زرعی افسر کی رہنمائی
                </strong>

                {parseAdvice(
                  selectedHistoryCase.advice
                ).text && (
                  <p>
                    {
                      parseAdvice(
                        selectedHistoryCase.advice
                      ).text
                    }
                  </p>
                )}

                {parseAdvice(
                  selectedHistoryCase.advice
                ).voiceNote && (
                  <audio
                    controls
                    src={
                      parseAdvice(
                        selectedHistoryCase.advice
                      ).voiceNote
                    }
                    style={{
                      width: "100%",
                      marginTop: "10px",
                    }}
                  />
                )}

                {parseAdvice(
                  selectedHistoryCase.advice
                ).text && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      speakAdvice(
                        parseAdvice(
                          selectedHistoryCase.advice
                        ).text
                      )
                    }
                  >
                    🔊 رہنمائی سنیں
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/* =========================================================
   OFFICER DASHBOARD
========================================================= */

function OfficerDashboard({
  cases,
  selectedCase,
  setSelectedCase,
  advice,
  setAdvice,
  pesticideRecommendation,
  setPesticideRecommendation,
  otherProductRecommendation,
  setOtherProductRecommendation,
  loadOfficerCases,
  verifyCase,
  sendAdvice,
  speakAdvice,
  setPage,
  correctDiagnosis,
  setCorrectDiagnosis,
  logout,
  startOfficerRecording,
  stopOfficerRecording,
  isOfficerRecording,
  officerVoiceNote,
  officerVoicePreview,
  clearOfficerVoiceNote,
}) {
  const [filter, setFilter] = useState("All");

  const filteredCases = cases.filter((item) => {
    if (filter === "All") return true;
    return item.status === filter;
  });

  const pendingCases = cases.filter(
    (item) => item.status === "Pending"
  );

  const verifiedCases = cases.filter(
    (item) => item.status === "Verified"
  );

  return (
    <div className="dashboard-page">
      <nav className="dashboard-nav">
        <div className="logo">
          <span className="logo-icon">🌱</span>
          Kissan Advisor
        </div>

        <div className="user-area">
          <button
            type="button"
            onClick={() => setPage("home")}
          >
            ← ہوم
          </button>

          <button
            type="button"
            onClick={logout}
          >
            لاگ آؤٹ
          </button>
        </div>
      </nav>

      <main className="dashboard-container">
        <div className="dashboard-heading">
          <div>
            <p className="small-label">
              زرعی افسر پینل
            </p>

            <h1>
              بیماری کے کیسز کا انتظام 👨‍🌾
            </h1>

            <p>
              AI نتائج کا جائزہ لیں اور کسان کو ماہرانہ زرعی رہنمائی دیں۔
            </p>
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={loadOfficerCases}
          >
            🔄 کیسز تازہ کریں
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>📋</span>

            <div>
              <small>کل کیسز</small>
              <h3>{cases.length}</h3>
            </div>
          </div>

          <div className="stat-card">
            <span>⏳</span>

            <div>
              <small>جائزے کے منتظر</small>

              <h3>
                {pendingCases.length}
              </h3>
            </div>
          </div>

          <div className="stat-card">
            <span>✅</span>

            <div>
              <small>تصدیق شدہ کیسز</small>

              <h3>
                {verifiedCases.length}
              </h3>
            </div>
          </div>
        </div>

        <section className="cases-section">
          <div className="section-header">
            <div>
              <p className="small-label">
                کیس مینجمنٹ
              </p>

              <h2>
                📋 کسانوں کے کیسز
              </h2>

              <p>
                جائزہ لینے کے لیے ایک کیس منتخب کریں۔
              </p>
            </div>
          </div>

          <div className="case-filters">
            <button
              type="button"
              className={
                filter === "All"
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() => setFilter("All")}
            >
              تمام ({cases.length})
            </button>

            <button
              type="button"
              className={
                filter === "Pending"
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() => setFilter("Pending")}
            >
              زیرِ التوا ({pendingCases.length})
            </button>

            <button
              type="button"
              className={
                filter === "Verified"
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() => setFilter("Verified")}
            >
              تصدیق شدہ ({verifiedCases.length})
            </button>
          </div>

          {filteredCases.length === 0 ? (
            <div className="empty-state">
              <div>📭</div>

              <h3>
                کوئی کیس دستیاب نہیں
              </h3>

              <p>
                کسانوں کے کیسز یہاں ظاہر ہوں گے۔
              </p>
            </div>
          ) : (
            <div className="officer-layout">
              <div className="case-list">
                {filteredCases.map((item) => (
                  <div
                    key={item._id}
                    className={`case-item ${
                      selectedCase?._id === item._id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedCase(item)
                    }
                  >
                    <div>
                      <strong>
                        {item.caseId}
                      </strong>

                      <p>
                        {item.farmerName}
                      </p>

                      <small>
                        {getCropNameUrdu(item.crop)} •{" "}
                        {getDiseaseNameUrdu(item.disease)}
                      </small>
                    </div>

                    <span
                      className={`status ${
                        item.status === "Verified"
                          ? "verified"
                          : "pending"
                      }`}
                    >
                      {getStatusUrdu(item.status)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="review-panel">
                {!selectedCase ? (
                  <div className="empty-state">
                    <div>👈</div>

                    <h3>
                      کیس منتخب کریں
                    </h3>

                    <p>
                      جائزہ لینے کے لیے فہرست سے کسان کا کیس منتخب کریں۔
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="review-header">
                      <div>
                        <small>
                          کیس آئی ڈی
                        </small>

                        <h2>
                          {selectedCase.caseId}
                        </h2>
                      </div>

                      <span
                        className={`status ${
                          selectedCase.status === "Verified"
                            ? "verified"
                            : "pending"
                        }`}
                      >
                        {getStatusUrdu(
                          selectedCase.status
                        )}
                      </span>
                    </div>

                    {selectedCase.image && (
                      <img
                        src={selectedCase.image}
                        alt="فصل کی تصویر"
                        className="case-image"
                      />
                    )}

                    <div className="review-info">
                      <div>
                        <small>کسان</small>

                        <strong>
                          {selectedCase.farmerName}
                        </strong>
                      </div>

                      <div>
                        <small>فصل</small>

                        <strong>
                          {getCropNameUrdu(
                            selectedCase.crop
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>AI بیماری</small>

                        <strong>
                          {getDiseaseNameUrdu(
                            selectedCase.disease
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>اعتماد</small>

                        <strong>
                          {selectedCase.confidence}%
                        </strong>
                      </div>
                    </div>

                    <div className="expert-review-box">
                      <div className="expert-review-title">
                        <span>🤖</span>

                        <div>
                          <small>
                            AI تشخیص
                          </small>

                          <h3>
                            {getDiseaseNameUrdu(
                              selectedCase.disease
                            )}
                          </h3>
                        </div>
                      </div>

                      <p>
                        حتمی زرعی رہنمائی دینے سے پہلے AI نتیجے کا جائزہ لیں۔
                      </p>
                    </div>

                    <div className="review-form">
                      <label>
                        ماہر کی درست / تصحیح شدہ تشخیص
                      </label>

                      <input
                        type="text"
                        placeholder="مثلاً یلو رسٹ"
                        value={
                          correctDiagnosis ||
                          getDiseaseNameUrdu(
                            selectedCase.disease
                          ) ||
                          ""
                        }
                        onChange={(e) =>
                          setCorrectDiagnosis(
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="review-actions">
                      {selectedCase.status === "Pending" && (
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() =>
                            verifyCase(selectedCase._id)
                          }
                        >
                          ✅ کیس کی تصدیق کریں
                        </button>
                      )}

                      <textarea
                        placeholder="کسان کے لیے علاج یا عمومی زرعی رہنمائی لکھیں..."
                        value={advice}
                        onChange={(e) =>
                          setAdvice(e.target.value)
                        }
                        rows="5"
                      />

                      <div className="review-form">
                        <label>
                          🧪 تجویز کردہ کیڑے مار / فنگس کش دوا
                        </label>
                        <input
                          type="text"
                          placeholder="مثلاً: گندم کے لیے مقامی طور پر رجسٹرڈ فنگس کش دوا"
                          value={pesticideRecommendation}
                          onChange={(e) =>
                            setPesticideRecommendation(e.target.value)
                          }
                        />
                        <small className="input-help">
                          صرف رجسٹرڈ اور فصل کے لیے منظور شدہ دوا کی سفارش کریں۔
                        </small>
                      </div>

                      <div className="review-form">
                        <label>
                          📦 دیگر زرعی مصنوعات / سامان
                        </label>
                        <input
                          type="text"
                          placeholder="مثلاً: منظور شدہ بیج، کھاد یا دوسری زرعی مصنوعات"
                          value={otherProductRecommendation}
                          onChange={(e) =>
                            setOtherProductRecommendation(e.target.value)
                          }
                        />
                        <small className="input-help">
                          کسان کے لیے مفید اور منظور شدہ دوسری زرعی مصنوعات یا سامان درج کریں۔
                        </small>
                      </div>

                      {/* =================================================
                         OFFICER VOICE ADVICE
                      ================================================= */}

                      <div className="voice-message-box">
                        <small>
                          🎙️ کسان کو وائس رہنمائی
                        </small>

                        <p>
                          آپ اپنی اردو میں رہنمائی ریکارڈ کرکے کسان کو بھیج سکتے ہیں۔
                        </p>

                        {!isOfficerRecording ? (
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={
                              startOfficerRecording
                            }
                          >
                            🎙️ اردو وائس ریکارڈ کریں
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={
                              stopOfficerRecording
                            }
                          >
                            ⏹️ ریکارڈنگ بند کریں
                          </button>
                        )}

                        {isOfficerRecording && (
                          <p>
                            🔴 ریکارڈنگ جاری ہے... اردو میں رہنمائی بولیں۔
                          </p>
                        )}

                        {officerVoicePreview && (
                          <div>
                            <small>
                              ریکارڈ شدہ وائس:
                            </small>

                            <audio
                              controls
                              src={officerVoicePreview}
                              style={{
                                width: "100%",
                                marginTop: "10px",
                              }}
                            />

                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={
                                clearOfficerVoiceNote
                              }
                            >
                              ✕ وائس ہٹائیں
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="primary-btn"
                        onClick={sendAdvice}
                      >
                        💬 کسان کو رہنمائی بھیجیں
                      </button>

                      {selectedCase.advice && (
                        <div className="advice-box">
                          <strong>
                            افسر کی رہنمائی:
                          </strong>

                          {parseAdvice(
                            selectedCase.advice
                          ).text && (
                            <p>
                              {
                                parseAdvice(
                                  selectedCase.advice
                                ).text
                              }
                            </p>
                          )}

                          {parseAdvice(
                            selectedCase.advice
                          ).voiceNote && (
                            <audio
                              controls
                              src={
                                parseAdvice(
                                  selectedCase.advice
                                ).voiceNote
                              }
                              style={{
                                width: "100%",
                                marginTop: "10px",
                              }}
                            />
                          )}

                          {parseAdvice(
                            selectedCase.advice
                          ).text && (
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() =>
                                speakAdvice(
                                  parseAdvice(
                                    selectedCase.advice
                                  ).text
                                )
                              }
                            >
                              🔊 رہنمائی سنیں
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function AdminDashboard({
  cases,
  setPage,
  logout,
}) {
  const verifiedCases = cases.filter(
    (item) => item.status === "Verified"
  ).length;

  const pendingCases = cases.filter(
    (item) => item.status === "Pending"
  ).length;

  const cropCount = new Set(
    cases
      .map((item) => item.crop)
      .filter(Boolean)
  ).size;

  const diseaseCount = new Set(
    cases
      .map((item) => item.disease)
      .filter(Boolean)
  ).size;

  return (
    <div className="dashboard-page">
      <nav className="dashboard-nav">
        <div className="logo">
          <span className="logo-icon">🌱</span>
          Kissan Advisor
        </div>

        <div className="user-area">
          <button
            type="button"
            onClick={() => setPage("home")}
          >
            ← ہوم
          </button>

          <button
            type="button"
            onClick={logout}
          >
            لاگ آؤٹ
          </button>
        </div>
      </nav>

      <main className="dashboard-container">
        <div className="dashboard-heading">
          <div>
            <p className="small-label">
              ایڈمن پینل
            </p>

            <h1>
              سسٹم مینجمنٹ ⚙️
            </h1>

            <p>
              کسانوں، بیماری کے کیسز اور زرعی رہنمائی کے ڈیٹا کی نگرانی کریں۔
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>👨‍🌾</span>

            <div>
              <small>کل فصل کیسز</small>
              <h3>{cases.length}</h3>
            </div>
          </div>

          <div className="stat-card">
            <span>⏳</span>

            <div>
              <small>زیرِ التوا کیسز</small>
              <h3>{pendingCases}</h3>
            </div>
          </div>

          <div className="stat-card">
            <span>✅</span>

            <div>
              <small>تصدیق شدہ کیسز</small>
              <h3>{verifiedCases}</h3>
            </div>
          </div>
        </div>

        <div className="admin-grid">
          <div className="admin-card">
            <div className="admin-card-icon">
              👨‍🌾
            </div>

            <h3>
              کسان
            </h3>

            <p>
              رجسٹرڈ کسان گندم کی بیماری کے کیسز اپ لوڈ کر سکتے ہیں
              اور زرعی رہنمائی حاصل کر سکتے ہیں۔
            </p>

            <strong>
              کسان مینجمنٹ
            </strong>
          </div>

          <div className="admin-card">
            <div className="admin-card-icon">
              👨‍💼
            </div>

            <h3>
              زرعی افسران
            </h3>

            <p>
              افسران AI تشخیص کا جائزہ لیتے اور ماہرانہ تصدیق و رہنمائی فراہم کرتے ہیں۔
            </p>

            <strong>
              افسر مینجمنٹ
            </strong>
          </div>

          <div className="admin-card">
            <div className="admin-card-icon">
              🌾
            </div>

            <h3>
              فصل کا ڈیٹا بیس
            </h3>

            <p>
              موجودہ AI ماڈل گندم کی بیماریوں کی تشخیص کے لیے تربیت یافتہ ہے۔
            </p>

            <strong>
              {cropCount} فصل کی اقسام
            </strong>
          </div>

          <div className="admin-card">
            <div className="admin-card-icon">
              🦠
            </div>

            <h3>
              بیماری کا ڈیٹا بیس
            </h3>

            <p>
              موجودہ AI ماڈل براؤن رسٹ، یلو رسٹ، سیپٹوریا، ملڈیو
              اور صحت مند گندم کی کلاسز کو سپورٹ کرتا ہے۔
            </p>

            <strong>
              {diseaseCount} بیماری کی اقسام
            </strong>
          </div>

          <div className="admin-card">
            <div className="admin-card-icon">
              🧪
            </div>

            <h3>
              علاج اور زرعی ادویات
            </h3>

            <p>
              علاج کی رہنمائی اور مقامی طور پر متعلقہ زرعی ادویات کی سفارشات کا انتظام کریں۔
            </p>

            <strong>
              رہنمائی مینجمنٹ
            </strong>
          </div>

          <div className="admin-card">
            <div className="admin-card-icon">
              📊
            </div>

            <h3>
              کیس مانیٹرنگ
            </h3>

            <p>
              زیرِ التوا، تصدیق شدہ اور مکمل کسانوں کے بیماری کے کیسز کی نگرانی کریں۔
            </p>

            <strong>
              سسٹم مانیٹرنگ
            </strong>
          </div>
        </div>

        <section className="cases-section">
          <div className="section-header">
            <div>
              <p className="small-label">
                حالیہ کیسز
              </p>

              <h2>
                📋 کیس مانیٹرنگ
              </h2>

              <p>
                سسٹم میں موجود تازہ بیماری کے کیسز۔
              </p>
            </div>
          </div>

          {cases.length === 0 ? (
            <div className="empty-state">
              <div>📭</div>

              <h3>
                ابھی کوئی کیس نہیں
              </h3>

              <p>
                سسٹم کے کیسز یہاں ظاہر ہوں گے۔
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>کیس آئی ڈی</th>
                    <th>کسان</th>
                    <th>فصل</th>
                    <th>بیماری</th>
                    <th>حیثیت</th>
                    <th>تاریخ</th>
                  </tr>
                </thead>

                <tbody>
                  {cases
                    .slice(0, 10)
                    .map((item) => (
                      <tr key={item._id}>
                        <td>
                          <strong>
                            {item.caseId}
                          </strong>
                        </td>

                        <td>
                          {item.farmerName || "کسان"}
                        </td>

                        <td>
                          {getCropNameUrdu(item.crop)}
                        </td>

                        <td>
                          {getDiseaseNameUrdu(item.disease)}
                        </td>

                        <td>
                          <span
                            className={`status ${
                              item.status === "Verified"
                                ? "verified"
                                : "pending"
                            }`}
                          >
                            {getStatusUrdu(item.status)}
                          </span>
                        </td>

                        <td>
                          {formatDate(item.createdAt)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  const [page, setPage] = useState(() => {
    try {
      const storedStaff = JSON.parse(
        localStorage.getItem("ka_staff_user")
      );

      if (storedStaff?.role === "admin") {
        return "admin";
      }

      if (storedStaff?.role === "officer") {
        return "officer";
      }

      const storedFarmer = JSON.parse(
        localStorage.getItem("ka_user")
      );

      if (storedFarmer?.role === "farmer") {
        return "dashboard";
      }
    } catch {
      // Invalid localStorage data
    }

    return "home";
  });

  /* =======================================================
     FARMER SESSION
  ======================================================= */

  const [farmerMode, setFarmerMode] =
    useState("login");

  const [farmer, setFarmer] =
    useState(() => {
      try {
        return (
          JSON.parse(
            localStorage.getItem("ka_user")
          ) || null
        );
      } catch {
        return null;
      }
    });

  const [token, setToken] =
    useState(
      localStorage.getItem("ka_token") || ""
    );

  /* =======================================================
     STAFF SESSION
  ======================================================= */

  const [staffUser, setStaffUser] =
    useState(() => {
      try {
        return (
          JSON.parse(
            localStorage.getItem(
              "ka_staff_user"
            )
          ) || null
        );
      } catch {
        return null;
      }
    });

  const [staffToken, setStaffToken] =
    useState(
      localStorage.getItem(
        "ka_staff_token"
      ) || ""
    );

  /* =======================================================
     FORM
  ======================================================= */

  const [formData, setFormData] =
    useState({
      name: "",
      email: "",
      password: "",
    });

  /* =======================================================
     IMAGE / AI
  ======================================================= */

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [selectedImage, setSelectedImage] =
    useState("");

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [showResult, setShowResult] =
    useState(false);

  const [analysisResult, setAnalysisResult] =
    useState(null);

  /* =======================================================
     CASES
  ======================================================= */

  const [cases, setCases] =
    useState([]);

  const [selectedCase, setSelectedCase] =
    useState(null);

  const [advice, setAdvice] =
    useState("");

  const [pesticideRecommendation, setPesticideRecommendation] =
    useState("");

  const [otherProductRecommendation, setOtherProductRecommendation] =
    useState("");

  const [correctDiagnosis, setCorrectDiagnosis] =
    useState("");

  /* =======================================================
     OTHER STATES
  ======================================================= */

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =======================================================
     WEATHER / LOCATION STATES
  ======================================================= */

  const [weather, setWeather] =
    useState(null);

  const [locationName, setLocationName] =
    useState("");

  const [weatherLoading, setWeatherLoading] =
    useState(false);

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [weatherError, setWeatherError] =
    useState("");

  const fileInputRef =
    useRef(null);

  /* =======================================================
     OFFICER VOICE ADVICE STATES
  ======================================================= */

  const [isOfficerRecording, setIsOfficerRecording] =
    useState(false);

  const [officerVoiceNote, setOfficerVoiceNote] =
    useState("");

  const [officerVoicePreview, setOfficerVoicePreview] =
    useState("");

  const mediaRecorderRef =
    useRef(null);

  const mediaChunksRef =
    useRef([]);

  /* =======================================================
     API REQUEST
  ======================================================= */

  const apiRequest = async (
    url,
    options = {},
    authToken = token
  ) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (authToken) {
      headers.Authorization =
        `Bearer ${authToken}`;
    }

    const response = await fetch(
      `${API_URL}${url}`,
      {
        ...options,
        headers,
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        "کچھ غلط ہو گیا ہے۔"
      );
    }

    return data;
  };

  /* =======================================================
     LOAD FARMER CASES
  ======================================================= */

  const loadFarmerCases = async () => {
    if (!token) {
      return;
    }

    try {
      const data =
        await apiRequest("/cases/my");

      const caseList =
        Array.isArray(data)
          ? data
          : data.cases || [];

      setCases(caseList);
    } catch (err) {
      console.error(
        "Farmer cases error:",
        err
      );
    }
  };

  /* =======================================================
     LOAD OFFICER / ADMIN CASES
  ======================================================= */

  const loadOfficerCases = async () => {
    if (!staffToken) {
      setCases([]);
      return;
    }

    try {
      const data =
        await apiRequest(
          "/cases",
          {},
          staffToken
        );

      const caseList =
        Array.isArray(data)
          ? data
          : data.cases || [];

      setCases(caseList);
    } catch (err) {
      console.error(
        "Officer/Admin cases error:",
        err
      );

      setCases([]);
    }
  };

  /* =======================================================
     AUTO LOAD FARMER CASES
  ======================================================= */

  useEffect(() => {
    if (
      farmer &&
      token &&
      farmer.role === "farmer"
    ) {
      loadFarmerCases();
    }
  }, [farmer, token]);

  /* =======================================================
     AUTO LOAD STAFF CASES
  ======================================================= */

  useEffect(() => {
    if (
      staffUser &&
      staffToken &&
      (
        staffUser.role === "officer" ||
        staffUser.role === "admin"
      )
    ) {
      loadOfficerCases();
    }
  }, [staffUser, staffToken]);

  /* =======================================================
     CLEANUP VOICE
  ======================================================= */

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        try {
          if (
            mediaRecorderRef.current.state !==
            "inactive"
          ) {
            mediaRecorderRef.current.stop();
          }
        } catch {
          // Ignore
        }
      }

      if (
        typeof window !== "undefined" &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* =======================================================
     STAFF LOGIN
  ======================================================= */

  const handleStaffLogin =
    (newToken, user) => {
      if (!newToken || !user) {
        return;
      }

      localStorage.setItem(
        "ka_staff_token",
        newToken
      );

      localStorage.setItem(
        "ka_staff_user",
        JSON.stringify(user)
      );

      setStaffToken(newToken);
      setStaffUser(user);

      setCases([]);
      setSelectedCase(null);
      setAdvice("");
      setCorrectDiagnosis("");

      if (user.role === "admin") {
        setPage("admin");
      } else {
        setPage("officer");
      }
    };

  /* =======================================================
     FARMER AUTH
  ======================================================= */

  const handleAuth =
    async (e) => {
      e.preventDefault();

      setLoading(true);
      setError("");

      const cleanName =
        formData.name.trim();

      const cleanEmail =
        formData.email
          .trim()
          .toLowerCase();

      const cleanPassword =
        formData.password;

      if (
        farmerMode === "register" &&
        cleanName.length < 2
      ) {
        setError(
          "براہِ کرم اپنا پورا نام درج کریں۔"
        );

        setLoading(false);
        return;
      }

      if (cleanPassword.length < 6) {
        setError(
          "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔"
        );

        setLoading(false);
        return;
      }

      try {
        const endpoint =
          farmerMode === "register"
            ? "/auth/register"
            : "/auth/login";

        const body =
          farmerMode === "register"
            ? {
                name: cleanName,
                email: cleanEmail,
                password: cleanPassword,
              }
            : {
                email: cleanEmail,
                password: cleanPassword,
              };

        const data =
          await apiRequest(
            endpoint,
            {
              method: "POST",
              body: JSON.stringify(body),
            }
          );

        localStorage.setItem(
          "ka_token",
          data.token
        );

        localStorage.setItem(
          "ka_user",
          JSON.stringify(data.user)
        );

        setToken(data.token);
        setFarmer(data.user);

        setFormData({
          name: "",
          email: "",
          password: "",
        });

        setError("");
        setPage("dashboard");
      } catch (err) {
        setError(
          err.message ||
          "درخواست مکمل نہیں ہو سکی۔"
        );
      } finally {
        setLoading(false);
      }
    };

  /* =======================================================
     FARMER LOGOUT
  ======================================================= */

  const logout = () => {
    localStorage.removeItem("ka_token");
    localStorage.removeItem("ka_user");

    setToken("");
    setFarmer(null);

    setCases([]);
    setSelectedCase(null);
    setAdvice("");
    setCorrectDiagnosis("");

    setSelectedFile(null);
    setSelectedImage("");
    setShowResult(false);
    setAnalysisResult(null);

    setWeather(null);
    setLocationName("");
    setPage("home");
  };

  /* =======================================================
     STAFF LOGOUT
  ======================================================= */

  const staffLogout = () => {
    localStorage.removeItem(
      "ka_staff_token"
    );

    localStorage.removeItem(
      "ka_staff_user"
    );

    setStaffToken("");
    setStaffUser(null);

    setCases([]);
    setSelectedCase(null);
    setAdvice("");
    setPesticideRecommendation("");
    setOtherProductRecommendation("");
    setCorrectDiagnosis("");

    setOfficerVoiceNote("");
    setOfficerVoicePreview("");
    setIsOfficerRecording(false);

    setPage("home");
  };

  /* =======================================================
     FILE TO BASE64
  ======================================================= */

  const fileToBase64 = (file) => {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.readAsDataURL(file);

        reader.onload =
          () => resolve(
            reader.result
          );

        reader.onerror =
          reject;
      }
    );
  };

  /* =======================================================
     IMAGE CHANGE
  ======================================================= */

  const handleImageChange =
    (e) => {
      const file =
        e.target.files?.[0];

      if (!file) {
        return;
      }

      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];

      if (
        !allowedTypes.includes(
          file.type
        )
      ) {
        setError(
          "براہِ کرم JPG، PNG یا WEBP تصویر منتخب کریں۔"
        );

        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        setError(
          "تصویر کا سائز 5MB سے کم ہونا چاہیے۔"
        );

        return;
      }

      setSelectedFile(file);

      const imageUrl =
        URL.createObjectURL(file);

      setSelectedImage(imageUrl);

      setShowResult(false);
      setAnalysisResult(null);
      setError("");
    };

  /* =======================================================
     REAL AI ANALYSIS
  ======================================================= */

  const handleAnalyze =
    async () => {
      if (!selectedFile) {
        setError(
          "براہِ کرم پہلے فصل کی تصویر منتخب کریں۔"
        );

        return;
      }

      if (!token) {
        setError(
          "براہِ کرم پہلے کسان کے طور پر لاگ اِن کریں۔"
        );

        return;
      }

      setIsAnalyzing(true);
      setError("");
      setShowResult(false);
      setAnalysisResult(null);

      try {
        const formDataAI =
          new FormData();

        formDataAI.append(
          "file",
          selectedFile
        );

        const aiResponse =
          await fetch(
            `${AI_URL}/predict`,
            {
              method: "POST",
              body: formDataAI,
            }
          );

        let aiData = {};

        try {
          aiData =
            await aiResponse.json();
        } catch {
          aiData = {};
        }

        if (!aiResponse.ok) {
          throw new Error(
            aiData.detail ||
            aiData.message ||
            "AI سروس تصویر کا تجزیہ نہیں کر سکی۔"
          );
        }

        if (
          aiData.status !== "success" ||
          !aiData.disease
        ) {
          throw new Error(
            "AI سروس نے درست نتیجہ واپس نہیں کیا۔"
          );
        }

        console.log(
          "REAL AI RESULT:",
          aiData
        );

        const imageBase64 =
          await fileToBase64(
            selectedFile
          );

        const caseResponse =
          await apiRequest(
            "/cases",
            {
              method: "POST",
              body: JSON.stringify({
                crop:
                  aiData.crop ||
                  "Wheat",

                disease:
                  aiData.disease,

                confidence:
                  aiData.confidence,

                image:
                  imageBase64,
              }),
            }
          );

        const realResult = {
          crop:
            aiData.crop ||
            "Wheat",

          disease:
            aiData.disease,

          confidence:
            aiData.confidence,

          status:
            "success",
        };

        setAnalysisResult(
          realResult
        );

        setShowResult(true);

        if (caseResponse?.case) {
          setCases(
            (previous) => [
              caseResponse.case,
              ...previous,
            ]
          );
        } else {
          await loadFarmerCases();
        }
      } catch (err) {
        console.error(
          "AI ANALYSIS ERROR:",
          err
        );

        let message =
          err.message ||
          "تصویر کا تجزیہ نہیں ہو سکا۔";

        if (
          message.includes(
            "Failed to fetch"
          )
        ) {
          message =
            "AI سروس دستیاب نہیں ہے۔ یقینی بنائیں کہ Python AI server http://127.0.0.1:8000 پر چل رہا ہے۔";
        }

        setError(message);
      } finally {
        setIsAnalyzing(false);
      }
    };

  /* =======================================================
     SHARE CASE
  ======================================================= */

  const shareCase =
    async (caseId) => {
      if (!caseId) {
        alert(
          "براہِ کرم پہلے کیس بنائیں۔"
        );

        return;
      }

      try {
        await loadFarmerCases();

        alert(
          "✅ کیس زرعی افسر کے جائزے کے لیے دستیاب ہے۔"
        );
      } catch (err) {
        alert(
          err.message ||
          "کیس شیئر نہیں ہو سکا۔"
        );
      }
    };

  /* =======================================================
     VERIFY CASE
  ======================================================= */

  const verifyCase =
    async (caseId) => {
      if (!staffToken) {
        alert(
          "افسر کا سیشن ختم ہو گیا ہے۔ براہِ کرم دوبارہ لاگ اِن کریں۔"
        );

        return;
      }

      try {
        const data =
          await apiRequest(
            `/cases/${caseId}/verify`,
            {
              method: "PUT",
            },
            staffToken
          );

        setCases(
          (previous) =>
            previous.map(
              (item) =>
                item._id === caseId
                  ? data.case
                  : item
            )
        );

        setSelectedCase(
          data.case
        );
      } catch (err) {
        alert(
          err.message
        );
      }
    };

  /* =======================================================
     SEND ADVICE
  ======================================================= */

  const sendAdvice =
    async () => {
      const combinedAdvice = [
        advice.trim(),
        pesticideRecommendation.trim()
          ? `تجویز کردہ دوا: ${pesticideRecommendation.trim()}`
          : "",
        otherProductRecommendation.trim()
          ? `دیگر تجویز کردہ زرعی مصنوعات: ${otherProductRecommendation.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      if (
        !selectedCase ||
        (
          !combinedAdvice &&
          !officerVoiceNote
        )
      ) {
        alert(
          "براہِ کرم تحریری رہنمائی، دوا / مصنوعات کی سفارش یا وائس رہنمائی فراہم کریں۔"
        );

        return;
      }

      if (!staffToken) {
        alert(
          "افسر کا سیشن ختم ہو گیا ہے۔ براہِ کرم دوبارہ لاگ اِن کریں۔"
        );

        return;
      }

      try {
        const advicePayload =
          createAdvicePayload(
            combinedAdvice,
            officerVoiceNote
          );

        const data =
          await apiRequest(
            `/cases/${selectedCase._id}/advice`,
            {
              method: "PUT",
              body: JSON.stringify({
                advice:
                  advicePayload,
              }),
            },
            staffToken
          );

        setCases(
          (previous) =>
            previous.map(
              (item) =>
                item._id ===
                selectedCase._id
                  ? data.case
                  : item
            )
        );

        setSelectedCase(
          data.case
        );

        setAdvice("");
        setPesticideRecommendation("");
        setOtherProductRecommendation("");
        setOfficerVoiceNote("");
        setOfficerVoicePreview("");

        alert(
          "رہنمائی کامیابی سے کسان کو بھیج دی گئی 🌱"
        );
      } catch (err) {
        alert(
          err.message
        );
      }
    };

  /* =======================================================
     TEXT TO SPEECH — URDU
  ======================================================= */

  const speakAdvice = (text) => {
    const cleanText = String(text || "").replace(/\s+/g, " ").trim();

    if (!cleanText) return;

    if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      alert("Text-to-speech is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    try { synth.resume(); } catch {}

    const speakNow = () => {
      const voices = synth.getVoices();
      const urduVoice = voices.find((voice) => {
        const lang = String(voice?.lang || "").toLowerCase();
        return lang === "ur-pk" || lang.startsWith("ur-") || lang === "ur";
      });

      // Short chunks are more reliable in Chrome/Edge, especially for Urdu text.
      const chunks = cleanText.match(/.{1,180}(?:\s|$)/g) || [cleanText];
      let index = 0;

      const speakNext = () => {
        if (index >= chunks.length) return;

        const utterance = new SpeechSynthesisUtterance(chunks[index].trim());
        utterance.lang = "ur-PK";
        utterance.rate = 0.88;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Prefer an installed Urdu voice; otherwise let the browser use its default voice
        // while retaining the Urdu language tag.
        if (urduVoice) utterance.voice = urduVoice;

        utterance.onerror = (event) => {
          console.error("Speech synthesis error:", event);
        };

        utterance.onend = () => {
          index += 1;
          window.setTimeout(speakNext, 40);
        };

        try {
          synth.speak(utterance);
          window.setTimeout(() => {
            try {
              if (!synth.speaking) synth.resume();
            } catch {}
          }, 120);
        } catch (error) {
          console.error("Speech start error:", error);
        }
      };

      speakNext();
    };

    const voices = synth.getVoices();
    if (voices.length) {
      speakNow();
      return;
    }

    let handled = false;
    const handleVoicesChanged = () => {
      if (handled) return;
      handled = true;
      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
      speakNow();
    };

    synth.addEventListener?.("voiceschanged", handleVoicesChanged);
    // Some browsers don't fire voiceschanged reliably; try once after a short delay.
    window.setTimeout(() => {
      if (!handled) {
        handled = true;
        synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
        speakNow();
      }
    }, 900);
  };

  /* =======================================================
     WEATHER + LOCATION
  ======================================================= */

  const getLocationWeather =
    () => {
      if (
        !navigator.geolocation
      ) {
        setWeatherError(
          "اس براؤزر میں لوکیشن سروس دستیاب نہیں ہے۔"
        );

        return;
      }

      setLocationLoading(true);
      setWeatherLoading(true);
      setWeatherError("");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude =
            position.coords.latitude;

          const longitude =
            position.coords.longitude;

          try {
            const weatherUrl =
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=auto`;

            const weatherResponse =
              await fetch(
                weatherUrl
              );

            if (!weatherResponse.ok) {
              throw new Error(
                "موسم کی معلومات لوڈ نہیں ہو سکیں۔"
              );
            }

            const weatherData =
              await weatherResponse.json();

            const current =
              weatherData.current || {};

            const hourly =
              weatherData.hourly || {};

            const currentHour =
              new Date(current.time);

            let precipitationProbability =
              0;

            if (
              Array.isArray(
                hourly.time
              ) &&
              Array.isArray(
                hourly.precipitation_probability
              )
            ) {
              const index =
                hourly.time.findIndex(
                  (time) =>
                    new Date(time).getHours() ===
                    currentHour.getHours()
                );

              if (index >= 0) {
                precipitationProbability =
                  Number(
                    hourly
                      .precipitation_probability[
                      index
                    ] || 0
                  );
              }
            }

            setWeather({
              temperature:
                Number(
                  current.temperature_2m ||
                  0
                ),

              humidity:
                Number(
                  current.relative_humidity_2m ||
                  0
                ),

              precipitation:
                Number(
                  current.precipitation ||
                  0
                ),

              weatherCode:
                Number(
                  current.weather_code ??
                  0
                ),

              windSpeed:
                Number(
                  current.wind_speed_10m ||
                  0
                ),

              precipitationProbability,
            });

            try {
              const geoResponse =
                await fetch(
                  `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`
                );

              if (geoResponse.ok) {
                const geoData =
                  await geoResponse.json();

                const place =
                  geoData.results?.[0];

                if (place) {
                  const parts = [
                    place.name,
                    place.admin2,
                    place.admin1,
                  ].filter(Boolean);

                  setLocationName(
                    [...new Set(parts)]
                      .join(", ")
                  );
                } else {
                  setLocationName(
                    `${latitude.toFixed(
                      2
                    )}, ${longitude.toFixed(
                      2
                    )}`
                  );
                }
              }
            } catch {
              setLocationName(
                `${latitude.toFixed(
                  2
                )}, ${longitude.toFixed(
                  2
                )}`
              );
            }
          } catch (err) {
            console.error(
              "WEATHER ERROR:",
              err
            );

            setWeatherError(
              err.message ||
              "موسم کی معلومات لوڈ نہیں ہو سکیں۔"
            );
          } finally {
            setWeatherLoading(false);
            setLocationLoading(false);
          }
        },

        (geoError) => {
          console.error(
            "LOCATION ERROR:",
            geoError
          );

          let message =
            "آپ کی لوکیشن حاصل نہیں ہو سکی۔";

          if (
            geoError.code ===
            geoError.PERMISSION_DENIED
          ) {
            message =
              "لوکیشن کی اجازت نہیں دی گئی۔ براہِ کرم براؤزر میں لوکیشن کی اجازت دیں اور دوبارہ کوشش کریں۔";
          }

          if (
            geoError.code ===
            geoError.POSITION_UNAVAILABLE
          ) {
            message =
              "آپ کی لوکیشن معلوم نہیں کی جا سکی۔";
          }

          if (
            geoError.code ===
            geoError.TIMEOUT
          ) {
            message =
              "لوکیشن حاصل کرنے کی درخواست کا وقت ختم ہو گیا۔ دوبارہ کوشش کریں۔";
          }

          setWeatherError(message);

          setWeatherLoading(false);
          setLocationLoading(false);
        },

        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        }
      );
    };

  /* =======================================================
     OFFICER VOICE RECORDING
  ======================================================= */

  const startOfficerRecording =
    async () => {
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        alert(
          "آپ کے براؤزر میں وائس ریکارڈنگ دستیاب نہیں ہے۔ Google Chrome یا Microsoft Edge استعمال کریں۔"
        );

        return;
      }

      try {
        if (mediaRecorderRef.current) {
          try {
            if (
              mediaRecorderRef.current.state !==
              "inactive"
            ) {
              mediaRecorderRef.current.stop();
            }
          } catch {
            // Ignore
          }
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

        let mimeType = "";

        if (
          typeof MediaRecorder !==
            "undefined" &&
          MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus"
          )
        ) {
          mimeType =
            "audio/webm;codecs=opus";
        } else if (
          typeof MediaRecorder !==
            "undefined" &&
          MediaRecorder.isTypeSupported(
            "audio/webm"
          )
        ) {
          mimeType =
            "audio/webm";
        }

        const recorder =
          mimeType
            ? new MediaRecorder(
                stream,
                { mimeType }
              )
            : new MediaRecorder(
                stream
              );

        mediaChunksRef.current = [];

        recorder.ondataavailable =
          (event) => {
            if (
              event.data &&
              event.data.size > 0
            ) {
              mediaChunksRef.current.push(
                event.data
              );
            }
          };

        recorder.onstop =
          () => {
            const blob =
              new Blob(
                mediaChunksRef.current,
                {
                  type:
                    recorder.mimeType ||
                    "audio/webm",
                }
              );

            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            if (!blob.size) {
              setIsOfficerRecording(
                false
              );

              return;
            }

            const reader =
              new FileReader();

            reader.onloadend =
              () => {
                const audioData =
                  reader.result || "";

                setOfficerVoiceNote(
                  audioData
                );

                setOfficerVoicePreview(
                  audioData
                );
              };

            reader.readAsDataURL(blob);

            setIsOfficerRecording(
              false
            );
          };

        recorder.onerror =
          (event) => {
            console.error(
              "OFFICER RECORDING ERROR:",
              event
            );

            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            setIsOfficerRecording(
              false
            );

            alert(
              "وائس ریکارڈنگ مکمل نہیں ہو سکی۔ دوبارہ کوشش کریں۔"
            );
          };

        mediaRecorderRef.current =
          recorder;

        recorder.start();

        setOfficerVoiceNote("");
        setOfficerVoicePreview("");
        setIsOfficerRecording(true);
      } catch (error) {
        console.error(
          "OFFICER VOICE ERROR:",
          error
        );

        setIsOfficerRecording(
          false
        );

        if (
          error?.name ===
          "NotAllowedError"
        ) {
          alert(
            "مائیکروفون کی اجازت نہیں دی گئی۔ براہِ کرم مائیکروفون کی اجازت دیں۔"
          );
        } else {
          alert(
            "وائس ریکارڈنگ شروع نہیں ہو سکی۔"
          );
        }
      }
    };

  /* =======================================================
     STOP OFFICER RECORDING
  ======================================================= */

  const stopOfficerRecording =
    () => {
      const recorder =
        mediaRecorderRef.current;

      if (!recorder) {
        setIsOfficerRecording(
          false
        );

        return;
      }

      try {
        if (
          recorder.state !==
          "inactive"
        ) {
          recorder.stop();
        }
      } catch (error) {
        console.error(
          "STOP OFFICER RECORDING ERROR:",
          error
        );

        setIsOfficerRecording(
          false
        );
      }
    };

  /* =======================================================
     CLEAR OFFICER VOICE
  ======================================================= */

  const clearOfficerVoiceNote =
    () => {
      setOfficerVoiceNote("");
      setOfficerVoicePreview("");
    };

  /* =======================================================
     PAGE ROUTING
  ======================================================= */

  return (
    <>
      {page === "home" && (
        <Home
          setPage={setPage}
          setFarmerMode={
            setFarmerMode
          }
        />
      )}

      {page === "auth" && (
        <Auth
          farmerMode={
            farmerMode
          }
          setFarmerMode={
            setFarmerMode
          }
          formData={
            formData
          }
          setFormData={
            setFormData
          }
          handleAuth={
            handleAuth
          }
          loading={
            loading
          }
          error={
            error
          }
          setError={
            setError
          }
          setPage={
            setPage
          }
        />
      )}

      {page === "officer-login" && (
        <StaffLogin
          staffRole="officer"
          setPage={setPage}
          onLogin={
            handleStaffLogin
          }
        />
      )}

      {page === "admin-login" && (
        <StaffLogin
          staffRole="admin"
          setPage={setPage}
          onLogin={
            handleStaffLogin
          }
        />
      )}

      {page === "dashboard" &&
        farmer &&
        farmer.role === "farmer" && (
          <Dashboard
            farmer={
              farmer
            }
            cases={
              cases
            }
            selectedFile={
              selectedFile
            }
            selectedImage={
              selectedImage
            }
            isAnalyzing={
              isAnalyzing
            }
            showResult={
              showResult
            }
            analysisResult={
              analysisResult
            }
            error={
              error
            }
            fileInputRef={
              fileInputRef
            }
            handleImageChange={
              handleImageChange
            }
            handleAnalyze={
              handleAnalyze
            }
            loadFarmerCases={
              loadFarmerCases
            }
            speakAdvice={
              speakAdvice
            }
            logout={
              logout
            }
            shareCase={
              shareCase
            }
            weather={
              weather
            }
            locationName={
              locationName
            }
            weatherLoading={
              weatherLoading
            }
            locationLoading={
              locationLoading
            }
            weatherError={
              weatherError
            }
            getLocationWeather={
              getLocationWeather
            }
          />
        )}

      {page === "officer" &&
        staffUser &&
        staffUser.role === "officer" && (
          <OfficerDashboard
            cases={
              cases
            }
            selectedCase={
              selectedCase
            }
            setSelectedCase={
              (caseItem) => {
                setSelectedCase(
                  caseItem
                );

                setAdvice("");
                setCorrectDiagnosis("");

                const parsedAdvice =
                  parseAdvice(
                    caseItem?.advice
                  );

                if (
                  parsedAdvice.text
                ) {
                  setAdvice(
                    parsedAdvice.text
                  );
                }

                setOfficerVoiceNote("");
                setOfficerVoicePreview("");
              }
            }
            advice={
              advice
            }
            setAdvice={
              setAdvice
            }
            pesticideRecommendation={
              pesticideRecommendation
            }
            setPesticideRecommendation={
              setPesticideRecommendation
            }
            otherProductRecommendation={
              otherProductRecommendation
            }
            setOtherProductRecommendation={
              setOtherProductRecommendation
            }
            loadOfficerCases={
              loadOfficerCases
            }
            verifyCase={
              verifyCase
            }
            sendAdvice={
              sendAdvice
            }
            speakAdvice={
              speakAdvice
            }
            setPage={
              setPage
            }
            correctDiagnosis={
              correctDiagnosis
            }
            setCorrectDiagnosis={
              setCorrectDiagnosis
            }
            logout={
              staffLogout
            }
            startOfficerRecording={
              startOfficerRecording
            }
            stopOfficerRecording={
              stopOfficerRecording
            }
            isOfficerRecording={
              isOfficerRecording
            }
            officerVoiceNote={
              officerVoiceNote
            }
            officerVoicePreview={
              officerVoicePreview
            }
            clearOfficerVoiceNote={
              clearOfficerVoiceNote
            }
          />
        )}

      {page === "admin" &&
        staffUser &&
        staffUser.role === "admin" && (
          <AdminDashboard
            cases={
              cases
            }
            setPage={
              setPage
            }
            logout={
              staffLogout
            }
          />
        )}
    </>
  );
}

export default App;