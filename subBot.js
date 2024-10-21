const { Client, RichPresence } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');

const token = process.argv[2];
const channelId = process.argv[3];

const client = new Client();

client.once('ready', async () => {
  console.log(`Bot with token ${token} is ready!`);
    
    // Create an object to store the last message timestamp for each user
const userLastMessage = new Map();

client.on('messageCreate', (message) => {
  // Check if it's a direct message and the bot is mentioned
  if (message.channel.type === 'DM' && message.mentions.has(client.user)) {
    const userId = message.author.id;
    const now = Date.now();

    // Check if the user has sent a message in the last 1 hour (3600000 ms)
    if (userLastMessage.has(userId) && (now - userLastMessage.get(userId)) < 86400000) {
      return; // Do nothing if less than 1 hour has passed
    }

    // Update the last message timestamp for the user
    userLastMessage.set(userId, now);

    // Send the response
    return message.channel.send(`https://discord.gg/3QNvnXX6Nf
https://discord.gg/VmSA9sgPzW`);
  }
});
    

// Replace with the two specific channel IDs you want the bot to handle
const specificChannelId1 = '1279546979696902296';  
const specificChannelId2 = '1165941397405315203';  


// Listen for messages in both channels
client.on('messageCreate', message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message is from the first specific channel
    if (message.channel.id === specificChannelId1) {
        if (message.content.toLowerCase() === 'reklam') {
            setTimeout(() => {
                message.reply(" ```Bnera wa tagm ka la chate tae bat``` ");
            }, 5000); // 5-second delay
        } else if (message.content.toLowerCase() === 'Reklam') {
            setTimeout(() => {
                message.reply(" ```Bnera wa tagm ka la chate tae``` ");
            }, 5000); // 5-second delay
        }

    } 
    // Check if the message is from the second specific channel
    else if (message.channel.id === specificChannelId2) {
        if (message.content.toLowerCase() === 'reklam') {
            setTimeout(() => {
                message.reply(" ```Bnera wa tagm ka la chate tae bat``` ");
            }, 7000); // 5-second delay
        } else if (message.content.toLowerCase() === 'Reklam') {
            setTimeout(() => {
                message.reply(" ```Bnera wa tagm ka la chate tae bat``` ");
            }, 7000); // 5-second delay
        }
    }
});


    
  client.user.setStatus("idle");
       
  try {
    const channel = await client.channels.fetch(channelId);

    setTimeout(() => {
      try {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
          selfMute: true, // Bot joins muted
          selfDeaf: true, // Bot joins Deafnd
        });

        console.log(`Joined the voice channel: ${channelId}`);

        connection.on('stateChange', (state) => {
          console.log(`Connection state changed: ${state.status}`);
        });

        connection.on('error', (error) => {
          console.error(`Voice connection error: ${error}`);
        });

        connection.on('disconnect', (disconnectReason) => {
          console.log(`Disconnected from voice channel: ${disconnectReason}`);
        });
      } catch (error) {
        console.error(`Error joining the voice channel: ${error}`);
      }
    }, 1000);
  } catch (error) {
    console.error(`Error fetching the channel: ${error}`);
  }
});

client.login(token);