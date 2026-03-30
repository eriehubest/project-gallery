import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class MobileGrassPlane
{
    constructor()
    {
        this.game = Game.getInstance()

        this.renderRadius = 20
        this.spacing = 0.36
        this.jitter = 0.86
        this.baseWidth = 0.34
        this.baseHeight = 0.27
        this.wobbleAmplitude = 0.104
        this.wobbleSpeed = 1.17
        this.wobbleTravel = 0.3
        this.clearRadius = 1.84
        this.trailHistoryStart = 0
        this.trailHistoryEnd = 0.93
        this.clampStep = 0.04
        this.centerSnapStep = 5
        this.fadeRingSize = 4
        this.centerX = null
        this.centerZ = null
        this.items = []

        this.setGeometry()
        this.setMaterial()
        this.rebuild(true)

        this.game.ticker.events.on('tick', () =>
        {
            this.refreshArea()
            this.update()
        }, 20)

        if (this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: 'MobileGrass',
                expanded: false
            })

            this.debugPanel.addBinding(this, 'renderRadius', { min: 4, max: 40, step: 0.1 })
                .on('change', () => this.rebuild(true))
            this.debugPanel.addBinding(this, 'spacing', { min: 0.2, max: 2, step: 0.01 })
                .on('change', () => this.rebuild(true))
            this.debugPanel.addBinding(this, 'jitter', { min: 0, max: 1, step: 0.01 })
                .on('change', () => this.rebuild(true))
            this.debugPanel.addBinding(this, 'baseWidth', { min: 0.05, max: 1.5, step: 0.01 })
                .on('change', () => this.rebuildGeometry())
            this.debugPanel.addBinding(this, 'baseHeight', { min: 0.1, max: 2, step: 0.01 })
                .on('change', () => this.rebuildGeometry())
            this.debugPanel.addBinding(this, 'wobbleAmplitude', { min: 0, max: 0.4, step: 0.001 })
            this.debugPanel.addBinding(this, 'wobbleSpeed', { min: 0, max: 4, step: 0.01 })
            this.debugPanel.addBinding(this, 'wobbleTravel', { min: 0, max: 0.3, step: 0.001 })
            this.debugPanel.addBinding(this, 'clearRadius', { min: 0, max: 8, step: 0.01 })
            this.debugPanel.addBinding(this, 'trailHistoryStart', { min: 0, max: 1, step: 0.01 })
            this.debugPanel.addBinding(this, 'trailHistoryEnd', { min: 0, max: 1, step: 0.01 })
            this.debugPanel.addBinding(this, 'clampStep', { min: 0.01, max: 0.5, step: 0.01 })
                .on('change', () => this.rebuild(true))
            this.debugPanel.addBinding(this, 'centerSnapStep', { min: 0.5, max: 10, step: 0.5 })
                .on('change', () => this.rebuild(true))
            this.debugPanel.addBinding(this, 'fadeRingSize', { min: 0.1, max: 4, step: 0.1 })
        }
    }

    setGeometry()
    {
        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
            -this.baseWidth * 0.5, 0, 0,
            this.baseWidth * 0.5, 0, 0,
            0, this.baseHeight, 0
        ], 3))
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute([
            0, 0, 0,
            0, 0, 0,
            1, 1, 1
        ], 3))
        this.geometry.computeVertexNormals()
    }

    setMaterial()
    {
        this.material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            vertexColors: true,
            transparent: true,
            depthWrite: false
        })

        this.material.userData.vehiclePosition = { value: new THREE.Vector3() }
        this.material.userData.fadeStart = { value: Math.max(0, this.renderRadius - this.fadeRingSize) }
        this.material.userData.fadeEnd = { value: this.renderRadius }

        this.material.onBeforeCompile = (shader) =>
        {
            shader.uniforms.uVehiclePosition = this.material.userData.vehiclePosition
            shader.uniforms.uFadeStart = this.material.userData.fadeStart
            shader.uniforms.uFadeEnd = this.material.userData.fadeEnd

            shader.vertexShader = shader.vertexShader
                .replace(
                    '#include <common>',
                    `#include <common>
                    varying vec3 vWorldPosition;`
                )
                .replace(
                    '#include <worldpos_vertex>',
                    `#include <worldpos_vertex>
                    vWorldPosition = worldPosition.xyz;`
                )

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <common>',
                    `#include <common>
                    varying vec3 vWorldPosition;
                    uniform vec3 uVehiclePosition;
                    uniform float uFadeStart;
                    uniform float uFadeEnd;`
                )
                .replace(
                    '#include <dithering_fragment>',
                    `float vehicleDistance = distance(vWorldPosition.xz, uVehiclePosition.xz);
                    float fadeAlpha = 1.0 - smoothstep(uFadeStart, uFadeEnd, vehicleDistance);
                    gl_FragColor.a *= fadeAlpha;
                    #include <dithering_fragment>`
                )
        }
    }

    rebuildGeometry()
    {
        if (this.mesh)
            this.game.scene.remove(this.mesh)

        if (this.geometry)
            this.geometry.dispose()

        this.setGeometry()
        this.setMesh()
    }

    getVehicleCenter()
    {
        const vehiclePosition = this.game.vehicle?.position

        return {
            x: vehiclePosition?.x ?? 0,
            z: vehiclePosition?.z ?? 0
        }
    }

    getSnappedCenter()
    {
        const center = this.getVehicleCenter()

        return {
            x: Math.round(center.x / this.centerSnapStep) * this.centerSnapStep,
            z: Math.round(center.z / this.centerSnapStep) * this.centerSnapStep
        }
    }

    quantize(value, step = this.clampStep)
    {
        return Math.floor(value / step) * step
    }

    createItems(centerX, centerZ)
    {
        const items = []
        const terrain = this.game.world?.terrain
        const radiusSquared = this.renderRadius * this.renderRadius
        const minCellX = Math.floor((centerX - this.renderRadius) / this.spacing)
        const maxCellX = Math.ceil((centerX + this.renderRadius) / this.spacing)
        const minCellZ = Math.floor((centerZ - this.renderRadius) / this.spacing)
        const maxCellZ = Math.ceil((centerZ + this.renderRadius) / this.spacing)

        for (let cellX = minCellX; cellX <= maxCellX; cellX++)
        {
            for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++)
            {
                const x = cellX * this.spacing
                const z = cellZ * this.spacing
                const distanceSquared = (x - centerX) ** 2 + (z - centerZ) ** 2

                if (distanceSquared > radiusSquared)
                    continue

                const grassSample = terrain?.getGrassSample(x, z)

                if (!grassSample?.visible)
                    continue

                const localJitter = this.jitter
                const jitteredX = x + grassSample.offsetX * localJitter
                const jitteredZ = z + grassSample.offsetZ * localJitter

                if (((jitteredX - centerX) ** 2 + (jitteredZ - centerZ) ** 2) > radiusSquared)
                    continue

                const elevation = this.quantize(
                    terrain?.getWorldElevation(jitteredX, jitteredZ, 0) ?? 0
                )
                const scale = this.quantize(
                    THREE.MathUtils.lerp(0.8, 1.4, grassSample.darkness)
                )
                const heightScale = this.quantize(grassSample.heightScale)

                items.push({
                    x: jitteredX,
                    y: elevation,
                    z: jitteredZ,
                    scale: scale + grassSample.scaleMix * 0.32,
                    heightScale: heightScale,
                    rotationY: grassSample.rotationY,
                    phase: grassSample.phase,
                    wobbleStrength: grassSample.wobbleStrength,
                    color: new THREE.Color().lerpColors(
                        new THREE.Color('#b38a2a'),
                        new THREE.Color('#8ac83a'),
                        grassSample.colorMix
                    )
                })
            }
        }

        return items
    }

    setMesh()
    {
        if (this.mesh)
            this.game.scene.remove(this.mesh)

        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.items.length)
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

        for (let i = 0; i < this.items.length; i++)
            this.mesh.setColorAt(i, this.items[i].color)

        if (this.mesh.instanceColor)
            this.mesh.instanceColor.needsUpdate = true

        this.mesh.castShadow = false
        this.mesh.receiveShadow = true
        this.game.scene.add(this.mesh)

        this.update()
    }

    rebuild(force = false)
    {
        const center = this.getSnappedCenter()

        if (!force && center.x === this.centerX && center.z === this.centerZ)
            return

        this.centerX = center.x
        this.centerZ = center.z

        this.items = this.createItems(center.x, center.z)
        this.setMesh()
    }

    refreshArea()
    {
        this.rebuild(false)
    }

    getHeightScale(distanceSquared, clearRadiusSquared, baseHeightScale, strength = 1)
    {
        if (distanceSquared > clearRadiusSquared)
            return baseHeightScale

        const clearedHeightScale = (clearRadiusSquared - distanceSquared) < (clearRadiusSquared * 2 / 3)
            ? distanceSquared / clearRadiusSquared
            : 0

        return THREE.MathUtils.lerp(baseHeightScale, clearedHeightScale, strength)
    }

    update()
    {
        if (!this.mesh || this.items.length === 0)
            return

        const vehicleCenter = this.getVehicleCenter()
        this.material.userData.vehiclePosition.value.set(vehicleCenter.x, 0, vehicleCenter.z)
        this.material.userData.fadeStart.value = Math.max(0, this.renderRadius - this.fadeRingSize)
        this.material.userData.fadeEnd.value = this.renderRadius

        const dummy = new THREE.Object3D()
        const time = this.game.ticker.elapsedScaled * this.wobbleSpeed
        const theta = this.game.view?.spherical?.theta ?? 0
        const phi = this.game.view?.spherical?.phi ?? 0
        const trailPositions = this.game.vehicle?.positionHistory ?? []
        const clearRadiusSquared = this.clearRadius * this.clearRadius
        const baseRotationY = theta
        const baseRotationX = (phi - Math.PI * 0.5) * 0.08
        const trailStartIndex = Math.floor(trailPositions.length * this.trailHistoryStart)
        const trailEndIndex = Math.max(trailStartIndex + 1, Math.ceil(trailPositions.length * this.trailHistoryEnd))

        for (let i = 0; i < this.items.length; i++)
        {
            const item = this.items[i]
            const wobbleBase = time + item.phase + item.x * this.wobbleTravel + item.z * this.wobbleTravel * 0.7
            const rotationX = Math.sin(wobbleBase) * this.wobbleAmplitude * item.wobbleStrength
            const rotationZ = Math.cos(wobbleBase * 1.17) * this.wobbleAmplitude * 0.7 * item.wobbleStrength
            let heightScale = item.heightScale

            for (let trailIndex = trailStartIndex; trailIndex < trailEndIndex; trailIndex++)
            {
                const trailPosition = trailPositions[trailIndex]

                if (!trailPosition)
                    continue

                const distanceSquared = (item.x - trailPosition.x) ** 2 + (item.z - trailPosition.z) ** 2
                heightScale = Math.min(heightScale, this.getHeightScale(distanceSquared, clearRadiusSquared, item.heightScale, 1))

                if (heightScale === 0)
                    break
            }

            dummy.position.set(item.x, 0, item.z)
            dummy.rotation.set(baseRotationX + rotationX, baseRotationY + item.rotationY, rotationZ)
            dummy.scale.set(item.scale, item.scale * heightScale, item.scale)
            dummy.updateMatrix()
            this.mesh.setMatrixAt(i, dummy.matrix)
        }

        this.mesh.instanceMatrix.needsUpdate = true
    }
}
