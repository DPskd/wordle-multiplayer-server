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
  res.end('Wordle Multiplayer Server');
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();
const clients = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sendToClient(ws, type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function broadcastToRoom(room, type, data, excludeWs = null) {
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

wss.on('connection', (ws) => {
  ws.id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  clients.set(ws.id, ws);
  
  console.log(`Игрок подключился: ${ws.id}`);
  
  sendToClient(ws, 'connected', { playerId: ws.id });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[${ws.id}] received:`, data.type);
      
      switch (data.type) {
        case 'create_room': {
          // Проверяем, не в комнате ли уже игрок
          for (let [code, room] of rooms) {
            if (room.players.find(p => p.id === ws.id)) {
              sendToClient(ws, 'error', { message: 'Вы уже в комнате' });
              return;
            }
          }
          
          const code = generateRoomCode();
          const room = {
            code,
            host: ws.id,
            guest: null,
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
            guestWon: false,
            multiMode: 'async'
          };
          
          rooms.set(code, room);
          
          sendToClient(ws, 'room_created', {
            code: room.code,
            players: room.players,
            isHost: true
          });
          console.log(`Комната создана: ${code}`);
          break;
        }
        
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
          
          // Проверяем, не в комнате ли уже игрок
          for (let [code, r] of rooms) {
            if (r.players.find(p => p.id === ws.id)) {
              sendToClient(ws, 'error', { message: 'Вы уже в комнате' });
              return;
            }
          }
          
          room.guest = ws.id;
          room.players.push({ id: ws.id, name: 'Игрок 2', ready: false, wordSet: false });
          
          sendToClient(ws, 'room_joined', {
            code: room.code,
            players: room.players,
            isHost: false
          });
          
          // Уведомляем хоста
          const hostWs = clients.get(room.host);
          if (hostWs) {
            sendToClient(hostWs, 'player_joined', {
              players: room.players
            });
          }
          console.log(`Игрок присоединился к комнате: ${room.code}`);
          break;
        }
        
        case 'quick_play': {
          let foundRoom = false;
          for (let [code, room] of rooms) {
            if (room.players.length < 2 && !room.gameStarted) {
              room.guest = ws.id;
              room.players.push({ id: ws.id, name: 'Игрок 2', ready: false, wordSet: false });
              
              sendToClient(ws, 'room_joined', {
                code: room.code,
                players: room.players,
                isHost: false
              });
              
              const hostWs = clients.get(room.host);
              if (hostWs) {
                sendToClient(hostWs, 'player_joined', {
                  players: room.players
                });
              }
              foundRoom = true;
              console.log(`Быстрая игра: присоединился к ${room.code}`);
              break;
            }
          }
          
          if (!foundRoom) {
            const code = generateRoomCode();
            const room = {
              code,
              host: ws.id,
              guest: null,
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
              guestWon: false,
              multiMode: 'async'
            };
            
            rooms.set(code, room);
            
            sendToClient(ws, 'room_created', {
              code: room.code,
              players: room.players,
              isHost: true
            });
            console.log(`Быстрая игра: создана комната ${code}`);
          }
          break;
        }
        
        case 'player_ready': {
          let playerRoom = null;
          for (let [code, room] of rooms) {
            if (room.players.find(p => p.id === ws.id)) {
              playerRoom = room;
              break;
            }
          }
          
          if (!playerRoom) {
            sendToClient(ws, 'error', { message: 'Вы не в комнате' });
            return;
          }
          
          const player = playerRoom.players.find(p => p.id === ws.id);
          if (!player) return;
          
          player.ready = true;
          console.log(`${player.name} готов в комнате ${playerRoom.code}`);
          
          // Отправляем статус готовности этому игроку
          sendToClient(ws, 'ready_status', { 
            ready: true,
            players: playerRoom.players 
          });
          
          // Отправляем обновление всем в комнате
          broadcastToRoom(playerRoom, 'players_update', {
            players: playerRoom.players
          });
          
          // Проверяем, все ли готовы (должно быть 2 игрока и оба ready)
          const allPlayersReady = playerRoom.players.length === 2 && 
                                   playerRoom.players.every(p => p.ready);
          
          if (allPlayersReady && !playerRoom.wordPhase) {
            playerRoom.wordPhase = true;
            console.log(`Все готовы в комнате ${playerRoom.code}, начинаем фазу загадывания слов`);
            
            // Отправляем всем сообщение о начале фазы загадывания
            broadcastToRoom(playerRoom, 'all_ready', {
              message: 'Все готовы! Загадайте свои слова.'
            });
          }
          break;
        }
        
        case 'set_word': {
          let playerRoom = null;
          for (let [code, room] of rooms) {
            if (room.players.find(p => p.id === ws.id)) {
              playerRoom = room;
              break;
            }
          }
          
          if (!playerRoom) {
            sendToClient(ws, 'error', { message: 'Вы не в комнате' });
            return;
          }
          
          if (!playerRoom.wordPhase) {
            sendToClient(ws, 'error', { message: 'Дождитесь готовности всех игроков' });
            return;
          }
          
          if (!data.word || data.word.length !== 5 || !/^[А-ЯЁ]+$/i.test(data.word)) {
            sendToClient(ws, 'error', { message: 'Неверное слово (5 русских букв)' });
            return;
          }
          
          const upperWord = data.word.toUpperCase();
          const player = playerRoom.players.find(p => p.id === ws.id);
          
          if (ws.id === playerRoom.host) {
            playerRoom.hostWord = upperWord;
          } else {
            playerRoom.guestWord = upperWord;
          }
          
          player.wordSet = true;
          console.log(`${player.name} загадал слово в комнате ${playerRoom.code}`);
          
          // Отправляем подтверждение этому игроку
          sendToClient(ws, 'word_set_status', {
            wordSet: true,
            players: playerRoom.players
          });
          
          // Отправляем обновление всем
          broadcastToRoom(playerRoom, 'players_update', {
            players: playerRoom.players
          });
          
          // Проверяем, оба ли загадали слова
          const bothWordsSet = playerRoom.players.length === 2 && 
                               playerRoom.players.every(p => p.wordSet);
          
          if (bothWordsSet && !playerRoom.gameStarted) {
            playerRoom.gameStarted = true;
            
            // Случайно выбираем, кто ходит первым
            const firstTurn = Math.random() < 0.5 ? playerRoom.host : playerRoom.guest;
            playerRoom.currentTurn = firstTurn;
            
            console.log(`Игра началась в комнате ${playerRoom.code}, первый ход: ${firstTurn}`);
            
            const hostWs = clients.get(playerRoom.host);
            const guestWs = clients.get(playerRoom.guest);
            
            if (hostWs) {
              sendToClient(hostWs, 'game_started', {
                targetWord: playerRoom.guestWord,
                myTurn: playerRoom.currentTurn === playerRoom.host
              });
            }
            
            if (guestWs) {
              sendToClient(guestWs, 'game_started', {
                targetWord: playerRoom.hostWord,
                myTurn: playerRoom.currentTurn === playerRoom.guest
              });
            }
            
            broadcastToRoom(playerRoom, 'battle_start', {
              message: 'Оба слова загаданы! БИТВА НАЧИНАЕТСЯ!'
            });
          } else {
            // Сообщаем, кто уже загадал
            const wordSetPlayers = playerRoom.players.filter(p => p.wordSet);
            const waitingPlayers = playerRoom.players.filter(p => !p.wordSet);
            
            if (waitingPlayers.length > 0) {
              broadcastToRoom(playerRoom, 'waiting_for_words', {
                message: `${wordSetPlayers.map(p => p.name).join(', ')} загадал(и) слово. Ожидаем остальных...`,
                players: playerRoom.players
              });
            }
          }
          break;
        }
        
        case 'make_guess': {
          let playerRoom = null;
          let isHost = false;
          
          for (let [code, room] of rooms) {
            if (room.host === ws.id) {
              playerRoom = room;
              isHost = true;
              break;
            }
            if (room.guest === ws.id) {
              playerRoom = room;
              isHost = false;
              break;
            }
          }
          
          if (!playerRoom) {
            sendToClient(ws, 'error', { message: 'Вы не в игре' });
            return;
          }
          
          if (!playerRoom.gameStarted) {
            sendToClient(ws, 'error', { message: 'Игра не началась' });
            return;
          }
          
          if (playerRoom.currentTurn !== ws.id) {
            sendToClient(ws, 'error', { message: 'Не ваш ход' });
            return;
          }
          
          if (!data.guess || data.guess.length !== 5 || !/^[А-ЯЁ]+$/i.test(data.guess)) {
            sendToClient(ws, 'error', { message: 'Неверное слово' });
            return;
          }
          
          const upperGuess = data.guess.toUpperCase();
          const targetWord = isHost ? playerRoom.guestWord : playerRoom.hostWord;
          const result = evaluateGuess(upperGuess, targetWord);
          
          if (isHost) {
            playerRoom.hostAttempts.push({ word: upperGuess, result });
          } else {
            playerRoom.guestAttempts.push({ word: upperGuess, result });
          }
          
          console.log(`${isHost ? 'Хост' : 'Гость'} угадывает: ${upperGuess}`);
          
          // Отправляем результат угадывающему
          sendToClient(ws, 'guess_result', {
            guess: upperGuess,
            result,
            attempts: isHost ? playerRoom.hostAttempts : playerRoom.guestAttempts
          });
          
          // Проверка на победу
          if (upperGuess === targetWord) {
            if (isHost) {
              playerRoom.hostGameOver = true;
              playerRoom.hostWon = true;
            } else {
              playerRoom.guestGameOver = true;
              playerRoom.guestWon = true;
            }
            
            sendToClient(ws, 'game_won', { 
              word: targetWord,
              message: 'Вы угадали слово! ПОБЕДА!'
            });
            
            const opponentWs = clients.get(isHost ? playerRoom.guest : playerRoom.host);
            if (opponentWs) {
              sendToClient(opponentWs, 'game_lost', {
                message: 'Соперник угадал ваше слово! Поражение...',
                opponentWord: upperGuess
              });
            }
            
            broadcastToRoom(playerRoom, 'game_over', {
              winner: isHost ? 'Игрок 1' : 'Игрок 2',
              winnerId: ws.id
            });
          } else {
            // Проверка на исчерпание попыток
            const attempts = isHost ? playerRoom.hostAttempts : playerRoom.guestAttempts;
            if (attempts.length >= 6) {
              if (isHost) playerRoom.hostGameOver = true;
              else playerRoom.guestGameOver = true;
              
              sendToClient(ws, 'game_lost', {
                message: 'Попытки исчерпаны',
                word: targetWord
              });
              
              // Проверяем, не закончилась ли игра у обоих
              if (playerRoom.hostGameOver && playerRoom.guestGameOver) {
                broadcastToRoom(playerRoom, 'game_over', {
                  winner: null,
                  message: 'Ничья! Оба игрока не угадали слова.'
                });
              }
            }
          }
          
          // Передаем ход сопернику, если игра продолжается
          if (!playerRoom.hostGameOver || !playerRoom.guestGameOver) {
            if (playerRoom.hostGameOver) {
              playerRoom.currentTurn = playerRoom.guest;
            } else if (playerRoom.guestGameOver) {
              playerRoom.currentTurn = playerRoom.host;
            } else {
              playerRoom.currentTurn = isHost ? playerRoom.guest : playerRoom.host;
            }
            
            const nextPlayer = clients.get(playerRoom.currentTurn);
            if (nextPlayer && nextPlayer.readyState === WebSocket.OPEN) {
              sendToClient(nextPlayer, 'your_turn', { message: 'Ваш ход' });
            }
          }
          
          // Отправляем обновление сопернику
          const opponentId = isHost ? playerRoom.guest : playerRoom.host;
          const opponentWs = clients.get(opponentId);
          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            sendToClient(opponentWs, 'opponent_update', {
              opponentAttempts: isHost ? playerRoom.hostAttempts : playerRoom.guestAttempts
            });
          }
          break;
        }
        
        case 'leave_room': {
          for (let [code, room] of rooms) {
            const playerIndex = room.players.findIndex(p => p.id === ws.id);
            if (playerIndex !== -1) {
              const playerName = room.players[playerIndex].name;
              room.players.splice(playerIndex, 1);
              console.log(`${playerName} покинул комнату ${code}`);
              
              if (room.players.length === 0) {
                rooms.delete(code);
                console.log(`Комната ${code} удалена`);
              } else {
                broadcastToRoom(room, 'player_left', {
                  message: `${playerName} покинул комнату`
                });
                
                // Сбрасываем состояние комнаты
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
              }
              break;
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Игрок отключился: ${ws.id}`);
    
    // Удаляем игрока из всех комнат
    for (let [code, room] of rooms) {
      const playerIndex = room.players.findIndex(p => p.id === ws.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(code);
          console.log(`Комната ${code} удалена (все вышли)`);
        } else {
          broadcastToRoom(room, 'player_left', {
            message: 'Соперник отключился'
          });
        }
        break;
      }
    }
    
    clients.delete(ws.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
