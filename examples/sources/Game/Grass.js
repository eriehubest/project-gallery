import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class Grass
{
    constructor()
    {
        this.game = Game.getInstance()

        this.size = 57
        this.spacing = 0.36
        this.jitter = 0.5
        this.baseWidth = 0.40
        this.baseHeight = 0.28
        this.wobbleAmplitude = 0.065
        this.wobbleSpeed = 1.61
        this.wobbleTravel = 0.3
        this.clearRadius = 2.07
        this.trailHistoryStart = 0
        this.trailHistoryEnd = 0.93

        this.items = this.createItems()
        this.setGeometry()
        this.setMaterial()
        this.setMesh()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 20)

        // Debug
        if (this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: `Grass`,
                expanded: false
            })

            this.debugPanel.addBinding(this, 'size', { min: 10, max: 160, step: 1 })
                .on('change', () => this.rebuild())
            this.debugPanel.addBinding(this, 'spacing', { min: 0.2, max: 2, step: 0.01 })
                .on('change', () => this.rebuild())
            this.debugPanel.addBinding(this, 'jitter', { min: 0, max: 1, step: 0.01 })
                .on('change', () => this.rebuild())
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

    rebuild()
    {
        this.items = this.createItems()

        if (this.mesh)
        {
            this.game.scene.remove(this.mesh)
        }

        this.setMesh()
    }

    createItems()
    {
        const items = []
        const halfSize = this.size * 0.5
        const terrain = this.game.world?.terrain

        for(let x = -halfSize; x <= halfSize; x += this.spacing)
        {
            for(let z = -halfSize; z <= halfSize; z += this.spacing)
            {
                const worldX = x
                const worldZ = z
                const grassSample = terrain?.getGrassSample(worldX, worldZ)

                if(!grassSample?.visible)
                    continue

                const jitterStrength = THREE.MathUtils.lerp(0.4, 1.15, grassSample.darkness)
                const localJitter = this.jitter * jitterStrength
                const jitteredX = worldX + (Math.random() - 0.5) * localJitter
                const jitteredZ = worldZ + (Math.random() - 0.5) * localJitter
                const jitteredSample = terrain?.getGrassSample(jitteredX, jitteredZ) ?? grassSample
                const elevation = terrain?.getWorldElevation(jitteredX, jitteredZ, this.game.ticker?.elapsed ?? 0) ?? 0
                const scale = THREE.MathUtils.lerp(0.8, 1.4, jitteredSample.darkness)

                items.push({
                    x: jitteredX,
                    y: elevation * 0.2,
                    z: jitteredZ,
                    scale: scale + Math.random() * 0.32,
                    heightScale: jitteredSample.heightScale,
                    rotationY: Math.random() * Math.PI / 3,
                    phase: Math.random() * Math.PI * 2,
                    wobbleStrength: 0.7 + jitteredSample.gradient * 0.35 + Math.random() * 0.15,
                    color: new THREE.Color().lerpColors(
                        new THREE.Color('#214010'),
                        new THREE.Color('#8ebf43'),
                        THREE.MathUtils.clamp(1 - jitteredSample.darkness * 0.75 + Math.random() * 0.08, 0, 1)
                    )
                })
            }
        }

        return items
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
            vertexColors: true
        })
    }

    setMesh()
    {
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.items.length)
        this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

        for(let i = 0; i < this.items.length; i++)
            this.mesh.setColorAt(i, this.items[i].color)

        this.mesh.instanceColor.needsUpdate = true
        this.mesh.castShadow = false
        this.mesh.receiveShadow = true
        this.mesh.frustumCulled = false
        this.game.scene.add(this.mesh)

        this.update()
    }

    getHeightScale(distanceSquared, clearRadiusSquared, baseHeightScale, strength = 1)
    {
        if(distanceSquared > clearRadiusSquared)
            return baseHeightScale

        const clearedHeightScale = (clearRadiusSquared - distanceSquared) < (clearRadiusSquared * 2 / 3)
            ? distanceSquared / clearRadiusSquared
            : 0

        return THREE.MathUtils.lerp(baseHeightScale, clearedHeightScale, strength)
    }

    update()
    {
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

        for(let i = 0; i < this.items.length; i++)
        {
            const item = this.items[i]
            const wobbleBase = time + item.phase + item.x * this.wobbleTravel + item.z * this.wobbleTravel * 0.7
            const rotationX = Math.sin(wobbleBase) * this.wobbleAmplitude * item.wobbleStrength
            const rotationZ = Math.cos(wobbleBase * 1.17) * this.wobbleAmplitude * 0.7 * item.wobbleStrength
            let heightScale = item.heightScale

            for(let trailIndex = trailStartIndex; trailIndex < trailEndIndex; trailIndex++)
            {
                const trailPosition = trailPositions[trailIndex]

                if(!trailPosition)
                    continue

                const distanceSquared = (item.x - trailPosition.x) ** 2 + (item.z - trailPosition.z) ** 2
                heightScale = Math.min(heightScale, this.getHeightScale(distanceSquared, clearRadiusSquared, item.heightScale, 1))

                if(heightScale === 0)
                    break
            }

            dummy.position.set(item.x, item.y, item.z)
            dummy.rotation.set(baseRotationX + rotationX, baseRotationY + item.rotationY, rotationZ)
            dummy.scale.set(item.scale, item.scale * heightScale, item.scale)
            dummy.updateMatrix()
            this.mesh.setMatrixAt(i, dummy.matrix)
        }

        this.mesh.instanceMatrix.needsUpdate = true
    }
}
