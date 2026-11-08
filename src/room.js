import { joinRoom, selfId } from 'trystero';

/* Kleine Raum-Schicht für den Mehrspieler: Anwesenheit (presence) pro Spieler plus Ereignisse (fx).
   Läuft direkt zwischen den Browsern (WebRTC), Trystero vermittelt die Verbindung über öffentliche Nostr-Relays. */
const APP_ID = 'kurvenjaeger-v1';
const MOVE_KEYS = new Set(['x', 'z', 'a', 'y', 's', 'st', 'p', 'f', 'fl']);

export async function joinRoomP2P(name) {
  const room = joinRoom({ appId: APP_ID }, name);
  const presAct = room.makeAction('pres'), fxAct = room.makeAction('fx');
  const me = {}, others = new Map();
  const peerCbs = new Set(), fxCbs = new Set();
  const notify = () => peerCbs.forEach(cb => { try { cb(); } catch (e) {} });

  room.onPeerJoin = id => { others.set(id, {}); presAct.send(Object.assign({}, me), { target: id }); notify(); };
  room.onPeerLeave = id => { others.delete(id); notify(); };
  presAct.onMessage = (d, { peerId }) => {
    const o = others.get(peerId) || {}; others.set(peerId, o);
    Object.assign(o, d);
    /* Positionspakete nicht jedes Mal als Lobby-Änderung melden */
    if (Object.keys(d).some(k => !MOVE_KEYS.has(k))) notify();
  };
  fxAct.onMessage = d => fxCbs.forEach(cb => { try { cb({ data: d, isMe: false }); } catch (e) {} });

  return {
    peers: () => [{ peer: selfId, kind: 'viewer', isMe: true, sameTab: true, presence: me }]
      .concat([...others].map(([peer, presence]) => ({ peer, kind: 'viewer', isMe: false, sameTab: false, presence }))),
    presence: d => { Object.assign(me, d); presAct.send(d); return Promise.resolve(); },
    emit: (type, d) => { fxAct.send(d); return Promise.resolve(); },
    onPeers: cb => { peerCbs.add(cb); return () => peerCbs.delete(cb); },
    on: (type, cb) => { fxCbs.add(cb); return () => fxCbs.delete(cb); },
    leave: () => { room.leave(); return Promise.resolve(); }
  };
}
