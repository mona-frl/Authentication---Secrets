require("dotenv").config()
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const ejs = require('ejs');
const _ = require('lodash');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');


app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.set('strictQuery', false);
mongoose.connect(`mongodb+srv://${process.env.LOGIN}:${process.env.PASSWORD}@cluster0.vicar3r.mongodb.net/userDB`);
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: [{ type: String }]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'https://secrets-dqp0.onrender.com/auth/google/secrets',
    passReqToCallback: true
},
    function (request, accessToken, refreshToken, profile, done) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return done(err, user);
        });
    }
));

passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: 'https:secrets-dpq0.onrender.com/auth/facebook/secrets'
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ facebookId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get('/', (req, res) => {
    res.render('home')
});

app.get('/auth/google',
    passport.authenticate('google',
        { scope: ['email', 'profile'] }
    ));

app.get('/auth/facebook',
    passport.authenticate('facebook',
        { scope: ['public_profile'] }
    ));

app.get('/auth/google/secrets',
    passport.authenticate('google', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
    }));

app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
    }));

app.get('/secrets', (req, res) => {
    User.find({ "secret": { $ne: null } }, (err, user) => {
        if (!err) {
            if (user) {
                res.render('secrets', { usersWithSecrets: user })
            }
        } else {
            console.log(err)
        }
    })
})

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error(err);
        } else {
            res.redirect('/')
        }
    })
});

app.route('/login')
    .get((req, res) => {
        res.render('login')
    })
    .post(passport.authenticate("local"), (req, res) => {
        const user = new User({
            username: req.body.username,
            password: req.body.password
        });
        req.login(user, function (err) {
            if (err) {
                console.log(err);
                res.redirect('/login')
            } else {
                res.redirect('/secrets');
            }
        });
    });

app.route('/register')
    .get((req, res) => {
        res.render('register')
    })
    .post((req, res) => {
        User.register({ username: req.body.username }, req.body.password, (err, user) => {
            if (!err) {
                passport.authenticate('local')(req, res, () => {
                    res.redirect('/secrets');
                })
            } else {
                console.log(err);
                res.redirect('/register');
            }
        })
    });

app.route('/submit')
    .get((req, res) => {
        if (req.isAuthenticated()) {
            res.render('submit');
        } else {
            res.redirect('/login');
        }
    })
    .post((req, res) => {
        const submittedSecret = req.body.secret;
        User.findById(req.user._id,  (err, foundUser) => {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    foundUser.secret.push(submittedSecret);
                    foundUser.save(() => {
                        res.redirect('/secrets');
                    });
                }
            }
        });
    });

app.listen(port, function () {
    console.log('Listening to the port ' + port);
});
