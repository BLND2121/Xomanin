const http = require('http');
const express = require('express');
const { Client, MessageEmbed, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_ID = ['890933844222558239'] // Replace with the bot owner's Discord ID
const ALLOWED_ROLES = process.env.allowed_roles ? process.env.allowed_roles.split(',') : ['971346783135465472']; // Define allowed roles for command execution

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve the HTML file on the root route
app.get("/", (request, response) => {
  response.sendFile('web.html', { root: __dirname });
});

// Start the server on the specified port
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const configFile = 'config.json';
const limitsFile = 'limits.json';
const balanceFile = 'balance.json'; // Assuming balance data is stored in balance.json

// Load existing configuration
let config = {};
if (fs.existsSync(configFile)) {
  config = JSON.parse(fs.readFileSync(configFile));
}

// Load existing limits
let limits = { users: {} };
if (fs.existsSync(limitsFile)) {
  limits = JSON.parse(fs.readFileSync(limitsFile));
}

// Initialize balance
let balance = {
  coins: {}, // Initialize an object to store user coin balances
};
if (fs.existsSync(balanceFile)) {
  balance = JSON.parse(fs.readFileSync(balanceFile));
}

// Store bot processes to manage them
let botProcesses = {};

// Slash command setup
const commands = [
  new SlashCommandBuilder()
    .setName('add_token')
    .setDescription('Add token and voice channel ID')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('The bot token')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('idvoice')
        .setDescription('The voice channel ID')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('remove_token')
    .setDescription('Remove token and stop bot instance')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('The bot token to remove')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('token_list')
    .setDescription('Send the list of tokens in private chat')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('limit')
    .setDescription('Manage token limits for users')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform (remove/give)')
        .setRequired(true)
        .addChoices(
          { name: 'remove', value: 'remove' },
          { name: 'give', value: 'give' }
        ))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to modify')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount to add/remove')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coins.')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('credit')
    .setDescription('Check your current coin balance.')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('buy_limit')
    .setDescription('Buy additional token limit.')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of additional tokens to buy.')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('To see all commands')
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken('MTA4ODI3MDIwODU3OTQwMzc5Ng.GP9Obu.JqtIAYoZh_Q63nCdgxfilClNRbuct1hGJZtet0'); // Replace with your bot token

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands('1088270208579403796'), // Replace with your client ID
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

const updateBotPresence = () => {
  const tokenCount = Object.keys(config).length;
  client.user.setActivity(`Tokens : ${tokenCount}`, { type: 'PLAYING' });
};

