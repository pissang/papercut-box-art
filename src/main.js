import ClayAdvancedRenderer from 'claygl-advanced-renderer';
import { application, Vector3, util, Shader } from 'claygl';
import { lerp, parse, stringify } from 'zrender/src/tool/color';
import simplexCuts from './simplexCuts';
import TextureUI from './ui/Texture';
import imageCuts from './imageCuts';
import * as colorBrewer from 'd3-scale-chromatic';

var brewerMethods = [
    'BrBG', 'PRGn', 'PiYG', 'PuOr', 'RdBu', 'RdGy', 'RdYlBu', 'RdYlGn', 'Spectral',
    'Viridis', 'Inferno', 'Magma', 'Plasma', 'Warm', 'Cool', 'Rainbow', 'YlGnBu', 'RdPu', 'PuRd',
].map(function (a) {
    return 'interpolate' + a;
});
// var brewerMethods = Object.keys(colorBrewer);

import standardExtCode from './standard_extend.glsl';
Shader.import(standardExtCode);

var shader = new Shader(Shader.source('clay.standard.vertex'), Shader.source('papercut.standard_ext'));

function updateRandomSeed() {
    config.seed = Math.random();
}

var simplexCutsCanvasList = [];
var uploadedImageList = [];

function createDefaultConfig() {
    var config = {

        seed: Math.random(),

        shadowDirection: [0, 0],
        shadowKernelSize: 16,
        shadowBlurSize: 10,

        cameraPosition: [0, 0],
        cameraDistance: 10,

        paperCount: 5,
        paperAspect: 1,

        randomScale: 3,
        randomOffset: 0.5,
        $randomOffsetRange: [0, 1],

        paperGap: 0.5,
        $paperGapRange: [0, 2],

        paperDetail: './img/paper-detail.png',
        paperDetailTiling: 8,

        layers: []
    };

    for (var i = 0; i < 10; i++) {
        config.layers.push({
            image: '',
            lumCutoff: 0.5,
            inverse: false,
            useImage: false,

            $cutoffRange: [0, 1]
        });
    }
    return config;
}

function createRandomColors() {
    var method = colorBrewer[brewerMethods[Math.round(Math.random() * (brewerMethods.length - 1))]];
    config.layers.forEach(function (layer, idx) {
        layer.color = parse(method(1 - idx / 9)).slice(0, 3);
    });
};

var config = createDefaultConfig();
createRandomColors();

