const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config(); // To load environment variables

const app = express();
const PORT = process.env.PORT || 3004;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI || "";

mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => console.error("MongoDB connection error:", err));

// --- Mongoose Schemas ---
const HandSignSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
});
const HandSign = mongoose.model("HandSign", HandSignSchema);

const VideoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Keep original ID if needed
    path: { type: String, required: true },
    correctSign: { type: String, required: true },
});
const Video = mongoose.model("Video", VideoSchema);

const ValidationResultSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    videoId: { type: String, required: true }, // Reference Video by its 'id' field
    selectedSign: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});
// Ensure a user can only validate a specific video once
ValidationResultSchema.index({ userId: 1, videoId: 1 }, { unique: true });
const ValidationResult = mongoose.model(
    "ValidationResult",
    ValidationResultSchema
);

// --- Hardcoded Users (Keep for now, consider moving to DB later) ---
const users = [
    { id: 1, username: "user1", password: "password1", name: "User One" },
    { id: 2, username: "user2", password: "password2", name: "User Two" },
    { id: 3, username: "user3", password: "password3", name: "User Three" },
    { id: 4, username: "user4", password: "password4", name: "User Four" },
];

// --- API Endpoints ---

// Login endpoint (remains the same)
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find(
        (u) => u.username === username && u.password === password
    );
    if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(401).json({
            success: false,
            message: "Invalid credentials",
        });
    }
});

// Get list of hand signs from DB
app.get("/api/handsigns", async (req, res) => {
    try {
        const signs = await HandSign.find().sort({ name: 1 });
        // Return only the names
        res.json(signs.map((sign) => sign.name));
    } catch (error) {
        console.error("Error fetching hand signs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load hand signs",
        });
    }
});

// Get videos for validation from DB
app.get("/api/videos", async (req, res) => {
    try {
        // Fetch videos and return in the expected format
        const videos = await Video.find(
            {},
            { _id: 0, id: 1, path: 1, correctSign: 1 }
        );
        res.json(videos);
    } catch (error) {
        console.error("Error fetching videos:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load videos",
        });
    }
});

// Save validation results to DB
app.post("/api/submit", async (req, res) => {
    try {
        const { userId, videoId, selectedSign } = req.body;

        if (!userId || !videoId || !selectedSign) {
            return res
                .status(400)
                .json({ success: false, message: "Missing required fields" });
        }

        // Use findOneAndUpdate with upsert:true to insert or update
        const result = await ValidationResult.findOneAndUpdate(
            { userId, videoId }, // Find based on userId and videoId
            { selectedSign, timestamp: new Date() }, // Update these fields
            { new: true, upsert: true, runValidators: true } // Options: return updated doc, create if not found, run schema validation
        );

        res.json({
            success: true,
            message: "Validation saved successfully",
            data: result,
        });
    } catch (error) {
        console.error("Error saving validation:", error);
        // Handle potential duplicate key error if index is violated (though upsert should manage this)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Validation already submitted.",
            });
        }
        res.status(500).json({
            success: false,
            message: "Failed to save validation",
        });
    }
});

// Get user's progress from DB
app.get("/api/progress/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        // Convert userId from param string to number if necessary (depends on how you store it)
        const numericUserId = parseInt(userId, 10);
        if (isNaN(numericUserId)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid user ID format" });
        }

        const completedCount = await ValidationResult.countDocuments({
            userId: numericUserId,
        });
        const totalVideos = await Video.countDocuments();

        const percentage =
            totalVideos > 0
                ? Math.round((completedCount / totalVideos) * 100)
                : 0;

        res.json({ completed: completedCount, total: totalVideos, percentage });
    } catch (error) {
        console.error("Error getting progress:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get progress",
        });
    }
});

// --- Serve static video files (If needed, otherwise remove) ---
// app.use('/videos', express.static(path.join(__dirname, 'videos')));

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

async function seedDatabase() {
    try {
        // Clear existing data (optional)
        // await HandSign.deleteMany({});
        // await Video.deleteMany({});
        // await ValidationResult.deleteMany({}); // Be careful with this one

        // Check if data already exists
        const signCount = await HandSign.countDocuments();
        if (signCount === 0) {
            console.log("Seeding HandSigns...");
            const fs = require("fs");
            const handSignsPath = path.join(
                __dirname,
                "data",
                "handsigns.json"
            );
            const handSignsData = JSON.parse(
                fs.readFileSync(handSignsPath, "utf8")
            );
            const handSignDocs = handSignsData.map((name) => ({ name }));
            await HandSign.insertMany(handSignDocs);
            console.log("HandSigns seeded.");
        } else {
            console.log("HandSigns already exist, skipping seed.");
        }

        const videoCount = await Video.countDocuments();
        if (videoCount === 0) {
            console.log("Seeding Videos...");
            const fs = require("fs");
            const videosPath = path.join(__dirname, "data", "videos.json");
            const videosData = JSON.parse(fs.readFileSync(videosPath, "utf8"));
            await Video.insertMany(videosData);
            console.log("Videos seeded.");
        } else {
            console.log("Videos already exist, skipping seed.");
        }
    } catch (error) {
        console.error("Error seeding database:", error);
    }
}

mongoose.connection.once("open", () => {
    seedDatabase();
});
