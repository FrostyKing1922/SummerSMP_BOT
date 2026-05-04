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

// 🌐 Keep alive server
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("🌐 Web server running"));

// 🤖 Bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// 🔒 Anti-spam system
let isStarting = false;
let lastStartTime = 0;
const COOLDOWN = 30000; // 30 sec

// 📌 Slash command
const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send server control panel')
].map(cmd => cmd.toJSON());

// 🔗 Register commands
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

// 🚀 Start server function
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

// 🎮 Send panel
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
async function getServerState() {
  const res = await axios.get(
    `${process.env.PANEL_URL}/api/client/servers/${process.env.SERVER_ID}/resources`,
    {
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
        Accept: "Application/vnd.pterodactyl.v1+json"
      }
    }
  );

  return res.data.attributes.current_state;
}
// 🔘 Button handler (ANTI-SPAM FIXED)
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "start_server") {

    if (isStarting) {
      return interaction.reply({
        content: "⏳ Server is already starting!",
        ephemeral: true
      });
    }

    try {
      const state = await getServerState();
      console.log("STATE:", state);

      // 🟢 Running
      if (state === "running") {
        return interaction.reply({
          content: "🟢 Server is already ONLINE!",
          ephemeral: true
        });
      }

      // ⏳ Starting
      if (state === "starting") {
        return interaction.reply({
          content: "⏳ Server is already starting!",
          ephemeral: true
        });
      }

      isStarting = true;

      await interaction.reply("⏳ Starting server...");

      await startServer();

      await interaction.editReply("🚀 Server is starting!");

      isStarting = false;

    } catch (err) {
      console.error("FULL ERROR:", err.response?.data || err);

      isStarting = false;

      const errorCode = err.response?.data?.errors?.[0]?.code;
      const errorMsg = err.response?.data?.errors?.[0]?.detail || "";

      // 🔴 LIMBO (important fix)
      if (
        errorCode === "ServerStateConflictException" &&
        errorMsg.toLowerCase().includes("not assigned to a node")
      ) {
        return interaction.reply({
          content: "⚠️ Server is in limbo (not ready). Please wait or contact host.",
          ephemeral: true
        });
      }

      // 🟢 Already running (safe cases only)
      if (
        errorCode === "InvalidStateException" ||
        errorMsg.toLowerCase().includes("already running")
      ) {
        return interaction.reply({
          content: "🟢 Server is already ONLINE!",
          ephemeral: true
        });
      }

      // ❌ Real error
      return interaction.reply({
        content: "❌ Failed to start server.",
        ephemeral: true
      });
    }
  }
});
// 🎤 Auto-start when someone joins VC
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channel && newState.channel) {
    const now = Date.now();

    if (isStarting || now - lastStartTime < COOLDOWN) return;

    isStarting = true;
    lastStartTime = now;

    try {
      await startServer();
      console.log("🚀 Auto-start triggered");
    } catch (err) {
      console.error("❌ Auto-start error:", err.response?.data || err);
    }

    setTimeout(() => {
      isStarting = false;
    }, COOLDOWN);
  }
});

// 🔑 Login
client.login(process.env.TOKEN);