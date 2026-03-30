import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { lerp } from './utilities/maths.js'
import { VehicleMaterialsDebug } from './Debug/VehicleMaterialsDebug.js'

export class Vehicle {
    constructor(model) {
        this.game = Game.getInstance()
        this.model = model

        this.floorContact = false
        this.lastJumpInstance = 0;
        this.floorContactWheels = false
        this.isGrounded = false

        this.steeringAmplitude = 0.5
        this.engineForceAmplitude = 300
        this.boostMultiplier = 2
        this.topSpeed = 5
        this.topSpeedBoost = 30
        this.brakeAmplitude = 35
        this.idleBrake = 0.06
        this.reverseBrake = 0.4

        this.position = new THREE.Vector3()
        this.quaternion = new THREE.Quaternion()
        this.velocity = new THREE.Vector3()
        this.forward = new THREE.Vector3(1, 0, 0)
        this.direction = this.forward.clone()
        this.speed = 0
        this.forwardSpeed = 0
        this.goingForward = true
        this.positionHistory = []
        this.positionHistoryMaxLength = 50
        this.lastRecordedPositionKey = ''
        this.wheelTrailHistory = []
        this.wheelTrailHistoryMaxLength = 100
        this.wheelTrailWheelIndexes = [2, 3]
        this.lastWheelTrailKeys = new Map()

        this.setControls()
        this.setPhysics()
        this.setVisual()

        const vehiclePositionDOM = document.querySelector('.game .vehicle-debug')
        const children = vehiclePositionDOM.children

        if (this.game.debug.active) {
            vehiclePositionDOM.classList.remove('hidden')
            vehiclePositionDOM.classList.add('flex')
        }

        this.game.ticker.events.on('tick', () => {
            this.updatePrePhysics()

            children[0].innerHTML = `x: ${this.position.x.toFixed(1)}`
            children[1].innerHTML = `y: ${this.position.y.toFixed(1)}`
            children[2].innerHTML = `z: ${this.position.z.toFixed(1)}`
        }, 2)

        this.game.ticker.events.on('tick', () => {
            this.updatePostPhysics()
            this.updateVisual()
        }, 5)

        addEventListener('keydown', (event) => {
            if (event.code === 'KeyR') {
                this.body.setTranslation(new THREE.Vector3(0, this.game.respawns.items.get('landing').position.y, 0), true)
                this.body.setRotation(new THREE.Quaternion(), true)
                this.body.setLinvel(new THREE.Vector3(0, 0, 0), true)
                this.body.setAngvel(new THREE.Vector3(0, 0, 0), true)
            }
        })
    }

    setControls() {
        this.input = {
            accelerating: 0,
            steering: 0,
            braking: 0,
            boosting: 0
        }
    }

    setPhysics() {
        const spawn = this.game.respawns.getDefault()
        const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn?.rotation ?? 0)

        const rigidBodyDesc = this.game.RAPIER.RigidBodyDesc.dynamic()
        rigidBodyDesc.setTranslation(0, spawn?.position.y ?? 4, 0)
        rigidBodyDesc.setRotation(rotation)
        rigidBodyDesc.setCanSleep(false)
        rigidBodyDesc.setLinearDamping(0.1)
        rigidBodyDesc.setAngularDamping(0.1)

        this.body = this.game.physics.world.createRigidBody(rigidBodyDesc)

        const colliders = [
            // Keep the chassis weight low while leaving it centered between the axles.
            { parameters: [1.3, 0.4, 0.85], position: { x: 0, y: -0.1, z: 0 }, mass: 2.5, centerOfMass: { x: 0, y: -0.55, z: 0 } },
            { parameters: [0.5, 0.15, 0.65], position: { x: 0, y: 0.4, z: 0 }, mass: 0 },
            { parameters: [1.5, 0.5, 0.9], position: { x: 0.1, y: -0.2, z: 0 }, mass: 0 }
        ]

