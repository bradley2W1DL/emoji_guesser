const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();
const players = new Map();

const emojiPhrases = [
  { emojis: "🍎🩺", answer: "an apple a day keeps the doctor away", difficulty: 1 },
  { emojis: "🐦👋", answer: "kill two birds with one stone", difficulty: 2 },
  { emojis: "🌧️🐱🐶", answer: "its raining cats and dogs", difficulty: 1 },
  { emojis: "🍰🎂", answer: "piece of cake", difficulty: 1 },
  { emojis: "❄️🧊", answer: "break the ice", difficulty: 2 },
  { emojis: "🐘🏠", answer: "elephant in the room", difficulty: 2 },
  { emojis: "🔥💨", answer: "where theres smoke theres fire", difficulty: 3 },
  { emojis: "🏠💎", answer: "home is where the heart is", difficulty: 2 },
  { emojis: "⏰💰", answer: "time is money", difficulty: 1 },
  { emojis: "🌟👁️", answer: "reach for the stars", difficulty: 2 },
  { emojis: "🔔🐱", answer: "curiosity killed the cat", difficulty: 2 },
  { emojis: "🎯🖼️", answer: "worth a thousand words", difficulty: 3 },
  { emojis: "🐟🌊", answer: "plenty of fish in the sea", difficulty: 2 },
  { emojis: "🥾👢", answer: "the shoe is on the other foot", difficulty: 3 },
  { emojis: "🌙🔵", answer: "once in a blue moon", difficulty: 2 },
  { emojis: "🍯🐝", answer: "busy as a bee", difficulty: 1 },
  { emojis: "💔🎵", answer: "music soothes the savage beast", difficulty: 3 },
  { emojis: "🍀☘️", answer: "the luck of the irish", difficulty: 2 },
  { emojis: "🌈🏺", answer: "pot of gold at the end of the rainbow", difficulty: 2 },
  { emojis: "🐎🌊", answer: "dont look a gift horse in the mouth", difficulty: 3 }
];

function createRoom(roomId, hostSocketId) {
  const room = {
    id: roomId,
    host: hostSocketId,
    players: new Map(),
    currentRound: 0,
    maxRounds: 6,
    gameState: 'waiting', // waiting, playing, between_rounds, finished
    currentPhrase: null,
    roundStartTime: null,
    usedPhrases: [],
    roundAnswers: new Map()
  };
  rooms.set(roomId, room);
  return room;
}

function getRandomPhrase(usedPhrases) {
  const availablePhrases = emojiPhrases.filter(phrase => !usedPhrases.includes(phrase));
  if (availablePhrases.length === 0) return null;
  return availablePhrases[Math.floor(Math.random() * availablePhrases.length)];
}

function startNewRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.currentRound >= room.maxRounds) return;
  
  room.currentRound++;
  room.gameState = 'playing';
  room.currentPhrase = getRandomPhrase(room.usedPhrases);
  room.usedPhrases.push(room.currentPhrase);
  room.roundStartTime = Date.now();
  room.roundAnswers.clear();
  
  io.to(roomId).emit('round_started', {
    round: room.currentRound,
    maxRounds: room.maxRounds,
    emojis: room.currentPhrase.emojis,
    difficulty: room.currentPhrase.difficulty
  });
  
  setTimeout(() => {
    if (room.gameState === 'playing') {
      endRound(roomId);
    }
  }, 60000); // 60 second rounds
}

function endRound(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.gameState = 'between_rounds';
  
  const roundResults = Array.from(room.roundAnswers.entries()).map(([socketId, data]) => ({
    playerId: socketId,
    playerName: room.players.get(socketId)?.name || 'Unknown',
    timeToAnswer: data.timeToAnswer,
    points: data.points
  }));
  
  io.to(roomId).emit('round_ended', {
    answer: room.currentPhrase.answer,
    results: roundResults,
    leaderboard: getLeaderboard(room)
  });
  
  if (room.currentRound >= room.maxRounds) {
    setTimeout(() => endGame(roomId), 5000);
  } else {
    setTimeout(() => startNewRound(roomId), 5000);
  }
}

function endGame(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.gameState = 'finished';
  const finalLeaderboard = getLeaderboard(room);
  
  io.to(roomId).emit('game_ended', {
    winner: finalLeaderboard[0],
    finalLeaderboard
  });
}

function getLeaderboard(room) {
  return Array.from(room.players.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((player, index) => ({
      rank: index + 1,
      name: player.name,
      score: player.totalScore,
      socketId: player.socketId
    }));
}

function calculatePoints(timeToAnswer, difficulty) {
  const maxTime = 60000;
  const basePoints = difficulty * 100;
  const timeBonus = Math.max(0, Math.floor((maxTime - timeToAnswer) / 1000) * 10);
  return basePoints + timeBonus;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  socket.on('create_room', (data) => {
    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const room = createRoom(roomId, socket.id);
    
    const player = {
      socketId: socket.id,
      name: data.playerName,
      totalScore: 0,
      isHost: true
    };
    
    room.players.set(socket.id, player);
    players.set(socket.id, { roomId, name: data.playerName });
    socket.join(roomId);
    
    socket.emit('room_created', {
      roomId,
      isHost: true,
      players: Array.from(room.players.values())
    });
  });
  
  socket.on('join_room', (data) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (room.gameState !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }
    
    const player = {
      socketId: socket.id,
      name: data.playerName,
      totalScore: 0,
      isHost: false
    };
    
    room.players.set(socket.id, player);
    players.set(socket.id, { roomId: data.roomId, name: data.playerName });
    socket.join(data.roomId);
    
    socket.emit('room_joined', {
      roomId: data.roomId,
      isHost: false,
      players: Array.from(room.players.values())
    });
    
    socket.to(data.roomId).emit('player_joined', {
      player: player,
      players: Array.from(room.players.values())
    });
  });
  
  socket.on('start_game', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (!room || room.host !== socket.id || room.gameState !== 'waiting') return;
    
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }
    
    startNewRound(playerData.roomId);
  });
  
  socket.on('submit_guess', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(playerData.roomId);
    if (!room || room.gameState !== 'playing' || room.roundAnswers.has(socket.id)) return;
    
    const guess = data.guess.toLowerCase().trim();
    const correctAnswer = room.currentPhrase.answer.toLowerCase();
    
    if (guess === correctAnswer) {
      const timeToAnswer = Date.now() - room.roundStartTime;
      const points = calculatePoints(timeToAnswer, room.currentPhrase.difficulty);
      
      room.players.get(socket.id).totalScore += points;
      room.roundAnswers.set(socket.id, { timeToAnswer, points });
      
      io.to(playerData.roomId).emit('correct_guess', {
        playerName: playerData.name,
        timeToAnswer,
        points,
        playersAnswered: room.roundAnswers.size,
        totalPlayers: room.players.size
      });
      
      if (room.roundAnswers.size === room.players.size) {
        endRound(playerData.roomId);
      }
    } else {
      socket.emit('incorrect_guess');
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const playerData = players.get(socket.id);
    
    if (playerData) {
      const room = rooms.get(playerData.roomId);
      if (room) {
        room.players.delete(socket.id);
        
        if (room.host === socket.id && room.players.size > 0) {
          const newHost = room.players.keys().next().value;
          room.host = newHost;
          room.players.get(newHost).isHost = true;
        }
        
        if (room.players.size === 0) {
          rooms.delete(playerData.roomId);
        } else {
          io.to(playerData.roomId).emit('player_left', {
            playerName: playerData.name,
            players: Array.from(room.players.values())
          });
        }
      }
      
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});