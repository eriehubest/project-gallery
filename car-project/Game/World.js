import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { Terrain } from './world/Terrain.js'
import { HDRLoader } from 'three/examples/jsm/Addons.js'

export class World {
    constructor() {
        this.game = Game.getInstance()
        this.container = new THREE.Object3D()
        this.offset = new THREE.Vector3(-10, 0, 0)
        this.container.position.copy(this.offset)
        this.game.scene.add(this.container)
        this.game.scene.background = new THREE.Color('#000000')
        this.game.scene.environment = null

        this.rampSize = {
            length: 5,
            height: 3.2,
            width: 11
        }
        this.rampPosition = new THREE.Vector3(10 + 5.5 + this.rampSize.length / 2, 0, 0)
        this.hitObjectRadius = 1
        this.hitObjectPosition = new THREE.Vector3(10, 3, 0)

        const WorldParams = {
            AMBIENTLIGHT_INTENSITY: 0.05,
        }

        const ambientLight = new THREE.AmbientLight('#ffffff', WorldParams.AMBIENTLIGHT_INTENSITY)
        const directionalLight = new THREE.DirectionalLight('#ffffff', 2)
        directionalLight.position.set(-6.25, 3, 4)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.set(1024, 1024)
        directionalLight.shadow.camera.near = 0.1
        directionalLight.shadow.camera.far = 30
        directionalLight.shadow.camera.top = 8
        directionalLight.shadow.camera.right = 8
        directionalLight.shadow.camera.bottom = -8
        directionalLight.shadow.camera.left = -8
        this.container.add(ambientLight, directionalLight)

        // const hdrLoader = new HDRLoader();

        // hdrLoader.load('/background/spruit_sunrise.hdr', (environmentMap) => {
        //     environmentMap.mapping = THREE.EquirectangularReflectionMapping

        //     this.game.scene.background = environmentMap
        //     this.game.scene.backgroundBlurriness = 0.5
        //     this.game.scene.environment = environmentMap
        //     this.game.scene.environmentIntensity = 0.4
        // })

        this.terrainGeometry = new THREE.PlaneGeometry(10, 10, 10)
        this.terrainGeometry.rotateX(-Math.PI / 2)

        this.material = new THREE.MeshBasicMaterial({ color: 'white' })
        // this.game.scene.add(new THREE.Mesh(this.terrainGeometry, this.material))

        this.setTerrain()

        this.game.ticker.events.on('tick', () => {
            this.update()
        }, 10)


        if (this.game.debug.active) {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: 'World',
                expanded: false,
            })

            this.debugPanel.addBinding(ambientLight, 'intensity', { label: 'AmbientLight Intensity', min: 0, max: 3, step: 0.01 })
        }
    }

    setViewChange()
    {
        const basePosition = this.terrain.container.getWorldPosition(new THREE.Vector3())
        this.game.view.addTopViewToggle(new THREE.Vector2(basePosition.x + 7.5, basePosition.z + 7.5), new THREE.Vector2(basePosition.x - 7.5, basePosition.z - 7.5))
    }

    setTerrain() {
        this.terrain = new Terrain();
        this.container.add(this.terrain.container)
    }

    createRampGeometry() {
        const shape = new THREE.Shape()
        shape.moveTo(-this.rampSize.length * 0.5, 0)
        shape.lineTo(this.rampSize.length * 0.5, 0)
        shape.lineTo(-this.rampSize.length * 0.5, this.rampSize.height)
        shape.closePath()

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: this.rampSize.width,
            bevelEnabled: false,
            steps: 1
        })

        geometry.translate(0, 0, -this.rampSize.width * 0.5)
        geometry.computeVertexNormals()

        return geometry
    }

    setRamp() {
        const geometry = this.createRampGeometry()

        this.ramp = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                // color: '#19060a',
                color: '#ffffff',
                // emissive: '#ff2a55',
                // emissiveIntensity: 1,
                // roughness: 0.3,
                // metalness: 0.05,
                transparent: true,
                opacity: 0.2,
                toneMapped: false
            })
        )
        this.ramp.position.copy(this.rampPosition)
        this.ramp.castShadow = true
        this.ramp.receiveShadow = true
        this.container.add(this.ramp)

        const bodyDesc = this.game.RAPIER.RigidBodyDesc.fixed().setTranslation(
            this.rampPosition.x + this.offset.x,
            this.rampPosition.y,
            this.rampPosition.z + this.offset.z
        )
        this.rampBody = this.game.physics.world.createRigidBody(bodyDesc)

        const vertices = new Float32Array(geometry.attributes.position.array)
        const indices = geometry.index
            ? new Uint32Array(geometry.index.array)
            : new Uint32Array(Array.from({ length: vertices.length / 3 }, (_, index) => index))

        const colliderDesc = this.game.RAPIER.ColliderDesc.trimesh(vertices, indices)
        colliderDesc.setFriction(0.9)
        colliderDesc.setRestitution(0.1)
        this.game.physics.world.createCollider(colliderDesc, this.rampBody)
    }

    setHitObject() {
        this.hitObject = new THREE.Mesh(
            new THREE.SphereGeometry(this.hitObjectRadius, 32, 32),
            new THREE.MeshStandardMaterial({
                color: '#f97316',
                emissive: '#7c2d12',
                emissiveIntensity: 0,
                roughness: 0.35,
                metalness: 0.0
            })
        )
        this.hitObject.position.copy(this.hitObjectPosition)
        this.hitObject.castShadow = true
        this.hitObject.receiveShadow = true
        this.container.add(this.hitObject)

        const bodyDesc = this.game.RAPIER.RigidBodyDesc.dynamic().setTranslation(
            this.hitObjectPosition.x + this.offset.x,
            this.hitObjectPosition.y,
            this.hitObjectPosition.z + this.offset.z
        )
        this.hitObjectBody = this.game.physics.world.createRigidBody(bodyDesc)

        const colliderDesc = this.game.RAPIER.ColliderDesc.ball(this.hitObjectRadius)
        colliderDesc.setMass(0.01)
        colliderDesc.setFriction(0.9)
        colliderDesc.setRestitution(1)
        bodyDesc.setLinearDamping(2.5)
        bodyDesc.setAngularDamping(4)
        this.game.physics.world.createCollider(colliderDesc, this.hitObjectBody)
    }

    update() {
        if (!this.hitObject || !this.hitObjectBody)
            return

        this.hitObject.position.copy(this.hitObjectBody.translation())
        this.hitObject.quaternion.copy(this.hitObjectBody.rotation())
    }
}
