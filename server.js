const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '2000mb', verify: (req, res, buf) => { req.rawBody = buf; } }));

const TEMP_DIR = process.env.MOGO_TEMP_DIR || path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const WHISPER_CPP_DIR = process.env.WHISPER_CPP_DIR || path.join(__dirname, 'whisper.cpp');

function resolveWhisperBin() {
    const candidates = [
        path.join(WHISPER_CPP_DIR, 'build', 'bin', 'whisper-cli'),
        path.join(WHISPER_CPP_DIR, 'whisper-cli'),
        path.join(WHISPER_CPP_DIR, 'build', 'bin', 'main'),
        path.join(WHISPER_CPP_DIR, 'main'),
    ];
    return candidates.find((bin) => fs.existsSync(bin)) || null;
}

function buildWhisperEnv() {
    const libDirs = [
        path.join(WHISPER_CPP_DIR, 'build', 'src'),
        path.join(WHISPER_CPP_DIR, 'build', 'ggml', 'src'),
        path.join(WHISPER_CPP_DIR, 'build', 'ggml', 'src', 'ggml-blas'),
        path.join(WHISPER_CPP_DIR, 'build', 'ggml', 'src', 'ggml-metal'),
    ].filter((dir) => fs.existsSync(dir));
    const joined = libDirs.join(path.delimiter);
    const prev = process.env.DYLD_LIBRARY_PATH || '';
    return {
        ...process.env,
        DYLD_LIBRARY_PATH: prev ? `${joined}${path.delimiter}${prev}` : joined,
    };
}

function resolveWhisperModel(aiModel) {
    const modelBin = path.join(WHISPER_CPP_DIR, 'models', `ggml-${aiModel}.bin`);
    if (!fs.existsSync(modelBin)) {
        return { error: `Whisper model missing: ${modelBin}. Run: cd whisper.cpp/models && ./download-ggml-model.sh ${aiModel}` };
    }
    return { modelBin };
}

function spawnWhisper(args, handlers) {
    const whisperBin = resolveWhisperBin();
    if (!whisperBin) {
        handlers.onError('Whisper binary not found. Build it: cd whisper.cpp && cmake -B build && cmake --build build');
        return null;
    }

    const child = spawn(whisperBin, args, { env: buildWhisperEnv() });
    let stderr = '';

    child.on('error', (err) => handlers.onError(`Whisper spawn error: ${err.message}`));
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    if (handlers.onStdout) child.stdout.on('data', handlers.onStdout);

    child.on('close', (code, signal) => {
        if (code === 0) {
            handlers.onSuccess();
            return;
        }
        const detail = stderr.trim() || (signal ? `signal ${signal}` : `exit code ${code}`);
        handlers.onError(`Whisper CPP failed (${detail})`);
    });

    return child;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/temp', express.static(TEMP_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.mp4';
        cb(null, crypto.randomBytes(16).toString('hex') + ext);
    }
});
const upload = multer({ storage: storage });

const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const jobs = {};
const { buildStrict1x1BoxBlurFilter } = require('./lib/convert-to-1x1-square');

function resolveOutputHeightFromQuality(quality, customResolution) {
    const res = quality === 'custom' ? (customResolution || '720p') : quality;
    if (res === '1080p') return 1080;
    if (res === '480p') return 480;
    return 720;
}

function resolveVideoBitrate(quality, videoBitrateKbps) {
    if (quality === '1080p') return '4500k';
    if (quality === '480p') return '1000k';
    if (quality === '720p') return '2500k';
    if (quality === 'custom') {
        const kbps = Math.max(400, Math.min(8000, parseInt(videoBitrateKbps, 10) || 2000));
        return `${kbps}k`;
    }
    return '2500k';
}

function evenDimension(value) {
    const n = Math.max(2, Math.round(value));
    return n % 2 === 0 ? n : n - 1;
}

