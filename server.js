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
  res.end('Wordle Multiplayer Server v2');
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();
const clients = new Map();

// Списки слов
const WORDS_RU = 'АРБУЗ,БАНКА,ВЕТЕР,ГОРОД,ДОЖДЬ,ЖАБРА,ЗЕБРА,ИГРОК,КАРТА,ЛОДКА,МОРОЗ,НОСОК,ПАРУС,РОМАН,САХАР,ТУМАН,ФАКЕЛ,ХЛЕБ,ЦАПЛЯ,ЧАШКА,ШТОРМ,ЩЕНОК,ЭКРАН,ЮНОША,ЯБЕДА,ПИРОГ,ТОЧКА,РУЧКА,КНИГА,КОШКА,МЫШКА,ЗЕМЛЯ,ВОЛНА,ГРОЗА,ЗАКАТ,ОГОНЬ,БЕРЕГ,ГРИБ,ДЕРЕВ,ЗАМОК,ЛИМОН,МАЯК,НИТКА,ОБЛАК,РУБЛЬ,СМЕНА,ТРОПА,УТЁС,ХОЛОД,ЦВЕТ,ЯЩИК,ГОРКА,ЗОНТ,ИСКРА,КЕДР,СОСНА,ТОПОР'.split(',').filter(w => w.length === 5);
const WORDS_EN = 'ABOUT,ABOVE,ACTOR,ADMIT,ADOPT,ADULT,AFTER,AGAIN,AGENT,ALBUM,ALERT,ALIKE,ALIVE,ALLOW,ALONE,ANGEL,ANGRY,APPLE,ARENA,ARGUE,ARISE,ARROW,ASIDE,AVOID,AWARD,BASIC,BEACH,BEGAN,BEGIN,BEING,BELOW,BIRTH,BLACK,BLADE,BLAME,BLANK,BLAST,BLAZE,BLEED,BLESS,BLIND,BLOCK,BLOOD,BOARD,BOOST,BRAIN,BRAND,BRAVE,BREAK,BREED,BRICK,BRIEF,BRING,BROAD,BROWN,BRUSH,BUILD,BURST,CANDY,CARRY,CAUSE,CHAIN,CHAIR,CHAOS,CHARM,CHEAP,CHECK,CHESS,CHEST,CHILD,CLEAN,CLEAR,CLIMB,CLOSE,CLOUD,COAST,COLOR,CORAL,COULD,COUNT,COURT,COVER,CRACK,CRAFT,CRASH,CRAZY,CREAM,CRIME,CROSS,CROWD,CROWN,CRUSH,CURVE,CYCLE,DAILY,DANCE,DEATH,DELAY,DEVIL,DIARY,DIRTY,DOING,DOUBT,DOUGH,DRAFT,DRAMA,DREAM,DRESS,DRINK,DRIVE,DRONE,EARLY,EARTH,EIGHT,ELECT,ELITE,EMPTY,ENEMY,ENJOY,ENTER,EQUAL,ERROR,EVENT,EVERY,EXACT,EXIST,EXTRA,FAITH,FALSE,FAULT,FENCE,FEVER,FIELD,FIGHT,FINAL,FIRST,FLAME,FLASH,FLOAT,FLOOR,FLUID,FOCUS,FORCE,FORTH,FOUND,FRAME,FRESH,FRONT,FROST,FRUIT,FULLY,FUNNY,GHOST,GIANT,GIVEN,GLASS,GLOBE,GLOOM,GLORY,GOING,GRACE,GRADE,GRAIN,GRAND,GRANT,GRASS,GRAVE,GREAT,GREEN,GROUP,GUARD,GUESS,GUEST,GUIDE,HAPPY,HEART,HEAVY,HELLO,HONEY,HONOR,HORSE,HOTEL,HOUSE,HUMAN,HUMOR,HURRY,IMAGE,INDEX,INNER,INPUT,ISSUE,JEWEL,JOINT,JUDGE,JUICE,KNOWN,LABEL,LARGE,LATER,LAUGH,LAYER,LEARN,LEAVE,LEGAL,LEVEL,LIGHT,LIMIT,LOCAL,LOGIC,LOOSE,LUNCH,MAGIC,MAJOR,MARCH,MATCH,MEDIA,METAL,MIGHT,MINOR,MINUS,MIXED,MODEL,MONEY,MONTH,MOUNT,MOUSE,MOUTH,MOVIE,MUSIC,NERVE,NEVER,NIGHT,NOISE,NORTH,NOVEL,NURSE,OCEAN,OFFER,OFTEN,OLIVE,ORDER,OTHER,OUGHT,OUTER,OWNER,PAINT,PANEL,PAPER,PARTY,PEACE,PEARL,PHASE,PHONE,PHOTO,PIANO,PIECE,PILOT,PIXEL,PLACE,PLAIN,PLANE,PLANT,PLATE,POINT,POWER,PRESS,PRICE,PRIDE,PRIME,PRIZE,PROOF,PROUD,PROVE,PUPIL,QUEEN,QUEST,QUICK,QUIET,QUITE,RADIO,RAISE,RANGE,RAPID,REACH,REACT,READY,REALM,REIGN,REPLY,RIGHT,RIVER,ROBOT,ROCKY,ROUGE,ROUGH,ROUND,ROUTE,ROYAL,RULER,RURAL,SAINT,SALAD,SAUCE,SCALE,SCENE,SCOPE,SCORE,SENSE,SERVE,SEVEN,SHADE,SHAKE,SHALL,SHAME,SHAPE,SHARE,SHARP,SHELF,SHELL,SHIFT,SHINE,SHIRT,SHOCK,SHOOT,SHORT,SHOUT,SIGHT,SINCE,SIXTH,SIXTY,SKILL,SLAVE,SLEEP,SLICE,SLIDE,SMART,SMELL,SMILE,SMOKE,SNAKE,SOLAR,SOLID,SOLVE,SORRY,SOUTH,SPACE,SPARE,SPARK,SPEAK,SPEED,SPEND,SPILL,SPINE,SPLIT,SPORT,SPRAY,SQUAD,STACK,STAGE,STAND,START,STATE,STEAM,STEEL,STICK,STILL,STOCK,STONE,STORE,STORM,STORY,STUDY,STYLE,SUGAR,SUPER,SWEAR,SWEEP,SWEET,SWIFT,SWING,SWORD,TABLE,TASTE,TEACH,THANK,THEIR,THEME,THERE,THICK,THING,THINK,THIRD,THOSE,THREE,THROW,TIGHT,TIRED,TITLE,TODAY,TOKEN,TOOTH,TOTAL,TOUCH,TOUGH,TOWER,TRACK,TRADE,TRAIL,TRAIN,TREAT,TREND,TRIAL,TRIBE,TRICK,TROOP,TRUCK,TRULY,TRUST,TRUTH,TWICE,TWIST,UNDER,UNION,UNITY,UNTIL,UPPER,UPSET,URBAN,USUAL,VALID,VALUE,VIDEO,VIRAL,VIRUS,VISIT,VITAL,VOCAL,VOICE,WATCH,WATER,WEIGH,WHEAT,WHEEL,WHERE,WHICH,WHILE,WHITE,WHOLE,WHOSE,WOMAN,WOMEN,WORLD,WORRY,WORSE,WORST,WORTH,WOULD,WOUND,WRITE,WRONG,WROTE,YACHT,YIELD,YOUNG,YOUTH,ZEBRA'.split(',').filter(w => w.length === 5);

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

