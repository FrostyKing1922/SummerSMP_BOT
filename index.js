require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const axios = require('axios');
const express = require('express');

const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("🌐 Web server running"));

// 🔥 Create bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// 📌 Slash command (to send button)
const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send server control panel')
].map(cmd => cmd.toJSON());

// 🔗 Register command
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log("✅ Commands registered");
})();

// 🚀 Function to start server
async function startServer() {
  return axios.post(
    `${process.env.PANEL_URL}/api/client/servers/${process.env.SERVER_ID}/power`,
    { signal: "start" },
    {
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
        "Content-Type": "application/json",
        Accept: "Application/vnd.pterodactyl.v1+json"
      }
    }
  );
}

// 🎮 Slash command → send button
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "panel") {
    const button = new ButtonBuilder()
      .setCustomId("start_server")
      .setLabel("🚀 Start Server")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      content: "🎮 Minecraft Server Control",
      components: [row]
    });
  }
});

// 🔘 Button click
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "start_server") {
    await interaction.reply("⏳ Starting server...");

    try {
      await startServer();
      await interaction.editReply("🚀 Server is starting!");
    } catch (err) {
      console.error(err.response?.data || err);
      await interaction.editReply("❌ Failed to start server.");
    }
  }
});

// 🎤 AUTO START WHEN SOMEONE JOINS VC
client.on('voiceStateUpdate', async (oldState, newState) => {
  // joined a VC
  if (!oldState.channel && newState.channel) {
    console.log("👤 Someone joined VC");

    try {
      await startServer();
      console.log("🚀 Auto-start triggered");
    } catch (err) {
      console.error("Auto-start error:", err.response?.data || err);
    }
  }
});
let lastStart = 0;

async function safeStart() {
  if (Date.now() - lastStart < 30000) return;
  lastStart = Date.now();
  return startServer();
}
// 🔑 Login
client.login(process.env.TOKEN);