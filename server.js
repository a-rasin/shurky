const express = require('express');
const crypto = require('crypto');
const session = require('express-session');
const dotenv = require('dotenv');
const mysql = require('mysql');
const base64url = require('base64url');
const { Fido2Lib } = require("fido2-lib");
dotenv.config();
var pool  = mysql.createPool({
  connectionLimit: process.env.DB_MAX_CON,
  host           : process.env.DB_HOST,
  user           : process.env.DB_USER,
  password       : process.env.DB_PSWD,
  database       : process.env.DB_NAME,
});

const f2l = new Fido2Lib({
    challengeSize: 128,
    attestation: "none",
    cryptoParams: [-7, -257],
    authenticatorAttachment: "platform",
    authenticatorRequireResidentKey: false,
    authenticatorUserVerification: "required"
});

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: 'foo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "lax"
  }
}));

const port = process.env.PORT || 5000;

app.use(express.static('./public'));

app.set('view engine', 'ejs');

app.get('/template', async (_, res) => {
  let { results } = await query('SELECT * FROM BOOKS');
  results = results.map((a) => ({ id: a.id, data: [ a.sales, a.title, a.author, a.price ]}));

  res.render('template', {foo: 'BAR', data: JSON.stringify(results)});
});

app.get('/protected', async (req, res) => {
  // You could easily swap this fixed string with a result from the db.
  if (req.session.user !== 'admin') {
    return res.redirect('/');
  }

  res.render('protected');
});

app.get('/paste-img', async (req, res) => {
  res.render('paste-img');
});

app.get('/api/data', async (_, res) => {
  try {
    const { results } = await query('SELECT * FROM BOOKS');
    // const { results } = await query('SELECT * FROM BOOKS WHERE id = ?', [1]);
    res.send(results.map((a) => ({ id: a.id, data: [ a.sales, a.title, a.author, a.price ]})));
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/photo', async (req, res) => {
  // Do something
  console.log(req.body.photo)
});

app.post('/api/login', async (req, res) => {
  try {
    const user = req.body.user;

    req.session.user = user;

    res.send({ success: true });
  } catch (err) {
  console.log(err)
    res.status(500).send(err);
  }
});

app.get('/api/user-types', async (req, res) => {
  try {
    const { results } = await query('SELECT * FROM USER_TYPES');
    res.send({ data: results });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/api/phone-lookup/:phone', async (req, res) => {
  try {
    const { results } = await query('SELECT * FROM USERS WHERE PHONE = ?', [req.params.phone]);
    res.send({ exists: results.length > 0, ...results[0] });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/create-user/', async (req, res) => {
  try {
    const { firstName, lastName, phone, visitorType } = req.body;
    const { results } = await query('INSERT INTO USERS(name, phone, visitorType) VALUES(?, ?, ?)', [
      firstName + ' ' + lastName,
      phone,
      visitorType
    ]);
    console.log(results)
    res.send({ success: true });
  } catch (err) {
    console.log(err)
    res.status(500).send(err);
  }
});

app.get('/api/registration-options', async (req, res) => {
  const registrationOptions = await f2l.attestationOptions();

  req.session.challenge = Buffer.from(registrationOptions.challenge);
  req.session.userHandle = crypto.randomBytes(32);

  registrationOptions.user.id = req.session.userHandle;
  registrationOptions.challenge = Buffer.from(registrationOptions.challenge);

  // iOS
  // registrationOptions.authenticatorSelection = {authenticatorAttachment: 'platform'};

  res.json(registrationOptions);
});

app.get('/api/authentication-options', async (req, res) => {
  const authnOptions = await f2l.assertionOptions();

  req.session.challenge = Buffer.from(authnOptions.challenge);
  authnOptions.challenge = Buffer.from(authnOptions.challenge);

  res.json(authnOptions);
})

app.post('/api/register', async (req, res) => {
  const {credential} = req.body;

  const challenge = new Uint8Array(req.session.challenge.data).buffer;
  credential.rawId = new Uint8Array(Buffer.from(credential.rawId, 'base64')).buffer;
  credential.response.attestationObject = base64url.decode(credential.response.attestationObject, 'base64');
  credential.response.clientDataJSON = base64url.decode(credential.response.clientDataJSON, 'base64');

  const attestationExpectations = {
    challenge,
    origin: 'http://localhost:5000',
    factor: 'either'
  };

  try {
    const regResult = await f2l.attestationResult(credential, attestationExpectations);

    req.session.publicKey = regResult.authnrData.get('credentialPublicKeyPem');
    req.session.prevCounter = regResult.authnrData.get('counter');

    res.json({status: 'ok'});
  }
  catch(e) {
    console.log('error', e);
    res.status(500).json({status: 'failed'});
  }
});

app.post('/api/authenticate', async (req, res) => {
  const {credential} = req.body;

  credential.rawId = new Uint8Array(Buffer.from(credential.rawId, 'base64')).buffer;

  const challenge = new Uint8Array(req.session.challenge.data).buffer;
  const {publicKey, prevCounter} = req.session;

  if(publicKey === 'undefined' || prevCounter === undefined) {
    res.status(401).json({status: 'non authorized'});
  }
  else {
    const assertionExpectations = {
      challenge,
      origin: 'http://localhost:5000',
      factor: 'either',
      publicKey,
      prevCounter,
      userHandle: new Uint8Array(Buffer.from(req.session.userHandle, 'base64')).buffer  //new Uint8Array(Buffer.from(req.session.userHandle.data)).buffer
    };

    try {
      await f2l.assertionResult(credential, assertionExpectations); // will throw on error

      res.json({status: 'ok'});
    }
    catch(e) {
      console.log('error', e);
      res.status(500).json({status: 'failed'});
    }
  }
});


const query = (query, extra) => (new Promise((resolve, reject) => {
  pool.query(query, extra, function (error, results, fields) {
    if (error) return reject(error);
    return resolve({ results, fields });
  });
}));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
