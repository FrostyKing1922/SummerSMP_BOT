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

// 🌐 Keep alive server (Railway/Replit safe)
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

// ⛔ Anti-spam cooldown
let lastStartTime = 0;
const COOLDOWN = 30000; // 30 sec

// 📌 Slash command (send panel)
const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send server control panel')
].map(cmd => cmd.toJSON());

// 🔗 Register command
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Commands registered");
  } catch (err) {
    console.error("❌ Command registration error:", err);
  }
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

// 🔘 Button click handler (WITH COOLDOWN)
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "start_server") {
    const now = Date.now();

    // ⛔ Cooldown check
    if (now - lastStartTime < COOLDOWN) {
      return interaction.reply({
        content: "⏳ Server was started recently. Wait a bit.",
        ephemeral: true
      });
    }

    lastStartTime = now;

    await interaction.reply("⏳ Starting server...");

    try {
      await startServer();
      await interaction.editReply("🚀 Server is starting!");
    } catch (err) {
      console.error("❌ ERROR:", err.response?.data || err);
      await interaction.editReply("❌ Failed to start server.");
    }
  }
});

// 🎤 Auto-start when someone joins VC
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channel && newState.channel) {
    console.log("👤 User joined VC");

    const now = Date.now();

    // ⛔ Prevent spam via VC
    if (now - lastStartTime < COOLDOWN) return;

    lastStartTime = now;

    try {
      await startServer();
      console.log("🚀 Auto-start triggered");
    } catch (err) {
      console.error("❌ Auto-start error:", err.response?.data || err);
    }
  }
});

// 🔑 Login
client.login(process.env.TOKEN);