var app = application.create('#main', {

    autoRender: false,

    init: function (app) {
        this._advancedRenderer = new ClayAdvancedRenderer(app.renderer, app.scene, app.timeline, {
            shadow: {
                enable: true
            },
            postEffect: {
                bloom: {
                    enable: false
                },
                screenSpaceAmbientOcclusion: {
                    enable: true,
                    radius: 2,
                    intensity: 1.1,
                    quality: 'high'
                }
            }
        });
        // TODO
        this._advancedRenderer._renderMain._compositor._compositeNode.undefine('TONEMAPPING');

        this._camera = app.createCamera([0, 0, 10], [0, 0, 0]);

        this._dirLight = app.createDirectionalLight([0, 0, 0], '#fff', 0.7);
        this._dirLight.shadowResolution = 1024;
        app.createAmbientLight('#fff', 0.3);

        this._updatePapersCount(app);
        this._updateSimplexCuts();

        this._groundPlane = app.createPlane({
            shader: shader,
            roughness: 1
        });
        this._groundPlane.scale.set(11, 11, 1);

        this._updatePapers();

        app.methods.updateShadow();
        app.methods.updateCamera();
    },

    _updatePapersCount: function (app) {
        this._rootNode = this._rootNode || app.createNode();

        var levels = Math.max(Math.min(Math.round(config.paperCount), 10), 1);
        var children = this._rootNode.children();

        for (var i = 0; i < levels; i++) {
            if (!children[i]) {
                var paper = app.createPlane({
                    shader: shader,
                    diffuseMap: util.texture.createBlank(),
                    roughness: 1,
                    alphaCutoff: 0.9
                }, this._rootNode);
                paper.material.define('fragment', 'ALPHA_TEST');
                paper.scale.set(10, 10, 1);
            }
            else {
                children[i].invisible = false;
            }
        }
        for (var i = levels; i < children.length; i++) {
            children[i].invisible = true;
        }

        app.methods.changePaperDetailTexture();
    },

    _updateSimplexCuts: function () {
        simplexCutsCanvasList = simplexCuts(config, config.seed);

        simplexCutsCanvasList.forEach(function (canvas, idx) {
            var diffuseMap = this._rootNode.childAt(idx).material.get('diffuseMap');
            if (!uploadedImageList[idx]) {
                diffuseMap.image = canvas;
                diffuseMap.dirty();
            }
        }, this);
    },

    _updatePapers: function () {
        var children = this._rootNode.children();
        var gap = config.paperGap + 0.1;
        children.forEach(function (child, idx) {
            child.position.z = -idx * gap;
            child.scale.x = 10 * config.paperAspect;
            if (!(uploadedImageList[idx] && config.layers[idx].useImage)) {
                child.material.set('color', stringify(config.layers[idx].color, 'rgb'));
            }
            child.material.set('detailMapTiling', [config.paperDetailTiling, config.paperDetailTiling]);
        });
        this._groundPlane.position.z = -config.paperCount * gap;
        this._groundPlane.scale.x = 11 * config.paperAspect;
        this._groundPlane.material.set('color', stringify(config.layers[
            Math.min(config.paperCount, config.layers.length - 1)
        ].color, 'rgb'));
        this._groundPlane.material.set('detailMapTiling', [config.paperDetailTiling, config.paperDetailTiling]);

        this._advancedRenderer.render();
    },

    loop: function () {},

    methods: {
        render: function () {
            this._advancedRenderer.render();
        },

        updateShadow: function () {
            var x = -config.shadowDirection[0];
            var y = -config.shadowDirection[1];
            var lightDir = new Vector3(x, y, 1).normalize();
            var normal = Vector3.POSITIVE_Z;
            var ndl = Vector3.dot(lightDir, normal);
            this._dirLight.intensity = 0.7 / ndl;

            this._dirLight.position.set(x, y, 1);
            this._dirLight.lookAt(Vector3.ZERO, Vector3.UP);
            this._advancedRenderer.setShadow({
                kernelSize: config.shadowKernelSize,
                blurSize: Math.max(config.shadowBlurSize, 1)
            });
            this._advancedRenderer.render();
        },

        updateCamera: function () {
            // TODO RESET CAMERA
            var z = config.cameraDistance;
            var x = config.cameraPosition[0] * z;
            var y = config.cameraPosition[1] * z;

            this._camera.position.set(x, y, z);
            this._camera.lookAt(Vector3.ZERO, Vector3.UP);

            this._advancedRenderer.render();
        },

        changeLevels: function (app) {
            this._updatePapersCount(app);
            this._updateSimplexCuts();
            this._updatePapers();
        },

        updateSimplexCuts: function () {
            this._updateSimplexCuts();
            this._updatePapers();
        },

        updatePapers: function () {
            this._updatePapers();
        },

        changePaperCutImage: function (app, idx) {
            var self = this;
            var child = this._rootNode.childAt(idx);
            if (!child) {
                return;
            }

            var diffuseTexture = child.material.get('diffuseMap');

            var uploadedImage = uploadedImageList[idx];
            var layer = config.layers[idx];
            var src = layer.image;

            if (layer.useImage) {
                child.material.set('color', '#fff');
            }
            else {
                child.material.set('color', stringify(layer.color, 'rgb'));
            }

            if (!src || src === 'none') {
                diffuseTexture.image = simplexCutsCanvasList[idx];
                diffuseTexture.dirty();
                uploadedImageList[idx] = null;

                self._advancedRenderer.render();
            }
            if (!uploadedImage) {
                uploadedImage = new Image();
            }

            function doCut() {
                var canvas = imageCuts(
                    uploadedImage, layer.lumCutoff, layer.inverse, !layer.useImage
                );
                diffuseTexture.image = canvas;
                diffuseTexture.dirty();

                self._advancedRenderer.render();
            }
            if (uploadedImage.src === src && uploadedImage.width) {
                doCut();
                return;
            }
            uploadedImage.onload = function () {
                doCut();
            };
            uploadedImage.src = src;

            uploadedImageList[idx] = uploadedImage;
        },

        changePaperDetailTexture: function (app) {
            var self = this;
            function setDetailTexture(detailTexture) {
                self._rootNode.eachChild(function (mesh) {
                    if (mesh.material) {
                        mesh.material.set('detailMap', detailTexture);
                    }
                });
                self._groundPlane.material.set('detailMap', detailTexture);

                self._advancedRenderer.render();
            }
            if (config.paperDetail && config.paperDetail !== 'none') {
                app.loadTexture(config.paperDetail, {
                    convertToPOT: true
                }).then(setDetailTexture);
            }
            else {
                setDetailTexture(null);
            }
        }
    }
});

