/* Start: läuft nach allen anderen Modulen */
import { TRACKS } from './data.js';
import { S } from './state.js';
import { resize } from './util.js';
import { buildWorld } from './world.js';
import { resetRace } from './cars.js';
import { renderMenu, frame, initMenu } from './menu.js';

buildWorld(TRACKS[S.selTrack]);
resetRace();
initMenu();
renderMenu();
resize();
requestAnimationFrame(frame);
