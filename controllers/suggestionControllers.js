const Suggestion = require('../models/Suggestion');

// @desc    Get suggestions for a specific type
// @route   GET /api/suggestions/:type
// @access  Public or Private
const getSuggestions = async (req, res) => {
    const { type } = req.params;
    const { q } = req.query; // Search query

    if (!['model', 'color', 'issue'].includes(type)) {
        return res.status(400).json({ message: "Invalid suggestion type" });
    }

    try {
        let filter = { type };
        if (q) {
            filter.value = { $regex: new RegExp(q, 'i') };
        }

        // Limit to top 20 most frequent suggestions that match
        const suggestions = await Suggestion.find(filter)
            .sort({ frequency: -1, value: 1 })
            .limit(20);

        res.status(200).json(suggestions.map(s => s.value));
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const addSuggestion = async (type, value) => {
    if (!value || typeof value !== 'string') return;
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) return;

    try {
        await Suggestion.findOneAndUpdate(
            { type, value: { $regex: new RegExp(`^${trimmedValue}$`, 'i') } }, // Case-insensitive exact match
            { $inc: { frequency: 1 }, $setOnInsert: { type, value: trimmedValue } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        console.error(`Failed to add suggestion for ${type}:`, error);
    }
};

module.exports = {
    getSuggestions,
    addSuggestion
};
