const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }
  
  if (req.url === '/stats') {
    const publicRooms = [];
    for (let [code, room] of rooms) {
      if (!room.isPrivate && room.players.length < 2 && !room.gameStarted) {
        publicRooms.push({
          code: room.code,
          lang: room.lang,
          multiMode: room.multiMode,
          playerCount: room.players.length,
          hostName: room.players[0]?.name || 'Player'
        });
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      rooms: rooms.size,
      players: clients.size,
      activeGames: Array.from(rooms.values()).filter(r => r.gameStarted).length,
      publicRooms: publicRooms
    }));
    return;
  }
  
  res.writeHead(200);
  res.end('Wordle Multiplayer Server v7');
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();
const clients = new Map();

// Anti-spam
const messageTimestamps = new Map();
const MESSAGE_COOLDOWN = 500;
const MAX_MESSAGES_PER_SECOND = 3;

// ==================== WORD LISTS ====================
const WORDS_RU = 'АРБУЗ,БАНКА,ВЕТЕР,ГОРОД,ДОЖДЬ,ЖАБРА,ЗЕБРА,ИГРОК,КАРТА,ЛОДКА,МОРОЗ,НОСОК,ПАРУС,РОМАН,САХАР,ТУМАН,ФАКЕЛ,ЦАПЛЯ,ЧАШКА,ШТОРМ,ЩЕНОК,ЭКРАН,ЮНОША,ЯБЕДА,ПИРОГ,ТОЧКА,РУЧКА,КНИГА,КОШКА,МЫШКА,ЗЕМЛЯ,ВОЛНА,ГРОЗА,ЗАКАТ,ОГОНЬ,БЕРЕГ,ЗАМОК,ЛИМОН,НИТКА,РУБЛЬ,СМЕНА,ТРОПА,ХОЛОД,ГОРКА,ИСКРА,СОСНА,ТОПОР,ЗВЕЗД,КЛЮЧИ,ПОЛЕТ,МЕСЯЦ,БРОВИ,МЕЧТА,ОТВЕТ,СЛОВО,ЧИСЛО,МЕСТО,ВРЕМЯ,ВЕЧЕР,УТРОМ,МЫСЛЬ'.split(',').filter(w => w.length === 5);
const WORDS_EN = 'ABOUT,ABOVE,ACTOR,ADMIT,ADOPT,ADULT,AFTER,AGAIN,AGENT,ALBUM,ALERT,ALIKE,ALIVE,ALLOW,ALONE,ANGEL,ANGRY,APPLE,ARENA,ARGUE,ARISE,ARROW,ASIDE,AVOID,AWARD,BASIC,BEACH,BEGAN,BEGIN,BEING,BELOW,BIRTH,BLACK,BLADE,BLAME,BLANK,BLAST,BLAZE,BLEED,BLESS,BLIND,BLOCK,BLOOD,BOARD,BOOST,BRAIN,BRAND,BRAVE,BREAK,BREED,BRICK,BRIEF,BRING,BROAD,BROWN,BRUSH,BUILD,BURST,CANDY,CARRY,CAUSE,CHAIN,CHAIR,CHAOS,CHARM,CHEAP,CHECK,CHESS,CHEST,CHILD,CLEAN,CLEAR,CLIMB,CLOSE,CLOUD,COAST,COLOR,CORAL,COULD,COUNT,COURT,COVER,CRACK,CRAFT,CRASH,CRAZY,CREAM,CRIME,CROSS,CROWD,CROWN,CRUSH,CURVE,CYCLE,DAILY,DANCE,DEATH,DELAY,DEVIL,DIARY,DIRTY,DOING,DOUBT,DOUGH,DRAFT,DRAMA,DREAM,DRESS,DRINK,DRIVE,DRONE,EARLY,EARTH,EIGHT,ELECT,ELITE,EMPTY,ENEMY,ENJOY,ENTER,EQUAL,ERROR,EVENT,EVERY,EXACT,EXIST,EXTRA,FAITH,FALSE,FAULT,FENCE,FEVER,FIELD,FIGHT,FINAL,FIRST,FLAME,FLASH,FLOAT,FLOOR,FLUID,FOCUS,FORCE,FORTH,FOUND,FRAME,FRESH,FRONT,FROST,FRUIT,FULLY,FUNNY,GHOST,GIANT,GIVEN,GLASS,GLOBE,GLORY,GOING,GRACE,GRADE,GRAIN,GRAND,GRANT,GRASS,GRAVE,GREAT,GREEN,GROUP,GUARD,GUESS,GUEST,GUIDE,HAPPY,HEART,HEAVY,HELLO,HONEY,HONOR,HORSE,HOTEL,HOUSE,HUMAN,HUMOR,HURRY,IMAGE,INDEX,INNER,INPUT,ISSUE,JEWEL,JOINT,JUDGE,JUICE,KNOWN,LABEL,LARGE,LATER,LAUGH,LAYER,LEARN,LEAVE,LEGAL,LEVEL,LIGHT,LIMIT,LOCAL,LOGIC,LOOSE,LUNCH,MAGIC,MAJOR,MARCH,MATCH,MEDIA,METAL,MIGHT,MINOR,MINUS,MIXED,MODEL,MONEY,MONTH,MOUNT,MOUSE,MOUTH,MOVIE,MUSIC,NERVE,NEVER,NIGHT,NOISE,NORTH,NOVEL,NURSE,OCEAN,OFFER,OFTEN,OLIVE,ORDER,OTHER,OUGHT,OUTER,OWNER,PAINT,PANEL,PAPER,PARTY,PEACE,PEARL,PHASE,PHONE,PHOTO,PIANO,PIECE,PILOT,PIXEL,PLACE,PLAIN,PLANE,PLANT,PLATE,POINT,POWER,PRESS,PRICE,PRIDE,PRIME,PRIZE,PROOF,PROUD,PROVE,PUPIL,QUEEN,QUEST,QUICK,QUIET,QUITE,RADIO,RAISE,RANGE,RAPID,REACH,REACT,READY,REALM,REIGN,REPLY,RIGHT,RIVER,ROBOT,ROCKY,ROUGH,ROUND,ROUTE,ROYAL,RULER,RURAL,SAINT,SALAD,SAUCE,SCALE,SCENE,SCOPE,SCORE,SENSE,SERVE,SEVEN,SHADE,SHAKE,SHALL,SHAME,SHAPE,SHARE,SHARP,SHELF,SHELL,SHIFT,SHINE,SHIRT,SHOCK,SHOOT,SHORT,SHOUT,SIGHT,SINCE,SIXTH,SIXTY,SKILL,SLAVE,SLEEP,SLICE,SLIDE,SMART,SMELL,SMILE,SMOKE,SNAKE,SOLAR,SOLID,SOLVE,SORRY,SOUTH,SPACE,SPARE,SPARK,SPEAK,SPEED,SPEND,SPILL,SPINE,SPLIT,SPORT,SPRAY,SQUAD,STACK,STAGE,STAND,START,STATE,STEAM,STEEL,STICK,STILL,STOCK,STONE,STORE,STORM,STORY,STUDY,STYLE,SUGAR,SUPER,SWEAR,SWEEP,SWEET,SWIFT,SWING,SWORD,TABLE,TASTE,TEACH,THANK,THEIR,THEME,THERE,THICK,THING,THINK,THIRD,THOSE,THREE,THROW,TIGHT,TIRED,TITLE,TODAY,TOKEN,TOOTH,TOTAL,TOUCH,TOUGH,TOWER,TRACK,TRADE,TRAIL,TRAIN,TREAT,TREND,TRIAL,TRIBE,TRICK,TROOP,TRUCK,TRULY,TRUST,TRUTH,TWICE,TWIST,UNDER,UNION,UNITY,UNTIL,UPPER,UPSET,URBAN,USUAL,VALID,VALUE,VIDEO,VIRAL,VIRUS,VISIT,VITAL,VOCAL,VOICE,WATCH,WATER,WEIGH,WHEAT,WHEEL,WHERE,WHICH,WHILE,WHITE,WHOLE,WHOSE,WOMAN,WOMEN,WORLD,WORRY,WORSE,WORST,WORTH,WOULD,WOUND,WRITE,WRONG,WROTE,YACHT,YIELD,YOUNG,YOUTH,ZEBRA'.split(',').filter(w => w.length === 5);

