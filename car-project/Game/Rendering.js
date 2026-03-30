import * as THREE from 'three/webgpu'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { Game } from './Game'
import { pass, renderOutput } from 'three/tsl'
import { cheapDOF } from './Passes/cheapDOF.js'

export class Rendering {
    constructor() {
        this.game = Game.getInstance()
        this.usePostprocessing = true

        if (this.game.debug.active) {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: `Rendering`,
                expanded: false
            })
        }
    }

    start() {
        this.game.ticker.events.on('tick', () => {
            this.render()
        }, 998)

        this.game.viewport.events.on('change', () => {
            this.resize()
        })
    }

    async setRenderer() {
        this.renderer = new THREE.WebGPURenderer({ canvas: this.game.canvasElement, powerPreference: 'high-performance', forceWebGL: false, antialias: this.game.viewport.ratio < 2 })
        this.renderer.setSize(this.game.viewport.width, this.game.viewport.height);
        this.renderer.setPixelRatio(this.game.viewport.pixelRatio);
        this.renderer.sortObjects = true
        this.renderer.domElement.classList.add('experience')
        this.renderer.shadowMap.enabled = true;

        this.renderer.setAnimationLoop((elapsedTime) => { this.game.ticker.update(elapsedTime) })

        return this.renderer.init();
    }

    setPostprocessing() {
        this.postProcessing = new THREE.RenderPipeline(this.renderer)

        const scenePass = pass(this.game.scene, this.game.view.camera)
        const scenePassColor = scenePass.getTextureNode('output')

        this.bloomPass = bloom(scenePassColor)
        this.bloomPass._nMips = this.game.quality.level === 0 ? 5 : 2
        this.bloomPass.threshold.value = 1
        this.bloomPass.strength.value = 0.25
        this.bloomPass.smoothWidth.value = 1

        this.cheapDOFPass = cheapDOF(renderOutput(scenePass))

        const qualityChange = (level) =>
        {
            if(level === 0)
                this.postProcessing.outputNode = this.cheapDOFPass.add(this.bloomPass)
            else
                this.postProcessing.outputNode = scenePassColor.add(this.bloomPass)

            this.postProcessing.needsUpdate = true
        }

        qualityChange(this.game.quality.level)
        this.game.quality.events.on('change', qualityChange)

        if (this.game.debug.active) {
            this.debugPanel.addBinding(this, 'usePostprocessing', { label: 'postprocessing' })

            const bloomPanel = this.debugPanel.addFolder({
                title: 'bloom',
                expanded: false,
            })

            bloomPanel.addBinding(this.bloomPass.threshold, 'value', { label: 'threshold', min: 0, max: 2, step: 0.01 })
            bloomPanel.addBinding(this.bloomPass.strength, 'value', { label: 'strength', min: 0, max: 3, step: 0.01 })
            bloomPanel.addBinding(this.bloomPass.radius, 'value', { label: 'radius', min: 0, max: 1, step: 0.01 })
            bloomPanel.addBinding(this.bloomPass.smoothWidth, 'value', { label: 'smoothWidth', min: 0, max: 1, step: 0.01 })

            const blurPanel = this.debugPanel.addFolder({
                title: 'blur',
                expanded: false,
            })

            blurPanel.addBinding(this.cheapDOFPass.strength, 'value', { label: 'strength', min: 0, max: 3, step: 0.01 })
        }
    }

    resize() 
    {
        this.renderer.setSize(this.game.viewport.width, this.game.viewport.height);
        this.renderer.setPixelRatio(this.game.viewport.pixelRatio);
    }

    async render()
    {
        if(this.usePostprocessing && this.postProcessing)
            this.postProcessing.render()
        else if(this.game.view?.camera)
            this.renderer.render(this.game.scene, this.game.view.camera)
    }
}
