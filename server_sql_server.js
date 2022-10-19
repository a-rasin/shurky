const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
/*
 * https://www.npmjs.com/package/mssql#request
 * Here's some documentation on this module
 */
const sql = require('mssql')
dotenv.config();
const config = {
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PSWD,
  database : process.env.DB_NAME,
  pool     : {
    max: process.env.DB_MAX_CON
  }
};

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

const run = async () => {
  try {
    let pool = await sql.connect(config);
    app.use(express.static('./public'));

    app.set('view engine', 'ejs');

    app.get('/template', async (_, res) => {
      // backticks without parenthesis around them? what kind of function is this?
      // This is a new concept called tagged template literals introduced in ES6. You probably already know what template strings or string literals are.
      // They are a kind of string that's surrounded by `` instead of quotes. They make strings a bit easier because you can insert variables easier. `Test ${my_var}`
      // Well tagged template literals have a function right before the string called a tag function. This tag function processes the following string.
      // Usually a tag function looks something like this my_func(strings, ...values). Let's see an example:
      // const foo = 'dog';
      // const bar = 'huskey';
      // const baz = 'blue eyes';
      // my_func`My first ${foo} was a (${bar}) with ${baz}.`;
      // In this case strings and value would get the following values:
      // strings = [ 'My first ', ' was a (', ') with ', '.']
      // values = [ 'dog', 'huskey', 'blue eyes']
      // Strings is the original string split on each variable and values is the set of provided values.
      // my_func could now manipulate the string and then do something with it.
      // In our case pool.query sanitizes all values to provent sql injections and then runs the query.
      // const results = await pool.query`SELECT * FROM BOOKS WHERE id = ${some_var}`; // mssql automatically sanitizes input here so no need to worry about sql injections
      // Be carefull however if you surrounded the string with a parenthesis I don't think the sanitization would work.
      let results  = await pool.query`SELECT * FROM BOOKS`;
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
        const results = await pool.query`SELECT * FROM BOOKS`;
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

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.log(err);
  }
};

run();
