import * as THREE from 'three/webgpu'
import Experience from '../Experience'

export default class View
{
    constructor()
    {
        this.experience = Experience.getInstance();
        this.target = new THREE.Vector3(0, 0, 0);

        this.pan = {}

        this.setCamera();

        this.experience.viewport.events.on('resize', () => this.resize(), 2 );
        this.experience.ticker.events.on('tick', () => this.update(), 2 );

    }

    resize()
    {
        this.camera.aspect = this.experience.viewport.ratio;
        this.camera.updateProjectionMatrix();
    }

    update()
    {
        this.camera.lookAt(this.target)
    }

    setCamera()
    {
        this.camera = new THREE.PerspectiveCamera(25, this.experience.viewport.ratio, 0.1, 100)
        this.camera.position.set(0, 0, 30);
        this.camera.lookAt(this.target);
        this.experience.scene.add(this.camera);
    }

    setVehicle(_vehicle)
    {
        if(!_vehicle)
            return

        this.vehicle = _vehicle
        this.experience.scene.add(_vehicle)

        const bounds = new THREE.Box3().setFromObject(_vehicle)
        const size = bounds.getSize(new THREE.Vector3())
        const center = bounds.getCenter(new THREE.Vector3())
        const maxSize = Math.max(size.x, size.y, size.z)
        const distance = maxSize * 1.9

        this.target.copy(center)
        this.target.y = center.y + size.y * 0.15

        this.camera.position.set(
            center.x + distance * 0.95,
            this.target.y + Math.max(size.y * 0.45, 1.2),
            center.z + distance * 1.1
        )
        this.camera.near = Math.max(maxSize / 100, 0.1)
        this.camera.far = Math.max(maxSize * 20, 100)
        this.camera.updateProjectionMatrix()
        this.camera.lookAt(this.target)
    }
}
