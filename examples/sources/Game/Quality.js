import { Events } from "./Events";
import { Game } from "./Game";


export class Quality
{
    constructor()
    {
        this.game = Game.getInstance();
        
        this.events = new Events();

        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.level = isMobile ? 1 : 0;

        if (this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: `Quality`,
                expanded: false,
            })

            this.game.debug.addButtons(
                debugPanel, 
                {
                    low: () => {
                        this.changeLevel(1)
                    },
                    high: () => {
                        this.changeLevel(2)
                    }
                },
                'change'
            )
        }
    }

    changeLevel(level = 0)
    {
        if (level === this.level)
            return

        this.level = level;
        this.events.trigger('change', [ this.level ]);
    }
}