function parseCustomCrop(body) {
    const cropW = parseInt(body.cropW, 10);
    const cropH = parseInt(body.cropH, 10);
    const cropX = parseInt(body.cropX, 10);
    const cropY = parseInt(body.cropY, 10);
    if (!Number.isFinite(cropW) || !Number.isFinite(cropH) || cropW < 2 || cropH < 2) {
        return null;
    }
    return {
        x: Number.isFinite(cropX) ? cropX : 0,
        y: Number.isFinite(cropY) ? cropY : 0,
        width: cropW,
        height: cropH,
    };
}

function buildCropFilterLine(customCrop) {
    if (!customCrop) return null;
    const w = evenDimension(customCrop.width);
    const h = evenDimension(customCrop.height);
    const x = evenDimension(customCrop.x);
    const y = evenDimension(customCrop.y);
    return `[0:v]crop=${w}:${h}:${x}:${y}[vcrop]`;
}

function buildBlurFillFilter(outputW, outputH, boxBlur, inputLabel) {
    const src = inputLabel.startsWith('[') ? inputLabel : `[${inputLabel}]`;
    return [
        `${src}split=2[bg][fg]`,
        `[bg]scale=${outputW}:${outputH}:force_original_aspect_ratio=increase,crop=${outputW}:${outputH},boxblur=${boxBlur}[bg_blur]`,
        `[fg]scale=${outputW}:${outputH}:force_original_aspect_ratio=decrease[fg_fit]`,
        '[bg_blur][fg_fit]overlay=(W-w)/2:(H-h)/2[vout]',
    ];
}

/** Returns simple -vf or complex filter spec for HLS encode. */
function buildVideoFilterSpec(outputHeight, aspectRatio, customCrop) {
    const cropLine = buildCropFilterLine(customCrop);
    const src = cropLine ? 'vcrop' : '0:v';

    if (!aspectRatio || aspectRatio === 'original') {
        if (cropLine) {
            return {
                complexFilter: [cropLine, `[vcrop]scale=-2:${outputHeight}[vout]`],
                mapVideo: '[vout]',
            };
        }
        return { vf: `scale=-2:${outputHeight}` };
    }

    if (aspectRatio === '1:1') {
        const s = evenDimension(outputHeight);
        const filters = cropLine ? [cropLine] : [];
        filters.push(...buildStrict1x1BoxBlurFilter(s, '40:5', src));
        return { complexFilter: filters, mapVideo: '[vout]' };
    }

    const ratioMap = { '16:9': [16, 9], '9:16': [9, 16] };
    const pair = ratioMap[aspectRatio];
    if (!pair) return { vf: `scale=-2:${outputHeight}` };

    const [rw, rh] = pair;
    const h = outputHeight;
    const w = evenDimension((h * rw) / rh);
    const filters = cropLine ? [cropLine] : [];
    filters.push(...buildBlurFillFilter(w, h, '32:5', src));

    return { complexFilter: filters, mapVideo: '[vout]' };
}

function applyVideoFilterToFfmpegCommand(cmd, filterSpec) {
    if (filterSpec.complexFilter) {
        cmd.complexFilter(filterSpec.complexFilter);
        return;
    }
    cmd.videoFilters(filterSpec.vf);
}

