import Events from "./Events";

export default class Keyboard {
    constructor() {
        this.events = new Events();

        this.pressed = [];

        // Triggers up when tab visibility changes
        window.addEventListener('blur', () => {
            for (const key of this.pressed)
                this.events.trigger('up', [key])

            this.pressed = [];
        })

        addEventListener('keydown', (_event) => {
            this.pressed.push(_event.code, _event.key)
            this.events.trigger('down', [_event.code, _event.key])
        })

        addEventListener('keyup', (_event) => {
            // Code
            const indexCode = this.pressed.indexOf(_event.code)

            if (indexCode !== -1)
                this.pressed.splice(indexCode, 1)

            // Key
            const indexKey = this.pressed.indexOf(_event.key)

            if (indexKey !== -1)
                this.pressed.splice(indexKey, 1)

            this.events.trigger('up', [_event.code, _event.key])
        })
    }
}