// ==================== BANNED WORDS ====================
const BANNED_WORDS_RU = 'СУКА,БЛЯДЬ,БЛЯ,ПИЗДА,ХУЙ,ХУЕ,ХУЯ,ЕБАТЬ,ЕБАЛ,ЕБАН,ПИДОР,ПИДАР,ГАНДОН,МУДАК,УЕБОК,ЗАЛУПА,ШЛЮХА,ПРОСТИТУТКА,ЕБЛО,ЖОПА,СРАКА,ГОВНО,ССАТЬ,СЦАТЬ,ТРАХАТЬ,ТРАХНУ,ВЫЕБАТЬ,ОТСОСИ,МИНЕТ,ДРОЧИТЬ,ДРОЧУ,КОНЧА,КОНЧИТЬ,ГЕЙ,ЛЕСБИ,ЛЕСБИЯНКА,ПЕДИК,ПЕДРИЛА,НИГГЕР,НИГА,НАЦИСТ,ФАШИСТ,ФАШИК,УБИТЬ,УБЬЮ,УБЕЙ,СМЕРТЬ,НАРКОТА,НАРКОТИК,КОКАИН,ГЕРОИН,МЕТАМФЕТАМИН,ТРАВКА,ВОДКА,БУХАТЬ,ПЬЯНЫЙ,ПЬЯНЬ,АЛКАШ,АЛКОГОЛИК,ДЕБИЛ,ДЕГЕНЕРАТ,ИДИОТ,ДАУН,УМСТВЕННО,УРОД,ЛОХ,ЧМО,ЧМЫРЬ,ХАМ,ХАМЛО,ПУТИН,ЗЕЛЕНСКИЙ,ТРАМП,БАЙДЕН,ВОЙНА,ПОРНО,СЕКС,СПЕРМА,КУНИ,АНИЛИНГУС'.split(',');
const BANNED_WORDS_EN = 'FUCK,SHIT,BITCH,ASS,DICK,COCK,PUSSY,CUNT,NIGGA,NIGGER,FAG,FAGGOT,NAZI,HITLER,KILL,MURDER,DEATH,SUICIDE,TERROR,TERRORIST,RETARD,IDIOT,MORON,STUPID,PORN,SEX,SLUT,WHORE,PROSTITUTE,RAPE,DRUG,COCAINE,HEROIN,METH,WEED,MARIJUANA,PENIS,VAGINA,ANAL,ORAL,MASTURBATE,EJACULATE,TRUMP,BIDEN,PUTIN,ZELENSKY,WAR,DRUNK,ALCOHOL,VODKA,BEER'.split(',');
const BANNED_PATTERNS_RU = [/х[уy]й/i, /п[иi][з3]д/i, /[еe]б[аa@][тt]/i, /[еe]б[аa@][лl]/i, /[еe]б[аa@][нn]/i, /[б6]л[яy][дt]/i, /[сc][уy][кk][аa]/i, /[нn][аa@][хx]/i, /[пp][иi][дd][оo][рp]/i, /[гg][еe][йy]/i, /[нn][иi][гg][еe][рp]/i, /[нn][аa@][цz][иi]/i, /[фf][аa@][шs][иi][сc][тt]/i, /[жg][иi][дd]/i, /[хx][оo][хx][оo][лl]/i, /[дd][аa@][уy][нn]/i, /[дd][еe][б6][иi][лl]/i, /[мm][уy][дd][аa@][кk]/i, /[гg][аa@][нn][дd][оo][нn]/i, /[ч4][мm][оo]/i, /[лl][оo][хx]/i, /[уy][б6][иi]/i, /[сc][мm][еe][рp][тt]/i, /[вv][оo][йy][нn]/i, /[пp][уy][тt][иi][нn]/i, /[з3][еe][лl][еe][нn][сc][кk]/i, /[тt][рp][аa@][мm][пp]/i, /[б6][аa@][йy][дd][еe][нn]/i, /[пp][оo][рp][нn][оo]/i, /[сc][еe][кk][сc]/i, /[тt][рp][аa@][хx]/i, /[шs][лl][юu][хx][аa@]/i];
const BANNED_PATTERNS_EN = [/f[u*]ck/i, /s[h*][i*]t/i, /b[i*]tch/i, /a[s*][s*]/i, /d[i*]ck/i, /c[o*]ck/i, /p[u*][s*][s*]y/i, /c[u*]nt/i, /n[i*]gg[a*]/i, /f[a*]g/i, /n[a*]z[i*]/i, /h[i*]tl[e*]r/i, /k[i*]ll/i, /m[u*]rd[e*]r/i, /d[e*][a*]th/i, /t[e*]rr[o*]r/i, /r[e*]t[a*]rd/i, /p[o*]rn/i, /s[l*][u*]t/i, /wh[o*]re/i, /r[a*]p[e*]/i, /d[r*][u*]g/i, /c[o*]c[a*]ine/i, /h[e*]r[o*]in/i, /m[e*]th/i, /w[e*][e*]d/i];

