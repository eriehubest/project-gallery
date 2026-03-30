import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { DRACOLoader } from "three/examples/jsm/Addons.js";
import { KTX2Loader } from "three/examples/jsm/Addons.js";
import * as THREE from 'three/webgpu'
import Experience from "../Experience";

export default class ResourceLoader {
    constructor() {
        this.experience = Experience.getInstance()
        this.loaders = new Map();
        this.cache = new Map();
    }

    getLoader(_type) {
        if (this.loaders.has(_type))
            return this.loaders.get(_type);

        let loader = null

        /**
         * Format should either be:
         * 'texture'
         * 'gltf'
         * 'draco'
         */
        if (_type === 'texture') {
            loader = new THREE.TextureLoader();
        }
        else if (_type === 'textureKtx') {
            loader = new KTX2Loader()
            loader.setTranscoderPath('/basis/')
            loader.detectSupport(this.experience.rendering.renderer)
        }
        else if (_type === 'draco') {
            loader = new DRACOLoader()
            loader.setDecoderPath('/draco/')
            loader.preload();
        }
        else if (_type === 'gltf') {
            const dracoLoader = this.getLoader('draco')

            const ktx2Loader = this.getLoader('textureKtx')
            
            loader = new GLTFLoader()
            loader.setDRACOLoader(dracoLoader)
            loader.setKTX2Loader(ktx2Loader)
        }

        this.loaders.set(_type, loader)
        return loader;
    }

    fixGltfColorSpaces(_resource) {
        if (!_resource?.scene)
            return

        _resource.scene.traverse((child) => {
            if (!child.isMesh)
                return

            const materials = Array.isArray(child.material) ? child.material : [child.material]

            for (const material of materials) {
                if (!material)
                    continue

                if (material.map) {
                    material.map.colorSpace = THREE.SRGBColorSpace
                    material.map.needsUpdate = true
                }

                if (material.emissiveMap) {
                    material.emissiveMap.colorSpace = THREE.SRGBColorSpace
                    material.emissiveMap.needsUpdate = true
                }

                material.needsUpdate = true
            }
        })
    }

    load(_files, _progressCallback = null) {
        return new Promise((resolve, reject) => {
            let toLoad = _files.length
            let loadedCount = 0
            const loadedResources = {}

            // Progress
            const progress = () => {
                toLoad--
                loadedCount++

                if (typeof _progressCallback === 'function')
                    _progressCallback({
                        loaded: loadedCount,
                        total: _files.length,
                        progress: _files.length === 0 ? 1 : loadedCount / _files.length
                    })

                if (toLoad === 0)
                    resolve(loadedResources)
            }

            // Save
            const save = (_file, _resource) => {
                if (_file[2] === 'gltf')
                    this.fixGltfColorSpaces(_resource)

                // Apply modifier
                if (typeof _file[3] !== 'undefined')
                    _file[3](_resource)

                // Save in resources object
                loadedResources[_file[0]] = _resource

                // Save in cache
                this.cache.set(_file[1], _resource)
            }

            // Error
            // Each file
            for (const _file of _files) {
                // In cache
                if (this.cache.has(_file[1])) {
                    // Save cached file directly in resources object
                    loadedResources[_file[0]] = this.cache.get(_file[1])

                    progress()
                }

                // Not in cache
                else {
                    const loader = this.getLoader(_file[2])
                    loader.load(
                        _file[1],
                        resource => {
                            save(_file, resource)
                            progress()
                        },
                        undefined,
                        loadError => {
                            console.error(`Resources > Couldn't load file ${_file[1]}`, loadError)
                            reject(loadError ?? new Error(`Couldn't load file ${_file[1]}`))
                        }
                    )
                }
            }
        })
    }
}
