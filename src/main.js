import ClayAdvancedRenderer from 'claygl-advanced-renderer';
import { application, Vector3 } from 'claygl';
import { contours } from 'd3-contour';
import { geoPath } from 'd3-geo';
import SimplexNoise from 'simplex-noise';
import { lerp } from 'zrender/src/tool/color';

function simplexCuts() {
    var simplex = new SimplexNoise(Math.random);
    var values = [];
    var m = 200;
    var n = 200;
    var scale = Math.max(config.randomScale, 1);
    var levels = Math.max(config.randomLevel, 1);
    for (var x = 0; x < m; x++) {
        for (var y = 0; y < n; y++) {
            values.push(simplex.noise2D(x / m * scale, y / n * scale));
        }
    }
    var thresholds = Array.from(Array(levels).keys()).map(function (a) {
        return a / levels;
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

var config = {
    shadowDirection: [0, 0],
    shadowKernelSize: 16,
    shadowBlurSize: 10,

    randomScale: 5,
    randomLevel: 7,

    paperDistance: 0.5,
    $paperDistanceRange: [0, 1],

    paperColor0: '#f00',
    paperColor1: '#d00',
    paperColor2: '#a00'
};

var app = application.create('#main', {

    autoRender: false,

    init: function (app) {
        this._advancedRenderer = new ClayAdvancedRenderer(app.renderer, app.scene, app.timeline, {
            shadow: {
                enable: true,
                kernelSize: config.shadowKernelSize,
                blurSize: config.shadowBlurSize
            },
            postEffect: {
                screenSpaceAmbientOcclusion: {
                    enable: true,
                    radius: 1,
                    intensity: 1.4,
                    quality: 'high'
                }
            }
        });

        this._camera = app.createCamera([0, 0, 10], [0, 0, 0]);

        this._dirLight = app.createDirectionalLight([
            config.shadowDirection[0], config.shadowDirection[1], -1
        ], '#fff', 0.7);
        this._dirLight.shadowResolution = 1024;

        app.createAmbientLight('#fff', 0.3);

        this._createPapers(app);

        this._advancedRenderer.render();
    },

    _createPapers: function (app) {
        var canvas = simplexCuts();
        app.scene.remove(this._rootNode);
        this._rootNode = app.createNode();

        canvas.forEach(function (canvas, idx) {
            var paper = app.createPlane({
                diffuseMap: canvas,
                roughness: 1,
                alphaCutoff: 0.9
            }, this._rootNode);
            paper.material.define('fragment', 'ALPHA_TEST');
            paper.scale.set(10, 10, 1);
        }, this);

        var lastPaper = app.createPlane({
            roughness: 1,
            alphaCutoff: 0.9
        }, this._rootNode);
        lastPaper.material.define('fragment', 'ALPHA_TEST');
        lastPaper.scale.set(15, 15, 1);

        this._updatePapers();
    },

    _updatePapers: function () {
        var children = this._rootNode.children();
        children.forEach(function (child, idx) {
            child.position.z = -idx * (config.paperDistance + 0.1);
            child.material.set('color', lerp(
                idx / children.length, [config.paperColor0, config.paperColor1, config.paperColor2]
            ));
        });
    },

    loop: function () {},

    methods: {
        render: function () {
            this._advancedRenderer.render();
        },

        updateShadow: function () {
            this._dirLight.position.set(
                -config.shadowDirection[0],
                -config.shadowDirection[1],
                1
            );
            this._dirLight.lookAt(Vector3.ZERO);
            this._advancedRenderer.setShadow({
                kernelSize: config.shadowKernelSize,
                blurSize: Math.max(config.shadowBlurSize, 1)
            });
            this._advancedRenderer.render();
        },

        generate: function (app) {
            this._createPapers(app);
            this._advancedRenderer.render();
        },

        updatePapers: function () {
            this._updatePapers();
            this._advancedRenderer.render();
        },
    }
});

var controlKit = new ControlKit({
    loadAndSave: false,
    useExternalStyle: true
});

var scenePanel = controlKit.addPanel({ label: 'Settings', width: 250 });

scenePanel.addGroup({ label: 'Generate' })
    .addNumberInput(config, 'randomScale', { label: 'Scale', onFinish: app.methods.generate, step: 1, min: 0 })
    .addNumberInput(config, 'randomLevel', { label: 'Levels', onFinish: app.methods.generate, step: 1, min: 0 })
    .addSlider(config, 'paperDistance', '$paperDistanceRange', { label: 'Distance', onChange: app.methods.updatePapers })
    .addColor(config, 'paperColor0', { label: 'Color 0', onChange: app.methods.updatePapers })
    .addColor(config, 'paperColor1', { label: 'Color 1', onChange: app.methods.updatePapers })
    .addColor(config, 'paperColor2', { label: 'Color 2', onChange: app.methods.updatePapers });

scenePanel.addGroup({ label: 'Directional Shadow' })
    .addPad(config, 'shadowDirection', { label: 'Direction', onChange: app.methods.updateShadow })
    .addNumberInput(config, 'shadowBlurSize', { label: 'Blur Size', onChange: app.methods.updateShadow, step: 0.5, min: 0 });


window.addEventListener('resize', function () { app.resize(); app.methods.render(); } );