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
  
  res.writeHead(200);
  res.end('Wordle Multiplayer Server v5');
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();
const clients = new Map();

// Word lists
const WORDS_RU = 'АРБУЗ,БАНКА,ВЕТЕР,ГОРОД,ДОЖДЬ,ЖАБРА,ЗЕБРА,ИГРОК,КАРТА,ЛОДКА,МОРОЗ,НОСОК,ПАРУС,РОМАН,САХАР,ТУМАН,ФАКЕЛ,ЦАПЛЯ,ЧАШКА,ШТОРМ,ЩЕНОК,ЭКРАН,ЮНОША,ЯБЕДА,ПИРОГ,ТОЧКА,РУЧКА,КНИГА,КОШКА,МЫШКА,ЗЕМЛЯ,ВОЛНА,ГРОЗА,ЗАКАТ,ОГОНЬ,БЕРЕГ,ЗАМОК,ЛИМОН,НИТКА,РУБЛЬ,СМЕНА,ТРОПА,ХОЛОД,ГОРКА,ИСКРА,СОСНА,ТОПОР,ЗВЕЗД,КЛЮЧИ,ПОЛЕТ,МЕСЯЦ,БРОВИ,МЕЧТА,ОТВЕТ,СЛОВО,ЧИСЛО,МЕСТО,ВРЕМЯ,ВЕЧЕР,УТРОМ,МЫСЛЬ'.split(',').filter(w => w.length === 5);
const WORDS_EN = 'ABOUT,ABOVE,ACTOR,ADMIT,ADOPT,ADULT,AFTER,AGAIN,AGENT,ALBUM,ALERT,ALIKE,ALIVE,ALLOW,ALONE,ANGEL,ANGRY,APPLE,ARENA,ARGUE,ARISE,ARROW,ASIDE,AVOID,AWARD,BASIC,BEACH,BEGAN,BEGIN,BEING,BELOW,BIRTH,BLACK,BLADE,BLAME,BLANK,BLAST,BLAZE,BLEED,BLESS,BLIND,BLOCK,BLOOD,BOARD,BOOST,BRAIN,BRAND,BRAVE,BREAK,BREED,BRICK,BRIEF,BRING,BROAD,BROWN,BRUSH,BUILD,BURST,CANDY,CARRY,CAUSE,CHAIN,CHAIR,CHAOS,CHARM,CHEAP,CHECK,CHESS,CHEST,CHILD,CLEAN,CLEAR,CLIMB,CLOSE,CLOUD,COAST,COLOR,CORAL,COULD,COUNT,COURT,COVER,CRACK,CRAFT,CRASH,CRAZY,CREAM,CRIME,CROSS,CROWD,CROWN,CRUSH,CURVE,CYCLE,DAILY,DANCE,DEATH,DELAY,DEVIL,DIARY,DIRTY,DOING,DOUBT,DOUGH,DRAFT,DRAMA,DREAM,DRESS,DRINK,DRIVE,DRONE,EARLY,EARTH,EIGHT,ELECT,ELITE,EMPTY,ENEMY,ENJOY,ENTER,EQUAL,ERROR,EVENT,EVERY,EXACT,EXIST,EXTRA,FAITH,FALSE,FAULT,FENCE,FEVER,FIELD,FIGHT,FINAL,FIRST,FLAME,FLASH,FLOAT,FLOOR,FLUID,FOCUS,FORCE,FORTH,FOUND,FRAME,FRESH,FRONT,FROST,FRUIT,FULLY,FUNNY,GHOST,GIANT,GIVEN,GLASS,GLOBE,GLORY,GOING,GRACE,GRADE,GRAIN,GRAND,GRANT,GRASS,GRAVE,GREAT,GREEN,GROUP,GUARD,GUESS,GUEST,GUIDE,HAPPY,HEART,HEAVY,HELLO,HONEY,HONOR,HORSE,HOTEL,HOUSE,HUMAN,HUMOR,HURRY,IMAGE,INDEX,INNER,INPUT,ISSUE,JEWEL,JOINT,JUDGE,JUICE,KNOWN,LABEL,LARGE,LATER,LAUGH,LAYER,LEARN,LEAVE,LEGAL,LEVEL,LIGHT,LIMIT,LOCAL,LOGIC,LOOSE,LUNCH,MAGIC,MAJOR,MARCH,MATCH,MEDIA,METAL,MIGHT,MINOR,MINUS,MIXED,MODEL,MONEY,MONTH,MOUNT,MOUSE,MOUTH,MOVIE,MUSIC,NERVE,NEVER,NIGHT,NOISE,NORTH,NOVEL,NURSE,OCEAN,OFFER,OFTEN,OLIVE,ORDER,OTHER,OUGHT,OUTER,OWNER,PAINT,PANEL,PAPER,PARTY,PEACE,PEARL,PHASE,PHONE,PHOTO,PIANO,PIECE,PILOT,PIXEL,PLACE,PLAIN,PLANE,PLANT,PLATE,POINT,POWER,PRESS,PRICE,PRIDE,PRIME,PRIZE,PROOF,PROUD,PROVE,PUPIL,QUEEN,QUEST,QUICK,QUIET,QUITE,RADIO,RAISE,RANGE,RAPID,REACH,REACT,READY,REALM,REIGN,REPLY,RIGHT,RIVER,ROBOT,ROCKY,ROUGH,ROUND,ROUTE,ROYAL,RULER,RURAL,SAINT,SALAD,SAUCE,SCALE,SCENE,SCOPE,SCORE,SENSE,SERVE,SEVEN,SHADE,SHAKE,SHALL,SHAME,SHAPE,SHARE,SHARP,SHELF,SHELL,SHIFT,SHINE,SHIRT,SHOCK,SHOOT,SHORT,SHOUT,SIGHT,SINCE,SIXTH,SIXTY,SKILL,SLAVE,SLEEP,SLICE,SLIDE,SMART,SMELL,SMILE,SMOKE,SNAKE,SOLAR,SOLID,SOLVE,SORRY,SOUTH,SPACE,SPARE,SPARK,SPEAK,SPEED,SPEND,SPILL,SPINE,SPLIT,SPORT,SPRAY,SQUAD,STACK,STAGE,STAND,START,STATE,STEAM,STEEL,STICK,STILL,STOCK,STONE,STORE,STORM,STORY,STUDY,STYLE,SUGAR,SUPER,SWEAR,SWEEP,SWEET,SWIFT,SWING,SWORD,TABLE,TASTE,TEACH,THANK,THEIR,THEME,THERE,THICK,THING,THINK,THIRD,THOSE,THREE,THROW,TIGHT,TIRED,TITLE,TODAY,TOKEN,TOOTH,TOTAL,TOUCH,TOUGH,TOWER,TRACK,TRADE,TRAIL,TRAIN,TREAT,TREND,TRIAL,TRIBE,TRICK,TROOP,TRUCK,TRULY,TRUST,TRUTH,TWICE,TWIST,UNDER,UNION,UNITY,UNTIL,UPPER,UPSET,URBAN,USUAL,VALID,VALUE,VIDEO,VIRAL,VIRUS,VISIT,VITAL,VOCAL,VOICE,WATCH,WATER,WEIGH,WHEAT,WHEEL,WHERE,WHICH,WHILE,WHITE,WHOLE,WHOSE,WOMAN,WOMEN,WORLD,WORRY,WORSE,WORST,WORTH,WOULD,WOUND,WRITE,WRONG,WROTE,YACHT,YIELD,YOUNG,YOUTH,ZEBRA'.split(',').filter(w => w.length === 5);

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
    let targetIndex = targetLetters.findIndex((l, idx) => l === letter && !matched[idx]);
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
    rooms.delete(room.code);
    console.log(`[ROOM] ${room.code} deleted (no players)`);
    return null;
  }
  
  if (playerId === room.host) {
    room.host = room.players[0].id;
    room.guest = null;
    console.log(`[ROOM] New host in ${room.code}: ${room.host}`);
  }
  
  // Reset game state
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
  room.players.forEach(p => {
    p.ready = false;
    p.wordSet = false;
  });
  
  return player;
}

