var kenel = [
    0.04, 0.25, 1.11, 3.56, 8.20, 13.5, 16.0, 13.5, 8.20, 3.56, 1.11, 0.25, 0.04
];

function bilateralFilterSeperate(pixels, out, w, h, isHorizontal) {
    var halfLen = Math.floor(kenel.length / 2);
    for (var i = 0; i < w; i++) {
        for (var j = 0; j < h; j++) {
            var offset = j * w + i;
            var lumAll = 0;
            var weightSum = 0;
            var lum = pixels[offset];
            for (var k = 0; k < kenel.length; k++) {
                var off2;
                if (isHorizontal) {
                    off2 = Math.max(Math.min(k - halfLen + i, w - 1), 0) + j * w;
                }
                else {
                    off2 = Math.max(Math.min(k - halfLen + j, h - 1), 0) * w + i;
                }
                var lum2 = pixels[off2];
                var weight = kenel[k] * (1.0 - Math.abs(lum - lum2) / 255);
                lumAll += weight * lum2;
                weightSum += weight;
            }
            out[offset] = lumAll / weightSum;
        }
    }
}

function bilateralFilter(pixels, w, h) {
    var out0 = new Uint8Array(pixels.length);
    var out1 = new Uint8Array(pixels.length);
    bilateralFilterSeperate(pixels, out0, w, h, true);
    bilateralFilterSeperate(out0, out1, w, h, false);

    return out1;
}


export default function (img, cutoff, inverse, useGlobalColor) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = 2048;
    canvas.height = 2048;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    cutoff = 255 * cutoff;

    var lumData = new Uint8ClampedArray(imgData.width * imgData.height);

    for (var i = 0; i < imgData.data.length; i += 4) {
        var r = imgData.data[i];
        var g = imgData.data[i + 1];
        var b = imgData.data[i + 2];
        var a = imgData.data[i + 3];
        if (a < cutoff) {
            // Set 0 to cutoff.
            imgData.data[i + 3] = 0;
        }
        else {
            var lum = 0.2125 * r + 0.7154 * g + 0.0721 * b;
            lumData[i / 4] = lum;
        }

        if (useGlobalColor) {
            imgData.data[i] = 255;
            imgData.data[i + 1] = 255;
            imgData.data[i + 2] = 255;
        }
    }
    // lumData = bilateralFilter(lumData, imgData.width, imgData.height);

    for (var i = 0; i < imgData.data.length; i += 4) {
        var lum = lumData[i / 4];
        if ((!inverse && lum <= cutoff) || (inverse && lum > cutoff)) {
            imgData.data[i + 3] = 0;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    return canvas;
};