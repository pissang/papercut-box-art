import { contours } from 'd3-contour';
import { geoPath } from 'd3-geo';
import SimplexNoise from 'simplex-noise';

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
        return a / levels - config.randomOffset;
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

                ctx.scale((canvas.width + 5)/ m, (canvas.height + 5) / n);

                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                path(contour);
                ctx.fill();
                return canvas;
            });
    }

    return create(null);
}