function isBannedWord(word, lang) {
  const bannedList = lang === 'ru' ? BANNED_WORDS_RU : BANNED_WORDS_EN;
  const patterns = lang === 'ru' ? BANNED_PATTERNS_RU : BANNED_PATTERNS_EN;
  
  // Check full words
  if (bannedList.includes(word.toUpperCase())) return true;
  
  // Check patterns
  if (patterns.some(p => p.test(word))) return true;
  
  return false;
}

function filterProfanity(text, lang) {
  let filtered = text;
  const bannedList = lang === 'ru' ? BANNED_WORDS_RU : BANNED_WORDS_EN;
  const patterns = lang === 'ru' ? BANNED_PATTERNS_RU : BANNED_PATTERNS_EN;
  
  bannedList.forEach(word => {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    filtered = filtered.replace(regex, match => '*'.repeat(match.length));
  });
  
  patterns.forEach(pattern => {
    filtered = filtered.replace(pattern, match => '*'.repeat(match.length));
  });
  
  return filtered;
}

function isValidWord(word, lang) {
  if (word.length !== 5) return false;
  const wordRegex = lang === 'ru' ? /^[А-ЯЁ]+$/i : /^[A-Z]+$/i;
  if (!wordRegex.test(word)) return false;
  if (isBannedWord(word, lang)) return false;
  const list = lang === 'ru' ? WORDS_RU : WORDS_EN;
  return list.includes(word.toUpperCase());
}

function randomWord(lang) {
  const list = lang === 'ru' ? WORDS_RU : WORDS_EN;
  return list[Math.floor(Math.random() * list.length)];
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sendToClient(ws, type, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function broadcastToRoom(room, type, data, excludeWs = null) {
  if (!room || !room.players) return;
  room.players.forEach(player => {
    const client = clients.get(player.id);
    if (client && client !== excludeWs && client.readyState === WebSocket.OPEN) {
      sendToClient(client, type, data);
    }
  });
}

function evaluateGuess(guess, target) {
  const result = Array(5).fill('absent');
  const targetLetters = target.split('');
  const guessLetters = guess.split('');
  const matched = Array(5).fill(false);
  
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'correct';
      matched[i] = true;
    }
  }
  
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const letter = guessLetters[i];
    const targetIndex = targetLetters.findIndex((l, idx) => l === letter && !matched[idx]);
    if (targetIndex !== -1) {
      result[i] = 'present';
      matched[targetIndex] = true;
    }
  }
  
  return result;
}

function findRoomByPlayer(playerId) {
  for (let [code, room] of rooms) {
    if (room.players.find(p => p.id === playerId)) {
      return room;
    }
  }
  return null;
}

function removePlayerFromRoom(room, playerId) {
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return null;
  
  const player = room.players[playerIndex];
  room.players.splice(playerIndex, 1);
  
  if (room.players.length === 0) {
    if (room.turnTimer) clearInterval(room.turnTimer);
    if (room.duelTimer) clearInterval(room.duelTimer);
    rooms.delete(room.code);
    console.log(`[ROOM] ${room.code} deleted (no players)`);
    return null;
  }
  
  if (playerId === room.host) {
    room.host = room.players[0].id;
    room.guest = room.players.length >= 2 ? room.players[1].id : null;
    console.log(`[ROOM] New host in ${room.code}: ${room.host}`);
  }
  
  resetRoomGameState(room);
  
  broadcastToRoom(room, 'players_update', {
    players: room.players
  });
  
  return player;
}