app.post('/process', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).send('No video uploaded');

    const videoPath = req.file.path;
    const folderId = path.parse(req.file.filename).name;
    const outputFolder = path.join(TEMP_DIR, folderId);

    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

    const m3u8Path = path.join(outputFolder, 'playlist.m3u8');
    const audioWavPath = path.join(outputFolder, 'audio.wav'); 
    
    const quality = req.body.quality || '720p';
    const aspectRatio = req.body.aspectRatio || 'original';
    const audioLanguage = req.body.language || 'Hindi'; 
    const aiModel = req.body.aiModel || 'small';
    const translateToEng = req.body.translate === 'true';

    const customResolution = req.body.customResolution || '720p';
    const outputHeight = resolveOutputHeightFromQuality(quality, customResolution);
    const filterSpec = buildVideoFilterSpec(outputHeight, aspectRatio, parseCustomCrop(req.body));
    const bitrate = resolveVideoBitrate(quality, req.body.videoBitrate);

    jobs[folderId] = { 
        status: 'compressing', progress: 0, whisperProgress: 0, duration: 0,
        origSizeMB: (req.file.size / (1024 * 1024)).toFixed(2), newSizeMB: 0,
        previewUrl: null, vttOriginal: null, vttEnglish: null, langOriginal: audioLanguage, error: null 
    };

    res.json({ status: 'Started', jobId: folderId });

    const hlsOptions = [
        '-profile:v baseline', '-level 3.0', '-start_number 0',
        '-hls_time 10', '-hls_list_size 0', '-f hls',
        `-b:v ${bitrate}`, '-c:a aac', '-b:a 128k',
    ];
    if (filterSpec.complexFilter) {
        hlsOptions.push('-map', filterSpec.mapVideo, '-map', '0:a?');
    }

    const compressCmd = ffmpeg(videoPath);
    applyVideoFilterToFfmpegCommand(compressCmd, filterSpec);
    compressCmd
        .addOptions(hlsOptions)
        .on('codecData', (data) => {
            if (data.duration) {
                const parts = data.duration.split(':');
                jobs[folderId].duration = (parseFloat(parts[0]) * 3600) + (parseFloat(parts[1]) * 60) + parseFloat(parts[2]);
            }
        })
        .output(m3u8Path)
        .on('progress', (progress) => {
            if (progress.percent) jobs[folderId].progress = Math.round(progress.percent);
        })
        .on('end', () => {
            let newSizeBytes = 0;
            fs.readdirSync(outputFolder).forEach(f => newSizeBytes += fs.statSync(path.join(outputFolder, f)).size);
            jobs[folderId].newSizeMB = (newSizeBytes / (1024 * 1024)).toFixed(2);

            jobs[folderId].status = 'whisper';
            
            ffmpeg(videoPath)
                .noVideo()
                .audioFrequency(16000)
                .audioChannels(1)
                .audioCodec('pcm_s16le')
                .output(audioWavPath)
                .on('end', () => {
                    const model = resolveWhisperModel(aiModel);
                    if (model.error) {
                        jobs[folderId].status = 'error';
                        jobs[folderId].error = model.error;
                        return;
                    }

                    let langCode = 'en';
                    if (audioLanguage === 'Hindi') langCode = 'hi';
                    if (audioLanguage === 'Urdu') langCode = 'ur';

                    const whisperArgs = ['-m', model.modelBin, '-f', audioWavPath, '-ovtt', '-of', path.join(outputFolder, 'original'), '-l', langCode];
                    if (audioLanguage === 'Hindi') whisperArgs.push('--prompt', 'यह देवनागरी लिपि में शुद्ध हिंदी है।');

                    const onWhisperProgress = (data) => {
                        const match = data.toString().match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3}) -->/);
                        if (match && jobs[folderId].duration > 0) {
                            const currentSecs = (parseFloat(match[1]) * 3600) + (parseFloat(match[2]) * 60) + parseFloat(match[3]);
                            jobs[folderId].whisperProgress = Math.min(Math.round((currentSecs / jobs[folderId].duration) * 100), 100);
                        }
                    };

                    const finishSuccess = () => {
                        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                        if (fs.existsSync(audioWavPath)) fs.unlinkSync(audioWavPath);
                        jobs[folderId].status = 'done';
                        jobs[folderId].previewUrl = `/temp/${folderId}/playlist.m3u8`;
                    };

                    spawnWhisper(whisperArgs, {
                        onStdout: onWhisperProgress,
                        onError: (msg) => { jobs[folderId].status = 'error'; jobs[folderId].error = msg; },
                        onSuccess: () => {
                            jobs[folderId].vttOriginal = `/temp/${folderId}/original.vtt`;

                            if (translateToEng && audioLanguage !== 'English') {
                                jobs[folderId].status = 'translating';
                                jobs[folderId].whisperProgress = 0;
                                const transArgs = ['-m', model.modelBin, '-f', audioWavPath, '-ovtt', '-of', path.join(outputFolder, 'english'), '-l', langCode, '-tr'];
                                spawnWhisper(transArgs, {
                                    onStdout: onWhisperProgress,
                                    onError: (msg) => { jobs[folderId].status = 'error'; jobs[folderId].error = msg; },
                                    onSuccess: () => {
                                        jobs[folderId].vttEnglish = `/temp/${folderId}/english.vtt`;
                                        finishSuccess();
                                    },
                                });
                            } else {
                                finishSuccess();
                            }
                        },
                    });
                })
                .on('error', (err) => {
                    jobs[folderId].status = 'error'; jobs[folderId].error = 'Audio extraction failed';
                }).run();
        })
        .on('error', () => {
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            jobs[folderId].status = 'error'; jobs[folderId].error = 'FFmpeg failed';
        }).run();
});

