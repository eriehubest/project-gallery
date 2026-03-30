import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class Physics
{
    constructor()
    {
        this.game = Game.getInstance()
        this.world = new this.game.RAPIER.World({ x: 0, y: -9.81, z: 0 })
        this.paused = false

        this.setGround()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 3)
    }

    setGround()
    {
        const bodyDesc = this.game.RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0)
        this.groundBody = this.world.createRigidBody(bodyDesc)

        const colliderDesc = this.game.RAPIER.ColliderDesc.cuboid(200, 0.1, 200)
        colliderDesc.setFriction(1)
        this.groundCollider = this.world.createCollider(colliderDesc, this.groundBody)

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(400, 0.2, 400),
            new THREE.MeshStandardMaterial({
                color: '#2a1f16',
                roughness: 0.9,
                metalness: 0.05,
                transparent: true,
                opacity: 0
            })
        )
        mesh.receiveShadow = true
        mesh.position.set(0, -0.1, 0)
        this.game.scene.add(mesh)

    }

    update()
    {
        if(this.paused)
        {
            return
        }

        this.world.timestep = this.game.ticker.deltaScaled
        this.world.step()
    }

    pause()
    {
        this.paused = true
    }

    resume()
    {
        this.paused = false
    }

    togglePause()
    {
        this.paused = !this.paused
    }
}
