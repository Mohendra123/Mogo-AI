/**
 * Strict 1:1 output: foreground fit (no crop), blurred background fill (no black bars).
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

function evenDimension(n) {
    const v = Math.max(2, Math.round(n));
    return v % 2 === 0 ? v : v - 1;
}

/**
 * filter_complex graph for square output.
 * @param {number} size - Output width/height (e.g. 1080)
 * @param {string} boxBlur - boxblur args: luma_radius:luma_power[:chroma_radius:chroma_power]
 * @returns {string[]}
 */
function buildStrict1x1BoxBlurFilter(size = 1080, boxBlur = '40:5', inputLabel = '0:v') {
    const s = evenDimension(size);
    const src = inputLabel.startsWith('[') ? inputLabel : `[${inputLabel}]`;
    return [
        `${src}split=2[bg][fg]`,
        `[bg]scale=${s}:${s}:force_original_aspect_ratio=increase,crop=${s}:${s},boxblur=${boxBlur}[bg_blur]`,
        `[fg]scale=${s}:${s}:force_original_aspect_ratio=decrease[fg_fit]`,
        '[bg_blur][fg_fit]overlay=(W-w)/2:(H-h)/2[vout]',
    ];
}

/** Single-line filter_complex (for CLI debugging). */
function buildStrict1x1BoxBlurFilterComplex(size = 1080, boxBlur = '40:5') {
    return buildStrict1x1BoxBlurFilter(size, boxBlur).join(';');
}

/**
 * Convert any input to strict 1:1 using fluent-ffmpeg.
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {object} [options]
 * @param {number} [options.size=1080] - Square edge length in pixels
 * @param {string} [options.boxBlur='40:5'] - Heavy blur strength
 * @param {object} [options.videoCodec] - e.g. { crf: 23, preset: 'medium' }
 * @returns {Promise<string>} Resolves with outputPath
 */
function convertToStrict1x1(inputPath, outputPath, options = {}) {
    const inputAbs = path.resolve(inputPath);
    const outputAbs = path.resolve(outputPath);

    if (!fs.existsSync(inputAbs)) {
        return Promise.reject(
            new Error(`Input file not found: ${inputAbs}\nUse a real path, e.g. node scripts/convert-16x9-to-1x1-blur.js ~/Downloads/my-video.mp4 out.mp4 1080`)
        );
    }

    const size = options.size ?? 1080;
    const boxBlur = options.boxBlur ?? '40:5';
    const filterGraph = buildStrict1x1BoxBlurFilter(size, boxBlur);
    const crf = options.crf ?? 23;
    const preset = options.preset ?? 'medium';

    return new Promise((resolve, reject) => {
        ffmpeg(inputAbs)
            .complexFilter(filterGraph)
            .outputOptions([
                '-map', '[vout]',
                '-map', '0:a?',
                '-c:v', 'libx264',
                '-preset', preset,
                '-crf', String(crf),
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart',
                '-pix_fmt', 'yuv420p',
            ])
            .on('start', (cmd) => {
                if (options.logCommand !== false) {
                    console.log('filter_complex:', buildStrict1x1BoxBlurFilterComplex(size, boxBlur));
                    console.log('ffmpeg:', cmd);
                }
            })
            .on('error', reject)
            .on('end', () => resolve(outputAbs))
            .save(outputAbs);
    });
}

module.exports = {
    evenDimension,
    buildStrict1x1BoxBlurFilter,
    buildStrict1x1BoxBlurFilterComplex,
    convertToStrict1x1,
};
