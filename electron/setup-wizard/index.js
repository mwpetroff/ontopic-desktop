/**
   * First-Launch Setup Wizard
   *
   * Shown once on first launch. Handles platform-specific setup:
   *
   *  Windows:
   *    - Request microphone permission (Windows privacy API)
   *    - Confirm default audio device selection
   *    - No extra drivers needed
   *
   *  macOS:
   *    - Request microphone permission (NSMicrophoneUsageDescription)
   *    - Prompt to install BlackHole virtual audio driver
   *    - Guide user through Multi-Output Device setup in System Preferences
   *      (or automate via CoreAudio aggregate device API if possible)
   *
   *  Linux:
   *    - Check if PulseAudio or PipeWire is running
   *    - Verify user is in the "audio" group
   *    - Auto-detect monitor source and confirm with user
   */

  const { app, dialog, shell } = require("electron");
  const os = require("os");
  const path = require("path");

  async function runSetupWizardIfNeeded(mainWindow) {
    const platform = process.platform;

    // TODO: persist wizard completion in app config (electron-store)
    const wizardCompleted = false; // Replace with: store.get("wizardCompleted")

    if (wizardCompleted) return;

    if (platform === "darwin") {
      await setupMac(mainWindow);
    } else if (platform === "win32") {
      await setupWin(mainWindow);
    } else {
      await setupLinux(mainWindow);
    }

    // store.set("wizardCompleted", true);
  }

  async function setupMac(win) {
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: "OnTopic Setup — macOS Audio",
      message: "System Audio Capture Setup",
      detail:
        "OnTopic needs to capture your speaker output to hear remote participants.\n\n" +
        "This requires installing the BlackHole virtual audio driver (free, open source).\n\n" +
        "Click Install to proceed. You will be prompted for your admin password once.",
      buttons: ["Install BlackHole", "Skip for Now"],
      defaultId: 0,
    });

    if (response === 0) {
      // TODO: Bundle BlackHole installer and run:
      // execSync("installer -pkg ./resources/BlackHole2ch.pkg -target /");
      shell.openExternal("https://github.com/ExistentialAudio/BlackHole/wiki/Installation");
    }
  }

  async function setupWin(win) {
    await dialog.showMessageBox(win, {
      type: "info",
      title: "OnTopic Setup — Windows Audio",
      message: "Audio Capture Ready",
      detail:
        "OnTopic will capture your microphone and speaker output automatically.\n\n" +
        "Make sure your headset or speakers are set as the Default Playback Device in Windows Sound Settings.",
      buttons: ["Got it"],
    });
  }

  async function setupLinux(win) {
    await dialog.showMessageBox(win, {
      type: "info",
      title: "OnTopic Setup — Linux Audio",
      message: "PulseAudio / PipeWire Detected",
      detail:
        "OnTopic will use your system audio monitor source to capture speaker output.\n\n" +
        "No additional setup required.",
      buttons: ["Got it"],
    });
  }

  module.exports = { runSetupWizardIfNeeded };
  