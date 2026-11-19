// 타일 코드
export const T = {
  EMPTY: 0, SOLID: 1, ONEWAY: 2, SPIKE: 3, JUMP: 4, HOT: 5, CONV_L: 6, CONV_R: 7, CRUMBLE: 8, BUTTER: 9,
  SWITCH: 10, BUZZER: 11, DOOR: 12, DOOR_OPEN: 13, QSIGN: 14, PANEL_O: 15, PANEL_X: 16, TIMER: 17,
  WARP_A: 18, WARP_A2: 19, WARP_B: 20, WARP_B2: 21, RHY_A: 22, RHY_B: 23, GHOST: 24, SPOT: 25, LASER: 26,
  STOP: 27, HINT: 28, SPIKE_D: 29, DECO: 30,
};

export const CHAR_TILE = {
  '#': T.SOLID, '=': T.ONEWAY, '^': T.SPIKE, 'v': T.SPIKE_D, 'J': T.JUMP, 'H': T.HOT, '<': T.CONV_L, '>': T.CONV_R,
  'C': T.CRUMBLE, 'I': T.BUTTER, 'S': T.SWITCH, 'B': T.BUZZER, 'D': T.DOOR, 'd': T.DOOR_OPEN, 'Q': T.QSIGN,
  'O': T.PANEL_O, 'X': T.PANEL_X, 'T': T.TIMER, 'W': T.WARP_A, 'w': T.WARP_A2, 'Y': T.WARP_B, 'y': T.WARP_B2,
  'R': T.RHY_A, 'r': T.RHY_B, 'g': T.GHOST, 'U': T.SPOT, 'Z': T.LASER, 'x': T.STOP, '!': T.HINT, '%': T.DECO,
};

// 맵 문자 → 개체
export const CHAR_ENTITY = {
  '@': 'start', 'E': 'exit', 'K': 'check', '*': 'gem', '$': 'gold', '?': 'box',
  'a': 'box:pie', 'b': 'box:bomb', 'c': 'box:mic', 'e': 'box:magnet', 'f': 'box:cloak', 'h': 'box:spring',
  '1': 'marsh', '2': 'sauce', '3': 'shroom', '4': 'qbot', '5': 'mole', '6': 'dancer', '7': 'drone', '8': 'tomato',
  'm': 'moverH', 'n': 'moverV', 'o': 'bumper', '9': 'boss', 'z': 'zone',
};

// 항상 단단한 타일 (상태 무관)
const ALWAYS_SOLID = new Set([T.SOLID, T.JUMP, T.HOT, T.CONV_L, T.CONV_R, T.BUTTER, T.SWITCH, T.BUZZER, T.GHOST, T.LASER]);
export function isAlwaysSolid(code) { return ALWAYS_SOLID.has(code); }
