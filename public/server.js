const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");

const thumbUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 3. New Bucket के लिए Client
const imageS3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// 4. API Route
app.post('/upload-thumbnail', thumbUpload.single('thumbnail'), async (req, res) => {
    console.log("📸 Thumbnail Request Aayi Hai!"); // यह लाइन चेक करने के लिए है कि फोटो सर्वर तक पहुँची या नहीं

    try {
        if (!req.file) {
            console.log("❌ File missing hai!");
            return res.status(400).json({ error: "Image file is missing" });
        }

        const seriesName = (req.body.seriesName || "Series").trim().replace(/\s+/g, '_');
        const episodeNum = req.body.episodeNum || "0";
        const fileName = `thumbnails/${seriesName}/Ep_${episodeNum}.webp`;

        const uploadParams = {
            Bucket: "mogo-image-storage",
            Key: fileName,
            Body: req.file.buffer,
            ContentType: 'image/webp',
        };

        console.log("🚀 R2 mein upload shuru...");
        await imageS3Client.send(new PutObjectCommand(uploadParams));

        const publicUrl = `https://pub-8bdbf1723ef64ad885906d201f5a2b20.r2.dev/${fileName}`;
        
        console.log("✅ Upload Successful:", publicUrl);
        res.json({ success: true, url: publicUrl });

    } catch (error) {
        console.error("Critical Thumbnail Error:", error);
        res.status(500).json({ error: "Server connection failed with R2" });
    }
});
