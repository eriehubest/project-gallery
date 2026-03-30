import * as THREE from 'three/webgpu'

export class VehicleMaterialsDebug
{
    constructor(game, root)
    {
        this.game = game
        this.root = root
        this.meshEntries = this.collectMeshEntries()

        if(this.meshEntries.length === 0)
            return

        this.panel = this.game.debug.panel.addFolder({
            title: 'Vehicle Materials',
            expanded: false,
        })

        for(const meshEntry of this.meshEntries)
            this.addMeshFolder(meshEntry)
    }

    collectMeshEntries()
    {
        const entries = []

        this.root.traverse((child) =>
        {
            if(!child.isMesh || !child.material)
                return

            const materials = Array.isArray(child.material) ? child.material : [ child.material ]

            entries.push({
                meshName: child.name || 'unnamedMesh',
                materials,
            })
        })

        return entries
    }

    addMeshFolder(meshEntry)
    {
        const meshFolder = this.panel.addFolder({
            title: meshEntry.meshName,
            expanded: false,
        })

        meshEntry.materials.forEach((material, index) =>
        {
            this.addMaterialFolder(meshFolder, material, index)
        })
    }

    addMaterialFolder(parentFolder, material, materialIndex)
    {
        const materialFolder = parentFolder.addFolder({
            title: material.name || `material ${materialIndex + 1}`,
            expanded: false,
        })

        if(material.color?.isColor)
            this.addColorBinding(materialFolder, material.color, 'color', material)

        if(material.emissive?.isColor)
            this.addColorBinding(materialFolder, material.emissive, 'emissive', material)

        if(material.sheenColor?.isColor)
            this.addColorBinding(materialFolder, material.sheenColor, 'sheen', material)

        if(material.specularColor?.isColor)
            this.addColorBinding(materialFolder, material.specularColor, 'specular', material)

        if(material.attenuationColor?.isColor)
            this.addColorBinding(materialFolder, material.attenuationColor, 'attenuation', material)
    }

    addColorBinding(panel, color, label, material)
    {
        panel
            .addBinding({ color: `#${color.getHexString(THREE.SRGBColorSpace)}` }, 'color', {
                label,
                view: 'color',
            })
            .on('change', ({ value }) =>
            {
                color.set(value)
                material.needsUpdate = true
            })
    }
}
