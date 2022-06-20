(async () => {
  let ds = [['r'], ['r', 'd'], ['d'], ['d', 'l'], ['l'], ['l', 'u'], ['u'], ['u', 'r']];
  let uV = window.u.value;
  let oV = window.o.value;
  let cV = window.c.value;

  let reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let parseInfo = (infoS) => {
    let info = {};
    for (let part of infoS.split(';')) {
      let [k, ...v] = part.split('=');
      info[k] = v.join('=');
    }
    return info;
  };

  let opts = {
    headers: {
      'Authorization': `Bearer ${oV.split(':')[1]}`,
      'Client-Id': 'q6batx0epp608isickayubi39itsckt',
    }
  };
  let userResp = await fetch(`https://api.twitch.tv/helix/users?login=${cV}`, opts);
  let userId = (await userResp.json()).data[0].id;

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

  let g = () => {
    let s = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    s.addEventListener('close', () => setTimeout(g, 100));
    s.addEventListener('error', () => setTimeout(g, 100));
    s.addEventListener('open', () => {
      s.send('CAP REQ :twitch.tv/tags');
      s.send(`PASS ${oV}`);
      s.send(`NICK ${uV}`);
      s.send(`JOIN #${cV}`);
    });
    s.addEventListener('message', (e) => {
      if (e.data.startsWith('PING ')) {
        s.send(`PONG ${e.data.slice(5, e.data.length - 2)}`);
      }

      let chat = /^@([^ ]+) :[^!]+.* PRIVMSG #[^ ]+ :(.+)\r\n$/.exec(e.data);
      if (chat) {
        let [, infoS, s] = chat;

        let info = parseInfo(infoS);

        let imgs = [];

        if (info.emotes) {
          for (let emote of info.emotes.split('/')) {
            let p = emote.split(':')
            let n = p[1].split(',').length;
            for (let i = 0; i < n; i += 1) {
              imgs.push(`https://static-cdn.jtvnw.net/emoticons/v2/${p[0]}/default/dark/2.0`);
            }
          }
        }

        for (let match of s.matchAll(bttvRegex)) {
          imgs.push(bttv[match[1]]);
        }

        for (let img of imgs) {
          let c = document.createElement('div');
          c.classList.add('c')
          c.style.top = `${20 + Math.random() * 60}vh`
          c.style.left = `${20 + Math.random() * 60}vw`
          let im = document.createElement('img');
          im.src = img;
          let cls = ds[Math.floor(Math.random() * ds.length)]
          setTimeout(() => im.classList.add('a', ...cls), 100);
          setTimeout(() => document.body.removeChild(c), 4100);
          c.appendChild(im);
          document.body.appendChild(c);
        }
      }
    });
  }
  g();
})();