function resetRoomGameState(room) {
  if (room.turnTimer) {
    clearInterval(room.turnTimer);
    room.turnTimer = null;
  }
  if (room.duelTimer) {
    clearInterval(room.duelTimer);
    room.duelTimer = null;
  }
  
  room.gameStarted = false;
  room.wordPhase = false;
  room.hostWord = '';
  room.guestWord = '';
  room.hostAttempts = [];
  room.guestAttempts = [];
  room.hostGameOver = false;
  room.guestGameOver = false;
  room.hostWon = false;
  room.guestWon = false;
  room.currentTurn = null;
  room.turnTimeLeft = null;
  room.duelTimeLeft = null;
  room.players.forEach(p => {
    p.ready = false;
    p.wordSet = false;
  });
}

// Timer system for duel mode
function startDuelTimer(room) {
  if (room.duelTimer) clearInterval(room.duelTimer);
  
  room.duelTimeLeft = 180;
  console.log(`[DUEL] Timer started for ${room.code}`);
  
  room.duelTimer = setInterval(() => {
    room.duelTimeLeft--;
    
    if (room.duelTimeLeft <= 0) {
      clearInterval(room.duelTimer);
      room.duelTimer = null;
      
      console.log(`[DUEL] Time's up in ${room.code}`);
      
      broadcastToRoom(room, 'duel_timeout', {
        message: 'Duel time expired!',
        word: room.hostWord || room.guestWord
      });
      
      resetRoomGameState(room);
      broadcastToRoom(room, 'players_update', {
        players: room.players
      });
    }
  }, 1000);
}

// Timer for async turn
function startTurnTimer(room) {
  if (room.turnTimer) clearInterval(room.turnTimer);
  
  room.turnTimeLeft = 60;
  console.log(`[TURN] Timer started for ${room.code} (${room.turnTimeLeft}s)`);
  
  room.turnTimer = setInterval(() => {
    room.turnTimeLeft--;
    
    if (room.turnTimeLeft <= 0) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
      
      console.log(`[TURN] Time's up for ${room.code}`);
      
      const currentPlayer = room.players.find(p => p.id === room.currentTurn);
      const otherPlayer = room.players.find(p => p.id !== room.currentTurn);
      
      if (currentPlayer) {
        const currentWs = clients.get(currentPlayer.id);
        if (currentWs) {
          sendToClient(currentWs, 'game_lost', {
            message: 'Time expired',
            word: currentPlayer.id === room.host ? room.guestWord : room.hostWord,
            winnerId: otherPlayer?.id,
            winnerNickname: otherPlayer?.name || 'Opponent',
            winnerColor: otherPlayer?.activeColor || ''
          });
        }
        
        if (otherPlayer) {
          const otherWs = clients.get(otherPlayer.id);
          if (otherWs) {
            sendToClient(otherWs, 'game_won', {
              word: otherPlayer.id === room.host ? room.guestWord : room.hostWord,
              winnerId: otherPlayer.id,
              winnerNickname: otherPlayer.name,
              winnerColor: otherPlayer.activeColor || ''
            });
          }
        }
      }
      
      broadcastToRoom(room, 'game_over', {
        winnerId: otherPlayer?.id,
        winnerNickname: otherPlayer?.name || 'Player'
      });
      
      resetRoomGameState(room);
      broadcastToRoom(room, 'players_update', {
        players: room.players
      });
    }
  }, 1000);
}

function clearRoomTimers(room) {
  if (room.turnTimer) {
    clearInterval(room.turnTimer);
    room.turnTimer = null;
  }
  if (room.duelTimer) {
    clearInterval(room.duelTimer);
    room.duelTimer = null;
  }
}

function startGame(room) {
  room.gameStarted = true;
  
  const firstTurn = Math.random() < 0.5 ? room.host : room.guest;
  room.currentTurn = firstTurn;
  
  console.log(`[GAME] Started in ${room.code}, mode: ${room.multiMode}, first turn: ${firstTurn === room.host ? 'Host' : 'Guest'}`);
  
  const hostWs = clients.get(room.host);
  const guestWs = clients.get(room.guest);
  
  const hostPlayer = room.players.find(p => p.id === room.host);
  const guestPlayer = room.players.find(p => p.id === room.guest);
  
  if (hostWs) {
    sendToClient(hostWs, 'game_started', {
      targetWord: room.guestWord,
      myTurn: room.currentTurn === room.host,
      opponentNickname: guestPlayer?.name || 'Opponent',
      opponentAvatar: guestPlayer?.avatarUrl || '',
      opponentColor: guestPlayer?.activeColor || ''
    });
  }
  
  if (guestWs) {
    sendToClient(guestWs, 'game_started', {
      targetWord: room.hostWord,
      myTurn: room.currentTurn === room.guest,
      opponentNickname: hostPlayer?.name || 'Opponent',
      opponentAvatar: hostPlayer?.avatarUrl || '',
      opponentColor: hostPlayer?.activeColor || ''
    });
  }
  
  if (room.multiMode === 'live') {
    startDuelTimer(room);
  } else if (room.multiMode === 'async') {
    startTurnTimer(room);
  }
  
  broadcastToRoom(room, 'battle_start', {
    message: 'Both words set! ⚔ BATTLE BEGINS! ⚔',
    player1: hostPlayer?.name || 'P1',
    player2: guestPlayer?.name || 'P2'
  });
}

