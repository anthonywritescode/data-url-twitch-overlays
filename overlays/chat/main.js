(async () => {
  let messages = document.createElement('div')
  messages.id = 'messages';
  document.body.appendChild(messages);

  let reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let parseInfo = (infoS) => {
    let info = {};
    for (let part of infoS.split(';')) {
      let [k, ...v] = part.split('=');
      info[k] = v.join('=');
    }
    return info;
  };

  let ME_PREFIX = '\x01ACTION ';

  let uV = document.getElementById('u').value;
  let oV = "oauth:" + document.getElementById('o').value;
  let cV = document.getElementById('c').value;

  let badgeUrls = {};
  let updateBadges = (j) => {
    for (let v of j.data) {
      for (let dct of v.versions) {
        badgeUrls[`${v.set_id}/${dct.id}`] = dct.image_url_2x;
      }
    }
  };

  let opts = {
    headers: {
      'Authorization': `Bearer ${oV.split(':')[1]}`,
      'Client-Id': 'gp762nuuoqcoxypju8c569th9wz7q5',
    }
  };
  let globalResp = await fetch('https://api.twitch.tv/helix/chat/badges/global', opts);
  updateBadges(await globalResp.json());
  let userResp = await fetch(`https://api.twitch.tv/helix/users?login=${cV}`, opts);
  let userId = (await userResp.json()).data[0].id;
  let perChannelResp = await fetch(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${userId}`, opts);
  updateBadges(await perChannelResp.json());

  let bttv = {};
  let updateBttv = (j) => {
    for (let emote of j) {
      bttv[emote.code] = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
    }
  };

  let bttvGlobalResp = await fetch('https://api.betterttv.net/3/cached/emotes/global');
  updateBttv(await bttvGlobalResp.json());
  let bttvUserResp = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${userId}`);
  let bttvUserJson = await bttvUserResp.json();
  updateBttv(bttvUserJson.channelEmotes);
  updateBttv(bttvUserJson.sharedEmotes);
  let bttvRegex = new RegExp(`(?:^|(?<=\\s))(${Object.keys(bttv).map(reEscape).join('|')})(?:$|(?=\\s))`, 'g');

  let cheers = {};
  let cheerResp = await fetch(`https://api.twitch.tv/helix/bits/cheermotes?broadcaster_id=${userId}`, opts);
  for (let dct of (await cheerResp.json()).data) {
    let cheerInfo = {prefix: dct.prefix.toLowerCase(), tiers: []};
    for (let tier of dct.tiers) {
      if (cheerInfo.prefix !== 'anon' && !tier.can_cheer) {
        continue;
      }

      cheerInfo.tiers.push({
        minBits: tier.min_bits,
        color: tier.color,
        image: tier.images.dark.animated['2'],
      });
    }
    if (cheerInfo.tiers) {
      cheerInfo.tiers.reverse();
      cheers[cheerInfo.prefix] = cheerInfo;
    }
  }
  let cheerRegex = new RegExp(`(?:^|(?<=\\s))(${Object.keys(cheers).join('|')})(\\d+)(?:$|(?=\\s))`, 'ig');

  let g = () => {
    let s = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    s.addEventListener('close', () => setTimeout(g, 100));
    s.addEventListener('error', () => setTimeout(g, 100));
    s.addEventListener('open', () => {
      s.send('CAP REQ :twitch.tv/commands twitch.tv/tags');
      s.send(`PASS ${oV}`);
      s.send(`NICK ${uV}`);
      s.send(`JOIN #${cV}`);
    });
    s.addEventListener('message', async (e) => {
      if (e.data.startsWith('PING ')) {
        s.send(`PONG ${e.data.slice(5, e.data.length - 2)}`);
      }
      let clearMsg = /^@([^ ]+) :[^!]+.* CLEARMSG #[^ ]+ :.+\r\n$/.exec(e.data);
      if (clearMsg) {
        let [, infoS] = clearMsg;

        let info = parseInfo(infoS);
        for (let el of document.querySelectorAll(`.msg-${info['target-msg-id']}`)) {
          el.parentNode.removeChild(el);
        }
      }

      let clearChat = /^@([^ ]+) :[^!]+.* CLEARCHAT #[^ ]+ :.+\r\n$/.exec(e.data);
      if (clearChat) {
        let [, infoS] = clearChat;

        let info = parseInfo(infoS);
        for (let el of document.querySelectorAll(`.user-${info['target-user-id']}`)) {
          el.parentNode.removeChild(el);
        }
      }

      let chat = /^@([^ ]+) :[^!]+.* PRIVMSG #[^ ]+ :(.+)\r\n$/.exec(e.data);
      if (chat) {
        let [, infoS, s] = chat;

        let info = parseInfo(infoS);

        let isMe = s.startsWith(ME_PREFIX);
        if (isMe) {
          s = s.slice(ME_PREFIX.length, -1);
        }

        let color;
        if (info['color']) {
          color = info['color'];
        } else {
          let hash = info['display-name'].split('').reduce((a, b) => (a<<5)-a+b.charCodeAt(0), 0);
          let bit = (n) => (hash & (0b1 << n)) >> n;
          let r = bit(0) * 0b1111111 + (bit(1) << 7);
          let g = bit(2) * 0b1111111 + (bit(3) << 7);
          let b = bit(4) * 0b1111111 + (bit(5) << 7);
          let hex = (i) => i.toString(16).padStart(2, '0');
          color = `#${hex(r)}${hex(g)}${hex(b)}`;
        }

        let emotes = [];
        if (info.emotes) {
          for (let part of info.emotes.split('/')) {
            let [emote, positions] = part.split(':');
            for (let pos of positions.split(',')) {
              let [start, end] = pos.split('-');
              emotes.push([parseInt(start, 10), parseInt(end, 10), emote, false]);
            }
          }
        }
        emotes.sort((a, b) => a[0] - b[0]);
        if (info['msg-id'] === 'gigantified-emote-message') {
            emotes[emotes.length - 1][3] = true;
        }

        let msg = document.createElement('div')
        msg.classList.add('message', `msg-${info.id}`, `user-${info['user-id']}`);

        if (info.badges) {
          for (let badge of info.badges.split(',')) {
            let img = document.createElement('img');
            img.classList.add('badge');
            img.src = badgeUrls[badge];
            msg.appendChild(img);
          }
        }

        if (isMe) {
          msg.style.color = color;
          msg.style.fontStyle = 'italic';
          msg.appendChild(document.createTextNode(' * '));
        }

        let user = document.createElement('span');
        user.classList.add('usr')
        user.style.color = color;
        user.innerText = info['display-name'];
        msg.appendChild(user);

        msg.append(document.createTextNode(' '));

        let msgText = document.createElement('span');
        if (info['msg-id'] === 'highlighted-message') {
          msgText.style.background = '#755ebc';
        } else if (info['custom-reward-id']) {
          msgText.style.background = '#1d5b82';
        }

        let doBttv = (s) => {
          let pos = 0;
          for (let match of s.matchAll(bttvRegex)) {
              msgText.append(document.createTextNode(s.slice(pos, match.index)));

              let emote = document.createElement('img');
              emote.classList.add('emote');
              emote.src = bttv[match[1]]
              msgText.appendChild(emote);

              pos = match.index + match[0].length;
          }
          msgText.appendChild(document.createTextNode(s.slice(pos)));
        };

        let doCheers = (s) => {
          if (!info.bits) {
            doBttv(s);
          } else {
            let pos = 0;
            for (let match of s.matchAll(cheerRegex)) {
              doBttv(s.slice(pos, match.index));

              let n = parseInt(match[2], 10);
              let tier = cheers[match[1].toLowerCase()].tiers.find((tier) => n >= tier.minBits);

              let emote = document.createElement('img');
              emote.classList.add('emote')
              emote.src = tier.image;
              msgText.appendChild(emote);

              let cheer = document.createElement('span');
              cheer.classList.add('cheer');
              cheer.style.color = tier.color;
              cheer.innerText = match[2];
              msgText.appendChild(cheer);

              pos = match.index + match[0].length;
            }
            doBttv(s.slice(pos));
          }
        }

        let pos = 0;
        for (let [start, end, emote, big] of emotes) {
          doCheers([...s].slice(pos, start).join(''));

          if (big) {
            msgText.appendChild(document.createElement('br'));
          }

          let emoteImg = document.createElement('img');
          emoteImg.classList.add('emote');
          if (big) {
            emoteImg.classList.add('emote-big');
          }
          emoteImg.src = `https://static-cdn.jtvnw.net/emoticons/v2/${emote}/default/dark/3.0`;
          msgText.appendChild(emoteImg);

          pos = end + 1;
        }
        doCheers([...s].slice(pos).join(''));

        msg.append(msgText);

        messages.appendChild(msg);

        let lastChild = messages.children[0];
        if (lastChild.getBoundingClientRect().bottom < 0) {
          messages.removeChild(lastChild);
        }
      }
    });
  }
  g();
})();
