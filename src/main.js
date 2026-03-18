import { bindRoomControls } from './controllers/roomController.js';
import { startGame } from './controllers/gameController.js';
import { registerWindowActions } from './ui/actions.js';

registerWindowActions();
bindRoomControls(startGame);

