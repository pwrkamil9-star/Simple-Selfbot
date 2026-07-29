"use strict";

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../conn');
const setting = require('../config.json');

function createMessage(remoteJid, text, options = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const isExtended = Boolean(options.mentionedJid);

  return {
    key: {
      remoteJid,
      fromMe: true,
      ...(options.participant ? { participant: options.participant } : {})
    },
    message: isExtended ? {
      extendedTextMessage: {
        text,
        contextInfo: { mentionedJid: options.mentionedJid }
      }
    } : {
      conversation: text
    },
    type: isExtended ? 'extendedTextMessage' : 'conversation',
    quotedMsg: null,
    mentioned: options.mentionedJid || [],
    now: timestamp,
    fromMe: true,
    sender: options.sender,
    pushName: 'Owner',
    messageTimestamp: timestamp,
    expiration: 0
  };
}

function createConnection(sent, groupMetadata) {
  const ownerNumber = String(setting.ownerNumber).replace(/\D/g, '');

  return {
    user: { id: `${ownerNumber}:1@s.whatsapp.net` },
    contacts: {},
    decodeJid: jid => String(jid || '').replace(/:\d+@/, '@'),
    async groupMetadata() {
      return groupMetadata || {};
    },
    async sendMessage(jid, content, options = {}) {
      sent.push({ jid, content, options });
      return { key: { remoteJid: jid, fromMe: true, id: `SENT-${sent.length}` } };
    }
  };
}

test('reply creates a fake quote from the current personal-chat contact', async t => {
  t.mock.method(console, 'log', () => {});
  const ownerJid = `${String(setting.ownerNumber).replace(/\D/g, '')}@s.whatsapp.net`;
  const contactJid = '628111111111@s.whatsapp.net';
  const sent = [];
  const conn = createConnection(sent);
  const message = createMessage(
    contactJid,
    `${setting.prefix}reply Pesan dari target|Balasan dari bot`,
    { sender: ownerJid }
  );

  await handler(conn, message, {}, setting, {});

  assert.equal(sent.length, 1);
  assert.equal(sent[0].jid, contactJid);
  assert.equal(sent[0].content.text, 'Balasan dari bot');
  assert.deepEqual(sent[0].content.mentions, [contactJid]);
  assert.deepEqual(sent[0].options.quoted.key, {
    fromMe: false,
    remoteJid: contactJid
  });
  assert.deepEqual(sent[0].options.quoted.message, {
    conversation: 'Pesan dari target'
  });
});

test('reply keeps the tagged participant when used in a group', async t => {
  t.mock.method(console, 'log', () => {});
  const ownerJid = `${String(setting.ownerNumber).replace(/\D/g, '')}@s.whatsapp.net`;
  const targetJid = '628222222222@s.whatsapp.net';
  const groupJid = '120363000000000000@g.us';
  const sent = [];
  const conn = createConnection(sent, {
    id: groupJid,
    subject: 'Test Group',
    participants: [
      { id: ownerJid, admin: 'admin' },
      { id: targetJid }
    ]
  });
  const message = createMessage(
    groupJid,
    `${setting.prefix}reply @628222222222|Pesan dari target|Balasan dari bot`,
    {
      mentionedJid: [targetJid],
      participant: ownerJid,
      sender: ownerJid
    }
  );

  await handler(conn, message, {}, setting, {});

  assert.equal(sent.length, 1);
  assert.equal(sent[0].jid, groupJid);
  assert.equal(sent[0].content.text, 'Balasan dari bot');
  assert.deepEqual(sent[0].options.quoted.key, {
    fromMe: false,
    participant: targetJid,
    remoteJid: groupJid
  });
  assert.deepEqual(sent[0].options.quoted.message, {
    conversation: 'Pesan dari target'
  });
});
