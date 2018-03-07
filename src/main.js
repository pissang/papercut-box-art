import ClayAdvancedRenderer from 'claygl-advanced-renderer';
import { application } from 'claygl';
import { contours } from 'd3-contour';
import { geoPath } from 'd3-geo';
import SimplexNoise from 'simplex-noise';

function simplexCuts() {
    var simplex = new SimplexNoise(Math.random);
    var values = [];
    var m = 200;
    var n = 200;
    for (var x = 0; x < m; x++) {
        for (var y = 0; y < n; y++) {
            values.push(simplex.noise2D(x / 50, y / 50));
        }
    }
    var thresholds = Array.from(Array(5).keys()).map(function (a) {
        return a / 5;
    });

    return contours()
        .size([m, n])
        .thresholds(thresholds)(values)
        .map(function (contour) {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = 2048;
            canvas.height = 2048;
            ctx.scale(canvas.width / m, canvas.height / n);
            ctx.translate(-0.5, -0.5);
            var path = geoPath(null, ctx);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            path(contour);
            ctx.fill();
            return canvas;
        });
}

var app = application.create('#main', {

    autoRender: false,

    init: function (app) {
        this._advancedRenderer = new ClayAdvancedRenderer(app.renderer, app.scene, app.timeline, {
            shadow: true,
            postEffect: {
                screenSpaceAmbientOcclusion: {
                    enable: true,
                    radius: 1,
                    intensity: 1.4,
                    quality: 'ultra'
                }
            }
        });

        this._camera = app.createCamera([0, 0, 15], [0, 0, 0]);

        var light = app.createDirectionalLight([1, -1, -3], '#fff', 0.7);
        light.shadowResolution = 1024;

        app.createAmbientLight('#fff', 0.3);

        this._initPapers(app);

        this._advancedRenderer.render();

        document.body.onclick = (function () {
            this._advancedRenderer.render();
        }).bind(this);
    },

    _initPapers: function (app) {
        var canvas = simplexCuts();
        canvas.forEach(function (canvas, idx) {
            var paper = app.createPlane({
                diffuseMap: canvas,
                color: 'red',
                roughness: 1,
                alphaCutoff: 0.9
            });
            paper.material.define('fragment', 'ALPHA_TEST');
            paper.scale.set(10, 10, 1);
            paper.position.z = -idx / 2;
        });

        var lastPaper = app.createPlane({
            color: '#f00',
            roughness: 1,
            alphaCutoff: 0.9
        });
        lastPaper.material.define('fragment', 'ALPHA_TEST');
        lastPaper.scale.set(15, 15, 1);
        lastPaper.position.z = -canvas.length / 2;
    },

    loop: function () {
    },

    methods: {
    }
});