client.once('ready', () => {
  console.log('Main bot is ready!');

  // Set initial presence when bot is ready
  updateBotPresence(); // Initial setting of bot presence

  // Update presence every 1 minute (60 seconds * 1000 milliseconds)
  setInterval(updateBotPresence, 60 * 1000);

  // Auto-start bot instances based on config.json
  for (const token in config) {
    const { channelId, userId } = config[token];
    const botProcess = spawn('node', [path.join(__dirname, 'subBot.js'), token, channelId]);
    botProcesses[token] = botProcess;

    botProcess.stdout.on('data', (data) => {
      console.log(`Bot stdout: ${data}`);
    });

    botProcess.stderr.on('data', (data) => {
      console.error(`Bot stderr: ${data}`);
    });

    botProcess.on('close', (code) => {
      console.log(`Bot process exited with code ${code}`);
      delete botProcesses[token];
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  console.log('Received interaction:', interaction);

  if (!interaction.isCommand()) return;

  const { commandName, options, user, member } = interaction;

  const hasAllowedRole = member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
  if (!hasAllowedRole && !OWNER_ID.includes(user.id)) {
    await interaction.reply({ content: 'You do not have permission to use this command', ephemeral: true });
    return;
  }

  if (commandName === 'add_token') {
    const token = options.getString('token');
    const channelId = options.getString('idvoice');

    // Get user limit and check if they can add a token
    const userLimit = limits.users[user.id]?.tokens_limit || 1;
    const userTokens = Object.values(config).filter(entry => entry.userId === user.id).length;

    if (userTokens >= userLimit) {
      await interaction.reply({ content: `You have reached your token limit of ${userLimit}.`, ephemeral: true });
      return;
    }

    console.log(`Received token: ${token}, channelId: ${channelId} from user: ${user.id}`);

    config[token] = { channelId, userId: user.id };
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    await interaction.reply({ content: `Token and Channel ID have been saved. Starting new bot instance...`, ephemeral: true });

    // Spawn a new bot process
    const botProcess = spawn('node', [path.join(__dirname, 'subBot.js'), token, channelId]);
    botProcesses[token] = botProcess;

    botProcess.stdout.on('data', (data) => {
      console.log(`Bot stdout: ${data}`);
    });

    botProcess.stderr.on('data', (data) => {
      console.error(`Bot stderr: ${data}`);
    });

    botProcess.on('close', (code) => {
      console.log(`Bot process exited with code ${code}`);
      delete botProcesses[token];
    });
  } else if (commandName === 'remove_token') {
    const token = options.getString('token');

    // Check if the user owns the token
    if (config[token] && config[token].userId === user.id) {
      delete config[token];
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

      if (botProcesses[token]) {
        botProcesses[token].kill();
        delete botProcesses[token];
      }

      await interaction.reply({ content: `Token and corresponding bot instance have been removed`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Token not found or you do not have permission to remove it`, ephemeral: true });
    }
  } else if (commandName === 'token_list') {
    const userTokens = Object.entries(config)
      .filter(([_, entry]) => entry.userId === user.id)
      .map(([token, _]) => token)
      .join('\n') || 'No tokens available.';

    try {
      await user.send(`Here is the list of your tokens:\n${userTokens}`);
      await interaction.reply({ content: 'Token list has been sent to your DMs.', ephemeral: true });
    } catch (error) {
      console.error(`Could not send DM to ${user.tag}.\n`, error);
      await interaction.reply({ content: 'I could not send you a DM. Please check your privacy settings.', ephemeral: true });
    }
  } else if (commandName === 'limit') {
    if (!OWNER_ID.includes(user.id)) {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      return;
    }

    const action = options.getString('action');
    const targetUser = options.getUser('user');
    const amount = options.getInteger('amount');

    if (action === 'give') {
      limits.users[targetUser.id] = { tokens_limit: (limits.users[targetUser.id]?.tokens_limit || 1) + amount };
    } else if (action === 'remove') {
      limits.users[targetUser.id] = { tokens_limit: Math.max(1, (limits.users[targetUser.id]?.tokens_limit || 1) - amount) };
    }

    fs.writeFileSync(limitsFile, JSON.stringify(limits, null, 2));
    await interaction.reply({ content: `User ${targetUser.tag}'s token limit has been updated.`, ephemeral: true });
  } else if (commandName === 'daily') {
    const userBalance = balance.coins[user.id] || { coins: 0, lastClaim: 0 };

    const now = Date.now();
    const lastClaimTimestamp = userBalance.lastClaim || 0;
    const hoursSinceLastClaim = (now - lastClaimTimestamp) / (1000 * 60 * 60);

    if (hoursSinceLastClaim < 24) {
      const remainingHours = 24 - hoursSinceLastClaim;
      await interaction.reply(`You can claim your daily coins in ${remainingHours.toFixed(1)} hours.`);
    } else {
      const dailyCoins = 3;
      userBalance.coins += dailyCoins;
      userBalance.lastClaim = now;
      balance.coins[user.id] = userBalance;

      fs.writeFileSync(balanceFile, JSON.stringify(balance, null, 2));

      await interaction.reply(`You have claimed your daily ${dailyCoins} coins. Total coins: ${userBalance.coins}`);
    }
  } else if (commandName === 'credit') {
    const userBalance = balance.coins[user.id] || { coins: 0 };
    await interaction.reply(`You have ${userBalance.coins} coins and ${limits.users[user.id]?.tokens_limit || 1} tokens.`);
  } else if (commandName === 'buy_limit') {
    const amount = options.getInteger('amount');
    if (isNaN(amount) || amount <= 0) {
      await interaction.reply(`Please enter a valid amount to buy.`);
      return;
    }

    const cost = amount * 20;
    const userBalance = balance.coins[user.id] || { coins: 0 };

    if (userBalance.coins < cost) {
      await interaction.reply(`You do not have enough coins. This purchase requires ${cost} coins.`);
      return;
    }

    userBalance.coins -= cost;
    balance.coins[user.id] = userBalance;

    limits.users[user.id] = { tokens_limit: (limits.users[user.id]?.tokens_limit || 1) + amount };
    fs.writeFileSync(limitsFile, JSON.stringify(limits, null, 2));
    fs.writeFileSync(balanceFile, JSON.stringify(balance, null, 2));

    await interaction.reply(`You have bought ${amount} additional token limit for ${cost} coins.`);
  } else if (commandName === 'help') {
    const helpMessage = `
<a:1010990591108194434:1252256640074518576>All My Commands<a:1010990591108194434:1252256640074518576>:
/add_token: Add an account to stream in voice.
/remove_token: Remove an account from streaming.
/token_list: See the list of tokens you added.
/daily: Claim your daily coins.
/credit: See your coins and tokens.
/buy_limit: Buy more tokens for streaming using coins.
    `;
    await interaction.reply(helpMessage);
  }
});

try {
    // Your API call or bot logic here
} catch (error) {
    console.error('Error occurred:', error);
}

client.login('MTA4ODI3MDIwODU3OTQwMzc5Ng.GP9Obu.JqtIAYoZh_Q63nCdgxfilClNRbuct1hGJZtet0'); // Replace with your bot's token