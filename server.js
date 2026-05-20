const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  // CORS для Яндекс.Игр
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check для Render
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
      
      switch (data.type) {
        case 'create_room': {
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
            players: [{ id: ws.id, name: 'Игрок 1' }],
            gameStarted: false,
            hostWord: '',
            guestWord: '',
            hostAttempts: [],
            guestAttempts: [],
            currentTurn: ws.id,
            hostGameOver: false,
            guestGameOver: false
          };
          
          rooms.set(code, room);
          
          sendToClient(ws, 'room_created', {
            code: room.code,
            players: room.players,
            isHost: true
          });
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
          
          room.guest = ws.id;
          room.players.push({ id: ws.id, name: 'Игрок 2' });
          
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
          break;
        }
        
        case 'quick_play': {
          let foundRoom = false;
          for (let [code, room] of rooms) {
            if (room.players.length < 2 && !room.gameStarted) {
              room.guest = ws.id;
              room.players.push({ id: ws.id, name: 'Игрок 2' });
              
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
              break;
            }
          }
          
          if (!foundRoom) {
            const code = generateRoomCode();
            const room = {
              code,
              host: ws.id,
              guest: null,
              players: [{ id: ws.id, name: 'Игрок 1' }],
              gameStarted: false,
              hostWord: '',
              guestWord: '',
              hostAttempts: [],
              guestAttempts: [],
              currentTurn: ws.id,
              hostGameOver: false,
              guestGameOver: false
            };
            
            rooms.set(code, room);
            
            sendToClient(ws, 'room_created', {
              code: room.code,
              players: room.players,
              isHost: true
            });
          }
          break;
        }
        
        case 'start_game': {
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
          
          if (playerRoom.players.length < 2) {
            sendToClient(ws, 'error', { message: 'Недостаточно игроков' });
            return;
          }
          
          if (!data.word || data.word.length !== 5 || !/^[А-ЯЁ]+$/i.test(data.word)) {
            sendToClient(ws, 'error', { message: 'Неверное слово (5 русских букв)' });
            return;
          }
          
          const upperWord = data.word.toUpperCase();
          
          if (ws.id === playerRoom.host) {
            playerRoom.hostWord = upperWord;
          } else {
            playerRoom.guestWord = upperWord;
          }
          
          sendToClient(ws, 'word_set', { message: 'Слово принято' });
          
          if (playerRoom.hostWord && playerRoom.guestWord) {
            playerRoom.gameStarted = true;
            
            const hostWs = clients.get(playerRoom.host);
            const guestWs = clients.get(playerRoom.guest);
            
            if (hostWs) {
              sendToClient(hostWs, 'game_started', {
                targetWord: playerRoom.guestWord,
                myTurn: true
              });
            }
            
            if (guestWs) {
              sendToClient(guestWs, 'game_started', {
                targetWord: playerRoom.hostWord,
                myTurn: false
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
          
          sendToClient(ws, 'guess_result', {
            guess: upperGuess,
            result,
            attempts: isHost ? playerRoom.hostAttempts : playerRoom.guestAttempts
          });
          
          if (upperGuess === targetWord) {
            if (isHost) {
              playerRoom.hostGameOver = true;
            } else {
              playerRoom.guestGameOver = true;
            }
            
            sendToClient(ws, 'game_won', { word: targetWord });
            
            const opponentWs = clients.get(isHost ? playerRoom.guest : playerRoom.host);
            if (opponentWs) {
              sendToClient(opponentWs, 'game_lost', {
                message: 'Соперник угадал ваше слово!'
              });
            }
          } else {
            const attempts = isHost ? playerRoom.hostAttempts : playerRoom.guestAttempts;
            if (attempts.length >= 6) {
              if (isHost) playerRoom.hostGameOver = true;
              else playerRoom.guestGameOver = true;
              
              sendToClient(ws, 'game_lost', {
                message: 'Попытки исчерпаны',
                word: targetWord
              });
            }
          }
          
          if (!playerRoom.hostGameOver && !playerRoom.guestGameOver) {
            playerRoom.currentTurn = isHost ? playerRoom.guest : playerRoom.host;
            
            const nextPlayer = clients.get(playerRoom.currentTurn);
            if (nextPlayer) {
              sendToClient(nextPlayer, 'your_turn', { message: 'Ваш ход' });
            }
          }
          
          const opponentId = isHost ? playerRoom.guest : playerRoom.host;
          const opponentWs = clients.get(opponentId);
          if (opponentWs) {
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
              room.players.splice(playerIndex, 1);
              
              if (room.players.length === 0) {
                rooms.delete(code);
              } else {
                const remainingPlayer = clients.get(room.players[0].id);
                if (remainingPlayer) {
                  sendToClient(remainingPlayer, 'player_left', {
                    message: 'Соперник покинул комнату'
                  });
                }
                
                room.gameStarted = false;
                room.hostWord = '';
                room.guestWord = '';
                room.hostAttempts = [];
                room.guestAttempts = [];
                room.hostGameOver = false;
                room.guestGameOver = false;
              }
              break;
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error('Ошибка:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Игрок отключился: ${ws.id}`);
    
    for (let [code, room] of rooms) {
      const playerIndex = room.players.findIndex(p => p.id === ws.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(code);
        } else {
          const remainingPlayer = clients.get(room.players[0].id);
          if (remainingPlayer) {
            sendToClient(remainingPlayer, 'player_left', {
              message: 'Соперник отключился'
            });
          }
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