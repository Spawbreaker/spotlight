class Spotlight {
  static ID = "spotlight";

  static TEMPLATES = {
    SPOTLIGHT: `modules/${this.ID}/templates/spotlight.html`,
  };

  static FLAGS = {
    COUNTER: "spotlightCounter",
  };

  static MAX_SPOTLIGHT = 3;

  static getSpotlightForUser(userId) {
    return game.users.get(userId)?.getFlag(this.ID, this.FLAGS.COUNTER) ?? 0;
  }

  static spotlightUser(userId) {
    const user = game.users.get(userId);

    if (!user) return;
    const currentSpotlight = this.getSpotlightForUser(userId);

    if (currentSpotlight) {
      user.setFlag(this.ID, this.FLAGS.COUNTER, currentSpotlight - 1);
      this._notifySpotlightTaken(userId);
    } else {
      ui.notifications.warn(
        game.i18n.format("SPOTLIGHT.NoSpotlightLeft", { player: user.name })
      );
    }
  }

  static takeTheSpotlight() {
    this.spotlightUser(game.user.id);
  }

  static refundSpotlightFor(userId) {
    const user = game.users.get(userId);
    if (!user) return;

    const currentSpotlight = this.getSpotlightForUser(userId);
    if (currentSpotlight < this.MAX_SPOTLIGHT) {
      user.setFlag(this.ID, this.FLAGS.COUNTER, currentSpotlight + 1);
    }
  }

  static refundSpotlight() {
    this.refundSpotlightFor(game.user.id);
  }

  static resetSpotlights() {
    // Only for GMs
    if (!game.user.isGM) {
      return;
    }

    for (const user of game.users) {
      user.setFlag(this.ID, this.FLAGS.COUNTER, this.MAX_SPOTLIGHT);
    }
    this._notifySpotlightReset();
  }

  static _notifySpotlightTaken(userId) {
    const content = `<p>${game.i18n.localize(
      "SPOTLIGHT.SpotlightTakenMessage"
    )}</p><button class="refund-spotlight-button" data-action="refund-spotlight">${game.i18n.localize(
      "SPOTLIGHT.RefundSpotlight"
    )}</button>`;

    ChatMessage.create({
      author: userId,
      content,
      // speaker: ChatMessage.getSpeaker({ user }),
      flags: {
        [this.ID]: {
          spotlightTaken: true,
        },
      },
    });
  }

  static _notifySpotlightReset() {
    const content = `<p>${game.i18n.localize(
      "SPOTLIGHT.SpotlightResetMessage"
    )}</p>`;
    ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ user: game.user }),
    });
  }
}

Hooks.on("init", () => {
  const origTokenLayerPrepareSceneControls =
    foundry.canvas.layers.TokenLayer.prepareSceneControls;
  foundry.canvas.layers.TokenLayer.prepareSceneControls = () => {
    console.log("Spotlight: Preparing scene controls for TokenLayer");
    const sc = SceneControls;
    const controls = origTokenLayerPrepareSceneControls();
    controls.tools.spotlight = {
      name: "spotlight",
      order: 5,
      title: "SPOTLIGHT.SpotlightControl",
      icon: "fas fa-star",
      toolclip: {
        heading: "SPOTLIGHT.SpotlightControl",
        items: sc.buildToolclipItems([
          {
            heading: "SPOTLIGHT.SpotlightControl",
            paragraph: "SPOTLIGHT.SpotlightControlTooltip",
          },
        ]),
      },
      button: true,
      onChange: () => {
        if (game.user.isGM) {
          // The GM can not be spotlighted.
          ui.notifications.info(game.i18n.localize("SPOTLIGHT.GMSpotlight"));
        } else {
          Spotlight.spotlightUser(game.user.id);
        }
      },
    };

    controls.tools.spotlightReset = {
      name: "spotlightReset",
      order: 6,
      title: "SPOTLIGHT.SpotlightResetTool",
      icon: "fa-solid fa-clock-rotate-left",
      toolclip: {
        heading: "SPOTLIGHT.SpotlightResetTool",
        items: sc.buildToolclipItems([
          {
            heading: "SPOTLIGHT.SpotlightResetTool",
            paragraph: "SPOTLIGHT.SpotlightResetTooltip",
          },
        ]),
      },
      button: true,
      onChange: () => {
        Spotlight.resetSpotlights();
      },
      visible: game.user.isGM,
    };

    return controls;
  };
});

Hooks.on("renderPlayers", (app, html, data) => {
  for (const li of html.querySelectorAll(".players-list > .player")) {
    const user = game.users.get(li.dataset.userId);

    // Skip users if they are the gm
    if (user.isGM) {
      continue;
    }

    const indicator = document.createElement("span");
    indicator.className = "spotlight-indicator";

    const spotlightCount = Spotlight.getSpotlightForUser(user.id);
    for (let i = 0; i < 3; i++) {
      const star = document.createElement("i");
      star.className = "fas fa-star";
      star.setAttribute(
        "data-spotlight-available",
        i < spotlightCount ? "true" : "false"
      );

      indicator.appendChild(star);
    }
    li.appendChild(indicator);
  }
});

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  if (data.message.flags?.[Spotlight.ID]?.spotlightTaken) {
    const refundButton = html.querySelector(".refund-spotlight-button");
    if (refundButton) {
      refundButton.addEventListener("click", (event) => {
        event.preventDefault();
        Spotlight.refundSpotlight(message.user.id);
        // Delete the message after refund
        message.delete();
      });
    }
  }
});
