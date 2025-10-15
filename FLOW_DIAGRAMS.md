# Flow Diagrams for Alias Registration

## Local 1v1 Game Flow

```
User clicks "Local (2P)" on home page
           |
           v
    Navigate to /game/local
           |
           v
    Backend: Check registered param
           |
    No registered param
           |
           v
    Backend: Return alias registration form (2 players)
           |
           v
    Frontend: initAliasRegistration() handles form
           |
           v
    User fills in Player 1 and Player 2 names
           |
           v
    Form submit: Store in sessionStorage['localGameAliases']
           |
           v
    Navigate to /game/local?registered=true
           |
           v
    Backend: Return game canvas
           |
           v
    Frontend: initLocalGame(false) loads
           |
           v
    setupLocalGameAliases() reads from sessionStorage
           |
           v
    Game displays player names on canvas
```

## Local AI Game Flow

```
User clicks "Play with AI" on home page
           |
           v
    Navigate to /game/local?ai=1
           |
           v
    Backend: Check registered param
           |
    No registered param
           |
           v
    Backend: Return alias registration form (1 player)
           |
           v
    Frontend: initAliasRegistration() handles form
           |
           v
    User fills in Player 1 name
           |
           v
    Form submit: Store {player1: name, player2: 'AI'} in sessionStorage
           |
           v
    Navigate to /game/local?ai=1&registered=true
           |
           v
    Backend: Return game canvas
           |
           v
    Frontend: initLocalGame(true) loads
           |
           v
    setupLocalGameAliases() reads from sessionStorage
           |
           v
    Game displays player name and "AI" on canvas
```

## Tournament Flow

```
User clicks "Local Tournament" on home page
           |
           v
    Navigate to /game/local-tournament
           |
           v
    Backend: Return tournament selection page
           |
           v
    User selects 4 or 8 players
           |
           v
    Navigate to /game/local-tournament?players=4
           |
           v
    Backend: Return alias registration form (4 or 8 players)
           |
           v
    Frontend: initAliasRegistration() handles form
           |
           v
    User fills in all player names
           |
           v
    Form submit: POST /api/tournaments with aliases
           |
           v
    Store {tournamentId, matches} in sessionStorage['newTournament']
           |
           v
    Navigate to /game/local-tournament
           |
           v
    Frontend: initLocalTournament() detects newTournament
           |
           v
    Display initial bracket
           |
           v
    User starts a match
           |
           v
    Store match data in sessionStorage['tournamentMatch']
           |
           v
    Navigate to /game/local?registered=true
           |
           v
    Backend: Return game canvas
           |
           v
    Frontend: initLocalGame() loads
           |
           v
    setupTournamentBridgeIfNeeded() detects tournamentMatch
           |
           v
    Game displays tournament player names on canvas
           |
           v
    Match ends, winner posted to /api/tournaments/:id/match
           |
           v
    Store result in sessionStorage['tournamentResult']
           |
           v
    Navigate back to /game/local-tournament
           |
           v
    Display winner screen and continue tournament
```

## Key Differences

### Tournament Match vs Regular Local Game
- **Tournament**: `sessionStorage['tournamentMatch']` is set, names come from there
- **Local**: `sessionStorage['localGameAliases']` is set, names come from there
- Both use `registered=true` parameter to bypass registration form

### Logged-in User Handling
- First field in registration form has:
  - `value="{user.nickname}"` - pre-filled with user's nickname
  - `disabled` attribute - cannot be changed
  - `class="disabled"` - styled to show it's disabled
- Applies to all game modes: local 1v1, AI, and tournament
