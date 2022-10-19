const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const mysql = require('mysql');
dotenv.config();
var pool  = mysql.createPool({
  connectionLimit: process.env.DB_MAX_CON,
  host           : process.env.DB_HOST,
  user           : process.env.DB_USER,
  password       : process.env.DB_PSWD,
  database       : process.env.DB_NAME,
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

app.get('/api/data', async (_, res) => {
  try {
    const { results } = await query('SELECT * FROM BOOKS');
    // const { results } = await query('SELECT * FROM BOOKS WHERE id = ?', [1]);
    console.log(results)
    res.send(results.map((a) => ({ id: a.id, data: [ a.sales, a.title, a.author, a.price ]})));
  } catch (err) {
    res.status(500).send(err);
  }
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
    console.log(results)
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

const query = (query, extra) => (new Promise((resolve, reject) => {
  pool.query(query, extra, function (error, results, fields) {
    if (error) return reject(error);
    return resolve({ results, fields });
  });
}));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
