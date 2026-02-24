const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/logos directory exists
const uploadDir = path.join(__dirname, '../uploads/logos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique name: <shop_id>_<timestamp>.<ext>
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, (req.user?.shopId || 'shop') + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|webp|heic|heif/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = (file.mimetype || '').toLowerCase();
    const isImageMime = mimetype.startsWith('image/');
    const allowedMime = allowedFileTypes.test(mimetype);

    // Some Android devices return uncommon image mime types.
    // Accept if either extension is valid or mime is a valid image type.
    if (extname || isImageMime || allowedMime) {
        return cb(null, true);
    }

    cb(new Error('Only image files are allowed (jpg, png, webp, heic, heif).'));
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter,
});

module.exports = upload;
