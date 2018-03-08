import { contours } from 'd3-contour';
import { geoPath } from 'd3-geo';
import SimplexNoise from 'simplex-noise';

import { core } from 'claygl';

var imgCache = new core.LRU(10);

export default function (config, seed) {
    var simplex = new SimplexNoise(function () {
        return seed;
    });
    var values = [];
    var m = 200;
    var n = 200;
    var scale = Math.max(config.randomScale, 1);
    var levels = Math.min(Math.max(Math.round(config.paperCount), 1), 10);
    for (var x = 0; x < m; x++) {
        for (var y = 0; y < n; y++) {
            values.push(simplex.noise2D(x / m * scale, y / n * scale));
        }
    }
    var thresholds = Array.from(Array(levels).keys()).map(function (a) {
        return a / levels;
    });

    function create(img) {
        return contours()
            .size([m, n])
            .thresholds(thresholds)(values)
            .map(function (contour) {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                canvas.width = 2048;
                canvas.height = 2048;
                var path = geoPath(null, ctx);
                if (img) {
                    var pattern = ctx.createPattern(img, 'repeat');
                    ctx.fillStyle = pattern;
                }
                else {
                    ctx.fillStyle = '#fff';
                }
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.scale(canvas.width / m, canvas.height / n);
                ctx.translate(-0.5, -0.5);

                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                path(contour);
                ctx.fill();
                return canvas;
            });
    }

    return new Promise(function (resolve, reject) {
        if (config.paperTexture) {
            var imgPromise = imgCache.get(config.paperTexture);
            if (!imgPromise) {
                imgPromise = new Promise(function (resolve, reject) {
                    var img = new Image();
                    img.src = config.paperTexture;
                    img.onload = function () {
                        resolve(img);
                    };
                    img.onerror = function () {
                        resolve(null);
                    };
                });
                imgCache.put(config.paperTexture, imgPromise);
            }
            imgPromise.then(function (img) {
                resolve(create(img));
            });
        }
        else {
            resolve(create(null));
        }
    });

}