app.get('/status/:jobId', (req, res) => res.json(jobs[req.params.jobId] || {error: 'Not found'}));

app.post('/upload-to-r2', (req, res) => {
    const { folderId, series, episode } = req.body;
    const outputFolder = path.join(TEMP_DIR, folderId);
    
    if (!fs.existsSync(outputFolder)) return res.status(400).json({ error: 'Files not found' });

    // Path setup
    const r2FolderPath = `${series.trim().replace(/\s+/g, '_')}/Ep${episode}`;

    // Job setup for Live Tracking
    if (!jobs[folderId]) jobs[folderId] = {};
    jobs[folderId].status = 'uploading_r2';
    jobs[folderId].r2Progress = 0;

    // Instant Response so Cloudflare DOES NOT timeout
    res.json({ status: 'Started' });

    // Background Process
    (async () => {
        try {
            const files = fs.readdirSync(outputFolder);
            let totalFiles = files.length;
            let uploadedCount = 0;

            const bucket = process.env.R2_BUCKET_NAME;
            if (!bucket) throw new Error('R2_BUCKET_NAME is not set in .env');

            for (const file of files) {
                const cType = file.endsWith('.m3u8')
                    ? 'application/vnd.apple.mpegurl'
                    : (file.endsWith('.ts') ? 'video/MP2T' : (file.endsWith('.vtt') ? 'text/vtt' : 'application/octet-stream'));

                await s3.send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: `${r2FolderPath}/${file}`,
                    Body: fs.readFileSync(path.join(outputFolder, file)),
                    ContentType: cType,
                }));
                uploadedCount++;
                jobs[folderId].r2Progress = Math.round((uploadedCount / totalFiles) * 100);
            }
            const publicBase = `${process.env.R2_PUBLIC_URL}/${r2FolderPath}`;
            const totalBytes = files.reduce((sum, f) => sum + fs.statSync(path.join(outputFolder, f)).size, 0);
            const hasOriginalVtt = files.includes('original.vtt');
            const hasEnglishVtt = files.includes('english.vtt');

            fs.rmSync(outputFolder, { recursive: true, force: true });
            jobs[folderId].status = 'r2_done';
            jobs[folderId].finalUrl = `${publicBase}/playlist.m3u8`;
            jobs[folderId].finalVttOriginal = hasOriginalVtt ? `${publicBase}/original.vtt` : null;
            jobs[folderId].finalVttEnglish = hasEnglishVtt ? `${publicBase}/english.vtt` : null;
            jobs[folderId].finalSizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
            jobs[folderId].finalDurationSec = jobs[folderId].duration || 0;
        } catch (error) {
            console.error("R2 Upload Error:", error);
            jobs[folderId].status = 'error';
            jobs[folderId].error = 'Cloudflare Upload Failed: ' + error.message;
        }
    })();
});
app.post('/cancel', (req, res) => {
    const out = path.join(TEMP_DIR, req.body.folderId);
    if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true });
    if (jobs[req.body.folderId]) delete jobs[req.body.folderId];
    res.json({ status: 'Cancelled' });
});
const thumbUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).single('thumbnail');

