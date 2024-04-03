import { WwnDice } from "../dice.js";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class WwnItem extends Item {
  // Replacing default image
  static get defaultIcons() {
    return {
      spell: "/systems/wwn/assets/default/spell.png",
      ability: "/systems/wwn/assets/default/ability.png",
      armor: "/systems/wwn/assets/default/armor.png",
      weapon: "/systems/wwn/assets/default/weapon.png",
      item: "/systems/wwn/assets/default/item.png",
      focus: "/systems/wwn/assets/default/focus.png",
      art: "/systems/wwn/assets/default/art.png",
      effect: ""
    };
  }

  static async create(data, context = {}) {
    if (data.img === undefined) {
      data.img = this.defaultIcons[data.type];
    }
    return super.create(data, context);
  }

  prepareData() {
    super.prepareData();
  }

  async prepareDerivedData() {
    const itemData = this?.system;

    // Rich text description
    itemData.enrichedDescription = await TextEditor.enrichHTML(
      itemData.description,
      { async: true }
    );
  }

  static chatListeners(html) {
    html.on("click", ".card-buttons button", this._onChatCardAction.bind(this));
    html.on("click", ".item-name", this._onChatCardToggleContent.bind(this));
  }

  getChatData(htmlOptions) {
    const itemData = { ...this.system };

    // Rich text description
    // data.description = TextEditor.enrichHTML(data.description, htmlOptions);

    // Item properties
    const props = [];
    const labels = this.labels;

    if (this.type == "weapon") {
      itemData.tags.forEach((t) => props.push(t.value));
    }
    if (this.type == "spell") {
      props.push(
        `${itemData.class} ${itemData.lvl}`,
        itemData.range,
        itemData.duration
      );
    }
    if (itemData.hasOwnProperty("equipped")) {
      props.push(itemData.equipped ? "Equipped" : "Not Equipped");
    }
    if (itemData.hasOwnProperty("stowed")) {
      props.push(itemData.stowed ? "Stowed" : "Not Stowed");
    }
    if (itemData.hasOwnProperty("prepared")) {
      props.push(itemData.prepared ? "Prepared" : "Not Prepared");
    }

    if (!!itemData.roll) {
      const unevaluatedRoll = new Roll(itemData.roll, {
        ...(this.actor?._getRollData() || {}),
        actor: this.actor,
      });
      itemData.roll = unevaluatedRoll.formula;
    }

    // Filter properties and return
    itemData.properties = props.filter((p) => !!p);
    return itemData;
  }

  async rollAsset(options = {}) {
    ui.notifications.info("TODO");
  }

  async rollSkill(options = {}) {
    const template = "systems/wwn/templates/items/dialogs/roll-skill.html";
    const dialogData = {
      defaultScore: this.system.score,
      dicePool: this.system.skillDice,
      name: this.name,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
    };
    const newData = {
      actor: this.actor,
      item: this,
      roll: {},
    };

    const data = this.system;
    const skillName = this.name;
    const score = this.actor.system.scores[data.score];

    // Determine if armor penalty applies
    let armorPenalty = 0;
    if (skillName == "Exert") {
      armorPenalty -= this.parent.system.skills.exertPenalty;
    } else if (skillName == "Sneak") {
      armorPenalty -= this.parent.system.skills.sneakPenalty;
    }

    // Determine skill level, taking into account polymath and unskilled penalties
    let skillLevel;
    const poly = this.parent.items.find((i) => i.name == "Polymath");
    if (
      !poly ||
      skillName == "Shoot" ||
      skillName == "Stab" ||
      skillName == "Brawl"
    ) {
      skillLevel = data.ownedLevel;
    } else {
      skillLevel = Math.max(poly.system.ownedLevel - 1, data.ownedLevel);
    }

    // Assemble dice pool
    const rollParts = [data.skillDice, score.mod, skillLevel];
    if (armorPenalty < 0) {
      rollParts.push(armorPenalty);
    }

    if (options.skipDialog) {
      const attrKey = `WWN.scores.${data.score}.short`;
      const rollTitle = `${game.i18n.localize(attrKey)}/${this.name}`;

      let rollData = {
        parts: rollParts,
        data: newData,
        title: rollTitle,
        flavor: null,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        form: null,
        rollTitle: rollTitle,
      };
      return WwnDice.sendRoll(rollData);
    }

    const html = await renderTemplate(template, dialogData);
    const title = `${game.i18n.localize("WWN.Roll")} ${this.name}`;
    const _doRoll = async (html) => {
      const form = html[0].querySelector("form");
      rollParts[0] = form.skillDice.value;
      rollParts[1] = this.actor.system.scores[form.score.value].mod;
      if (!score) {
        ui.notifications.error("Unable to find score on char.");
        return;
      }
      const attrKey = `WWN.scores.${form.score.value}.short`;
      const rollTitle = `${game.i18n.localize(attrKey)}/${this.name}`;
      let rollData = {
        parts: rollParts,
        data: newData,
        title: rollTitle,
        flavor: null,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        form: form,
        rollTitle: rollTitle,
      };
      WwnDice.sendRoll(rollData);
    };

    let buttons = {
      ok: {
        label: title,
        icon: '<i class="fas fa-dice-d20"></i>',
        callback: _doRoll,
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("WWN.Cancel"),
        callback: (html) => {},
      },
    };

    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: "ok",
        close: () => {},
      }).render(true);
    });
  }

  rollWeapon(options = {}) {
    let isNPC = this.actor.type != "character";
    const targets = 5;
    const data = this.system;
    let type = isNPC ? "attack" : "melee";
    const rollData = {
      ...(this.actor?._getRollData() || {}),
      item: this,
      actor: this.actor,
      roll: {
        save: this.system.save,
        target: null,
      },
    };

    if (data.missile && data.melee && !isNPC) {
      // Dialog
      new Dialog({
        title: "Choose Attack Range",
        content: "",
        buttons: {
          melee: {
            icon: '<i class="fas fa-fist-raised"></i>',
            label: "Melee",
            callback: () => {
              this.actor.targetAttack(rollData, "melee", options);
            },
          },
          missile: {
            icon: '<i class="fas fa-bullseye"></i>',
            label: "Missile",
            callback: () => {
              this.actor.targetAttack(rollData, "missile", options);
            },
          },
        },
        default: "melee",
      }).render(true);
      return true;
    } else if (data.missile && !isNPC) {
      type = "missile";
    }
    this.actor.targetAttack(rollData, type, options);
    return true;
  }

  async rollFormula(options = {}) {
    const data = this.system;
    if (!data.roll) {
      throw new Error("This Item does not have a formula to roll!");
    }

    const label = `${this.name}`;
    const rollParts = [data.roll];

    let type = data.rollType;

    const newData = {
      ...(this.actor._getRollData() || {}),
      actor: this.actor,
      item: this,
      roll: {
        type: type,
        target: data.rollTarget,
        blindroll: data.blindroll,
      },
    };

    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: newData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.formula", { label: label }),
      title: game.i18n.format("WWN.roll.formula", { label: label }),
    });
  }

  spendSpell() {
    const spellsLeft = this.actor.system.spells.perDay.value;
    const spellsMax = this.actor.system.spells.perDay.max;
    if (spellsLeft + 1 > spellsMax)
      return ui.notifications.warn("No spell slots remaining!");
    this.actor
      .update({
        "system.spells.perDay.value": spellsLeft + 1,
      })
      .then(() => {
        this.show({ skipDialog: true });
      });
  }

  spendArt() {
    if (this.system.time) {
      const sourceName = this.system.source;
      if (sourceName === undefined)
        return ui.notifications.warn(
          `Please add class name to the Source field.`
        );

      const currEffort = this.system.effort;
      const sourceVal = this.actor.system.classes[sourceName].value;
      const sourceMax = this.actor.system.classes[sourceName].max;

      if (sourceVal + 1 > sourceMax)
        return ui.notifications.warn("No Effort remaining!");

      this.update({ "system.effort": currEffort + 1 }).then(() => {
        this.show({ skipDialog: true });
      });
    } else {
      this.show({ skipDialog: true });
    }
  }

  getTags() {
    let formatTag = (tag, icon) => {
      if (!tag) return "";
      let fa = "";
      if (icon) {
        fa = `<i class="fas ${icon}"></i> `;
      }
      return `<li class='tag'>${fa}${tag}</li>`;
    };

    const data = this.system;
    switch (this.system.type) {
      case "weapon":
        let wTags = formatTag(data.damage, "fa-tint");
        data.tags.forEach((t) => {
          wTags += formatTag(t.value);
        });
        wTags += formatTag(CONFIG.WWN.saves[data.save], "fa-skull");
        if (data.missile) {
          wTags += formatTag(
            data.range.short + "/" + data.range.long,
            "fa-bullseye"
          );
        }
        return wTags;
      case "armor":
        return `${formatTag(CONFIG.WWN.armor[data.type], "fa-tshirt")}`;
      case "item":
        return "";
      case "focus":
        return "";
      case "ability":
        return "";
      case "spell":
        let sTags = `${formatTag(data.class)}${formatTag(
          data.range
        )}${formatTag(data.duration)}${formatTag(data.roll)}`;
        if (data.save) {
          sTags += formatTag(CONFIG.WWN.saves[data.save], "fa-skull");
        }
        return sTags;
      case "art":
        let roll = "";
        roll += data.roll ? data.roll : "";
        roll += data.rollTarget ? CONFIG.WWN.roll_type[data.rollType] : "";
        roll += data.rollTarget ? data.rollTarget : "";
        return `${formatTag(data.requirements)}${formatTag(roll)}`;
      case "asset":
        return "";
    }
    return "";
  }

  pushTag(values) {
    const data = this.system;
    let update = [];
    if (data.tags) {
      update = duplicate(data.tags);
    }
    let newData = {};
    var regExp = /\(([^)]+)\)/;
    if (update) {
      values.forEach((val) => {
        // Catch infos in brackets
        var matches = regExp.exec(val);
        let title = "";
        if (matches) {
          title = matches[1];
          val = val.substring(0, matches.index).trim();
        } else {
          val = val.trim();
          title = val;
        }
        // Auto fill checkboxes
        switch (val) {
          case CONFIG.WWN.tags.melee:
            newData.melee = true;
            break;
          case CONFIG.WWN.tags.slow:
            newData.slow = true;
            break;
          case CONFIG.WWN.tags.missile:
            newData.missile = true;
            break;
        }
        update.push({ title: title, value: val });
      });
    } else {
      update = values;
    }
    newData.tags = update;
    return this.update({ system: newData });
  }

  popTag(value) {
    const data = this.system;
    let update = data.tags.filter((el) => el.value != value);
    let newData = {
      tags: update,
    };
    return this.update({ system: newData });
  }

  roll() {
    switch (this.type) {
      case "weapon":
        this.rollWeapon();
        break;
      case "spell":
        this.spendSpell();
        break;
      case "art":
        this.spendArt();
        break;
      case "item":
      case "armor":
      case "focus":
      case "ability":
        this.show();
        break;
      case "skill":
        this.rollSkill();
        break;
      case "asset":
        this.rollAsset();
        break;
    }
  }

  /**
   * Show the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async show() {
    // Basic template rendering data
    const token = this.actor.token;
    const templateData = {
      actor: this.actor,
      tokenId: token ? `${token.parent.id}.${token.id}` : null,
      item: foundry.utils.duplicate(this),
      data: this.getChatData(),
      labels: this.labels,
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      isSpell: this.type === "spell",
      hasSave: this.hasSave,
      config: CONFIG.WWN,
    };

    // Render the chat card template
    const template = `systems/wwn/templates/chat/item-card.html`;
    const html = await renderTemplate(template, templateData);

    // Basic chat message data
    const chatData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        actor: this.actor.id,
        token: this.actor.token,
        alias: this.actor.name,
      },
    };

    // Toggle default roll mode
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    // Create the chat message
    return ChatMessage.create(chatData);
  }

  /**
   * Handle toggling the visibility of chat card content when the name is clicked
   * @param {Event} event   The originating click event
   * @private
   */
  static _onChatCardToggleContent(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const card = header.closest(".chat-card");
    const content = card.querySelector(".card-content");
    if (content.style.display == "none") {
      $(content).slideDown(200);
    } else {
      $(content).slideUp(200);
    }
  }

  static async _onChatCardAction(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    button.disabled = true;
    const card = button.closest(".chat-card");
    const messageId = card.closest(".message").dataset.messageId;
    const message = game.messages.get(messageId);
    const action = button.dataset.action;

    // Validate permission to proceed with the roll
    const isTargetted = action === "save";
    if (!(isTargetted || game.user.isGM || message.isAuthor)) return;

    // Get the Actor from a synthetic Token
    const actor = this._getChatCardActor(card);
    if (!actor) return;

    // Get the Item
    const item = actor.items.get(card.dataset.itemId);
    if (!item) {
      return ui.notifications.error(
        `The requested item ${card.dataset.itemId} no longer exists on Actor ${actor.name}`
      );
    }

    // Get card targets
    let targets = [];
    if (isTargetted) {
      targets = this._getChatCardTargets(card);
    }
    // Attack and Damage Rolls
    if (action === "damage") await item.rollDamage({ event });
    else if (action === "formula") await item.rollFormula({ event });
    // Saving Throws for card targets
    else if (action === "save") {
      if (!targets.length) {
        ui.notifications.warn(
          `You must have one or more controlled Tokens in order to use this option.`
        );
        return (button.disabled = false);
      }
      for (let t of targets) {
        await t.rollSave(button.dataset.save, { event });
      }
    }

    // Re-enable the button
    button.disabled = false;
  }

  static _getChatCardActor(card) {
    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId);
      if (!scene) return null;
      const tokenData = scene.getEmbeddedDocument("Token", tokenId);
      if (!tokenData) return null;
      const token = new Token(tokenData);
      return token.actor;
    }

    // Case 2 - use Actor ID directory
    const actorId = card.dataset.actorId;
    return game.actors.get(actorId) || null;
  }

  static _getChatCardTargets(card) {
    const character = game.user.character;
    const controlled = canvas.tokens.controlled;
    const targets = controlled.reduce(
      (arr, t) => (t.actor ? arr.concat([t.actor]) : arr),
      []
    );
    if (character && controlled.length === 0) targets.push(character);
    return targets;
  }
}