// Anti-spam check for chat
function isSpamming(playerId) {
  const now = Date.now();
  const timestamps = messageTimestamps.get(playerId) || [];
  
  const recent = timestamps.filter(t => now - t < 1000);
  
  if (recent.length >= MAX_MESSAGES_PER_SECOND) {
    return true;
  }
  
  if (recent.length > 0 && now - recent[recent.length - 1] < MESSAGE_COOLDOWN) {
    return true;
  }
  
  recent.push(now);
  messageTimestamps.set(playerId, recent);
  return false;
}

// Update player info in room
function updatePlayerInfo(ws, data) {
  const room = findRoomByPlayer(ws.id);
  if (!room) return;
  
  const player = room.players.find(p => p.id === ws.id);
  if (!player) return;
  
  let updated = false;
  
  if (data.nickname && data.nickname !== ws.nickname) {
    const sanitized = data.nickname.substring(0, 20).replace(/[<>]/g, '');
    if (sanitized) {
      ws.nickname = sanitized;
      player.name = sanitized;
      updated = true;
    }
  }
  if (data.avatarUrl !== undefined && data.avatarUrl !== ws.avatarUrl) {
    ws.avatarUrl = data.avatarUrl;
    player.avatarUrl = data.avatarUrl;
    updated = true;
  }
  if (data.activeColor !== undefined && data.activeColor !== ws.activeColor) {
    ws.activeColor = data.activeColor;
    player.activeColor = data.activeColor;
    updated = true;
  }
  
  if (updated) {
    broadcastToRoom(room, 'players_update', {
      players: room.players
    });
  }
}

