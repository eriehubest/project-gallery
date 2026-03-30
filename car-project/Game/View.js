import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import gsap from 'gsap'

export class View {
    constructor() {
        this.game = Game.getInstance()

        this.focusPoint = new THREE.Vector3()
        this.spherical = {
            radius: 30,
            phi: 1.05,
            theta: 0.75,
        }

        this.viewAngles = {
            base: {
                radius: 30,
                phi: 1.05,
                theta: 0.75,
            },

            upView: {
                radius: 30,
                phi: 0.7,
                theta: 0.75,
            }
        }

        this.setFocusPoint()
        this.setCameras()

        this.game.ticker.events.on('tick', () => {
            this.update()
        }, 7)

        this.game.viewport.events.on('change', () => {
            this.resize()
        })

        this.update()

        addEventListener('keydown', (event) => {
            if (event.code === 'KeyA') {
                this.spherical = this.viewAngles.upView
            }
        })
    }

    setFocusPoint() {
        const defaultRespawn = this.game.respawns.getDefault()

        if (defaultRespawn) {
            this.focusPoint.set(
                defaultRespawn.position.x,
                defaultRespawn.position.y,
                defaultRespawn.position.z
            )
        }
    }

    setCameras() {
        this.camera = new THREE.PerspectiveCamera(25, this.game.viewport.ratio, 0.1, 200)
        this.camera.position.set(12, 12, 12)
        this.camera.lookAt(0, 0, 0)
        this.game.scene.add(this.camera)

        this.setPan()
    }

    setPan() {
        this.pan = {}
        this.pan.enabled = true
        this.pan.activated = false
        this.pan.followCar = true

        this.pan.startPointer = new THREE.Vector2()
        this.pan.currentOffset = new THREE.Vector3()
        this.pan.targetOffset = new THREE.Vector3()
        this.pan.startOffset = new THREE.Vector3()
        this.pan.focusPointBase = new THREE.Vector3()
        this.pan.originOffset = new THREE.Vector3()

        this.pan.delayDamping = 0.1
        this.pan.cameraMovementScale = 18
        this.pan.returnDamping = 0.08
        this.pan.movementThreshold = 0.1
        this.pan.vehicleTarget = true;
        this.pan.cameraDirection = new THREE.Vector3()
        this.pan.cameraRight = new THREE.Vector3()
        this.pan.cameraForward = new THREE.Vector3()

        this.pan.setStartPan = (event) => {
            if (!this.pan.enabled)
                return

            this.pan.activated = true
            this.pan.followCar = false
            this.pan.vehicleTarget = false;

            this.pan.startPointer.set(event.clientX, event.clientY)
            this.pan.startOffset.copy(this.pan.targetOffset)
        }

        this.camera.getWorldDirection(this.pan.cameraDirection)

        this.pan.cameraForward
            .copy(this.pan.cameraDirection)
            .setY(0)
            .normalize()

        this.pan.cameraRight
            .crossVectors(this.pan.cameraForward, this.camera.up)
            .normalize()

        this.pan.panMove = (event) => {
            if (!this.pan.enabled || !this.pan.activated)
                return

            const bounds = this.game.domElement.getBoundingClientRect()
            const deltaX = -(event.clientX - this.pan.startPointer.x) / bounds.width
            const deltaY = (event.clientY - this.pan.startPointer.y) / bounds.height

            this.pan.targetOffset
                .copy(this.pan.startOffset)
                .addScaledVector(this.pan.cameraRight, deltaX * this.pan.cameraMovementScale)
                .addScaledVector(this.pan.cameraForward, deltaY * this.pan.cameraMovementScale)
            // console.log(this.pan.cameraRight)
        }

        this.pan.setEndPan = () => {
            if (!this.pan.enabled)
                return

            this.pan.activated = false
        }

        this.pan.releaseToFollowCar = () => {
            this.pan.activated = false
            this.pan.followCar = true
            this.pan.startOffset.copy(this.pan.targetOffset)
        }

        this.game.canvasElement.addEventListener('mousedown', this.pan.setStartPan)
        window.addEventListener('mousemove', this.pan.panMove)
        window.addEventListener('mouseup', this.pan.setEndPan)
    }

    resize() {
        this.camera.aspect = this.game.viewport.ratio
        this.camera.updateProjectionMatrix()
    }

    addTopViewToggle(BOTTOM_RIGHT = null, TOP_LEFT = null) {
        if (!TOP_LEFT || !BOTTOM_RIGHT)
            return;

        // Disabled: entering the former box area should no longer force a camera-angle change.
        // this.game.ticker.events.on('tick', () => {
        //     if (this.game.vehicle.position.x < BOTTOM_RIGHT.x && this.game.vehicle.position.x > TOP_LEFT.x) {
        //         if (this.game.vehicle.position.z < BOTTOM_RIGHT.y && this.game.vehicle.position.z > TOP_LEFT.y) {
        //             gsap.killTweensOf(this.spherical)
        //             gsap.to(this.spherical, {
        //                 phi: this.viewAngles.upView.phi,
        //                 duration: 0.5,
        //             })
        //         }
        //     }
        //
        //     else {
        //         gsap.to(this.spherical, {
        //             phi: this.viewAngles.base.phi,
        //             duration: 0.5,
        //         })
        //     }
        // })
    }

    update() {
        // const vehicleIsMoving = this.game.vehicle && Math.abs(this.game.vehicle.forwardSpeed) > this.pan.movementThreshold
        const vehicleIsMoving = this.game.vehicle && this.pan.vehicleTarget

        if (!this.pan.followCar && vehicleIsMoving)
            this.pan.releaseToFollowCar()

        if (this.pan.followCar) {
            if (this.game.vehicle) {
                this.focusPoint.lerp(this.game.vehicle.position, 1)
                this.focusPoint.y += (1.2 - this.focusPoint.y) * 0.1
            }

            this.pan.targetOffset.lerp(this.pan.originOffset, this.pan.returnDamping)
        }

        this.pan.currentOffset.lerp(this.pan.targetOffset, this.pan.delayDamping)
        this.pan.focusPointBase.copy(this.focusPoint).add(this.pan.currentOffset)

        this.camera.position.setFromSphericalCoords(
            this.spherical.radius,
            this.spherical.phi,
            this.spherical.theta
        )
        this.camera.position.add(this.pan.focusPointBase)
        this.camera.position.addScaledVector(this.pan.cameraRight, 4)

        const lookTarget = new THREE.Vector3()
            .copy(this.pan.focusPointBase)
            .addScaledVector(this.pan.cameraRight, 4)

        this.camera.lookAt(lookTarget)
    }
}
