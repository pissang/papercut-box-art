import ClayAdvancedRenderer from 'claygl-advanced-renderer';
import { application, Vector3, util, Shader } from 'claygl';
import { lerp, parse, stringify } from 'zrender/src/tool/color';
import simplexCuts from './simplexCuts';
import TextureUI from './ui/Texture';
import imageCuts from './imageCuts';

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

        randomScale: 5,

        paperGap: 0.5,
        $paperGapRange: [0, 1],

        // paperColor0: '#f00',
        // paperColor1: '#b00',
        // paperColor2: '#900',

        paperDetail: './img/free-vector-watercolor-paper-texture.jpg',
        paperDetailTiling: 5,

        layers: []
    };

    for (var i = 0; i < 10; i++) {
        config.layers.push({
            image: '',
            color: parse(lerp(i / 9, ['#f00', '#900', '#300'])).slice(0, 3),
            lumCutoff: 0.5,
            inverse: false,
            useImage: false,

            $cutoffRange: [0, 1]
        });
    }
    return config;
}

var config = createDefaultConfig();

var app = application.create('#main', {

    autoRender: false,

    init: function (app) {
        this._advancedRenderer = new ClayAdvancedRenderer(app.renderer, app.scene, app.timeline, {
            shadow: {
                enable: true
            },
            postEffect: {
                screenSpaceAmbientOcclusion: {
                    enable: true,
                    radius: 2,
                    intensity: 1.1,
                    quality: 'high'
                }
            }
        });

        this._camera = app.createCamera([0, 0, 10], [0, 0, 0]);

        this._dirLight = app.createDirectionalLight([0, 0, 0], '#fff', 1);
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
            if (!(uploadedImageList[idx] && config.layers[idx].useImage)) {
                child.material.set('color', stringify(config.layers[idx].color, 'rgb'));
            }
            child.material.set('detailMapTiling', [config.paperDetailTiling, config.paperDetailTiling]);
        });
        this._groundPlane.position.z = -config.paperCount * gap;
        this._groundPlane.material.set('color', stringify(config.layers[config.layers.length - 1].color, 'rgb'));
        this._groundPlane.material.set('detailMapTiling', [config.paperDetailTiling, config.paperDetailTiling]);

        this._advancedRenderer.render();
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
                if (layer.useImage) {
                    child.material.set('color', '#fff');
                }
                else {
                    child.material.set('color', stringify(layer.color, 'rgb'));
                }
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
    .addSlider(config, 'paperGap', '$paperGapRange', { label: 'Gap', onChange: app.methods.updatePapers })
    .addCustomComponent(TextureUI, config, 'paperDetail', { label: 'Detail', onChange: app.methods.changePaperDetailTexture })
    .addNumberInput(config, 'paperDetailTiling', { label: 'Tiling', onChange: app.methods.updatePapers, step: 0.5, min: 0 });

scenePanel.addGroup({ label: 'Random Generate' })
    .addNumberInput(config, 'randomScale', { label: 'Scale', onFinish: app.methods.updateSimplexCuts, step: 1, min: 0 })
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

var group = scenePanel.addGroup({ label: 'Layers' });
function createOnChangeFunction(idx) {
    return function () {
        app.methods.changePaperCutImage(idx);
    };
}
for (var i = 0; i < config.layers.length; i++) {
    var onChange = createOnChangeFunction(i);
    group.addSubGroup({ label: 'Layer ' + (i + 1), enable: i < 5 })
        .addColor(config.layers[i], 'color', { label: 'Color', colorMode: 'rgb', onChange: app.methods.updatePapers })
        .addCustomComponent(TextureUI, config.layers[i], 'image', { label: 'Image', onChange: onChange })
        .addSlider(config.layers[i], 'lumCutoff', '$cutoffRange', { label: 'Cutoff', onChange: onChange })
        .addCheckbox(config.layers[i], 'inverse', { label: 'Inverse', onChange: onChange})
        .addCheckbox(config.layers[i], 'useImage', { label: 'Use Image', onChange: onChange});
}

window.addEventListener('resize', function () { app.resize(); app.methods.render(); } );

document.getElementById('loading').style.display = 'none';