// Clean up stale rooms
setInterval(() => {
  const now = Date.now();
  for (let [code, room] of rooms) {
    if (room.lastActivity && now - room.lastActivity > 30 * 60 * 1000) {
      console.log(`[CLEANUP] Removing stale room ${code}`);
      clearRoomTimers(room);
      broadcastToRoom(room, 'player_left', {
        message: 'Room closed due to inactivity',
        players: []
      });
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

wss.on('connection', (ws) => {
  ws.id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  ws.nickname = 'Player';
  ws.avatarUrl = '';
  ws.activeColor = '';
  clients.set(ws.id, ws);
  
  console.log(`[+] Player connected: ${ws.id}`);
  
  sendToClient(ws, 'connected', { playerId: ws.id });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Update player info on every message
      updatePlayerInfo(ws, data);
      
      console.log(`[${ws.nickname}] ${data.type}`);
      
      switch (data.type) {
        
        // ==================== GET PUBLIC ROOMS ====================
        case 'get_public_rooms': {
          const publicRooms = [];
          for (let [code, room] of rooms) {
            if (!room.isPrivate && room.players.length < 2 && !room.gameStarted) {
              publicRooms.push({
                code: room.code,
                lang: room.lang,
                multiMode: room.multiMode,
                playerCount: room.players.length,
                hostName: room.players[0]?.name || 'Player'
              });
            }
          }
          sendToClient(ws, 'public_rooms_list', { rooms: publicRooms });
          console.log(`[ROOMS] Sent ${publicRooms.length} public rooms to ${ws.nickname}`);
          break;
        }
        
        // ==================== CREATE ROOM ====================
        case 'create_room': {
          if (findRoomByPlayer(ws.id)) {
            sendToClient(ws, 'error', { message: 'You are already in a room' });
            return;
          }
          
          const code = generateRoomCode();
          const room = {
            code,
            host: ws.id,
            guest: null,
            lang: data.lang || 'ru',
            multiMode: data.multiMode || 'async',
            isPrivate: data.isPrivate !== undefined ? data.isPrivate : false,
            players: [{ 
              id: ws.id, 
              name: ws.nickname || 'Player 1', 
              avatarUrl: ws.avatarUrl || '', 
              activeColor: ws.activeColor || '',
              ready: false, 
              wordSet: false 
            }],
            gameStarted: false,
            wordPhase: false,
            hostWord: '',
            guestWord: '',
            hostAttempts: [],
            guestAttempts: [],
            currentTurn: null,
            hostGameOver: false,
            guestGameOver: false,
            hostWon: false,
            guestWon: false,
            turnTimer: null,
            duelTimer: null,
            lastActivity: Date.now()
          };
          
          rooms.set(code, room);
          
          sendToClient(ws, 'room_created', {
            code: room.code,
            players: room.players,
            isHost: true,
            isPrivate: room.isPrivate,
            lang: room.lang
          });
          console.log(`[ROOM] Created: ${code} (${room.lang}, ${room.multiMode}, ${room.isPrivate ? 'private' : 'public'})`);
          break;
        }
        
        // ==================== JOIN ROOM ====================
        case 'join_room': {
          const code = data.code?.toUpperCase();
          const room = rooms.get(code);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'Room not found' });
            return;
          }
          
          if (room.players.length >= 2) {
            sendToClient(ws, 'error', { message: 'Room is full' });
            return;
          }
          
          if (room.isPrivate && data.code?.toUpperCase() !== room.code) {
            sendToClient(ws, 'error', { message: 'Room is private. Use the code to join.' });
            return;
          }
          
          const joinLang = data.lang || 'ru';
          if (joinLang !== room.lang) {
            const msg = joinLang === 'ru' 
              ? 'This room is for English language. Create a Russian room.' 
              : 'Эта комната для русского языка. Создайте английскую комнату.';
            sendToClient(ws, 'error', { message: msg });
            return;
          }
          
          const existingRoom = findRoomByPlayer(ws.id);
          if (existingRoom && existingRoom !== room) {
            sendToClient(ws, 'error', { message: 'You are already in another room' });
            return;
          }
          
          room.guest = ws.id;
          room.players.push({ 
            id: ws.id, 
            name: ws.nickname || 'Player 2', 
            avatarUrl: ws.avatarUrl || '', 
            activeColor: ws.activeColor || '',
            ready: false, 
            wordSet: false 
          });
          room.lastActivity = Date.now();
          
          sendToClient(ws, 'room_joined', {
            code: room.code,
            players: room.players,
            isHost: false,
            isPrivate: room.isPrivate,
            lang: room.lang
          });
          
          const hostWs = clients.get(room.host);
          if (hostWs) {
            sendToClient(hostWs, 'player_joined', {
              players: room.players
            });
          }
          console.log(`[ROOM] ${ws.nickname} joined ${room.code}`);
          break;
        }
        
        // ==================== QUICK PLAY ====================
        case 'quick_play': {
          const myLang = data.lang || 'ru';
          const myMode = data.multiMode || 'async';
          let foundRoom = false;
          
          for (let [code, room] of rooms) {
            if (
              room.players.length < 2 && 
              !room.gameStarted && 
              room.lang === myLang && 
              room.multiMode === myMode &&
              !room.isPrivate
            ) {
              room.guest = ws.id;
              room.players.push({ 
                id: ws.id, 
                name: ws.nickname || 'Player 2', 
                avatarUrl: ws.avatarUrl || '', 
                activeColor: ws.activeColor || '',
                ready: false, 
                wordSet: false 
              });
              room.lastActivity = Date.now();
              
              sendToClient(ws, 'room_joined', {
                code: room.code,
                players: room.players,
                isHost: false,
                isPrivate: false,
                lang: room.lang
              });
              
              const hostWs = clients.get(room.host);
              if (hostWs) {
                sendToClient(hostWs, 'player_joined', {
                  players: room.players
                });
              }
              foundRoom = true;
              console.log(`[QUICK] ${ws.nickname} joined ${room.code}`);
              break;
            }
          }
          
          if (!foundRoom) {
            const code = generateRoomCode();
            const room = {
              code,
              host: ws.id,
              guest: null,
              lang: myLang,
              multiMode: myMode,
              isPrivate: false,
              players: [{ 
                id: ws.id, 
                name: ws.nickname || 'Player 1', 
                avatarUrl: ws.avatarUrl || '', 
                activeColor: ws.activeColor || '',
                ready: false, 
                wordSet: false 
              }],
              gameStarted: false,
              wordPhase: false,
              hostWord: '',
              guestWord: '',
              hostAttempts: [],
              guestAttempts: [],
              currentTurn: null,
              hostGameOver: false,
              guestGameOver: false,
              hostWon: false,
              guestWon: false,
              turnTimer: null,
              duelTimer: null,
              lastActivity: Date.now()
            };
            
            rooms.set(code, room);
            
            sendToClient(ws, 'room_created', {
              code: room.code,
              players: room.players,
              isHost: true,
              isPrivate: false,
              lang: room.lang
            });
            console.log(`[QUICK] Created room ${code} (${ws.nickname})`);
          }
          break;
        }
        
        // ==================== TOGGLE ROOM TYPE ====================
        case 'toggle_room_type': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'You are not in a room' });
            return;
          }
          
          if (ws.id !== room.host) {
            sendToClient(ws, 'error', { message: 'Only host can change room type' });
            return;
          }
          
          room.isPrivate = data.isPrivate;
          room.lastActivity = Date.now();
          console.log(`[ROOM] ${room.code} is now ${room.isPrivate ? 'private' : 'public'}`);
          
          broadcastToRoom(room, 'room_type_changed', {
            isPrivate: room.isPrivate
          });
          break;
        }
        
        // ==================== KICK PLAYER ====================
        case 'kick_player': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'You are not in a room' });
            return;
          }
          
          if (ws.id !== room.host) {
            sendToClient(ws, 'error', { message: 'Only host can kick players' });
            return;
          }
          
          if (room.gameStarted) {
            sendToClient(ws, 'error', { message: 'Cannot kick during game' });
            return;
          }
          
          const kickedPlayer = room.players.find(p => p.id === data.playerId);
          if (!kickedPlayer) {
            sendToClient(ws, 'error', { message: 'Player not found' });
            return;
          }
          
          if (kickedPlayer.id === ws.id) {
            sendToClient(ws, 'error', { message: 'Cannot kick yourself' });
            return;
          }
          
          const kickedWs = clients.get(data.playerId);
          
          if (kickedWs) {
            sendToClient(kickedWs, 'player_kicked', {
              playerId: data.playerId,
              code: room.code,
              message: 'You have been kicked from the room'
            });
          }
          
          removePlayerFromRoom(room, data.playerId);
          
          console.log(`[KICK] ${kickedPlayer.name} kicked from ${room.code}`);
          break;
        }
        
        // ==================== CHAT MESSAGE ====================
        case 'chat_message': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'You are not in a room' });
            return;
          }
          
          // Anti-spam
          if (isSpamming(ws.id)) {
            sendToClient(ws, 'error', { message: 'Slow down! Please wait before sending.' });
            return;
          }
          
          // Sanitize and filter message
          const sanitizedMessage = (data.message || '').substring(0, 100).replace(/[<>]/g, '');
          const filteredMessage = filterProfanity(sanitizedMessage, room.lang);
          
          if (!filteredMessage.trim()) {
            return;
          }
          
          room.lastActivity = Date.now();
          
          // Broadcast to ALL players including sender (with filtered message)
          broadcastToRoom(room, 'chat_message', {
            sender: ws.nickname || 'Player',
            message: filteredMessage,
            room: data.room || 'lobby',
            activeColor: ws.activeColor || '',
            senderId: ws.id
          });
          break;
        }
        
        // ==================== PLAYER READY ====================
        case 'player_ready': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'You are not in a room' });
            return;
          }
          
          const player = room.players.find(p => p.id === ws.id);
          if (!player) return;
          
          player.ready = true;
          room.lastActivity = Date.now();
          console.log(`[READY] ${player.name} ready in ${room.code}`);
          
          // Broadcast updated player list
          broadcastToRoom(room, 'players_update', {
            players: room.players
          });
          
          const allReady = room.players.length === 2 && room.players.every(p => p.ready);
          
          if (allReady && !room.wordPhase) {
            room.wordPhase = true;
            console.log(`[READY] All ready in ${room.code}`);
            
            broadcastToRoom(room, 'all_ready', {
              message: 'All ready! Set your words.'
            });
          }
          break;
        }
        
        // ==================== SET WORD ====================
        case 'set_word': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'You are not in a room' });
            return;
          }
          
          if (!room.wordPhase && room.multiMode === 'async') {
            sendToClient(ws, 'error', { message: 'Wait for all players to be ready' });
            return;
          }
          
          if (!data.word || !isValidWord(data.word, room.lang)) {
            const msg = room.lang === 'ru' 
              ? 'Недопустимое слово (5 русских букв, без запрещённых слов)' 
              : 'Invalid word (5 English letters, no banned words)';
            sendToClient(ws, 'error', { message: msg });
            return;
          }
          
          const upperWord = data.word.toUpperCase();
          const player = room.players.find(p => p.id === ws.id);
          
          if (ws.id === room.host) {
            room.hostWord = upperWord;
          } else {
            room.guestWord = upperWord;
          }
          
          player.wordSet = true;
          room.lastActivity = Date.now();
          console.log(`[WORD] ${player.name} set word in ${room.code}`);
          
          // Broadcast updated players
          broadcastToRoom(room, 'players_update', {
            players: room.players
          });
          
          if (room.players.length === 2 && room.players.every(p => p.wordSet) && !room.gameStarted) {
            startGame(room);
          } else {
            const waiting = room.players.filter(p => !p.wordSet);
            if (waiting.length > 0) {
              broadcastToRoom(room, 'waiting_for_words', {
                message: `Waiting for: ${waiting.map(p => p.name).join(', ')}`,
                players: room.players
              });
            }
          }
          break;
        }
        
        // ==================== MAKE GUESS ====================
        case 'make_guess': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'You are not in a game' });
            return;
          }
          
          if (!room.gameStarted) {
            sendToClient(ws, 'error', { message: 'Game has not started' });
            return;
          }
          
          if (room.multiMode === 'async' && room.currentTurn !== ws.id) {
            sendToClient(ws, 'error', { message: 'Not your turn' });
            return;
          }
          
          if (!data.guess || !isValidWord(data.guess, room.lang)) {
            const msg = room.lang === 'ru' 
              ? 'Недопустимое слово' 
              : 'Invalid word';
            sendToClient(ws, 'error', { message: msg });
            return;
          }
          
          const upperGuess = data.guess.toUpperCase();
          const isHost = ws.id === room.host;
          const targetWord = isHost ? room.guestWord : room.hostWord;
          const result = evaluateGuess(upperGuess, targetWord);
          
          if (isHost) {
            room.hostAttempts.push({ word: upperGuess, result });
          } else {
            room.guestAttempts.push({ word: upperGuess, result });
          }
          room.lastActivity = Date.now();
          
          console.log(`[GUESS] ${isHost ? 'Host' : 'Guest'} (${ws.nickname}): ${upperGuess} -> ${result.join(',')}`);
          
          sendToClient(ws, 'guess_result', {
            guess: upperGuess,
            result,
            attempts: isHost ? room.hostAttempts : room.guestAttempts
          });
          
          // Update opponent with latest attempts
          const opponentId = isHost ? room.guest : room.host;
          const opponentWs = clients.get(opponentId);
          const opponentPlayer = room.players.find(p => p.id === opponentId);
          
          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            sendToClient(opponentWs, 'opponent_update', {
              opponentAttempts: isHost ? room.hostAttempts : room.guestAttempts,
              opponentNickname: ws.nickname,
              opponentAvatar: ws.avatarUrl || '',
              opponentColor: ws.activeColor || ''
            });
          }
          
          // Check for win
          if (upperGuess === targetWord) {
            clearRoomTimers(room);
            
            if (isHost) {
              room.hostGameOver = true;
              room.hostWon = true;
            } else {
              room.guestGameOver = true;
              room.guestWon = true;
            }
            
            const winnerPlayer = room.players.find(p => p.id === ws.id);
            const winnerName = winnerPlayer?.name || 'Player';
            
            sendToClient(ws, 'game_won', { 
              word: targetWord,
              winnerId: ws.id,
              winnerNickname: winnerName,
              winnerColor: winnerPlayer?.activeColor || ''
            });
            
            if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
              sendToClient(opponentWs, 'game_lost', {
                winnerId: ws.id,
                winnerNickname: winnerName,
                winnerColor: winnerPlayer?.activeColor || '',
                word: isHost ? room.hostWord : room.guestWord
              });
            }
            
            broadcastToRoom(room, 'game_over', {
              winnerId: ws.id,
              winnerNickname: winnerName,
              winnerColor: winnerPlayer?.activeColor || '',
              word: targetWord
            });
            
            // Reset for potential rematch
            setTimeout(() => {
              if (rooms.has(room.code)) {
                resetRoomGameState(room);
                broadcastToRoom(room, 'players_update', {
                  players: room.players
                });
              }
            }, 3000);
            
            return;
          }
          
          // Check if attempts exhausted (only for async mode, live mode continues)
          const attempts = isHost ? room.hostAttempts : room.guestAttempts;
          if (room.multiMode === 'async' && attempts.length >= 6) {
            if (isHost) room.hostGameOver = true;
            else room.guestGameOver = true;
            
            const loserPlayer = room.players.find(p => p.id === ws.id);
            const oppPlayer = room.players.find(p => p.id === opponentId);
            const oppName = oppPlayer?.name || 'Opponent';
            
            sendToClient(ws, 'game_lost', {
              message: 'Out of attempts',
              word: targetWord,
              winnerId: opponentId,
              winnerNickname: oppName,
              winnerColor: oppPlayer?.activeColor || ''
            });
            
            // If both game over, end game
            if (room.hostGameOver && room.guestGameOver) {
              clearRoomTimers(room);
              broadcastToRoom(room, 'game_over', {
                winnerId: null,
                message: 'Both players exhausted attempts',
                word: null
              });
              
              setTimeout(() => {
                if (rooms.has(room.code)) {
                  resetRoomGameState(room);
                  broadcastToRoom(room, 'players_update', {
                    players: room.players
                  });
                }
              }, 3000);
              return;
            }
            
            // If only one game over, the other player continues
            if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
              sendToClient(opponentWs, 'game_won', {
                word: isHost ? room.hostWord : room.guestWord,
                winnerId: opponentId,
                winnerNickname: oppName,
                winnerColor: oppPlayer?.activeColor || ''
              });
              
              setTimeout(() => {
                if (rooms.has(room.code)) {
                  resetRoomGameState(room);
                  broadcastToRoom(room, 'players_update', {
                    players: room.players
                  });
                }
              }, 3000);
            }
            
            return;
          }
          
          // Pass turn (async mode only)
          if (room.multiMode === 'async') {
            if (room.hostGameOver) {
              room.currentTurn = room.guest;
            } else if (room.guestGameOver) {
              room.currentTurn = room.host;
            } else {
              room.currentTurn = isHost ? room.guest : room.host;
            }
            
            // Reset turn timer
            if (room.turnTimer) {
              clearInterval(room.turnTimer);
              room.turnTimer = null;
            }
            startTurnTimer(room);
            
            const nextPlayer = clients.get(room.currentTurn);
            if (nextPlayer && nextPlayer.readyState === WebSocket.OPEN) {
              sendToClient(nextPlayer, 'your_turn', { message: 'Your turn' });
            }
          }
          break;
        }
        
        // ==================== DUEL TIMEOUT ====================
        case 'duel_timeout': {
          const room = findRoomByPlayer(ws.id);
          if (!room) return;
          
          clearRoomTimers(room);
          broadcastToRoom(room, 'duel_timeout', {
            message: 'Duel time expired!'
          });
          
          setTimeout(() => {
            if (rooms.has(room.code)) {
              resetRoomGameState(room);
              broadcastToRoom(room, 'players_update', {
                players: room.players
              });
            }
          }, 3000);
          break;
        }
        
        // ==================== LEAVE ROOM ====================
        case 'leave_room': {
          const room = findRoomByPlayer(ws.id);
          
          if (room) {
            clearRoomTimers(room);
            const player = removePlayerFromRoom(room, ws.id);
            
            if (player) {
              console.log(`[LEAVE] ${player.name} left ${room.code}`);
              
              if (room.players.length > 0) {
                broadcastToRoom(room, 'player_left', {
                  message: `${player.name} left the room`,
                  players: room.players
                });
              }
            }
          }
          break;
        }
        
        default:
          console.log(`[?] Unknown type from ${ws.nickname}: ${data.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendToClient(ws, 'error', { message: 'Server error processing your request' });
    }
  });

  ws.on('close', () => {
    console.log(`[-] Player disconnected: ${ws.id} (${ws.nickname})`);
    
    const room = findRoomByPlayer(ws.id);
    if (room) {
      clearRoomTimers(room);
      const player = removePlayerFromRoom(room, ws.id);
      
      if (player && room.players.length > 0) {
        broadcastToRoom(room, 'player_left', {
          message: `${player.name} disconnected`,
          players: room.players
        });
      }
    }
    
    clients.delete(ws.id);
  });
  
  ws.on('error', (error) => {
    console.error(`[ERROR] WebSocket error for ${ws.nickname}:`, error.message);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received. Cleaning up...');
  for (let [code, room] of rooms) {
    clearRoomTimers(room);
    broadcastToRoom(room, 'player_left', {
      message: 'Server shutting down',
      players: []
    });
  }
  rooms.clear();
  wss.close();
  server.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Wordle Server v7 running on port ${PORT}`);
  console.log(`📡 WebSocket: wss://localhost:${PORT}`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  console.log(`🛡️  Word validation: ENABLED (banned words filtered)`);
  console.log(`🚫 Anti-spam: ENABLED (${MAX_MESSAGES_PER_SECOND} msg/sec, ${MESSAGE_COOLDOWN}ms cooldown)`);
  console.log(`📋 Public rooms list: ENABLED`);
  console.log(`🔒 Chat profanity filter: ENABLED`);
  console.log(`⏱️  Turn timer: 60s (async) | Duel timer: 180s (live)`);
  console.log(`🔄 Room cleanup: 30min inactivity`);
  console.log(`========================================`);
});
