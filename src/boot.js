/* Start: läuft nach allen anderen Modulen */
import { TRACKS } from './data.js';
import { S } from './state.js';
import { resize } from './util.js';
import { buildWorld } from './world.js';
import { resetRace } from './cars.js';
import { renderMenu, frame } from './menu.js';

buildWorld(TRACKS[S.selTrack]);
resetRace();
renderMenu();
resize();
requestAnimationFrame(frame);