function startGame(room) {
  room.gameStarted = true;
  
  const firstTurn = Math.random() < 0.5 ? room.host : room.guest;
  room.currentTurn = firstTurn;
  
  console.log(`[GAME] Started in ${room.code}, first turn: ${firstTurn === room.host ? 'Host' : 'Guest'}`);
  
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
  
  broadcastToRoom(room, 'battle_start', {
    message: 'Both words set! BATTLE BEGINS!'
  });
}

// Update player info in room
function updatePlayerInfo(ws, data) {
  const room = findRoomByPlayer(ws.id);
  if (!room) return;
  
  const player = room.players.find(p => p.id === ws.id);
  if (!player) return;
  
  if (data.nickname) {
    ws.nickname = data.nickname;
    player.name = data.nickname;
  }
  if (data.avatarUrl !== undefined) {
    ws.avatarUrl = data.avatarUrl;
    player.avatarUrl = data.avatarUrl;
  }
  if (data.activeColor !== undefined) {
    ws.activeColor = data.activeColor;
    player.activeColor = data.activeColor;
  }
  
  // Broadcast updated player list to room
  broadcastToRoom(room, 'players_update', {
    players: room.players
  });
}

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
      
      // Always update player info
      updatePlayerInfo(ws, data);
      
      console.log(`[${ws.id}] ${data.type}`);
      
      switch (data.type) {
        
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
            isPrivate: data.isPrivate || false,
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
            guestWon: false
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
          const room = rooms.get(data.code?.toUpperCase());
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'Room not found' });
            return;
          }
          
          if (room.players.length >= 2) {
            sendToClient(ws, 'error', { message: 'Room is full' });
            return;
          }
          
          const joinLang = data.lang || 'ru';
          if (joinLang !== room.lang) {
            const msg = joinLang === 'ru' 
              ? 'This room is for English language' 
              : 'Эта комната для английского языка';
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
              guestWon: false
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
          
          broadcastToRoom(room, 'player_kicked', {
            playerId: data.playerId,
            players: room.players
          });
          
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
          
          // Send chat with player's active color
          broadcastToRoom(room, 'chat_message', {
            sender: ws.nickname || 'Player',
            message: data.message,
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
          console.log(`[READY] ${player.name} ready in ${room.code}`);
          
          sendToClient(ws, 'ready_status', { 
            ready: true,
            players: room.players 
          });
          
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
          
          const wordRegex = room.lang === 'ru' ? /^[А-ЯЁ]+$/i : /^[A-Z]+$/i;
          
          if (!data.word || data.word.length !== 5 || !wordRegex.test(data.word)) {
            const msg = room.lang === 'ru' ? 'Invalid word (5 Russian letters)' : 'Invalid word (5 English letters)';
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
          console.log(`[WORD] ${player.name} set word in ${room.code}`);
          
          sendToClient(ws, 'word_set_status', {
            wordSet: true,
            players: room.players
          });
          
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
          
          const wordRegex = room.lang === 'ru' ? /^[А-ЯЁ]+$/i : /^[A-Z]+$/i;
          
          if (!data.guess || data.guess.length !== 5 || !wordRegex.test(data.guess)) {
            const msg = room.lang === 'ru' ? 'Invalid word' : 'Invalid word';
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
          
          console.log(`[GUESS] ${isHost ? 'Host' : 'Guest'}: ${upperGuess} -> ${result.join(',')}`);
          
          sendToClient(ws, 'guess_result', {
            guess: upperGuess,
            result,
            attempts: isHost ? room.hostAttempts : room.guestAttempts
          });
          
          // Check for win
          if (upperGuess === targetWord) {
            if (isHost) {
              room.hostGameOver = true;
              room.hostWon = true;
            } else {
              room.guestGameOver = true;
              room.guestWon = true;
            }
            
            const winnerPlayer = room.players.find(p => p.id === ws.id);
            const loserPlayer = room.players.find(p => p.id !== ws.id);
            const winnerName = winnerPlayer?.name || 'Player';
            
            sendToClient(ws, 'game_won', { 
              word: targetWord,
              winnerId: ws.id,
              winnerNickname: winnerName,
              winnerColor: winnerPlayer?.activeColor || ''
            });
            
            const opponentWs = clients.get(isHost ? room.guest : room.host);
            if (opponentWs) {
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
            
            return;
          }
          
          // Check if attempts exhausted
          const attempts = isHost ? room.hostAttempts : room.guestAttempts;
          if (attempts.length >= 6) {
            if (isHost) room.hostGameOver = true;
            else room.guestGameOver = true;
            
            const loserPlayer = room.players.find(p => p.id === ws.id);
            const opponentId = isHost ? room.guest : room.host;
            const opponentPlayer = room.players.find(p => p.id === opponentId);
            const opponentName = opponentPlayer?.name || 'Opponent';
            
            sendToClient(ws, 'game_lost', {
              message: 'Out of attempts',
              word: targetWord,
              winnerId: opponentId,
              winnerNickname: opponentName,
              winnerColor: opponentPlayer?.activeColor || ''
            });
            
            if (room.hostGameOver && room.guestGameOver) {
              broadcastToRoom(room, 'game_over', {
                winnerId: null,
                message: 'Draw! Both failed to guess.',
                word: null
              });
              return;
            }
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
            
            const nextPlayer = clients.get(room.currentTurn);
            if (nextPlayer && nextPlayer.readyState === WebSocket.OPEN) {
              sendToClient(nextPlayer, 'your_turn', { message: 'Your turn' });
            }
          }
          
          // Update opponent
          const opponentId = isHost ? room.guest : room.host;
          const opponentWs = clients.get(opponentId);
          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            sendToClient(opponentWs, 'opponent_update', {
              opponentAttempts: isHost ? room.hostAttempts : room.guestAttempts
            });
          }
          break;
        }
        
        // ==================== LEAVE ROOM ====================
        case 'leave_room': {
          const room = findRoomByPlayer(ws.id);
          
          if (room) {
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
          console.log(`[?] Unknown type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`[-] Player disconnected: ${ws.id} (${ws.nickname})`);
    
    const room = findRoomByPlayer(ws.id);
    if (room) {
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket: wss://localhost:${PORT}`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`========================================`);
});
