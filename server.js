let publicKey, prevCounter;

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
    const { firstName, password, lastName, phone, visitorType } = req.body;
    const { results } = await query('INSERT INTO USERS(name, password, phone, visitorType) VALUES(?, ?, ?, ?)', [
      firstName + ' ' + lastName,
      password,
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

app.post('/api/login-user', async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { results } = await query('SELECT * FROM USERS WHERE phone = ? AND password = ?', [phone, password]);

    console.log(results)
    if (results.length === 0) {
      return res.status(401).send({message:"Password or Username is wrong"});
    }

    // Store user details in the session
    req.session.id = results[0].id;
    req.session.name = results[0].name;
    req.session.publicKey = results[0].publicKey;
    req.session.raw_id = results[0].raw_id;

    console.log({ name: results[0].name, publicKey: results[0].publicKey, raw_id: results[0].raw_id });
    res.send({ name: results[0].name, publicKey: results[0].publicKey, raw_id: results[0].raw_id });
  } catch (err) {
  console.log(err)
    res.status(500).send(err);
  }
});

// Get registration options when user registers new credential
app.get('/api/registration-options', async (req, res) => {
  // Get default registration options
  const registrationOptions = await f2l.attestationOptions();

  // put challenge into session
  // challenge: cryptographically random bytes to prevent "replay attacks"
  // replay attack: when malicious actor sniffs valid even encrypted data and then replays it
  //    example: alice connects to bob, bob asks for proof of identity alice sends her hashed
  //      password during this exchange Eve is listening, she then asks to connect to Bob posing as alice
  //      when bob asks for proof of identity Eve replays the hash she heard from alice.
  req.session.challenge = Buffer.from(registrationOptions.challenge);

  registrationOptions.user.id = Buffer.from(req.session.id || '');
  // convert challenge into buffer
  registrationOptions.challenge = Buffer.from(registrationOptions.challenge);

  // iOS, what's supposed to trigger faceID but didn't work for me
  // registrationOptions.authenticatorSelection = {authenticatorAttachment: 'platform'};

  res.json(registrationOptions);
});

// Get authentication options when user authenticates with a credential
app.get('/api/authentication-options', async (req, res) => {
  // get default assertion options
  const authnOptions = await f2l.assertionOptions();

  // store challenge in session
  req.session.challenge = Buffer.from(authnOptions.challenge);
  // convert challenge to buffer
  authnOptions.challenge = Buffer.from(authnOptions.challenge);

  res.json(authnOptions);
})

// Post: regiser a new credential
app.post('/api/register', async (req, res) => {
  const {credential} = req.body;
  const rawId = credential.rawId;

  // Get challenge from session
  const challenge = new Uint8Array(req.session.challenge.data).buffer;
  credential.rawId = new Uint8Array(Buffer.from(credential.rawId, 'base64')).buffer;
  // Decode from base 64
  credential.response.attestationObject = base64url.decode(credential.response.attestationObject, 'base64');
  credential.response.clientDataJSON = base64url.decode(credential.response.clientDataJSON, 'base64');

  const attestationExpectations = {
    challenge,
    origin: 'http://localhost:5000',
    // first, second or either. Documentation: https://webauthn-open-source.github.io/fido2-lib/Fido2Lib.html#attestationResult
    // first: user verification ie. biometric, pin auth etc, second: user presence ie. user pressed button, either: either
    factor: 'either'
  };

  try {
    // get result of comparison between credential and expectations, if expectations not met this will throw an error
    const regResult = await f2l.attestationResult(credential, attestationExpectations);

    publicKey = regResult.authnrData.get('credentialPublicKeyPem');

    // Store new credentials in session
    req.session.raw_id = rawId;
    req.session.publicKey = publicKey;
    // prevCounter = regResult.authnrData.get('counter');

    // Store new credentials in db
    await query('UPDATE USERS SET publicKey = ?, raw_id = ? WHERE id = ?', [publicKey, rawId, req.session.id]);

    res.json({status: 'ok', raw_id: rawId, publicKey});
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

  const {publicKey, raw_id} = req.session;

  if(publicKey === 'undefined' || raw_id === undefined) {
    res.status(401).json({status: 'non authorized'});
  }
  else {
    const assertionExpectations = {
      challenge,
      origin: 'http://localhost:5000',
      factor: 'either',
      publicKey,
      // these 2 seem to make no difference, but errors get thrown if they are not present
      prevCounter: 0,
      userHandle: new Uint8Array(Buffer.from(req.session.user || '', 'base64')).buffer
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

app.put('/api/delete-credential', async (req, res) => {
  try {
    query('UPDATE USERS set raw_id = "", publicKey = "" WHERE id = ?', [req.session.id]);

    res.json({status: 'ok'});
  }
  catch(e) {
    console.log('error', e);
    res.status(500).json({status: 'failed'});
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