        for (const item of colliders) {
            const colliderDesc = this.game.RAPIER.ColliderDesc.cuboid(...item.parameters)
            colliderDesc.setTranslation(item.position.x, item.position.y, item.position.z)
            colliderDesc.setFriction(0.4)
            colliderDesc.setRestitution(0.15)

            if (item.centerOfMass)
                colliderDesc.setMassProperties(item.mass, item.centerOfMass, { x: 1, y: 1, z: 1 }, new THREE.Quaternion())
            else
                colliderDesc.setMass(item.mass)

            this.game.physics.world.createCollider(colliderDesc, this.body)
        }

        this.controller = this.game.physics.world.createVehicleController(this.body)
        this.setWheelsPhysics()
        this.position.copy(this.body.translation())
        this.quaternion.copy(this.body.rotation())
        this.recordPositionHistory()
    }

    recordPositionHistory() {
        const roundedPosition = {
            x: Math.round(this.position.x * 10) / 10,
            y: Math.round(this.position.y * 10) / 10,
            z: Math.round(this.position.z * 10) / 10
        }
        const key = `${roundedPosition.x},${roundedPosition.y},${roundedPosition.z}`

        if (key === this.lastRecordedPositionKey)
            return

        this.lastRecordedPositionKey = key
        this.positionHistory.unshift(roundedPosition)

        if (this.positionHistory.length > this.positionHistoryMaxLength)
            this.positionHistory.length = this.positionHistoryMaxLength
    }

    recordWheelTrailHistory() {
        for (const wheelIndex of this.wheelTrailWheelIndexes) {
            const wheel = this.wheels.items[wheelIndex]

            if (!wheel?.inContact || !wheel.contactPoint)
                continue

            const roundedPoint = {
                x: Math.round(wheel.contactPoint.x * 10) / 10,
                y: Math.round(wheel.contactPoint.y * 10) / 10,
                z: Math.round(wheel.contactPoint.z * 10) / 10
            }
            const key = `${roundedPoint.x},${roundedPoint.y},${roundedPoint.z}`

            if (this.lastWheelTrailKeys.get(wheelIndex) === key)
                continue

            this.lastWheelTrailKeys.set(wheelIndex, key)
            this.wheelTrailHistory.unshift({
                ...roundedPoint,
                wheelIndex
            })
        }

        if (this.wheelTrailHistory.length > this.wheelTrailHistoryMaxLength)
            this.wheelTrailHistory.length = this.wheelTrailHistoryMaxLength
    }

    setWheelsPhysics() {
        this.wheels = {}
        this.wheels.items = []
        this.wheels.settings = {
            offset: { x: 0.90, y: 0, z: 0.75 },
            radius: 0.4,
            directionCs: { x: 0, y: -1, z: 0 },
            axleCs: { x: 0, y: 0, z: 1 },
            frictionSlip: 0.9,
            maxSuspensionForce: 150,
            maxSuspensionTravel: 2,
            sideFrictionStiffness: 3,
            suspensionCompression: 10,
            suspensionRelaxation: 2.7,
            suspensionStiffness: 25,
        }

        const positions = [
            new THREE.Vector3(this.wheels.settings.offset.x, this.wheels.settings.offset.y, this.wheels.settings.offset.z),
            new THREE.Vector3(this.wheels.settings.offset.x, this.wheels.settings.offset.y, -this.wheels.settings.offset.z),
            new THREE.Vector3(-this.wheels.settings.offset.x, this.wheels.settings.offset.y, this.wheels.settings.offset.z),
            new THREE.Vector3(-this.wheels.settings.offset.x, this.wheels.settings.offset.y, -this.wheels.settings.offset.z),
        ]

        for (let i = 0; i < 4; i++) {
            this.controller.addWheel(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), 1, 1)

            const wheel = {
                basePosition: positions[i].clone(),
                suspensionLength: 0,
                inContact: false,
                contactPoint: null
            }

            this.controller.setWheelDirectionCs(i, this.wheels.settings.directionCs)
            this.controller.setWheelAxleCs(i, this.wheels.settings.axleCs)
            this.controller.setWheelRadius(i, this.wheels.settings.radius)
            this.controller.setWheelChassisConnectionPointCs(i, wheel.basePosition)
            this.controller.setWheelFrictionSlip(i, this.wheels.settings.frictionSlip)
            this.controller.setWheelMaxSuspensionForce(i, this.wheels.settings.maxSuspensionForce)
            this.controller.setWheelMaxSuspensionTravel(i, this.wheels.settings.maxSuspensionTravel)
            this.controller.setWheelSideFrictionStiffness(i, this.wheels.settings.sideFrictionStiffness)
            this.controller.setWheelSuspensionCompression(i, this.wheels.settings.suspensionCompression)
            this.controller.setWheelSuspensionRelaxation(i, this.wheels.settings.suspensionRelaxation)
            this.controller.setWheelSuspensionStiffness(i, this.wheels.settings.suspensionStiffness)

            this.wheels.items.push(wheel)
        }
    }

    setVisual() {
        this.visual = {}
        this.visual.steering = 0
        this.visual.parts = {}
        this.visual.root = this.model.scene
        this.visual.lights = {}

        const searchList = [
            'bodyPainted',
            'chassis',
            'wheelContainer'
        ].map((name) => new RegExp(`^(${name})`, 'i'))

        this.visual.root.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
            }

            if (child.isMesh && child.name === 'wheelSuspension002') {
                const materials = Array.isArray(child.material) ? child.material : [ child.material ]

                for (const material of materials) {
                    if (material?.color?.isColor) {
                        material.color.set('#494949')
                        material.needsUpdate = true
                    }
                }
            }

            for (const search of searchList) {
                const match = child.name.match(search)
                if (match)
                    this.visual.parts[match[0]] = child
            }
        })
        this.visual.chassis = this.visual.parts.chassis || this.visual.root
        this.game.scene.add(this.visual.chassis)

        const headlightSettings = {
            color: '#ffb347',
            intensity: 18,
            distance: 16,
            angle: Math.PI * 0.22,
            penumbra: 0.45,
            decay: 1.6,
            y: 0.28,
            zOffset: 0.38,
            x: 1.55,
            targetX: 7.5,
            targetY: -0.15
        }

        this.visual.lights.headlights = []

        for (const zDirection of [1, -1]) {
            const light = new THREE.SpotLight(
                headlightSettings.color,
                headlightSettings.intensity,
                headlightSettings.distance,
                headlightSettings.angle,
                headlightSettings.penumbra,
                headlightSettings.decay
            )
            const target = new THREE.Object3D()

            light.castShadow = false
            light.position.set(headlightSettings.x, headlightSettings.y, headlightSettings.zOffset * zDirection)
            target.position.set(headlightSettings.targetX, headlightSettings.targetY, headlightSettings.zOffset * zDirection)

            this.visual.chassis.add(light)
            this.visual.chassis.add(target)
            light.target = target

            this.visual.lights.headlights.push({ light, target })
        }

        this.visual.wheels = []
        const template = this.visual.parts.wheelContainer

        if (template) {
            template.visible = false

            for (let i = 0; i < 4; i++) {
                const wheel = {}
                wheel.container = template.clone(true)
                wheel.container.visible = true
                this.visual.chassis.add(wheel.container)

                wheel.container.traverse((child) => {
                    if (child.name.match(/^wheelSuspension/i))
                        wheel.suspension = child
                    if (child.name.match(/^wheelCylinder/i))
                        wheel.cylinder = child
                })

                if (wheel.cylinder)
                    wheel.cylinder.position.set(0, 0, 0)

                if (i === 0 || i === 2)
                    wheel.container.rotation.y = Math.PI

                this.visual.wheels.push(wheel)
            }
        }

        if (this.game.debug.active)
        {
            const headlightDebug = {
                intensity: headlightSettings.intensity,
                distance: headlightSettings.distance,
                angle: headlightSettings.angle,
                penumbra: headlightSettings.penumbra
            }

            this.game.debug.panel.addBinding(headlightDebug, 'intensity', { label: 'headlightIntensity', min: 0, max: 40, step: 0.1 })
                .on('change', ({ value }) => {
                    for (const item of this.visual.lights.headlights)
                        item.light.intensity = value
                })
            this.game.debug.panel.addBinding(headlightDebug, 'distance', { label: 'headlightDistance', min: 1, max: 30, step: 0.1 })
                .on('change', ({ value }) => {
                    for (const item of this.visual.lights.headlights)
                        item.light.distance = value
                })
            this.game.debug.panel.addBinding(headlightDebug, 'angle', { label: 'headlightAngle', min: 0.05, max: Math.PI * 0.5, step: 0.01 })
                .on('change', ({ value }) => {
                    for (const item of this.visual.lights.headlights)
                        item.light.angle = value
                })
            this.game.debug.panel.addBinding(headlightDebug, 'penumbra', { label: 'headlightPenumbra', min: 0, max: 1, step: 0.01 })
                .on('change', ({ value }) => {
                    for (const item of this.visual.lights.headlights)
                        item.light.penumbra = value
                })

            this.materialsDebug = new VehicleMaterialsDebug(this.game, this.visual.root)
        }
    }

    updateControls() {
        const actions = this.game.inputs.actions
        this.input.accelerating = 0
        this.input.steering = 0
        this.input.braking = actions.get('brake')?.active ? 1 : 0
        this.input.boosting = actions.get('boost')?.active ? 1 : 0

        if (actions.get('forward')?.active)
        {
            this.game.view.pan.vehicleTarget = true;
            this.input.accelerating += 1
        }
        if (actions.get('backward')?.active)
        {
            this.game.view.pan.vehicleTarget = true;
            this.input.accelerating -= 1
        }
        if (actions.get('left')?.active)
        {
            this.game.view.pan.vehicleTarget = true;
            this.input.steering += 1
        }
        if (actions.get('right')?.active)
        {
            this.game.view.pan.vehicleTarget = true;
            this.input.steering -= 1
        }

        if (actions.get('jump')?.active)
        {
            this.jump()
        }
    }

    jump( _impulseValue = 100, _callback = null )
    {
        if (this.floorContact && this.game.ticker.elapsed - this.lastJumpInstance >= 0)
        {
            this.lastJumpInstance = this.game.ticker.elapsed;
            this.body.applyImpulse({ x: 20 * Math.random(), y: 40, z: 20 * Math.random() }, true);
            this.body.setRotation({ x: 50, y: 360, z: 60})
        }
            
    }

    detectFloorVehicleContact() {
        let hasFloorContact = false

        if (!this.game.physics.groundCollider) {
            this.floorContact = false
            return
        }

        for (let i = 0; i < this.body.numColliders(); i++) {
            const vehicleCollider = this.body.collider(i)

            this.game.physics.world.contactPair(
                vehicleCollider,
                this.game.physics.groundCollider,
                (manifold) => {
                    if (manifold.numContacts() > 0)
                        hasFloorContact = true
                }
            )

            if (hasFloorContact)
                break
        }

        this.floorContact = hasFloorContact

        if (this.floorContactWheels)
            this.floorContact = true;

        // console.log(this.floorContact)
    }

    updatePrePhysics() {
        if (this.game.physics.paused)
            return

        this.updateControls()

        const topSpeed = lerp(this.topSpeed, this.topSpeedBoost, this.input.boosting)
        const overflowSpeed = Math.max(0, this.speed - topSpeed)
        let engineForce = (this.input.accelerating * (1 + this.input.boosting * this.boostMultiplier)) * this.engineForceAmplitude / (1 + overflowSpeed) * this.game.ticker.deltaScaled

        let brake = this.input.braking

        if (!this.input.braking && Math.abs(this.input.accelerating) < 0.1)
            brake = this.idleBrake

        if (
            this.speed > 0.5 &&
            (
                (this.input.accelerating > 0 && !this.goingForward) ||
                (this.input.accelerating < 0 && this.goingForward)
            )
        ) {
            brake = this.reverseBrake
            engineForce = 0
        }

        let TEMP_WHEEL_DETECT = false;
        for (let i = 0; i < 4; i++) {

            const wheel = this.wheels.items[i]
            wheel.inContact = this.controller.wheelIsInContact(i)
            TEMP_WHEEL_DETECT = wheel.inContact
            wheel.contactPoint = this.controller.wheelContactPoint(i)
            wheel.suspensionLength = this.controller.wheelSuspensionLength(i)
        }
        this.floorContactWheels = TEMP_WHEEL_DETECT;

        brake *= this.brakeAmplitude * this.game.ticker.deltaScaled

        const steer = this.input.steering * this.steeringAmplitude
        this.controller.setWheelSteering(0, steer)
        this.controller.setWheelSteering(1, steer)

        for (let i = 0; i < 4; i++) {
            this.controller.setWheelBrake(i, brake)
            this.controller.setWheelEngineForce(i, engineForce)
            this.controller.setWheelSuspensionStiffness(i, this.wheels.settings.suspensionStiffness)
        }

        const delta = Math.min(1 / 60, this.game.ticker.deltaAverage || 1 / 60)
        this.controller.updateVehicle(delta)
    }

    updatePostPhysics() {
        if (this.game.physics.paused) {
            this.velocity.set(0, 0, 0)
            this.speed = 0
            this.forwardSpeed = 0

            return
        }

        const newPosition = new THREE.Vector3().copy(this.body.translation())
        this.velocity.copy(newPosition).sub(this.position)
        this.direction.copy(this.velocity).normalize()
        this.position.copy(newPosition)
        this.quaternion.copy(this.body.rotation())
        this.forward.set(1, 0, 0).applyQuaternion(this.quaternion)
        this.recordPositionHistory()

        this.speed = this.velocity.length() / Math.max(this.game.ticker.deltaScaled, 0.0001)
        const forwardRatio = this.direction.dot(this.forward)
        this.goingForward = forwardRatio > 0.5
        this.forwardSpeed = this.speed * forwardRatio

        for (let i = 0; i < 4; i++) {
            const wheel = this.wheels.items[i]
            wheel.inContact = this.controller.wheelIsInContact(i)
            wheel.contactPoint = this.controller.wheelContactPoint(i)
            wheel.suspensionLength = this.controller.wheelSuspensionLength(i)
        }

        this.isGrounded = this.wheels.items.some((wheel) => wheel.inContact)
        this.detectFloorVehicleContact()

        this.recordWheelTrailHistory()
    }

    updateVisual() {
        this.visual.chassis.position.copy(this.position)
        this.visual.chassis.quaternion.copy(this.quaternion)

        this.visual.steering += ((this.input.steering * this.steeringAmplitude) - this.visual.steering) * this.game.ticker.deltaScaled * 16
        const wheelRotation = this.forwardSpeed / this.wheels.settings.radius * 0.006

        for (let i = 0; i < this.visual.wheels.length; i++) {
            const visualWheel = this.visual.wheels[i]
            const physicalWheel = this.wheels.items[i]

            if (visualWheel.cylinder && (!this.input.braking || this.input.accelerating !== 0)) {
                if (i === 0 || i === 2)
                    visualWheel.cylinder.rotation.z += wheelRotation
                else
                    visualWheel.cylinder.rotation.z -= wheelRotation
            }

            if (i === 0)
                visualWheel.container.rotation.y = Math.PI + this.visual.steering
            if (i === 1)
                visualWheel.container.rotation.y = this.visual.steering

            let wheelY = physicalWheel.basePosition.y - physicalWheel.suspensionLength
            wheelY = Math.min(wheelY, -0.5)

            visualWheel.container.position.x = physicalWheel.basePosition.x
            visualWheel.container.position.y += (wheelY - visualWheel.container.position.y) * 25 * this.game.ticker.deltaScaled
            visualWheel.container.position.z = physicalWheel.basePosition.z

            if (visualWheel.suspension)
                visualWheel.suspension.scale.y = Math.abs(visualWheel.container.position.y) - 0.5
        }
    }
}
