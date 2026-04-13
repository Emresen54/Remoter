const { mouse, keyboard, Button, Key } = require("@nut-tree-fork/nut-js");
const { execSync } = require("child_process");

const MOUSE_SENSITIVITY = 2;
const SCROLL_SENSITIVITY = 4;

function writeToClipboardWindows(text) {
  const safeText = String(text ?? "");

  execSync("clip", {
    input: safeText,
    stdio: ["pipe", "ignore", "ignore"],
  });
}

async function pasteClipboard() {
  await keyboard.pressKey(Key.LeftControl);
  await keyboard.pressKey(Key.V);
  await keyboard.releaseKey(Key.V);
  await keyboard.releaseKey(Key.LeftControl);
}

async function handleCommand(payload) {
  const { type, data } = payload || {};

  switch (type) {
    case "move": {
      const dx = Number(data?.dx || 0);
      const dy = Number(data?.dy || 0);

      if (Number.isNaN(dx) || Number.isNaN(dy)) {
        throw new Error("Invalid move values");
      }

      if (dx === 0 && dy === 0) {
        return;
      }

      const currentPos = await mouse.getPosition();

      await mouse.setPosition({
        x: currentPos.x + Math.round(dx * MOUSE_SENSITIVITY),
        y: currentPos.y + Math.round(dy * MOUSE_SENSITIVITY),
      });

      break;
    }

    case "scroll": {
      const dy = Number(data?.dy || 0);

      if (Number.isNaN(dy)) {
        throw new Error("Invalid scroll value");
      }

      if (dy === 0) {
        return;
      }

      await mouse.scrollDown(Math.round(-dy * SCROLL_SENSITIVITY));
      break;
    }

    case "left_click":
      await mouse.click(Button.LEFT);
      break;

    case "right_click":
      await mouse.click(Button.RIGHT);
      break;

    case "type_text": {
      const text = String(data?.text || "");
      if (!text) return;

      try {
        writeToClipboardWindows(text);
        await new Promise((resolve) => setTimeout(resolve, 120));
        await pasteClipboard();
      } catch (err) {
        console.error("Clipboard paste failed, fallback to slow typing:", err.message);
        await keyboard.type(text);
      }

      break;
    }

    case "press_key": {
      const keyName = data?.key;

      const keyMap = {
        enter: Key.Enter,
        backspace: Key.Backspace,
        space: Key.Space,
        tab: Key.Tab,
        escape: Key.Escape,
      };

      const key = keyMap[keyName];

      if (!key) {
        throw new Error(`Unsupported key: ${keyName}`);
      }

      await keyboard.pressKey(key);
      await keyboard.releaseKey(key);
      break;
    }

    default:
      throw new Error(`Unknown command type: ${type}`);
  }
}

module.exports = { handleCommand };