// Найти комнату по игроку
function findRoomByPlayer(playerId) {
  for (let [code, room] of rooms) {
    if (room.players.find(p => p.id === playerId)) {
      return room;
    }
  }
  return null;
}

wss.on('connection', (ws) => {
  ws.id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  clients.set(ws.id, ws);
  
  console.log(`[+] Игрок подключился: ${ws.id}`);
  
  sendToClient(ws, 'connected', { playerId: ws.id });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[${ws.id}] ${data.type}`);
      
      switch (data.type) {
        
        // ==================== СОЗДАНИЕ КОМНАТЫ ====================
        case 'create_room': {
          // Проверяем, не в комнате ли уже игрок
          if (findRoomByPlayer(ws.id)) {
            sendToClient(ws, 'error', { message: 'Вы уже в комнате' });
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
            players: [{ id: ws.id, name: 'Игрок 1', ready: false, wordSet: false }],
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
          console.log(`[ROOM] Создана: ${code} (${room.lang}, ${room.multiMode}, ${room.isPrivate ? 'закрытая' : 'открытая'})`);
          break;
        }
        
        // ==================== ВХОД В КОМНАТУ ====================
        case 'join_room': {
          const room = rooms.get(data.code?.toUpperCase());
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'Комната не найдена' });
            return;
          }
          
          if (room.players.length >= 2) {
            sendToClient(ws, 'error', { message: 'Комната заполнена' });
            return;
          }
          
          // Проверка языка
          const joinLang = data.lang || 'ru';
          if (joinLang !== room.lang) {
            const msg = joinLang === 'ru' 
              ? 'Эта комната для английского языка' 
              : 'This room is for Russian language';
            sendToClient(ws, 'error', { message: msg });
            return;
          }
          
          // Проверяем, не в другой ли комнате игрок
          const existingRoom = findRoomByPlayer(ws.id);
          if (existingRoom && existingRoom !== room) {
            sendToClient(ws, 'error', { message: 'Вы уже в другой комнате' });
            return;
          }
          
          room.guest = ws.id;
          room.players.push({ id: ws.id, name: 'Игрок 2', ready: false, wordSet: false });
          
          sendToClient(ws, 'room_joined', {
            code: room.code,
            players: room.players,
            isHost: false,
            isPrivate: room.isPrivate,
            lang: room.lang
          });
          
          // Уведомляем хоста
          const hostWs = clients.get(room.host);
          if (hostWs) {
            sendToClient(hostWs, 'player_joined', {
              players: room.players
            });
          }
          console.log(`[ROOM] Игрок вошёл в ${room.code}`);
          break;
        }
        
        // ==================== БЫСТРАЯ ИГРА ====================
        case 'quick_play': {
          const myLang = data.lang || 'ru';
          const myMode = data.multiMode || 'async';
          let foundRoom = false;
          
          // Ищем открытую комнату с тем же языком и режимом
          for (let [code, room] of rooms) {
            if (
              room.players.length < 2 && 
              !room.gameStarted && 
              room.lang === myLang && 
              room.multiMode === myMode &&
              !room.isPrivate  // Только открытые комнаты!
            ) {
              room.guest = ws.id;
              room.players.push({ id: ws.id, name: 'Игрок 2', ready: false, wordSet: false });
              
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
              console.log(`[QUICK] Присоединился к ${room.code}`);
              break;
            }
          }
          
          if (!foundRoom) {
            // Создаём новую открытую комнату
            const code = generateRoomCode();
            const room = {
              code,
              host: ws.id,
              guest: null,
              lang: myLang,
              multiMode: myMode,
              isPrivate: false,
              players: [{ id: ws.id, name: 'Игрок 1', ready: false, wordSet: false }],
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
            console.log(`[QUICK] Создана комната ${code}`);
          }
          break;
        }
        
        // ==================== ПЕРЕКЛЮЧЕНИЕ ТИПА КОМНАТЫ ====================
        case 'toggle_room_type': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'Вы не в комнате' });
            return;
          }
          
          if (ws.id !== room.host) {
            sendToClient(ws, 'error', { message: 'Только хост может менять тип комнаты' });
            return;
          }
          
          room.isPrivate = data.isPrivate;
          console.log(`[ROOM] ${room.code} теперь ${room.isPrivate ? 'закрытая' : 'открытая'}`);
          
          broadcastToRoom(room, 'room_type_changed', {
            isPrivate: room.isPrivate
          });
          break;
        }
        
        // ==================== ГОТОВНОСТЬ ====================
        case 'player_ready': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'Вы не в комнате' });
            return;
          }
          
          const player = room.players.find(p => p.id === ws.id);
          if (!player) return;
          
          player.ready = true;
          console.log(`[READY] ${player.name} готов в ${room.code}`);
          
          sendToClient(ws, 'ready_status', { 
            ready: true,
            players: room.players 
          });
          
          broadcastToRoom(room, 'players_update', {
            players: room.players
          });
          
          // Проверяем, все ли готовы
          const allReady = room.players.length === 2 && room.players.every(p => p.ready);
          
          if (allReady && !room.wordPhase) {
            room.wordPhase = true;
            console.log(`[READY] Все готовы в ${room.code}`);
            
            broadcastToRoom(room, 'all_ready', {
              message: 'Все готовы! Загадайте свои слова.'
            });
          }
          break;
        }
        
        // ==================== ЗАГАДЫВАНИЕ СЛОВА ====================
        case 'set_word': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'Вы не в комнате' });
            return;
          }
          
          if (!room.wordPhase && room.multiMode === 'async') {
            sendToClient(ws, 'error', { message: 'Дождитесь готовности всех игроков' });
            return;
          }
          
          // Проверка слова
          const wordRegex = room.lang === 'ru' ? /^[А-ЯЁ]+$/i : /^[A-Z]+$/i;
          
          if (!data.word || data.word.length !== 5 || !wordRegex.test(data.word)) {
            const msg = room.lang === 'ru' ? 'Неверное слово (5 русских букв)' : 'Invalid word (5 English letters)';
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
          console.log(`[WORD] ${player.name} загадал слово в ${room.code}`);
          
          sendToClient(ws, 'word_set_status', {
            wordSet: true,
            players: room.players
          });
          
          broadcastToRoom(room, 'players_update', {
            players: room.players
          });
          
          // Проверяем, оба ли загадали
          const bothWordsSet = room.players.length === 2 && room.players.every(p => p.wordSet);
          
          if (bothWordsSet && !room.gameStarted) {
            room.gameStarted = true;
            
            // Случайный первый ход
            const firstTurn = Math.random() < 0.5 ? room.host : room.guest;
            room.currentTurn = firstTurn;
            
            console.log(`[GAME] Старт в ${room.code}, первый ход: ${firstTurn === room.host ? 'Хост' : 'Гость'}`);
            
            const hostWs = clients.get(room.host);
            const guestWs = clients.get(room.guest);
            
            if (hostWs) {
              sendToClient(hostWs, 'game_started', {
                targetWord: room.guestWord,
                myTurn: room.currentTurn === room.host
              });
            }
            
            if (guestWs) {
              sendToClient(guestWs, 'game_started', {
                targetWord: room.hostWord,
                myTurn: room.currentTurn === room.guest
              });
            }
            
            broadcastToRoom(room, 'battle_start', {
              message: 'Оба слова загаданы! БИТВА НАЧИНАЕТСЯ!'
            });
          } else {
            const waiting = room.players.filter(p => !p.wordSet);
            if (waiting.length > 0) {
              broadcastToRoom(room, 'waiting_for_words', {
                message: `Ожидаем: ${waiting.map(p => p.name).join(', ')}`,
                players: room.players
              });
            }
          }
          break;
        }
        
        // ==================== ХОД ====================
        case 'make_guess': {
          const room = findRoomByPlayer(ws.id);
          
          if (!room) {
            sendToClient(ws, 'error', { message: 'Вы не в игре' });
            return;
          }
          
          if (!room.gameStarted) {
            sendToClient(ws, 'error', { message: 'Игра не началась' });
            return;
          }
          
          if (room.currentTurn !== ws.id) {
            sendToClient(ws, 'error', { message: 'Не ваш ход' });
            return;
          }
          
          const wordRegex = room.lang === 'ru' ? /^[А-ЯЁ]+$/i : /^[A-Z]+$/i;
          
          if (!data.guess || data.guess.length !== 5 || !wordRegex.test(data.guess)) {
            const msg = room.lang === 'ru' ? 'Неверное слово' : 'Invalid word';
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
          
          console.log(`[GUESS] ${isHost ? 'Хост' : 'Гость'}: ${upperGuess}`);
          
          sendToClient(ws, 'guess_result', {
            guess: upperGuess,
            result,
            attempts: isHost ? room.hostAttempts : room.guestAttempts
          });
          
          // Победа?
          if (upperGuess === targetWord) {
            if (isHost) {
              room.hostGameOver = true;
              room.hostWon = true;
            } else {
              room.guestGameOver = true;
              room.guestWon = true;
            }
            
            sendToClient(ws, 'game_won', { 
              word: targetWord,
              message: 'Вы угадали слово! ПОБЕДА!'
            });
            
            const opponentWs = clients.get(isHost ? room.guest : room.host);
            if (opponentWs) {
              sendToClient(opponentWs, 'game_lost', {
                message: 'Соперник угадал ваше слово!',
                word: isHost ? room.hostWord : room.guestWord
              });
            }
            
            broadcastToRoom(room, 'game_over', {
              winner: isHost ? 'Игрок 1' : 'Игрок 2',
              winnerId: ws.id,
              word: targetWord
            });
          } else {
            // Исчерпание попыток
            const attempts = isHost ? room.hostAttempts : room.guestAttempts;
            if (attempts.length >= 6) {
              if (isHost) room.hostGameOver = true;
              else room.guestGameOver = true;
              
              sendToClient(ws, 'game_lost', {
                message: 'Попытки исчерпаны',
                word: targetWord
              });
              
              if (room.hostGameOver && room.guestGameOver) {
                broadcastToRoom(room, 'game_over', {
                  winner: null,
                  message: 'Ничья! Оба не угадали.',
                  word: null
                });
              }
            }
          }
          
          // Передача хода
          if (!room.hostGameOver || !room.guestGameOver) {
            if (room.hostGameOver) {
              room.currentTurn = room.guest;
            } else if (room.guestGameOver) {
              room.currentTurn = room.host;
            } else {
              room.currentTurn = isHost ? room.guest : room.host;
            }
            
            const nextPlayer = clients.get(room.currentTurn);
            if (nextPlayer && nextPlayer.readyState === WebSocket.OPEN) {
              sendToClient(nextPlayer, 'your_turn', { message: 'Ваш ход' });
            }
          }
          
          // Обновление сопернику
          const opponentId = isHost ? room.guest : room.host;
          const opponentWs = clients.get(opponentId);
          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            sendToClient(opponentWs, 'opponent_update', {
              opponentAttempts: isHost ? room.hostAttempts : room.guestAttempts
            });
          }
          break;
        }
        
        // ==================== ВЫХОД ИЗ КОМНАТЫ ====================
        case 'leave_room': {
          const room = findRoomByPlayer(ws.id);
          
          if (room) {
            const playerIndex = room.players.findIndex(p => p.id === ws.id);
            if (playerIndex !== -1) {
              const playerName = room.players[playerIndex].name;
              room.players.splice(playerIndex, 1);
              console.log(`[LEAVE] ${playerName} покинул ${room.code}`);
              
              if (room.players.length === 0) {
                rooms.delete(room.code);
                console.log(`[ROOM] ${room.code} удалена`);
              } else {
                // Сброс состояния
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
                
                broadcastToRoom(room, 'player_left', {
                  message: `${playerName} покинул комнату`,
                  players: room.players
                });
              }
            }
          }
          break;
        }
        
        default:
          console.log(`[?] Неизвестный тип: ${data.type}`);
      }
    } catch (error) {
      console.error('Ошибка:', error);
    }
  });

  ws.on('close', () => {
    console.log(`[-] Игрок отключился: ${ws.id}`);
    
    const room = findRoomByPlayer(ws.id);
    if (room) {
      const playerIndex = room.players.findIndex(p => p.id === ws.id);
      if (playerIndex !== -1) {
        const playerName = room.players[playerIndex].name;
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(room.code);
          console.log(`[ROOM] ${room.code} удалена (все вышли)`);
        } else {
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
          
          broadcastToRoom(room, 'player_left', {
            message: `${playerName} отключился`,
            players: room.players
          });
        }
      }
    }
    
    clients.delete(ws.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 WebSocket: wss://localhost:${PORT}`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`========================================`);
});