app.post('/upload-thumbnail', (req, res) => {
    // Multer ko route ke andar daala hai taki HTML error kabhi na aaye
    thumbUpload(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ error: "File Limit Error: " + err.message });
        }

        try {
            if (!req.file) return res.status(400).json({ error: "Image file is missing" });

            const seriesName = (req.body.seriesName || "Series").trim().replace(/\s+/g, '_');
            const episodeNum = req.body.episodeNum || "0";
            const fileName = `thumbnails/${seriesName}/Ep_${episodeNum}.webp`;

            // ✅ Purana S3 connection
            await s3.send(new PutObjectCommand({
                Bucket: "mogo-image-storage",
                Key: fileName,
                Body: req.file.buffer,
                ContentType: 'image/webp',
            }));

            const publicUrl = `https://pub-8bdbf1723ef64ad885906d201f5a2b20.r2.dev/${fileName}`;
            res.json({ success: true, url: publicUrl });

        } catch (error) {
            console.error("Thumbnail Error:", error);
            res.status(500).json({ error: "Upload Failed: " + error.message });
        }
    });
});

app.post('/process-podcast', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), (req, res) => {
    if (!req.files || !req.files.image || !req.files.audio) {
        return res.status(400).json({ error: "Files missing" });
    }

    const img = req.files.image[0];
    const aud = req.files.audio[0];
    const quality = req.body.quality || '720p';
    const aLang = req.body.language || 'Hindi';
    const aiModel = req.body.aiModel || 'small';
    const transEng = req.body.translate === 'true';
    
    // Naya Trim Data
    const startTime = req.body.startTime || '00:00:00';
    const endTime = req.body.endTime || '';
    
    const folderId = path.parse(aud.filename).name; 
    const outFolder = path.join(TEMP_DIR, folderId);
    if (!fs.existsSync(outFolder)) fs.mkdirSync(outFolder, { recursive: true });

    let scale = '-2:720'; let bitrate = '2500k';
    if (quality === '1080p') { scale = '-2:1080'; bitrate = '4500k'; }
    if (quality === '480p') { scale = '-2:480'; bitrate = '1000k'; }

    jobs[folderId] = {
        status: 'compressing', progress: 0, whisperProgress: 0, duration: 0,
        origSizeMB: ((img.size + aud.size) / (1024*1024)).toFixed(2), 
        newSizeMB: 0, previewUrl: null, vttOriginal: null, vttEnglish: null, 
        langOriginal: aLang, error: null
    };
    
    res.json({ status: 'Started', jobId: folderId });

    // Audio Trim Options
    let audInputOpts = [];
    if (startTime !== '00:00:00') audInputOpts.push('-ss', startTime);
    if (endTime !== '') audInputOpts.push('-to', endTime);

    // 1. VIDEO BANANE KE LIYE FFMPEG
    ffmpeg()
        .input(img.path)
        .inputOptions(['-loop 1', '-framerate 1'])
        .input(aud.path)
        .inputOptions(audInputOpts) // Yahan Magic Trim Lagaya!
        .outputOptions([
            '-c:v libx264', 
            '-tune stillimage', 
            '-r 30', // Constant Frame Rate (Prevents audio drift)
            '-c:a aac', 
            '-b:a 128k',
            '-pix_fmt yuv420p', 
            `-vf scale=${scale},pad=ceil(iw/2)*2:ceil(ih/2)*2`, 
            `-b:v ${bitrate}`, 
            '-shortest', 
            '-profile:v baseline', 
            '-level 3.0', 
            '-start_number 0',
            '-hls_time 10', 
            '-hls_list_size 0', 
            '-f hls'
        ])
        .output(path.join(outFolder, 'playlist.m3u8'))
        .on('end', () => {
            
            jobs[folderId].status = 'whisper';
            const wavOut = path.join(outFolder, 'audio.wav');
            
            // 2. WHISPER KE LIYE BHI SAME TRIM KIYA HUA WAV NIKALNA
            let wavCmd = ffmpeg(aud.path);
            if (startTime !== '00:00:00') wavCmd.inputOptions(['-ss', startTime]);
            if (endTime !== '') wavCmd.inputOptions(['-to', endTime]);

            wavCmd.audioFrequency(16000).audioChannels(1)
                .audioCodec('pcm_s16le').output(wavOut).on('end', () => {
                    
                    const model = resolveWhisperModel(aiModel);
                    if (model.error) {
                        jobs[folderId].status = 'error';
                        jobs[folderId].error = model.error;
                        return;
                    }

                    let langCode = 'en';
                    if (aLang === 'Hindi') langCode = 'hi';
                    if (aLang === 'Urdu') langCode = 'ur';

                    const wArgs = ['-m', model.modelBin, '-l', langCode, '-f', wavOut, '-ovtt', '-of', path.join(outFolder, 'original'), '-ml', '20'];

                    const finishJob = () => {
                        let totalBytes = 0;
                        if (fs.existsSync(outFolder)) {
                            fs.readdirSync(outFolder).forEach(f => { totalBytes += fs.statSync(path.join(outFolder, f)).size; });
                        }
                        jobs[folderId].newSizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
                        if (fs.existsSync(img.path)) fs.unlinkSync(img.path);
                        if (fs.existsSync(aud.path)) fs.unlinkSync(aud.path);
                        jobs[folderId].status = 'done';
                        jobs[folderId].previewUrl = `/temp/${folderId}/playlist.m3u8`;
                    };

                    spawnWhisper(wArgs, {
                        onError: (msg) => { jobs[folderId].status = 'error'; jobs[folderId].error = msg; },
                        onSuccess: () => {
                            jobs[folderId].vttOriginal = `/temp/${folderId}/original.vtt`;
                            if (transEng && aLang !== 'English') {
                                jobs[folderId].status = 'translating';
                                const tArgs = ['-m', model.modelBin, '-l', langCode, '-f', wavOut, '-tr', '-ovtt', '-of', path.join(outFolder, 'english'), '-ml', '20'];
                                spawnWhisper(tArgs, {
                                    onError: (msg) => { jobs[folderId].status = 'error'; jobs[folderId].error = msg; },
                                    onSuccess: () => {
                                        jobs[folderId].vttEnglish = `/temp/${folderId}/english.vtt`;
                                        finishJob();
                                    },
                                });
                            } else {
                                finishJob();
                            }
                        },
                    });
                }).on('error', (err) => { jobs[folderId].status = 'error'; jobs[folderId].error = err.message; }).run();
        }).on('error', (err) => { jobs[folderId].status = 'error'; jobs[folderId].error = err.message; }).run();
});

function logWhisperStartupCheck() {
    const bin = resolveWhisperBin();
    console.log(`Whisper dir: ${WHISPER_CPP_DIR}`);
    if (!bin) {
        console.error('Whisper: binary NOT FOUND — run: cd whisper.cpp && cmake -B build && cmake --build build');
        return;
    }
    console.log(`Whisper: binary OK — ${bin}`);
    const model = resolveWhisperModel('small');
    if (model.error) console.error(`Whisper: ${model.error}`);
    else console.log(`Whisper: model OK — ${model.modelBin}`);
}

const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server Running!`);
    logWhisperStartupCheck();
});
server.timeout = 0;
server.keepAliveTimeout = 0;
