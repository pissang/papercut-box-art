import { parse } from 'zrender/src/tool/color';

export default function (img, cutoff, inverse, useGlobalColor) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0, img.width, img.height);
    var imgData = ctx.getImageData(0, 0, img.width, img.height);
    cutoff = 255 * cutoff;

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
            if ((!inverse && lum <= cutoff) || (inverse && lum > cutoff)) {
                imgData.data[i + 3] = 0;
            }
        }

        if (useGlobalColor) {
            imgData.data[i] = 255;
            imgData.data[i + 1] = 255;
            imgData.data[i + 2] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    return canvas;
};