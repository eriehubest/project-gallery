import * as THREE from 'three/webgpu'
import { Events } from './Events.js'

export class Pointer
{
    static MODE_MOUSE = 1

    constructor(element)
    {
        this.element = element

        this.events = new Events()
        this.current = { x: 0, y: 0 }
        this.delta = { x: 0, y: 0 }
        this.upcoming = { x: 0, y: 0 }
        this.isDown = false
        this.mode = Pointer.MODE_MOUSE
        this.upcomingDown = false
        this.hasMoved = false

        this.element.addEventListener('mousemove', (_event) =>
        {
            _event.preventDefault()

            this.mode = Pointer.MODE_MOUSE
            
            this.upcoming.x = _event.clientX
            this.upcoming.y = _event.clientY
        })

        this.element.addEventListener('mousedown', (_event) =>
        {
            _event.preventDefault()

            this.mode = Pointer.MODE_MOUSE

            this.upcomingDown = true

            this.current.x = _event.clientX
            this.current.y = _event.clientY
            this.upcoming.x = _event.clientX
            this.upcoming.y = _event.clientY
        })

        addEventListener('mouseup', (_event) =>
        {
            _event.preventDefault()

            this.upcomingDown = false
        })

        this.element.addEventListener('contextmenu', (_event) =>
        {
            _event.preventDefault()
        })
    }

    update()
    {
        // Update from upcoming
        this.delta.x = this.upcoming.x - this.current.x
        this.delta.y = this.upcoming.y - this.current.y

        this.current.x = this.upcoming.x
        this.current.y = this.upcoming.y

        // Define what has changed and trigger events
        this.hasMoved = this.delta.x !== 0 || this.delta.y !== 0
        
        if(this.upcomingDown !== this.isDown)
        {
            this.isDown = this.upcomingDown

            if(this.isDown)
                this.events.trigger('down')
            else
                this.events.trigger('up')
        }

        if(this.hasMoved)
            this.events.trigger('move')
    }
}
