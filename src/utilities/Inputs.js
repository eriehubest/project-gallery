import Experience from "../Experience";
import Events from "./Events";
import Keyboard from "./Keyboard";
import { Pointer } from "./Pointer";
import ObservableSet from "./ObservableSet";

export class Inputs {
    static MODE_MOUSEKEYBOARD = 1
    static MODE_GAMEPAD = 2

    constructor(actions = [], filters = []) {
        this.game = Experience.getInstance();
        this.events = new Events();

        this.actions = new Map();
        this.filters = new ObservableSet((event) => {
            if (event.type === 'add') {
                document.documentElement.classList.add(`input-filter-${event.value}`)
            }
            else if (event.type === 'delete') {
                document.documentElement.classList.remove(`input-filter-${event.value}`)
            }
            else if (event.type === 'clear') {
                for (const previousValue of event.previousValues) {
                    document.documentElement.classList.remove(`input-filter-${previousValue}`)
                }
            }
        })

        this.setKeyboard();
        this.setPointer();

        this.mode = Inputs.MODE_MOUSEKEYBOARD

        this.addActions(actions)

        for (const filter of filters)
            this.filters.add(filter)

        this.game.ticker.events.on('tick', () => {
            this.update()
        }, 0)

        document.documentElement.classList.add(`is-mode-mouse-keyboard`)
    }

    addActions(actions) {
        for (const action of actions) {
            const formatedAction = { ...action }
            formatedAction.active = false
            formatedAction.value = 0
            formatedAction.trigger = null
            formatedAction.activeKeys = new Set()

            this.actions.set(action.name, formatedAction)
        }
    }

    setKeyboard() {
        this.keyboard = new Keyboard()

        this.keyboard.events.on('down', (key, code) => {
            this.updateMode(Inputs.MODE_MOUSEKEYBOARD)
            this.start(`Keyboard.${key}`)
            this.start(`Keyboard.${code}`)
        })

        this.keyboard.events.on('up', (key, code) => {
            this.updateMode(Inputs.MODE_MOUSEKEYBOARD)
            this.end(`Keyboard.${key}`)
            this.end(`Keyboard.${code}`)
        })
    }

    setPointer() {
        this.pointer = new Pointer(this.game.canvasElement)

        this.pointer.events.on('down', () => {
            this.updateMode(Inputs.MODE_MOUSEKEYBOARD)
            this.start('Pointer.any', { x: this.pointer.current.x, y: this.pointer.current.y })
        })

        this.pointer.events.on('up', () => {
            this.updateMode(Inputs.MODE_MOUSEKEYBOARD)
            this.end('Pointer.any', { x: this.pointer.current.x, y: this.pointer.current.y })
        })

        this.pointer.events.on('move', () => {
            this.change('Pointer.any', { x: this.pointer.current.x, y: this.pointer.current.y })
        })
    }

    checkCategory(action) {
        if (this.filters.size === 0)
            return true;

        if (action.categories.length === 0)
            return true;

        for (const category of action.categories) {
            if (this.filters.has(category))
                return true;
        }

        return false;
    }

    start(key, value = 1, isToggle = true) {
        const filteredActions = [...this.actions.values()].filter((_action) => _action.keys.indexOf(key) !== -1)

        for (const action of filteredActions) {
            if (action && this.checkCategory(action)) {
                action.value = value;
                action.activeKeys.add(key)
                action.trigger = 'start'

                if (isToggle) {
                    if (!action.active) {
                        action.active = true;

                        this.events.trigger('actionStart', [action])
                        this.events.trigger(action.name, [action])
                    }
                }

                else {
                    this.events.trigger('actionStart', [action])
                    this.events.trigger(action.name, [action])
                }
            }
        }
    }

    end(key, value = 0) {
        const filteredActions = [...this.actions.values()].filter((_action) => _action.keys.indexOf(key) !== - 1)

        for (const action of filteredActions) {
            if (action && action.active) {
                action.activeKeys.delete(key)

                if (action.activeKeys.size === 0) {
                    action.active = false;
                    action.value = value;
                    action.trigger = 'end'

                    this.events.trigger('actionEnd', [action])
                    this.events.trigger(action.name, [action]);
                }
            }
        }
    }

    change(key, value = 1) {
        const filteredActions = [...this.actions.values()].filter((_action) => _action.keys.indexOf(key) !== - 1)

        for (const action of filteredActions) {
            if (action && this.checkCategory(action)) {
                // Test if value has changed
                // - number => Direct comparaison
                // - object => Every property comparaison
                let hasChanged = false

                if (typeof value === 'number') {
                    if (action.value !== value)
                        hasChanged = true
                }
                else if (typeof value === 'object') {
                    const keys = Object.keys(value)

                    for (const key of keys) {
                        if (action.value[key] !== value[key])
                            hasChanged = true
                    }
                }

                if (hasChanged) {
                    action.value = value
                    action.trigger = 'change'

                    this.events.trigger('actionChange', [action])
                    this.events.trigger(action.name, [action])
                }
            }
        }
    }

    updateMode(mode) {
        if (mode === this.mode)
            return

        const oldMode = this.mode
        this.mode = mode

        const modeClasses = [
            null,
            'mouse-keyboard',
            'gamepad'
        ]

        document.documentElement.classList.remove(`is-mode-${modeClasses[oldMode]}`)
        document.documentElement.classList.add(`is-mode-${modeClasses[this.mode]}`)

        this.events.trigger('modeChange', [this.mode])
    }

    update() {
        this.pointer.update();
    }
}
