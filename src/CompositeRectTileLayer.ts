/// <reference types="pixi.js" />

module PIXI.tilemap {
    export class CompositeRectTileLayer extends PIXI.Container {
        constructor(zIndex?: number, bitmaps?: Array<Texture>, useSquare?: boolean, texPerChild?: number) {
            super();
            this.initialize.apply(this, arguments);
        }

        updateTransform() {
            super.displayObjectUpdateTransform()
        }

        z: number;
        zIndex: number;
        useSquare: boolean;
        shadowColor = new Float32Array([0.0, 0.0, 0.0, 0.5]);
        texPerChild: number;
        modificationMarker = 0;
        _globalMat: PIXI.Matrix = null;
        _tempScale: Array<number> = null;

        initialize(zIndex?: number, bitmaps?: Array<Texture>, useSquare?: boolean, texPerChild?: number) {
            this.z = this.zIndex = zIndex;
            this.useSquare = useSquare;
            this.texPerChild = texPerChild || 16;
            if (bitmaps) {
                this.setBitmaps(bitmaps);
            }
        }

        setBitmaps(bitmaps: Array<Texture>) {
            var texPerChild = this.texPerChild;
            var len1 = this.children.length;
            var len2 = Math.ceil(bitmaps.length / texPerChild);
            var i: number;
            for (i = 0; i < len1; i++) {
                (this.children[i] as RectTileLayer).textures = bitmaps.slice(i * texPerChild, (i + 1) * texPerChild);
            }
            for (i = len1; i < len2; i++) {
                this.addChild(new RectTileLayer(this.zIndex, bitmaps.slice(i * texPerChild, (i + 1) * texPerChild)));
            }
        }

        clear() {
            for (var i = 0; i < this.children.length; i++)
                (this.children[i] as RectTileLayer).clear();
            this.modificationMarker = 0;
        }

        addRect(num: number, u: number, v: number, x: number, y: number, tileWidth: number, tileHeight: number) {
            if (this.children[num] && (this.children[num] as RectTileLayer).textures)
                (this.children[num] as RectTileLayer).addRect(0, u, v, x, y, tileWidth, tileHeight);
        }

        addFrame(texture_: PIXI.Texture | String, x: number, y: number, animX: number, animY: number) {
            var texture : PIXI.Texture;
            if (typeof texture_ === "string") {
                texture = PIXI.Texture.fromImage(texture_);
            } else {
                texture = texture_ as PIXI.Texture
            }

            var children = this.children;
            var layer : RectTileLayer = null, ind = 0;
            for (var i = 0; i < children.length; i++) {
                var child = children[i] as RectTileLayer;
                var tex = child.textures;
                for (var j = 0; j < tex.length; j++) {
                    if (tex[j].baseTexture == texture.baseTexture) {
                        layer = child;
                        ind = j;
                        break;
                    }
                }
                if (layer) {
                    break;
                }
            }
            if (!layer) {
                for (i = 0; i < children.length; i++) {
                    var child = children[i] as RectTileLayer;
                    if (child.textures.length < 16) {
                        layer = child;
                        ind = child.textures.length;
                        child.textures.push(texture);
                    }
                }
                if (!layer) {
                    children.push(layer = new RectTileLayer(this.zIndex, texture));
                    ind = 0;
                }
            }
            layer.addRect(ind, texture.frame.x, texture.frame.y, x, y, texture.frame.width, texture.frame.height, animX, animY);
            return true;
        };

        renderCanvas(renderer: CanvasRenderer) {
            if (!renderer.plugins.tilemap.dontUseTransform) {
                var wt = this.worldTransform;
                renderer.context.setTransform(
                    wt.a,
                    wt.b,
                    wt.c,
                    wt.d,
                    wt.tx * renderer.resolution,
                    wt.ty * renderer.resolution
                );
            }
            var layers = this.children;
            for (var i = 0; i < layers.length; i++)
                layers[i].renderCanvas(renderer);
        };

        renderWebGL(renderer: WebGLRenderer) {
            var gl = renderer.gl;
            var shader = renderer.plugins.tilemap.getShader(this.useSquare);
            renderer.setObjectRenderer(renderer.plugins.tilemap);
            renderer.bindShader(shader);
            //TODO: dont create new array, please
            this._globalMat = this._globalMat || new PIXI.Matrix();
            renderer._activeRenderTarget.projectionMatrix.copy(this._globalMat).append(this.worldTransform);
            shader.uniforms.projectionMatrix = this._globalMat.toArray(true);
            shader.uniforms.shadowColor = this.shadowColor;
            if (this.useSquare) {
                var tempScale = this._tempScale = (this._tempScale || [0, 0]);
                tempScale[0] = this._globalMat.a >= 0 ? 1 : -1;
                tempScale[1] = this._globalMat.d < 0 ? 1 : -1;
                var ps = shader.uniforms.pointScale = tempScale;
                shader.uniforms.projectionScale = Math.abs(this.worldTransform.a) * renderer.resolution;
            }
            var af = shader.uniforms.animationFrame = renderer.plugins.tilemap.tileAnim;
            //shader.syncUniform(shader.uniforms.animationFrame);
            var layers = this.children;
            for (var i = 0; i < layers.length; i++)
                (layers[i] as RectTileLayer).renderWebGL(renderer, this.useSquare);
        }

        isModified(anim: boolean) {
            var layers = this.children;
            if (this.modificationMarker != layers.length) {
                return true;
            }
            for (var i = 0; i < layers.length; i++) {
                const layer = layers[i] as RectTileLayer;
                if (layer.modificationMarker != layer.pointsBuf.length ||
                    anim && layer.hasAnim) {
                    return true;
                }
            }
            return false;
        }

        clearModify() {
            var layers = this.children;
            this.modificationMarker = layers.length;
            for (var i = 0; i < layers.length; i++) {
                const layer = layers[i] as RectTileLayer;
                layer.modificationMarker = layer.pointsBuf.length;
            }
        }

    }
}
