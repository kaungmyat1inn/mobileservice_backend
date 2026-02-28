require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const jobRoutes = require("./routes/jobRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const staffRoutes = require("./routes/staffRoutes");
const suggestionRoutes = require("./routes/suggestionRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { startBot } = require("./services/telegramBot");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Base path for sub-path deployment
const BASE_PATH = "/mobileservice";

// Ensure MongoDB is connected before handling API traffic.
connectDB();

// Enable CORS for Flutter app
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
  "https://digitalmartmm.shop",
  "https://superadmin-digitalmartmm.shop",
  "https://createshop-digitalmartmm.shop",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// API Info endpoint
app.get(`${BASE_PATH}/api`, (req, res) => {
  res.json({
    name: "Mobile Service API",
    version: "1.0.0",
    basePath: BASE_PATH,
    endpoints: {
      auth: `${BASE_PATH}/api/auth`,
      jobs: `${BASE_PATH}/api/jobs`,
      expenses: `${BASE_PATH}/api/expenses`,
      admin: `${BASE_PATH}/api/admin`,
      suggestions: `${BASE_PATH}/api/suggestions`,
      health: `${BASE_PATH}/api/health`,
    },
    timestamp: new Date()
  });
});

// Health check route
app.get(`${BASE_PATH}/api/health`, (req, res) => {
  res.json({ status: "API is running...", timestamp: new Date() });
});

// API Routes with base path
app.use(`${BASE_PATH}/api/jobs`, jobRoutes);
app.use(`${BASE_PATH}/api/expenses`, expenseRoutes);
app.use(`${BASE_PATH}/api/auth`, authRoutes);
app.use(`${BASE_PATH}/api/admin`, adminRoutes);
app.use(`${BASE_PATH}/api/staff`, staffRoutes);
app.use(`${BASE_PATH}/api/suggestions`, suggestionRoutes);

// Static uploads directory
app.use(`${BASE_PATH}/api/uploads`, express.static(path.join(__dirname, 'uploads')));

// Root redirect to API info
app.get("/", (req, res) => {
  res.redirect(`${BASE_PATH}/api`);
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`🔌 API Base: http://localhost:${port}${BASE_PATH}/api`);
  console.log(`📱 Endpoints:`);
  console.log(`   - Auth: http://localhost:${port}${BASE_PATH}/api/auth`);
  console.log(`   - Jobs: http://localhost:${port}${BASE_PATH}/api/jobs`);
  console.log(`   - Expenses: http://localhost:${port}${BASE_PATH}/api/expenses`);
  console.log(`   - Admin: http://localhost:${port}${BASE_PATH}/api/admin`);
});

startBot(process.env.TELEGRAM_BOT_TOKEN);
