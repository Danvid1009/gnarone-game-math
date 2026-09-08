import * as outcomeTable from './outcome-table.js';
import * as jitteredTable from './jittered-table.js';
import * as curveBand from './curve-band.js';
import * as fruitFusion from './fruit-fusion.js';
import * as ladder from './ladder.js';
import * as slingshot from './slingshot.js';

export const modules = { outcomeTable, jitteredTable, curveBand, fruitFusion, ladder, slingshot };
export const games = Object.fromEntries(Object.values(modules).map(m => [m.game.id, m.game]));
