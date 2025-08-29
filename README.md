# Emoji Guesser

## Features:

- Multiplayer WebSocket server with room-based gameplay
- 6-round game system with scoring based on speed and difficulty
- 20 pre-loaded emoji phrases with varying difficulty levels
- Real-time gameplay with instant feedback and leaderboards
- Responsive design that works on desktop and mobile

### How to run:

1. Start the WebSocket server:
npm run dev

2. Start the React client (in a new terminal):
cd emoji-guesser && npm run dev

### Game Flow:

1. Players enter their name and create/join rooms using a 6-character room ID
2. Host starts the game when 2+ players are ready
3. Each round shows emojis representing a phrase/idiom
4. Players submit guesses - faster correct answers earn more points
5. After 6 rounds, the winner is determined by total score

The scoring system rewards both difficulty and speed, with harder phrases (⭐⭐⭐) giving more base points plus time bonuses for quick
 answers.
