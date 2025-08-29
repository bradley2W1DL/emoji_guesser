import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

interface Player {
  socketId: string;
  name: string;
  totalScore: number;
  isHost: boolean;
}

interface GameState {
  screen: 'home' | 'lobby' | 'game' | 'results';
  roomId: string | null;
  players: Player[];
  playerName: string;
  isHost: boolean;
  currentRound: number;
  maxRounds: number;
  emojis: string;
  difficulty: number;
  gameEnded: boolean;
  winner: Player | null;
  finalLeaderboard: Player[];
  guess: string;
  roundStartTime: number | null;
  currentAnswer: string | null;
  showIncorrectMessage: boolean;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    screen: 'home',
    roomId: null,
    players: [],
    playerName: '',
    isHost: false,
    currentRound: 0,
    maxRounds: 6,
    emojis: '',
    difficulty: 1,
    gameEnded: false,
    winner: null,
    finalLeaderboard: [],
    guess: '',
    roundStartTime: null,
    currentAnswer: null,
    showIncorrectMessage: false
  });
  const [messages, setMessages] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [incorrectMessageTimer, setIncorrectMessageTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('room_created', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'lobby',
        roomId: data.roomId,
        players: data.players,
        isHost: data.isHost
      }));
    });

    newSocket.on('room_joined', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'lobby',
        roomId: data.roomId,
        players: data.players,
        isHost: data.isHost
      }));
    });

    newSocket.on('player_joined', (data) => {
      setGameState(prev => ({
        ...prev,
        players: data.players
      }));
      addMessage(`${data.player.name} joined the room`);
    });

    newSocket.on('player_left', (data) => {
      setGameState(prev => ({
        ...prev,
        players: data.players
      }));
      addMessage(`${data.playerName} left the room`);
    });

    newSocket.on('round_started', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'game',
        currentRound: data.round,
        maxRounds: data.maxRounds,
        emojis: data.emojis,
        difficulty: data.difficulty,
        guess: '',
        roundStartTime: Date.now(),
        currentAnswer: null,
        showIncorrectMessage: false
      }));
      setMessages([]);
      setTimeLeft(60);
    });

    newSocket.on('correct_guess', (data) => {
      addMessage(`${data.playerName} got it right! (+${data.points} points)`);
      setGameState(prev => ({
        ...prev,
        players: prev.players.map(player => 
          player.socketId === data.playerId 
            ? { ...player, totalScore: data.newScore }
            : player
        )
      }));
    });

    newSocket.on('incorrect_guess', () => {
      if (incorrectMessageTimer) {
        clearTimeout(incorrectMessageTimer);
      }
      
      setGameState(prev => ({ ...prev, showIncorrectMessage: true }));
      
      const timer = setTimeout(() => {
        setGameState(prev => ({ ...prev, showIncorrectMessage: false }));
      }, 5000);
      
      setIncorrectMessageTimer(timer);
    });

    newSocket.on('round_ended', (data) => {
      addMessage(`Round ${gameState.currentRound} ended!`);
      setTimeLeft(0);
      setGameState(prev => ({
        ...prev,
        currentAnswer: data.answer,
        players: prev.players.map(player => {
          const leaderboardPlayer = data.leaderboard.find((p: any) => p.socketId === player.socketId);
          return leaderboardPlayer ? { ...player, totalScore: leaderboardPlayer.score } : player;
        })
      }));
    });

    newSocket.on('game_ended', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'results',
        gameEnded: true,
        winner: data.winner,
        finalLeaderboard: data.finalLeaderboard
      }));
    });

    newSocket.on('error', (data) => {
      addMessage(`Error: ${data.message}`);
    });

    return () => {
      if (incorrectMessageTimer) {
        clearTimeout(incorrectMessageTimer);
      }
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState.screen === 'game' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState.screen, timeLeft]);

  const addMessage = (message: string) => {
    setMessages(prev => [...prev.slice(-4), message]);
  };

  const createRoom = () => {
    if (!gameState.playerName.trim()) return;
    socket?.emit('create_room', { playerName: gameState.playerName });
  };

  const joinRoom = () => {
    if (!gameState.playerName.trim() || !gameState.roomId) return;
    socket?.emit('join_room', { roomId: gameState.roomId, playerName: gameState.playerName });
  };

  const startGame = () => {
    socket?.emit('start_game');
  };

  const submitGuess = () => {
    if (!gameState.guess.trim()) return;
    socket?.emit('submit_guess', { guess: gameState.guess });
  };

  const resetGame = () => {
    setGameState({
      screen: 'home',
      roomId: null,
      players: [],
      playerName: '',
      isHost: false,
      currentRound: 0,
      maxRounds: 6,
      emojis: '',
      difficulty: 1,
      gameEnded: false,
      winner: null,
      finalLeaderboard: [],
      guess: '',
      roundStartTime: null,
      currentAnswer: null,
      showIncorrectMessage: false
    });
    setMessages([]);
    setTimeLeft(60);
    if (incorrectMessageTimer) {
      clearTimeout(incorrectMessageTimer);
      setIncorrectMessageTimer(null);
    }
  };

  if (gameState.screen === 'home') {
    return (
      <div className="app">
        <div className="home">
          <h1>🎭 Emoji Guesser</h1>
          <p>Guess the phrase from emojis with friends!</p>
          
          <div className="form-group">
            <input
              type="text"
              placeholder="Enter your name"
              value={gameState.playerName}
              onChange={(e) => setGameState(prev => ({ ...prev, playerName: e.target.value }))}
              maxLength={20}
            />
          </div>

          <div className="button-group">
            <button 
              onClick={createRoom}
              disabled={!gameState.playerName.trim()}
              className="primary-button"
            >
              Create Room
            </button>
            
            <div className="join-room">
              <input
                type="text"
                placeholder="Room ID"
                value={gameState.roomId || ''}
                onChange={(e) => setGameState(prev => ({ ...prev, roomId: e.target.value.toUpperCase() }))}
                maxLength={6}
              />
              <button 
                onClick={joinRoom}
                disabled={!gameState.playerName.trim() || !gameState.roomId}
                className="secondary-button"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState.screen === 'lobby') {
    return (
      <div className="app">
        <div className="lobby">
          <h1>Room: {gameState.roomId}</h1>
          <p>Share this room ID with friends to join!</p>
          
          <div className="players-list">
            <h3>Players ({gameState.players.length})</h3>
            {gameState.players.map(player => (
              <div key={player.socketId} className="player-item">
                <span>{player.name}</span>
                {player.isHost && <span className="host-badge">Host</span>}
              </div>
            ))}
          </div>

          {gameState.isHost && (
            <button 
              onClick={startGame}
              disabled={gameState.players.length < 2}
              className="primary-button"
            >
              Start Game {gameState.players.length < 2 && '(Need 2+ players)'}
            </button>
          )}

          {!gameState.isHost && (
            <p>Waiting for host to start the game...</p>
          )}

          <button onClick={resetGame} className="secondary-button">
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  if (gameState.screen === 'game') {
    return (
      <div className="app">
        <div className="game">
          <div className="game-header">
            <h2>Round {gameState.currentRound} of {gameState.maxRounds}</h2>
            <div className="timer">
              <span className={`countdown ${timeLeft <= 10 ? 'urgent' : ''}`}>
                ⏱️ {timeLeft}s
              </span>
            </div>
            <div className="difficulty">Difficulty: {'⭐'.repeat(gameState.difficulty)}</div>
          </div>

          <div className="emoji-display">
            <div className="emojis">{gameState.emojis}</div>
            {gameState.currentAnswer ? (
              <div className="correct-answer-display">
                🎯 <strong>ANSWER: {gameState.currentAnswer.toUpperCase()}</strong>
              </div>
            ) : (
              <p>What phrase or idiom do these emojis represent?</p>
            )}
            {gameState.showIncorrectMessage && (
              <div className="incorrect-message">
                ❌ Incorrect guess, try again!
              </div>
            )}
          </div>

          <div className="guess-input">
            <input
              type="text"
              placeholder="Enter your guess"
              value={gameState.guess}
              onChange={(e) => setGameState(prev => ({ ...prev, guess: e.target.value }))}
              onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
            />
            <button onClick={submitGuess} className="primary-button">
              Submit Guess
            </button>
          </div>

          <div className="leaderboard">
            <h3>Leaderboard</h3>
            {gameState.players
              .sort((a, b) => b.totalScore - a.totalScore)
              .map((player, index) => (
                <div key={player.socketId} className="leaderboard-item">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{player.name}</span>
                  <span className="score">{player.totalScore} pts</span>
                </div>
              ))}
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div key={index} className="message">{message}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameState.screen === 'results') {
    return (
      <div className="app">
        <div className="results">
          <h1>🏆 Game Over!</h1>
          
          {gameState.winner && (
            <div className="winner">
              <h2>Winner: {gameState.winner.name}</h2>
              <p>{gameState.winner.totalScore} points</p>
            </div>
          )}

          <div className="final-leaderboard">
            <h3>Final Leaderboard</h3>
            {gameState.finalLeaderboard.map((player, index) => (
              <div key={player.socketId} className="leaderboard-item">
                <span className="rank">#{index + 1}</span>
                <span className="name">{player.name}</span>
                <span className="score">{player.totalScore} pts</span>
              </div>
            ))}
          </div>

          <button onClick={resetGame} className="primary-button">
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;