var controlKit = new ControlKit({
    loadAndSave: false,
    useExternalStyle: true
});

var scenePanel = controlKit.addPanel({ label: 'Settings', width: 250 });

scenePanel.addGroup({ label: 'Papers' })
    .addNumberInput(config, 'paperCount', { label: 'Levels', onFinish: app.methods.changeLevels, step: 1, min: 0 })
    .addNumberInput(config, 'paperAspect', { label: 'Aspect', onChange: app.methods.updatePapers, step: 0.1, min: 0 })
    .addSlider(config, 'paperGap', '$paperGapRange', { label: 'Gap', onChange: app.methods.updatePapers })
    .addCustomComponent(TextureUI, config, 'paperDetail', { label: 'Detail', onChange: app.methods.changePaperDetailTexture })
    .addNumberInput(config, 'paperDetailTiling', { label: 'Tiling', onChange: app.methods.updatePapers, step: 0.5, min: 0 });

scenePanel.addGroup({ label: 'Random Generate' })
    .addNumberInput(config, 'randomScale', { label: 'Scale', onFinish: app.methods.updateSimplexCuts, step: 1, min: 0 })
    .addSlider(config, 'randomOffset', '$randomOffsetRange', { label: 'Offset', onFinish: app.methods.updateSimplexCuts })
    .addButton('Generate', function () {
        updateRandomSeed();
        app.methods.changeLevels();
    });

scenePanel.addGroup({ label: 'Shadow', enable: false })
    .addPad(config, 'shadowDirection', { label: 'Direction', onChange: app.methods.updateShadow })
    .addNumberInput(config, 'shadowBlurSize', { label: 'Blur Size', onChange: app.methods.updateShadow, step: 0.5, min: 0 });

scenePanel.addGroup({ label: 'Camera', enable: false })
    .addPad(config, 'cameraPosition', { label: 'Position', onChange: app.methods.updateCamera })
    .addNumberInput(config, 'cameraDistance', { label: 'Distance', onChange: app.methods.updateCamera, step: 0.5, min: 0 });

var colorGroup = scenePanel.addGroup({ label: 'Layer Colors' });
colorGroup.addButton('Generate Colors', function () {
    createRandomColors();
    app.methods.updatePapers();
    controlKit.update();
});
for (var i = 0; i < config.layers.length; i++) {
    colorGroup.addColor(config.layers[i], 'color', { label: 'Layer ' + (i + 1), colorMode: 'rgb', onChange: app.methods.updatePapers  });
}
colorGroup.addButton('Revert Colors', function () {
    var colors = config.layers.map(function (layer) {
        return layer.color;
    }).reverse();
    config.layers.forEach(function (layer, idx) {
        layer.color = colors[idx];
    });
    app.methods.updatePapers();
    controlKit.update();
});

function createOnChangeFunction(idx) {
    return function () {
        app.methods.changePaperCutImage(idx);
    };
}

var imageGroup = scenePanel.addGroup({ label: 'Layer Images' });
for (var i = 0; i < config.layers.length; i++) {
    var onChange = createOnChangeFunction(i);
    imageGroup.addSubGroup({ label: 'Layer ' + (i + 1), enable: i < 5 })
        .addCustomComponent(TextureUI, config.layers[i], 'image', { label: 'Image', onChange: onChange })
        .addSlider(config.layers[i], 'lumCutoff', '$cutoffRange', { label: 'Cutoff', onFinish: onChange })
        .addCheckbox(config.layers[i], 'inverse', { label: 'Inverse', onChange: onChange})
        .addCheckbox(config.layers[i], 'useImage', { label: 'Use Image', onChange: onChange});
}

window.addEventListener('resize', function () { app.resize(); app.methods.render(); } );

document.getElementById('loading').style.display = 'none';