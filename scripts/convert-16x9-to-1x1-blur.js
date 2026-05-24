#!/usr/bin/env node
/**
 * CLI: convert video to strict 1:1 with blurred background (no black bars).
 *
 * Usage:
 *   node scripts/convert-16x9-to-1x1-blur.js input.mp4 output.mp4 [size]
 */

const { convertToStrict1x1 } = require('../lib/convert-to-1x1-square');

if (require.main === module) {
    const [,, input, output, sizeArg] = process.argv;
    if (!input || !output) {
        console.error('Usage: node scripts/convert-16x9-to-1x1-blur.js <input.mp4> <output.mp4> [size=1080]');
        process.exit(1);
    }
    const size = parseInt(sizeArg, 10) || 1080;
    convertToStrict1x1(input, output, { size })
        .then((out) => console.log('Done:', out))
        .catch((err) => {
            console.error(err.message);
            process.exit(1);
        });
}
