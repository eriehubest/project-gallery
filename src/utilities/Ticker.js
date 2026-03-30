import { uniform } from "three/tsl";
import Events from "./Events.js";

export default class Ticker
{
    constructor()
    {
        this.events = new Events();

        this.elapsed = 0;
        this.delta = 1/60;
        this.maxDelta = 1/30;
        this.elapsedUniform = uniform(this.elapsed)
        this.deltaUniform = uniform(this.delta)

        this.waits = [];
    }

    update(elapsed)
    {
        const elapsedSeconds = elapsed / 1000;
        this.delta = Math.min( elapsedSeconds - this.elapsed , this.maxDelta )
        this.elapsed = elapsedSeconds;

        this.elapsedUniform.value = this.elapsed
        this.deltaUniform.value = this.delta

        for ( let i = 0; i < this.waits.length; i++ )
        {
            const wait = this.waits[i]
            wait[0]--

            if (wait[0] == 0)
            {
                wait[1]()
                this.waits.splice(i, 1);
                i--
            }
        }

        this.events.trigger('tick');
    }

    wait( frames, callback )
    {
        this.waits.push([ frames, callback ])
    }
}
