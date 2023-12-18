var { Server, BitStream } = require('node-snet');

const server = new Server({
  address: "147.78.67.105",
  port: 11321,
  clientTimeout: 4000,
  ipVersion: 'v4'
});

const rooms = {}
const private_rooms = {}
const users = {}
const started_rooms = {}
const suits = ['spades', 'clubs', 'diamonds', 'hearts'];
const values = ['6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];


function generateRandomString(l) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzQWERTYUIOPASDFGHJKLZCVBNM1234567890'; // буквы английского алфавита
  let randomString = '';
  for (let i = 0; i < l; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    randomString += alphabet.charAt(randomIndex);
  }

  return randomString;
}


let functions = {
  createRoom: function(user, type) {
    if (!users[user]) {
      return "[error] Register first."
    }
    if (users[user].in_room !== "nope") {
      return "[error] You are already in the room."
    }
    if (type == "private") {
      let id = generateRandomString(15)
      if (rooms[id] || started_rooms[id] || private_rooms[id]) {
          functions.createRoom(user, type); // nice recursion
      }
      private_rooms[id] = {
        id: id,
        players: [users[user].name],
        maxPlayers: 2,
      };
      users[user].in_room = id
      return `Private game: ${id} successfully created.`;
    }
    if (Object.keys(rooms).length >= 5) {
      return "You cannot create more public rooms."
    }
    let id = generateRandomString(5)
    if (rooms[id] || started_rooms[id] || private_rooms[id]) {
        functions.createRoom(user, type); // nice recursion
    }
    rooms[id] = {
        id: id,
        players: [users[user].name],
        maxPlayers: 2,
    };
    users[user].in_room = id
    return `${id} successfully created.`;
  },
  getRooms: function() {
    return JSON.stringify(rooms);
  },
  getUsers: function() {
    return JSON.stringify(users);
  },
  getState: function(user) {
    if (!users[user]) {
      return "[error] Register first."
    }
    return JSON.stringify(users[user].in_room);;
  },
  answer: async function(id, text, priority, address, port) {
    return new Promise((resolve, reject) => {
      try {
        const data = new BitStream();
        data.writeString(text);
        server.send(id, data, priority, address, port, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },  
  createUser: function(user, userWant) {
    if (users[user]) {
        return "[error] User exists"
    }
    if (functions.isNameInUsers(userWant)) {
      return "[error] The name is already taken."
    }
    if (userWant.length < 2 || userWant.length > 9) {
      return "[error] User nick must be from 2 to 5 characters"
    }
    users[user] = {
      name: userWant,
      in_room: "nope"
    };
    return `${userWant}`;
  },
  connect: function(user, id) {
    if (!users[user]) {
      return "[error] Register first."
    }
    if (users[user].in_room !== "nope") {
      return "[error] You are already in the room."
    }
    if (private_rooms[id]) {
      private_rooms[id].players.push(users[user].name);
      users[user].in_room = id
      console.log("ADDED")
      return "You have been added to the room."
    }
    if (!rooms[id]) {
      return "[error] Room doesn't exist"
    }
    if (rooms[id].players.length >= 2) {
      return "[error] The room is already full."
    }
    rooms[id].players.push(users[user].name);
    users[user].in_room = id
    return "You have been added to the room."
  },
  leave: function(user, id) {
    if (!users[user]) {
      return "[error] Register first."
    }
    if (users[user].in_room === "nope") {
      return "[error] You are not in the room"
    }
    if (private_rooms[id]) {
      private_rooms[id].players = private_rooms[id].players.filter(player => player !== users[user].name);
      users[user].in_room = "nope"
      delete private_rooms[id]
      return "You have successfully left the room."
    }
    if (!rooms[id]) {
      return "[error] Room doesn't exist"
    }
    rooms[id].players = rooms[id].players.filter(player => player !== users[user].name);
    users[user].in_room = "nope"
    return "You have successfully left the room."
  },
  isNameInUsers: function(nameToCheck) {
    for (let key in users) {
      if (users[key].name === nameToCheck) {
        return true;
      }
    }
    return false;
  },
  getIpByName: function(object, value)  {
    return Object.keys(object).find(key => object[key].name === value);
  },
  findStartedGames: function() {
    for (let id in rooms) {
      if (rooms[id].players.length === 2) {
        let local_deck = []
        for (let suit of suits) {
          for (let value of values) {
            local_deck.push({suit, value});
          }
        }

        let p1_deck = []
        let p2_deck = []
        local_deck = functions.shuffle(local_deck)
        while (p1_deck.length < 4 || p2_deck.length < 4) {
          if (p1_deck.length < 4) {
            const card = local_deck.pop();
            console.log(local_deck.lenght)
            p1_deck.push(card);
          }
          if (p2_deck.length < 4) {
            const card = local_deck.pop();
            console.log(local_deck.lenght)
            p2_deck.push(card);
          }
        }
        let player_1 = functions.getIpByName(users, rooms[id].players[0])
        let player_2 = functions.getIpByName(users, rooms[id].players[1])
        started_rooms[id] = {
          id: id,
          players: [player_1, player_2],
          deck: local_deck,
          player1_deck: p1_deck,
          player2_deck: p2_deck,
          move: player_1,
          c1: 0,
          c2: 0
        }
        delete rooms[id];
        let arr_to_user_1 = {
          deck: p1_deck,
          move: users[started_rooms[id].move].name,
          ck: local_deck.length,
        }
        let arr_to_user_2 = {
          deck: p2_deck,
          move: users[started_rooms[id].move].name,
          ck: local_deck.length,
        }
        functions.answer(10, JSON.stringify(arr_to_user_1), 1, player_1.split(":")[0], player_1.split(":")[1])
        functions.answer(10, JSON.stringify(arr_to_user_2), 1, player_2.split(":")[0], player_2.split(":")[1])
      }
    }
    for (let id in private_rooms) {
      if (private_rooms[id].players.length === 2) {
        let local_deck = []
        for (let suit of suits) {
          for (let value of values) {
            local_deck.push({suit, value});
          }
        }

        let p1_deck = []
        let p2_deck = []
        local_deck = functions.shuffle(local_deck)
        while (p1_deck.length < 4 || p2_deck.length < 4) {
          if (p1_deck.length < 4) {
            const card = local_deck.pop();
            console.log(local_deck.lenght)
            p1_deck.push(card);
          }
          if (p2_deck.length < 4) {
            const card = local_deck.pop();
            console.log(local_deck.lenght)
            p2_deck.push(card);
          }
        }
        let player_1 = functions.getIpByName(users, private_rooms[id].players[0])
        let player_2 = functions.getIpByName(users, private_rooms[id].players[1])
        started_rooms[id] = {
          id: id,
          players: [player_1, player_2],
          deck: local_deck,
          player1_deck: p1_deck,
          player2_deck: p2_deck,
          move: player_1,
          c1: 0,
          c2: 0
        }
        delete private_rooms[id];
        console.log(users[started_rooms[id].move], started_rooms[id])
        let arr_to_user_1 = {
          deck: p1_deck,
          move: users[started_rooms[id].move].name,
          ck: local_deck.length,
        }
        let arr_to_user_2 = {
          deck: p2_deck,
          move: users[started_rooms[id].move].name,
          ck: local_deck.length,
        }
        functions.answer(10, JSON.stringify(arr_to_user_1), 1, player_1.split(":")[0], player_1.split(":")[1])
        functions.answer(10, JSON.stringify(arr_to_user_2), 1, player_2.split(":")[0], player_2.split(":")[1])
      }
    }
    return false;
  },
  shuffle: function(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },
  gameProcess: function(user, karta) {
    if (!users[user]) {
      return "[error] Register first."
    }
    if (users[user].in_room === "nope") {
      return "[error] You are not in the room"
    }
    if (!started_rooms[users[user].in_room]) {
      return "[error] Room doesn't exist"
    }
    let roomId = users[user].in_room
    if (!started_rooms[roomId].players.includes(user)) {
      return "[error] You are not in this room. Don't try to fool me. Subsequent attempts will cause you to be blocked."
    }
    if (user !== started_rooms[roomId].move) {
      return "[error] It's not your turn now."
    }
    let what_a_player = started_rooms[roomId].players.indexOf(user)
    //let p_deck = what_a_player === 0 ? started_rooms[roomId].player1_deck : started_rooms[roomId].player2_deck // колода того кто обратился
    //let e_deck = what_a_player === 0 ? started_rooms[roomId].player2_deck : started_rooms[roomId].player1_deck // колода опонента

    let p_chests = what_a_player === 0 ? started_rooms[roomId].c1 : started_rooms[roomId].c2 // сундучки того кто обратился
    let e_chests = what_a_player === 0 ? started_rooms[roomId].c2 : started_rooms[roomId].c1 // сундучки опонента
    let opponent = (what_a_player === 0) ? started_rooms[roomId].players[1] : started_rooms[roomId].players[0] // получаем опонента
    const playersDecks = started_rooms[roomId].players.map(player => player === user ? 'player1_deck' : 'player2_deck');
    const [p_deck, e_deck] = playersDecks.map(deck => started_rooms[roomId][deck]);
    if (!p_deck.map(card => card.value).includes(karta)){ // если у того кто обратился нет такой карты потому что кто-то решил обмануть нас
      return "[error] You don't have such a card." // говорим что такой карты нет
    }
    if (!e_deck.map(card => card.value).includes(karta)){ // если у опонента нет такой карты
      let game_deck = started_rooms[roomId].deck // получаем колоду игры
      if (game_deck.length !== 0) { // если в колоде есть карты
        const card = game_deck.pop(); // убираем карту с колоды
        const cardExistsInPDeck = p_deck.some(existingCard => {
          return existingCard.value === card.value;
        });
        console.log(cardExistsInPDeck, what_a_player)
        if (cardExistsInPDeck) {
          p_deck.push(card); // Даем карту тому, кто обратился

          let arr_to_user_1 = {
            deck: p_deck,
            move: users[started_rooms[roomId].move].name, // Проверяем, кто обратился, и устанавливаем ход соответственно
            ck: game_deck.length,
          }
          let arr_to_user_2 = {
            deck: e_deck,
            move: users[started_rooms[roomId].move].name,
            ck: game_deck.length,
          }
          functions.answer(10, JSON.stringify(arr_to_user_1), 1, user.split(":")[0], user.split(":")[1])
          functions.answer(10, JSON.stringify(arr_to_user_2), 1, opponent.split(":")[0], opponent.split(":")[1])
          functions.answer(15, karta, 1, opponent.split(":")[0], opponent.split(":")[1])
        } else {
          p_deck.push(card);
          started_rooms[roomId].move = opponent; // Передаем ход оппоненту

          let arr_to_user_1 = {
            deck: p_deck,
            move: users[started_rooms[roomId].move].name, // Проверяем, кто обратился, и устанавливаем ход соответственно
            ck: game_deck.length,
          }
          let arr_to_user_2 = {
            deck: e_deck,
            move: users[started_rooms[roomId].move].name,
            ck: game_deck.length,
          }
          // Отправка ответов пользователям
          functions.answer(10, JSON.stringify(arr_to_user_1), 1, user.split(":")[0], user.split(":")[1])
          functions.answer(10, JSON.stringify(arr_to_user_2), 1, opponent.split(":")[0], opponent.split(":")[1])
          functions.answer(15, karta, 1, opponent.split(":")[0], opponent.split(":")[1])
        }
        functions.findWinners() //возможно пора искать победителя
        return "take" // передаем ответ чтобы обработать на клиенте
      } else { // если в колоде закончились карты
        started_rooms[roomId].move = opponent // передаем ход опопненту
        let arr_to_user_1 = {
          deck: p_deck,
          move: users[started_rooms[roomId].move].name,
          ck: game_deck.length,
        }
        let arr_to_user_2 = {
          deck: e_deck,
          move: users[started_rooms[roomId].move].name,
          ck: game_deck.length,
        }
        functions.answer(10, JSON.stringify(arr_to_user_1), 1, user.split(":")[0], user.split(":")[1])
        functions.answer(10, JSON.stringify(arr_to_user_2), 1, opponent.split(":")[0], opponent.split(":")[1])
        functions.answer(15, karta, 1, opponent.split(":")[0], opponent.split(":")[1])
        functions.findWinners() //возможно пора искать победителя
        return "In deck end cards" // передаем ответ чтобы обработать на клиенте
      }
    } else { // если у опонента есть такие карты
      const indexesOfSixes = [];
      e_deck.forEach((card, index) => {
        if (card.value === karta) {
          indexesOfSixes.push(index);
        }
      });

      if (indexesOfSixes.length > 0) {
        indexesOfSixes.reverse().forEach(index => {
          p_deck.push(e_deck[index]); // Перемещаем карту в колоду игрока, который обратился
          e_deck.splice(index, 1); // Удаляем карту из колоды оппонента
        });
      }
      let game_deck = started_rooms[roomId].deck // получаем колоду игры
      let opponent = (what_a_player === 0) ? started_rooms[roomId].players[1] : started_rooms[roomId].players[0]
      let arr_to_user_1 = {
        deck: p_deck,
        move: users[started_rooms[roomId].move].name,
        ck: game_deck.length,
      }
      let arr_to_user_2 = {
        deck: e_deck,
        move: users[started_rooms[roomId].move].name,
        ck: game_deck.length,
      }
      functions.answer(10, JSON.stringify(arr_to_user_1), 1, user.split(":")[0], user.split(":")[1])
      functions.answer(10, JSON.stringify(arr_to_user_2), 1, opponent.split(":")[0], opponent.split(":")[1])
      functions.answer(15, karta, 1, opponent.split(":")[0], opponent.split(":")[1])
      functions.findWinners() //возможно пора искать победителя
      return `You took opponent ${karta}`
    }
  },
  removeFourCardsWithValues: function(deck, valuesToCheck, roomId, playerNumber) {
    let count = {}; // Счетчик значений карт
    deck.forEach(card => {
      if (card) {
        if (valuesToCheck.includes(card.value)) {
          count[card.value] = (count[card.value] || 0) + 1; // Подсчет количества карт с определенным значением
        }
      }
    });

    // Проверка наличия четырех карт с одним значением и удаление их
    for (const value in count) {
      if (count[value] >= 4) {
        let removed = 0;
        for (let i = deck.length - 1; i >= 0 && removed < 4; i--) {
          if (deck[i].value === value) {
            deck.splice(i, 1);
            removed++;
          }
        }
        started_rooms[roomId][`c${playerNumber}`] += 1; // Увеличение счетчика
        let arr_to_users = {
          c1: started_rooms[roomId].c1,
          c2: started_rooms[roomId].c2
        }
        let game_deck = started_rooms[roomId].deck
        let arr_to_user = {
          deck: deck,
          move: users[started_rooms[roomId].players[playerNumber-1]].name,
          ck: game_deck.length,
        }
        functions.answer(10, JSON.stringify(arr_to_user), 1, started_rooms[roomId].players[playerNumber-1].split(":")[0], started_rooms[roomId].players[playerNumber-1].split(":")[1])
        functions.answer(12, JSON.stringify(arr_to_users), 1, started_rooms[roomId].players[0].split(":")[0], started_rooms[roomId].players[0].split(":")[1])
        functions.answer(12, JSON.stringify(arr_to_users), 1, started_rooms[roomId].players[1].split(":")[0], started_rooms[roomId].players[1].split(":")[1])
        console.log(`Из комнаты ${roomId} у игрока ${playerNumber} удалены четыре карты с значением ${value}.`);
        functions.findWinners() //возможно пора искать победителя
      }
    }
  },
  findChests: function() {
    for (let roomId in started_rooms) {
      const room = started_rooms[roomId];
      const valuesToCheck = ['6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];
      
      for (let i = 0; i < 2; i++) {
        const player_deck = room[`player${i + 1}_deck`];
        functions.removeFourCardsWithValues(player_deck, valuesToCheck, roomId, i + 1)
      }
    }
  },
  findWinners: function() {
    for (let roomId in started_rooms) {
      const room = started_rooms[roomId];
      const player1Chests = room.c1;
      const player2Chests = room.c2;
      if (room.player1_deck.length === 0 || room.player2_deck.length === 0) {
        let winner = null;
        if (player1Chests > player2Chests) {
          winner = users[room.players[0]];
        } else if (player2Chests > player1Chests) {
          winner = users[room.players[1]];
        } else {
          winner = {
            name:"Nobody",
            in_room:"nope"
          }
        }
        if (winner) {
          console.log("Определили победителя")
          const arr_to_users = {winner: winner, r: "default"};
          const player1 = room.players[0].split(":");
          const player2 = room.players[1].split(":");
          users[room.players[0]].in_room = "nope"
          users[room.players[1]].in_room = "nope"
          functions.answer(13, JSON.stringify(arr_to_users), 1, player1[0], player1[1]);
          functions.answer(7, functions.getState(`${player1[0]}:${player1[1]}`), 1, player1[0], player1[1])
          functions.answer(13, JSON.stringify(arr_to_users), 1, player2[0], player2[1]);
          functions.answer(7, functions.getState(`${player2[0]}:${player2[1]}`), 1, player2[0], player2[1])
          delete started_rooms[roomId];
        }
      }
    }
  },
  surrender: function(user) {
    if (!users[user]) {
      return "[error] Register first."
    }
    if (users[user].in_room === "nope") {
      return "[error] You are not in the room"
    }
    if (!started_rooms[users[user].in_room]) {
      return "[error] Room doesn't exist"
    }
    let roomId = users[user].in_room
    if (!started_rooms[roomId].players.includes(user)) {
      return "[error] You are not in this room. Don't try to fool me. Subsequent attempts will cause you to be blocked."
    }
    const [p1, p2] = started_rooms[roomId].players;
    let what_a_player = started_rooms[roomId].players.indexOf(user)
    let who_win = (what_a_player) === 0 ? users[p2] : users[p1];
    const arr_to_users = {winner: who_win, r: "surr"};
    for (let j = 0; j < started_rooms[roomId].players.length; j++) {
      const player = started_rooms[roomId].players[j].split(":");
      users[p1].in_room = "nope"
      users[p2].in_room = "nope"
      functions.answer(13, JSON.stringify(arr_to_users), 1, player[0], player[1]);
      functions.answer(7, functions.getState(`${player[0]}:${player[1]}`), 1, player[0], player[1])
    } 
    delete started_rooms[roomId];
  }
};

server.on('ready', () => {
  console.log(`@server: started at port ${server.port}`);
  infiniteLoop(); // игровой луп
});

server.on('onReceivePacket', async (id, bs, address, port) => {
  if (id === 1) {
    await functions.answer(id, functions.createRoom(`${address}:${port}`, bs.toString()), 4, address, port)
  } else if (id === 2) { 
    await functions.answer(id, functions.getRooms(), 4, address, port)
  } else if (id === 3) {
    await functions.answer(id, functions.createUser(`${address}:${port}`, bs.toString()), 4, address, port)
  } else if (id === 4) {
    await functions.answer(id, functions.getUsers(), 4, address, port)
  } else if (id === 5) {
    await functions.answer(id, functions.connect(`${address}:${port}`, bs.toString()), 4, address, port)
  } else if (id === 6) {
    await functions.answer(id, functions.leave(`${address}:${port}`, bs.toString()), 4, address, port)
  } else if (id === 7) {
    await functions.answer(id, functions.getState(`${address}:${port}`), 4, address, port)
  } else if (id === 11) {
    await functions.answer(id, functions.gameProcess(`${address}:${port}`,  bs.toString()), 4, address, port)
  } else if (id === 14) {
    functions.surrender(`${address}:${port}`)
  }
});


async function infiniteLoop() {
  functions.findStartedGames()
  functions.findChests()
  setTimeout(infiniteLoop, 300);
}

server.on('onClientUpdate', async (address, port, type) => {
  console.log(`onClientUpdate ${address}:${port}:`, type);
  if (type === "timeout") {
        // Удаление пользователя из rooms
    for (const roomId in rooms) {
      if (rooms.hasOwnProperty(roomId)) {
        const room = rooms[roomId];
        if (users[`${address}:${port}`]) {
          room.players = room.players.filter(player => player !== users[`${address}:${port}`].name);
        }
      }
    }
    for (const roomId in private_rooms) {
      const room = private_rooms[roomId];
      const userAddress = `${address}:${port}`;
      if (users[userAddress]) {
        const userName = users[userAddress].name;
        const index = room.players.indexOf(userName);
        if (index !== -1) {
          console.log(`delete ${roomId}`)
          delete private_rooms[roomId];
          break;
        }
      }
    }
    for (const roomId in started_rooms) {
      if (started_rooms.hasOwnProperty(roomId)) {
        const room = started_rooms[roomId];
        const index = room.players.indexOf(`${address}:${port}`);
        if (index !== -1) {
          functions.surrender(`${address}:${port}`)
          console.log(`Комната ${roomId} удалена, так как пользователь ${`${address}:${port}`} был в этой комнате.`);
          delete started_rooms[roomId];
          break
        }
      }
    }
    delete users[`${address}:${port}`];
  }
});

server.listen();

// or change port
// server.listen(7788).then(() => console.log('listen'))