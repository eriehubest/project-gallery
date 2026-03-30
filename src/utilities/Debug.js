import { Pane } from "tweakpane";

export default class Debug
{
    constructor()
    {
        this.active = location.hash.match(/debug/i)

        if (this.active)
        {
            this.panel = new Pane();
            addEventListener('keydown', (event) =>
            {
                if(event.code === 'KeyH')
                    this.panel.hidden = !this.panel.hidden
            })
        }
    }
}