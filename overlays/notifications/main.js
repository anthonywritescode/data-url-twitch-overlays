(async () => {
  let oV = window.o.value.split(':')[1];
  let cV = window.c.value;

  let opts = {
    headers: {
      'Authorization': `Bearer ${oV}`,
      //'Client-Id': 'q6batx0epp608isickayubi39itsckt',
    }
  };
  //let userResp = await fetch(`https://api.twitch.tv/helix/users?login=${cV}`, opts);
  //let channelId = (await userResp.json()).data[0].id;

  console.log(await (await fetch('https://id.twitch.tv/oauth2/validate', opts)).json());
  return

  let g = () => {
    let s = new WebSocket('wss://pubsub-edge.twitch.tv');
    let pingInterval = null;
    let pingClose = null;

    let close = () => {
      s.close();
      clearInterval(pingInterval);
      clearTimeout(pingClose);
      setTimeout(g, 100);
    };

    let ping = () => {
      pingClose = setTimeout(close, 1000 * 10);
      s.send(JSON.stringify({'type': 'PING'}));
    };

    s.addEventListener('close', close);
    s.addEventListener('error', close);
    s.addEventListener('open', () => {
      pingInterval = setInterval(ping, 1000 * 4 * 60);
      s.send(JSON.stringify({
        type: 'LISTEN',
        data: {
          topics: [`channel-bits-events-v2.${channelId}`],
          auth_token: oV,
        }
      }));
    });
    s.addEventListener('message', (e) => {
      let msg = JSON.parse(e.data);
      if (msg.type === 'PONG') {
        clearInterval(pingClose);
      } else if (msg.type == 'RECONNECT') {
        close();
      }
      console.log('messaged!');
      console.log(e.data);
    });
  };
  g();
})();
