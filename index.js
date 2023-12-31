const mongoose = require('mongoose');
const Models = require('./Models/models');
const bodyParser = require('body-parser');
const express = require('express');
const morgan = require('morgan');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const { title } = require('process');
const { check, validationResult } = require('express-validator');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// require cors from all origins
const cors = require('cors');
app.use(cors());


// Restrict requests to specific origins
// let allowedOrigins = ['http://localhost:8080', 'http://testsite.com', '*'];

// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin) return callback(null, true);
//     if (allowedOrigins.indexOf(origin) === -1) {
//       let message = "The CORS policy for this application doesn't allow access from origin" + origin;
//       return callback(new Error(message), false);
//     }
//     return callback(null, true);
//   }
// }));

let auth = require('./auth.js')(app);

const passport = require('passport');
require('./passport');


const Movies = Models.Movie;
const Users = Models.User;

// mongoose.connect('mongodb+srv://johntest:1234@filmdb.kwgqh67.mongodb.net/test?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connect(process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true });


// Intro message
app.get('/', (req, res) => {
  res.send('Please enjoy the show!');
});

// Allow access to documentation.html
app.get('/documentation', (req, res) => {
  res.sendFile('public/documentation.html', { root: __dirname });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Creating GET route at endpoint "/movies" returning JSON object (Returns all movie objects)
app.get('/movies', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.find()
    .then((movies) => {
      res.status(200).json(movies);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err)
    });
});

// Creating GET route at endpoint "/movies/titles" returning JSON object (Returns all movie Titles)
app.get('/movies/titles', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.find()
    .then((movies) => {
      let movieTitles = []
      movies.forEach(function (movie) {
        movieTitles.push({ "Title": movie.Title })
      });
      res.status(200).json(movieTitles)
      // console.log(movies);
      // res.status(201).json(movies);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// Creating GET route at endpoint "/users" returning JSON object (Returns all users)
app.get('/users', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.find()
    .then((users) => {
      res.status(201).json(users);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// Creating GET that returns movies by title (READ)
app.get('/movies/:Title', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ Title: req.params.Title })
    .then((movie) => {
      res.json(movie);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// Creating GET that returns the Genre by name(READ)
app.get('/movies/genres/:genreName', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ 'Genre.Name': req.params.genreName })
    .then((movie) => {
      res.status(200).json(movie.Genre);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// Creating GET that returns data from Director by name(READ)
app.get('/movies/directors/:directorName', passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ 'Director.Name': req.params.directorName })
    .then((movie) => {
      res.json(movie.Director);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// Creating GET that returns data from a specific user (READ)
app.get('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOne({ Username: req.params.Username })
    .then((user) => {
      res.json(user);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

// Allow new users to Register (CREATE)
app.post('/users',
  [
    check('Username', 'Username is required').isLength({ min: 5 }),
    check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
    check('Password', 'Password is required').not().isEmpty(),
    check('Email', 'Email does not appear to be valid').isEmail(),
  ], (req, res) => {

    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    let hashedPassword = Users.hashPassword(req.body.Password);
    Users.findOne({ Username: req.body.Username })
      .then((user) => {
        if (user) {
          return res.status(400).send(req.body.Username + 'already exists');
        } else {
          Users
            .create({
              Username: req.body.Username,
              Password: hashedPassword,
              Email: req.body.Email,
              Birthday: req.body.Birthday,
              FavoriteMovies: [],
            })
            .then((user) => {
              res.status(201).json({
                message: `${req.body.Username} has been added successfully`, user,
              });
            })
            .catch((error) => {
              console.error(error);
              res.status(500).send('Error: ' + error);
            });
        }
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send('Error: ' + error);
      });
  });


// Allow users to update user info(username) (UPDATE)
app.put('/users/:Username',
  [
    check('Username', 'Username is required').isLength({ min: 5 }),
    check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  ],

  passport.authenticate('jwt', { session: false }), async function (req, res) {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let updatedUser;
    try {
      let hashedPassword = Users.hashPassword(req.body.Password);
      updatedUser = await Users.findOneAndUpdate(
        {
          Username: req.params.Username
        }, {
        $set: {
          Username: req.body.Username,
          Password: hashedPassword,
          Email: req.body.Email,
          Birthday: req.body.Birthday
        }
      },
        {
          new: true
        });
    }
    catch (err) {
      console.error(err);
      return res.status(500).send('Error: ' + err);
    }
    return res.json(updatedUser);
  })


// Allow users to add movies to ther favorites list and send text of confirmations as added (CREATE)
app.get('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOne({ Username: req.params.Username })
    .then(user => {
      if (!user) {
        return res.status(404).send('User not found.');
      }

      const movieID = req.params.MovieID;
      const isMovieAlreadyFavorited = user.FavoriteMovies.includes(movieID);

      if (isMovieAlreadyFavorited) {
        return res.status(409).send('Movie already exists in favorites.');
      }

      Users.findOneAndUpdate(
        { Username: req.params.Username },
        { $push: { FavoriteMovies: movieID } },
        { new: true }
      )
        .then(updatedUser => {
          res.json(updatedUser);
        })
        .catch(err => {
          console.error(err);
          res.status(500).send('Error: ' + err);
        });
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});



// Allow users to remove a movie from the favorites list (DELETE)
app.delete('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndUpdate(
    { Username: req.params.Username },
    { $pull: { FavoriteMovies: req.params.MovieID } },
    { new: true }
  )
    .then(updatedUser => {
      res.json(updatedUser);
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});


//Allow users to delete the registration
app.delete('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndRemove({ Username: req.params.Username })
    .then((user) => {
      if (!user) {
        res.status(400).send(req.params.Username + ' was not found');
      } else {
        res.status(200).send(req.params.Username + ' was deleted.');
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});


// This Serves the statics files in the "public" folder
app.use(express.static('public'));

// Creating a write stream (in append mode) to the log file
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'log.txt'), { flags: 'a' })

// Log all requests using Morgan
app.use(morgan('combined', { stream: accessLogStream }));

// Creating error-handling that log all errors to terminal
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Opes, something went wrong!');
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log('Listening on Port ' + port);
});


